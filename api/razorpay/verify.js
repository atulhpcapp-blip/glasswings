// Glasswings — Razorpay: verify a SUBSCRIPTION checkout (fast path).
// Subscriptions return payment_id + subscription_id (no order id), and the
// signature is HMAC(payment_id|subscription_id). The previous version used
// order-based verification, which subscriptions can never pass.
// The webhook (api/razorpay/webhook.js) is the guaranteed path; this gives
// the member instant access when the checkout handler does fire.
// Replaces: api/razorpay/verify-sub.js
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RAZORPAY_KEY_SECRET
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); } });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const SECRET = process.env.RAZORPAY_KEY_SECRET;
  if (!SECRET) return res.status(500).json({ error: "Payments are not configured yet." });

  const body = (typeof req.body === "object" && req.body) ? req.body : await readBody(req);
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, access_token } = body;
  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature)
    return res.status(400).json({ error: "Missing payment details." });

  try {
    // subscription checkout signature = HMAC(payment_id|subscription_id)
    const expected = crypto.createHmac("sha256", SECRET)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`).digest("hex");
    if (expected !== razorpay_signature)
      return res.status(400).json({ error: "Payment could not be verified." });

    const { data: ures } = await sb.auth.getUser(access_token);
    const uid = ures?.user?.id;
    if (!uid) return res.status(401).json({ error: "Please log in again." });

    // idempotent: this charge already processed (e.g. webhook beat us to it)
    const { data: dupe } = await sb.from("payments").select("id, status")
      .eq("razorpay_payment_id", razorpay_payment_id).maybeSingle();
    if (dupe && dupe.status === "paid") return res.status(200).json({ ok: true });

    // find the pending payment created by /subscribe for this subscription
    const { data: pay } = await sb.from("payments").select("*")
      .eq("razorpay_subscription_id", razorpay_subscription_id)
      .eq("user_id", uid).eq("status", "created")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!pay) {
      // webhook may have already updated it — treat an existing paid row as success
      const { data: done } = await sb.from("payments").select("id")
        .eq("razorpay_subscription_id", razorpay_subscription_id)
        .eq("user_id", uid).eq("status", "paid").limit(1).maybeSingle();
      if (done) return res.status(200).json({ ok: true });
      return res.status(400).json({ error: "Order not found." });
    }

    const pm = Number(pay.plan_months) || 1;

    if (pay.purpose === "plan") {
      const { data: existing } = await sb.from("member_plans").select("id, expires_at")
        .eq("user_id", uid).eq("plan_id", pay.plan_id).limit(1).maybeSingle();
      const base = existing?.expires_at ? new Date(existing.expires_at).getTime() : Date.now();
      const expiresAt = new Date(Math.max(base, Date.now()) + pm * 30 * 86400000).toISOString();
      if (existing) {
        await sb.from("member_plans").update({
          expires_at: expiresAt, source: "razorpay",
          razorpay_subscription_id, razorpay_payment_id,
        }).eq("id", existing.id);
      } else {
        await sb.from("member_plans").insert({
          user_id: uid, plan_id: pay.plan_id, months: pm, expires_at: expiresAt,
          source: "razorpay", razorpay_subscription_id, razorpay_payment_id,
        });
      }
    } else if (pay.purpose === "room") {
      const expiresAt = new Date(Date.now() + pm * 30 * 86400000).toISOString();
      await sb.from("room_subscriptions").upsert(
        { room_id: pay.room_id, user_id: uid, status: "active", expires_at: expiresAt, plan: pm + "m", razorpay_subscription_id },
        { onConflict: "room_id,user_id" }
      );
    }

    await sb.from("payments").update({ status: "paid", razorpay_payment_id }).eq("id", pay.id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Something went wrong confirming the payment." });
  }
}
