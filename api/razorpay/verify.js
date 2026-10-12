// Glasswings — Razorpay: verify a ONE-TIME payment and grant the ticket /
// room / credits. Order-based (razorpay_order_id). The grant happens here
// (service role) ONLY after the signature checks out, so it can't be faked
// from the browser.
// NOTE: subscriptions are handled separately in verify-sub.js + webhook.js.
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

// Addition: queue an owner/organiser sale alert ONLY after payment has
// been persisted AND independently confirmed as captured at Razorpay.
// Alert failures must never undo or block a successful ticket checkout.
async function queueCapturedTicketSale(pay, uid, orderId, paymentId) {
  try {
    if (!pay?.event_id || !paymentId || !orderId) return;
    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key || !secret) {
      console.warn('Glasswings sale alert skipped: Razorpay server keys unavailable');
      return;
    }
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      console.warn('Glasswings sale alert deferred: Razorpay status check failed', response.status);
      return;
    }
    const verified = await response.json();
    const captured = verified?.status === 'captured';
    const matching = verified?.id === paymentId && verified?.order_id === orderId &&
      verified?.currency === 'INR' && Number(verified?.amount) === Number(pay.amount);
    if (!captured || !matching || Number(verified.amount) <= 0) {
      console.warn('Glasswings sale alert skipped: payment is not captured or does not match saved order');
      return;
    }
    const { data: profile } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
    const lineItems = Array.isArray(pay.items) ? pay.items : [];
    const quantity = lineItems.length
      ? lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
      : (Number(pay.quantity) || 1);
    const { error } = await sb.rpc('gw_wa_enqueue_verified', {
      p_reference: `razorpay:${paymentId}`,
      p_kind: 'ticket_sale',
      p_event_id: pay.event_id,
      p_buyer_id: uid,
      p_amount: Number(verified.amount) / 100,
      p_quantity: Math.max(1, quantity),
      p_payment_id: paymentId,
      p_buyer_name: String(profile?.full_name || profile?.name || ''),
      p_buyer_phone: String(profile?.phone || profile?.mobile || profile?.phone_number || ''),
      p_details: {},
    });
    if (error) console.error('Glasswings sale alert could not be queued:', error.message);
  } catch (err) {
    console.error('Glasswings ticket sale alert error:', err?.message || err);
  }
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
    if (pay.status === "paid") {
      // Idempotent ticket grant: a repeat callback may retry a previously
      // failed notification enqueue, but the DB outbox prevents duplicates.
      if (pay.purpose === 'ticket') {
        await queueCapturedTicketSale(pay, uid, razorpay_order_id, razorpay_payment_id);
      }
      return res.status(200).json({ ok: true });
    }
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
      // 💳 deduct any credits the buyer applied to this order (only now that the card payment cleared)
      if (pay.credits_used && pay.credits_used > 0) {
        try { await sb.rpc("spend_event_credits", { p_user: uid, p_n: pay.credits_used }); } catch (e2) {}
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
    } else if (pay.purpose === "credits") {
      await sb.rpc("grant_game_credits", { p_user: uid, p_n: pay.quantity || 0 });
    } else if (pay.purpose === "boost") {
      await sb.rpc("grant_paid_spotlight", { p_user: uid });
    }
    const { error: paymentSaveError } = await sb.from("payments")
      .update({ status: "paid", razorpay_payment_id }).eq("razorpay_order_id", razorpay_order_id);
    // Only queue paid ticket sales. Never let a WhatsApp problem affect checkout.
    if (!paymentSaveError && pay.purpose === 'ticket') {
      await queueCapturedTicketSale(pay, uid, razorpay_order_id, razorpay_payment_id);
    } else if (paymentSaveError) {
      console.error('Glasswings alert skipped because paid status was not persisted:', paymentSaveError.message);
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Something went wrong confirming the payment." });
  }
}
