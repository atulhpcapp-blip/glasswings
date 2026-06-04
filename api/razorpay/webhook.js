// Glasswings — Razorpay webhook. Keeps room access in sync with Razorpay over
// time: monthly renewals, failed payments, cancellations, completion.
// Configure in Razorpay → Settings → Webhooks with the SAME secret as the
// RAZORPAY_WEBHOOK_SECRET env var, subscribed to subscription.* events.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RAZORPAY_WEBHOOK_SECRET
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// We need the RAW body to verify the signature, so turn off Vercel's parser.
export const config = { api: { bodyParser: false } };

function readRaw(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => resolve(raw));
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const raw = await readRaw(req);
  const SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (SECRET) {
    const expected = crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
    if (expected !== req.headers["x-razorpay-signature"]) return res.status(400).json({ error: "bad signature" });
  }

  let body = {};
  try { body = JSON.parse(raw || "{}"); } catch { return res.status(400).json({ error: "bad body" }); }

  const event = body.event;

  // ── One-time payments (tickets / room joins): grant server-side ──
  // The browser's verify call is the fast path, but if the buyer's app
  // closed mid-UPI-switch it never runs. This webhook is the safety net;
  // a unique index on event_tickets.razorpay_order_id prevents doubles.
  if (event === "payment.captured" || event === "order.paid") {
    try {
      const pe = body.payload?.payment?.entity;
      const orderId = pe?.order_id || body.payload?.order?.entity?.id;
      if (!orderId) return res.status(200).json({ ignored: true });
      // atomically claim the order: only one grantor wins
      const { data: claimed } = await sb.from("payments")
        .update({ status: "paid", ...(pe?.id ? { razorpay_payment_id: pe.id } : {}) })
        .eq("razorpay_order_id", orderId).neq("status", "paid")
        .select().maybeSingle();
      if (claimed) {
        if (claimed.purpose === "ticket" && claimed.event_id) {
          const { error: insErr } = await sb.from("event_tickets").insert({
            event_id: claimed.event_id, user_id: claimed.user_id,
            ticket_type_id: claimed.ticket_type_id, quantity: claimed.quantity || 1,
            addons: claimed.addons || [], referrer_id: claimed.referrer_id || null,
            razorpay_order_id: orderId,
          });
          if (insErr && insErr.code !== "23505") throw insErr;
        } else if (claimed.purpose === "room" && claimed.room_id) {
          const { data: existing } = await sb.from("room_subscriptions").select("id")
            .eq("room_id", claimed.room_id).eq("user_id", claimed.user_id).maybeSingle();
          if (!existing) await sb.from("room_subscriptions").insert({ room_id: claimed.room_id, user_id: claimed.user_id, status: "active" });
        }
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  const subEnt = body.payload?.subscription?.entity;
  const subId = subEnt?.id;
  if (!subId) return res.status(200).json({ ignored: true });

  try {
    const findRow = async () => (await sb.from("room_subscriptions").select("id, room_id, user_id").eq("razorpay_subscription_id", subId).maybeSingle()).data;

    if (event === "subscription.charged" || event === "subscription.activated" || event === "subscription.resumed") {
      const row = await findRow();
      if (row) {
        await sb.from("room_subscriptions").update({
          status: "active",
          current_end: subEnt.current_end ? new Date(subEnt.current_end * 1000).toISOString() : null,
        }).eq("id", row.id);
        // record the renewal charge in the ledger (deduped by payment id)
        const pe = body.payload?.payment?.entity;
        if (event === "subscription.charged" && pe?.id) {
          const { data: dup } = await sb.from("payments").select("id").eq("razorpay_payment_id", pe.id).maybeSingle();
          if (!dup) await sb.from("payments").insert({ user_id: row.user_id, purpose: "room", room_id: row.room_id, amount: pe.amount, status: "paid", razorpay_subscription_id: subId, razorpay_payment_id: pe.id });
        }
      }
    } else if (event === "subscription.cancelled" || event === "subscription.completed" || event === "subscription.halted") {
      // billing has stopped — remove access
      await sb.from("room_subscriptions").delete().eq("razorpay_subscription_id", subId);
    }
    // subscription.pending (a charge is being retried) is left as-is: the member
    // keeps access during the short retry window; a final failure ends as 'halted'.

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
