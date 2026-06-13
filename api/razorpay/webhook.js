// Glasswings — Razorpay WEBHOOK: the guaranteed path for subscriptions.
// Razorpay's server calls this the moment a subscription is charged —
// even if the member closed the app mid-payment (UPI AutoPay mandates).
// Verifies Razorpay's signature, activates/extends the plan, records the
// payment. Idempotent: safe under Razorpay's retries.
//
// Place at: api/razorpay/webhook.js
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RAZORPAY_WEBHOOK_SECRET
//
// Register in Razorpay Dashboard → Settings → Webhooks → Add:
//   URL:    https://glass-wings.com/api/razorpay/webhook
//   Secret: the same string you put in RAZORPAY_WEBHOOK_SECRET
//   Events: subscription.charged  (required)
//           subscription.activated (optional, handled as no-op)
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function readRaw(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => resolve(raw));
    req.on("error", () => resolve(""));
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const WSECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!WSECRET) return res.status(500).json({ error: "RAZORPAY_WEBHOOK_SECRET not set" });

  // raw body for signature; fall back to re-stringifying if runtime pre-parsed it
  let raw = await readRaw(req);
  if (!raw && req.body) raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  const sig = req.headers["x-razorpay-signature"];
  const expected = crypto.createHmac("sha256", WSECRET).update(raw).digest("hex");
  if (!sig || sig !== expected) return res.status(400).json({ error: "bad signature" });

  let body;
  try { body = typeof req.body === "object" && req.body ? req.body : JSON.parse(raw); }
  catch { return res.status(400).json({ error: "bad body" }); }

  try {
    const event = body.event;

    if (event === "subscription.charged") {
      const sub = body.payload?.subscription?.entity;
      const payment = body.payload?.payment?.entity;
      if (!sub || !payment) return res.status(200).json({ ok: true, skip: "no entities" });

      const pid = payment.id;                       // pay_xxx
      const subId = sub.id;                         // sub_xxx
      const notes = sub.notes || {};
      const uid = notes.uid;
      const planId = notes.plan_id || null;
      const roomId = notes.room_id || null;
      const pm = Number(notes.plan_months) || 1;
      if (!uid) return res.status(200).json({ ok: true, skip: "no uid in notes" });

      // idempotency: if this exact payment is already recorded as paid, stop
      const { data: dupe } = await sb.from("payments").select("id, status")
        .eq("razorpay_payment_id", pid).maybeSingle();
      if (dupe && dupe.status === "paid") return res.status(200).json({ ok: true, dupe: true });

      if (planId) {
        // activate / extend the membership plan
        const { data: existing } = await sb.from("member_plans").select("id, expires_at")
          .eq("user_id", uid).eq("plan_id", planId).limit(1).maybeSingle();
        const base = existing?.expires_at ? new Date(existing.expires_at).getTime() : Date.now();
        const expiresAt = new Date(Math.max(base, Date.now()) + pm * 30 * 86400000).toISOString();
        if (existing) {
          await sb.from("member_plans").update({
            expires_at: expiresAt, source: "razorpay",
            razorpay_subscription_id: subId, razorpay_payment_id: pid,
          }).eq("id", existing.id);
        } else {
          await sb.from("member_plans").insert({
            user_id: uid, plan_id: planId, months: pm, expires_at: expiresAt,
            source: "razorpay", razorpay_subscription_id: subId, razorpay_payment_id: pid,
          });
        }
      } else if (roomId) {
        // legacy room subscription path (kept for safety)
        const expiresAt = new Date(Date.now() + pm * 30 * 86400000).toISOString();
        await sb.from("room_subscriptions").upsert(
          { room_id: roomId, user_id: uid, status: "active", expires_at: expiresAt, plan: pm + "m", razorpay_subscription_id: subId },
          { onConflict: "room_id,user_id" }
        );
      }

      // record the money: update the pending 'created' row, or insert (renewal cycles)
      const { data: pending } = await sb.from("payments").select("id")
        .eq("razorpay_subscription_id", subId).eq("status", "created")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (pending) {
        await sb.from("payments").update({ status: "paid", razorpay_payment_id: pid }).eq("id", pending.id);
      } else if (!dupe) {
        await sb.from("payments").insert({
          user_id: uid, purpose: planId ? "plan" : "room",
          plan_id: planId, room_id: roomId, plan_months: pm,
          amount: payment.amount, status: "paid",
          razorpay_payment_id: pid, razorpay_subscription_id: subId,
        });
      }

      return res.status(200).json({ ok: true });
    }

    // mandate authorized etc. — money handled by subscription.charged
    return res.status(200).json({ ok: true, ignored: event });
  } catch (e) {
    // non-2xx → Razorpay retries for 24h, which is what we want on a glitch
    return res.status(500).json({ error: e.message || "webhook failed" });
  }
}
