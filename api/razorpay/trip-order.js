// POST /api/razorpay/trip-order   body: { access_token, booking_id, amount }
// Starts a Razorpay payment for a getaway booking: the booking amount (first payment)
// or any part payment. The amount is always checked by the database.
import { body, getUser, rpc, rzpCreateOrder, missingEnv, RZP_KEY_ID } from "./_booking-lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const miss = missingEnv();
  if (miss.length) return res.status(500).json({ error: `Server is missing: ${miss.join(", ")}` });
  try {
    const { access_token, booking_id, amount } = body(req);
    if (!booking_id) return res.status(400).json({ error: "Missing booking" });
    const user = await getUser(access_token);
    if (!user) return res.status(401).json({ error: "Please log in again" });
    const info = await rpc("trip_payment_info", { p_booking: booking_id, p_user: user.id, p_amount: Number(amount) || 0 });
    if (!info?.ok) return res.status(400).json({ error: info?.error || "This payment isn't available" });
    const rupees = Number(info.amount);
    const order = await rzpCreateOrder({
      amount: Math.round(rupees * 100), currency: "INR",
      receipt: `tr_${String(booking_id).replace(/-/g, "").slice(0, 20)}_${Date.now().toString(36)}`.slice(0, 40), payment_capture: 1,
      notes: { purpose: "trip_payment", booking_id, user_id: user.id, kind: info.kind },
    });
    await rpc("trip_set_order", { p_booking: booking_id, p_user: user.id, p_order: order.id, p_amount: rupees, p_kind: info.kind });
    return res.status(200).json({ order_id: order.id, key_id: RZP_KEY_ID, amount: order.amount, currency: order.currency, description: info.description });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Could not start the payment" });
  }
}
