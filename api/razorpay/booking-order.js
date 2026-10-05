// POST /api/razorpay/booking-order
// body: { access_token, milestone_id }
// Creates a Razorpay order for one booking instalment (advance / balance).
// The amount always comes from the database, never from the app.
import { body, getUser, rpc, rzpCreateOrder, missingEnv, RZP_KEY_ID } from "./_booking-lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const miss = missingEnv();
  if (miss.length) return res.status(500).json({ error: `Server is missing: ${miss.join(", ")}` });
  try {
    const { access_token, milestone_id } = body(req);
    if (!milestone_id) return res.status(400).json({ error: "Missing payment id" });
    const user = await getUser(access_token);
    if (!user) return res.status(401).json({ error: "Please log in again" });

    const info = await rpc("booking_payment_info", { p_milestone: milestone_id, p_user: user.id });
    if (!info?.ok) return res.status(400).json({ error: info?.error || "This payment isn't available" });

    const order = await rzpCreateOrder({
      amount: Number(info.amount) * 100,
      currency: "INR",
      receipt: `bk_${String(milestone_id).replace(/-/g, "").slice(0, 30)}`,
      payment_capture: 1,
      notes: { purpose: "event_booking", milestone_id, booking_id: info.booking_id, user_id: user.id },
    });
    await rpc("booking_set_order", { p_milestone: milestone_id, p_order: order.id });

    return res.status(200).json({ order_id: order.id, key_id: RZP_KEY_ID, amount: order.amount, currency: order.currency, description: info.description });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Could not start the payment" });
  }
}
