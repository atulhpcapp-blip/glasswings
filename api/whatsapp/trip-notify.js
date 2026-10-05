// POST /api/whatsapp/trip-notify   body: { access_token, booking_id }
// Sends any pending automatic WhatsApps for a getaway booking (receipts + Trip Pass).
// Safe to call any number of times: each message goes out only once.
import { body, getUser } from "../razorpay/_booking-lib.js";
import { notifyTrip } from "./_trip-wa.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { access_token, booking_id } = body(req);
    const user = await getUser(access_token);
    if (!user) return res.status(401).json({ error: "Please log in again" });
    const out = await notifyTrip(booking_id);
    return res.status(200).json({ ok: true, ...out });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message || "Couldn't send WhatsApp" });
  }
}
