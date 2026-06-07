// Glasswings — Razorpay: verify a payment and grant the ticket / room access.
// The grant happens here (service role) ONLY after the signature checks out,
// so it can't be faked from the browser.
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
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, access_token } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return res.status(400).json({ error: "Missing payment details." });

  try {
    const expected = crypto.createHmac("sha256", SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    if (expected !== razorpay_signature) {
      await sb.from("payments").update({ status: "failed" }).eq("razorpay_order_id", razorpay_order_id);
      return res.status(400).json({ error: "Payment could not be verified." });
    }

    const [{ data: ures }, { data: pay }] = await Promise.all([
      sb.auth.getUser(access_token),
      sb.from("payments").select("*").eq("razorpay_order_id", razorpay_order_id).single(),
    ]);
    const uid = ures?.user?.id;
    if (!uid) return res.status(401).json({ error: "Please log in again." });
    if (!pay || pay.user_id !== uid) return res.status(400).json({ error: "Order not found." });
    if (pay.status === "paid") return res.status(200).json({ ok: true });   // idempotent

    if (pay.purpose === "ticket") {
      const lines = (Array.isArray(pay.items) && pay.items.length)
        ? pay.items
        : [{ ticket_type_id: pay.ticket_type_id, quantity: pay.quantity }];
      for (let li = 0; li < lines.length; li++) {
        const { error: insErr } = await sb.from("event_tickets").insert({
          event_id: pay.event_id, user_id: uid, ticket_type_id: lines[li].ticket_type_id || null,
          quantity: lines[li].quantity || 1, addons: li === 0 ? (pay.addons || []) : [],
          referrer_id: pay.referrer_id || null, razorpay_order_id,
        });
        if (insErr && insErr.code !== "23505") throw insErr;   // 23505 = already granted
      }
    } else if (pay.purpose === "plan") {
      const pm = Number(pay.plan_months) || 1;
      const { data: existing } = await sb.from("member_plans").select("id, expires_at")
        .eq("user_id", uid).eq("plan_id", pay.plan_id)
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
        .limit(1).maybeSingle();
      const base = existing?.expires_at ? new Date(existing.expires_at).getTime() : Date.now();
      const expiresAt = new Date(Math.max(base, Date.now()) + pm * 30 * 86400000).toISOString();
      if (existing) {
        await sb.from("member_plans").update({ expires_at: expiresAt, razorpay_payment_id, source: "razorpay" }).eq("id", existing.id);
      } else {
        await sb.from("member_plans").insert({ user_id: uid, plan_id: pay.plan_id, months: pm, expires_at: expiresAt, source: "razorpay", razorpay_payment_id });
      }
    } else if (pay.purpose === "room") {
      const pm = Number(pay.plan_months) || 1;
      const expiresAt = new Date(Date.now() + pm * 30 * 86400000).toISOString();
      await sb.from("room_subscriptions").upsert(
        { room_id: pay.room_id, user_id: uid, status: "active", expires_at: expiresAt, plan: pm + "m" },
        { onConflict: "room_id,user_id" }
      );
    }

    await sb.from("payments").update({ status: "paid", razorpay_payment_id }).eq("razorpay_order_id", razorpay_order_id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Something went wrong confirming the payment." });
  }
}
