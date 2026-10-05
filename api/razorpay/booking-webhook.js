// POST /api/razorpay/booking-webhook   (called by Razorpay, not by the app)
// Backup for booking, vendor stall AND getaway (trip) payments: if the client's phone closes before the app
// confirms a payment, Razorpay calls this and the booking is confirmed anyway.
//
// Safety: we never trust the webhook body. We take the payment id from it,
// then fetch the payment AND its order directly from Razorpay with our secret
// key, and only mark paid if Razorpay itself says the money was captured.
// If RAZORPAY_WEBHOOK_SECRET is set, the Razorpay signature is checked too.
import crypto from "node:crypto";
import { rpc, rzpGetPayment, missingEnv, RZP_KEY_ID, RZP_SECRET } from "./_booking-lib.js";
import { notifyTrip } from "../whatsapp/_trip-wa.js";

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RZP_WEBHOOK_SECRET || "";

// Read the raw request body if the platform hasn't already consumed it.
function readRaw(req) {
  return new Promise((resolve) => {
    if (typeof req.on !== "function" || req.readableEnded || req.complete && req.body !== undefined) return resolve(null);
    const chunks = [];
    const t = setTimeout(() => resolve(chunks.length ? Buffer.concat(chunks) : null), 1500);
    req.on("data", c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => { clearTimeout(t); resolve(chunks.length ? Buffer.concat(chunks) : null); });
    req.on("error", () => { clearTimeout(t); resolve(null); });
  });
}

async function rzpGetOrder(id) {
  const auth = "Basic " + Buffer.from(`${RZP_KEY_ID}:${RZP_SECRET}`).toString("base64");
  const r = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(id)}`, { headers: { Authorization: auth } });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.description || "Couldn't fetch order");
  return j;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const miss = missingEnv();
  if (miss.length) return res.status(500).json({ error: `Server is missing: ${miss.join(", ")}` });

  try {
    // 1. Parse body (raw if available, so the signature can be checked)
    const raw = await readRaw(req);
    let evt = null;
    if (raw) { try { evt = JSON.parse(raw.toString("utf8")); } catch { evt = null; } }
    if (!evt) evt = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    // 2. Optional signature check (only possible when we have the exact raw body)
    const sig = req.headers["x-razorpay-signature"];
    if (WEBHOOK_SECRET && raw && sig) {
      const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
      const a = Buffer.from(expected), b = Buffer.from(String(sig));
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).json({ error: "Bad signature" });
    }

    // 3. Only payment events matter
    if (!["payment.captured", "order.paid"].includes(evt.event)) return res.status(200).json({ ok: true, ignored: evt.event || "unknown" });
    const paymentId = evt?.payload?.payment?.entity?.id;
    if (!paymentId) return res.status(200).json({ ok: true, ignored: "no payment" });

    // 4. Ask Razorpay directly (never trust the webhook body)
    const pay = await rzpGetPayment(paymentId);
    if (!pay.order_id) return res.status(200).json({ ok: true, ignored: "no order" });
    const order = await rzpGetOrder(pay.order_id);
    const notes = order.notes || {};
    const isBooking = notes.purpose === "event_booking" && notes.milestone_id && notes.user_id;
    const isStall = notes.purpose === "stall_booking" && notes.booking_id && notes.user_id;
    const isTrip = notes.purpose === "trip_payment" && notes.booking_id;
    if (!isBooking && !isStall && !isTrip) {
      return res.status(200).json({ ok: true, ignored: "not a booking or stall payment" });   // tickets, credits etc. are handled elsewhere
    }
    if (pay.status !== "captured") return res.status(200).json({ ok: true, ignored: `payment ${pay.status}` });
    if (isTrip) {
      const to = await rpc("trip_mark_paid", { p_order: order.id, p_payment: pay.id, p_amount_paise: pay.amount });
      if (to?.ok) { try { await notifyTrip(to.booking_id); } catch { } }
      return res.status(200).json({ ok: !!to?.ok, already: !!to?.already, detail: to?.error || undefined });
    }
    if (isStall) {
      const so = await rpc("stall_mark_paid", { p_booking: notes.booking_id, p_user: notes.user_id, p_order: order.id, p_payment: pay.id, p_amount_paise: pay.amount });
      return res.status(200).json({ ok: !!so?.ok, already: !!so?.already, detail: so?.error || undefined });
    }

    // 5. Mark paid (safe to repeat: already-paid instalments are ignored)
    const out = await rpc("booking_mark_paid", {
      p_milestone: notes.milestone_id, p_user: notes.user_id,
      p_order: order.id, p_payment: pay.id, p_amount_paise: pay.amount,
    });
    return res.status(200).json({ ok: !!out?.ok, already: !!out?.already, detail: out?.error || undefined });
  } catch (e) {
    // 500 makes Razorpay retry later, which is what we want for temporary failures
    return res.status(500).json({ error: e.message || "Webhook failed" });
  }
}
