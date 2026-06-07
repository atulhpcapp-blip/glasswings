// Glasswings — Razorpay: verify a subscription mandate and grant room access.
// Subscription signature = HMAC_SHA256(payment_id + "|" + subscription_id, secret).
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
  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) return res.status(400).json({ error: "Missing payment details." });

  try {
    const expected = crypto.createHmac("sha256", SECRET).update(`${razorpay_payment_id}|${razorpay_subscription_id}`).digest("hex");
    if (expected !== razorpay_signature) {
      await sb.from("payments").update({ status: "failed" }).eq("razorpay_subscription_id", razorpay_subscription_id);
      return res.status(400).json({ error: "Subscription could not be verified." });
    }

    const { data: ures } = await sb.auth.getUser(access_token);
    const uid = ures?.user?.id;
    if (!uid) return res.status(401).json({ error: "Please log in again." });

    const { data: pay } = await sb.from("payments").select("*").eq("razorpay_subscription_id", razorpay_subscription_id).single();
    if (!pay || pay.user_id !== uid) return res.status(400).json({ error: "Subscription not found." });
    if (pay.status === "paid") return res.status(200).json({ ok: true });   // idempotent

    if (pay.purpose === "plan") {
      const pm = Number(pay.plan_months) || 1;
      const { data: mp } = await sb.from("member_plans").select("id, expires_at").eq("user_id", uid).eq("plan_id", pay.plan_id).maybeSingle();
      const base = mp?.expires_at ? Math.max(new Date(mp.expires_at).getTime(), Date.now()) : Date.now();
      const expiresAt = new Date(base + pm * 30 * 86400000).toISOString();
      if (mp) await sb.from("member_plans").update({ expires_at: expiresAt, months: pm, source: "razorpay", razorpay_subscription_id, razorpay_payment_id }).eq("id", mp.id);
      else await sb.from("member_plans").insert({ user_id: uid, plan_id: pay.plan_id, months: pm, expires_at: expiresAt, source: "razorpay", razorpay_subscription_id, razorpay_payment_id });
      await sb.from("payments").update({ status: "paid", razorpay_payment_id }).eq("razorpay_subscription_id", razorpay_subscription_id);
      return res.status(200).json({ ok: true });
    }

    const { data: existing } = await sb.from("room_subscriptions").select("id").eq("room_id", pay.room_id).eq("user_id", uid).maybeSingle();
    if (existing) await sb.from("room_subscriptions").update({ status: "active", razorpay_subscription_id }).eq("id", existing.id);
    else await sb.from("room_subscriptions").insert({ room_id: pay.room_id, user_id: uid, status: "active", razorpay_subscription_id });

    await sb.from("payments").update({ status: "paid", razorpay_payment_id }).eq("razorpay_subscription_id", razorpay_subscription_id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Something went wrong confirming the subscription." });
  }
}
