// POST /api/razorpay/stall-verify
// body: { access_token, booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }
import { body, getUser, rpc, rzpGetPayment, rzpCapture, signatureOk, missingEnv } from "./_booking-lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const miss = missingEnv();
  if (miss.length) return res.status(500).json({ error: `Server is missing: ${miss.join(", ")}` });
  try {
    const { access_token, booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body(req);
    const user = await getUser(access_token);
    if (!user) return res.status(401).json({ error: "Please log in again" });
    if (!signatureOk(razorpay_order_id, razorpay_payment_id, razorpay_signature)) return res.status(400).json({ error: "Payment signature didn't match" });
    let pay = await rzpGetPayment(razorpay_payment_id);
    if (pay.order_id !== razorpay_order_id) return res.status(400).json({ error: "Payment doesn't belong to this order" });
    if (pay.status === "authorized") pay = await rzpCapture(razorpay_payment_id, pay.amount);
    if (pay.status !== "captured") return res.status(400).json({ error: `Payment is ${pay.status}` });
    const out = await rpc("stall_mark_paid", { p_booking: booking_id, p_user: user.id, p_order: razorpay_order_id, p_payment: razorpay_payment_id, p_amount_paise: pay.amount });
    if (!out?.ok) return res.status(400).json({ error: out?.error || "Couldn't confirm the payment" });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Couldn't confirm the payment" });
  }
}
