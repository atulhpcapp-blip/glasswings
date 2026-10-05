// POST /api/whatsapp/trip-remind
// body: { access_token, event_id, booking_ids? }   (no booking_ids = everyone with a balance)
// Sends the getaway payment reminder on WhatsApp through AiSensy (campaign "trip_payment_reminder").
// Template variables: {{1}} name · {{2}} trip · {{3}} paid · {{4}} total · {{5}} balance · {{6}} due date
// Button (dynamic URL): https://glass-wings.com/?trip={{1}}  ← booking code
import { body, getUser, rpc, SB_URL, SB_SERVICE } from "../razorpay/_booking-lib.js";

const AISENSY_KEY = process.env.AISENSY_API_KEY || process.env.AISENSY_KEY || "";
const AISENSY_URL = "https://backend.aisensy.com/campaign/t1/api/v2";
const clean = s => String(s == null ? "" : s).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 200) || "-";
const inr = n => Math.round(Number(n) || 0).toLocaleString("en-IN");

async function aisensy(payload) {
  const r = await fetch(AISENSY_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch { j = null; }
  const ok = r.ok && !(j && (j.success === false || j.success === "false" || j.status === "error" || j.errorMessage || j.error));
  return { ok, detail: ok ? "sent" : ((j && (j.errorMessage || j.message || j.error)) || text || `HTTP ${r.status}`) };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!SB_URL || !SB_SERVICE || !AISENSY_KEY) return res.status(200).json({ ok: false, error: "WhatsApp isn't set up: AISENSY_API_KEY is missing in Vercel." });
  try {
    const { access_token, event_id, booking_ids } = body(req);
    if (!event_id) return res.status(400).json({ error: "Missing trip" });
    const user = await getUser(access_token);
    if (!user) return res.status(401).json({ error: "Please log in again" });
    const t = await rpc("trip_remind_targets", { p_event: event_id, p_user: user.id, p_ids: Array.isArray(booking_ids) && booking_ids.length ? booking_ids : null });
    if (!t?.ok) return res.status(403).json({ error: t?.error || "Not allowed" });
    const rows = (t.rows || []).slice(0, 150);
    let sent = 0, failed = 0, noPhone = 0; const errors = [];
    for (const r of rows) {
      const digits = String(r.phone || "").replace(/\D/g, "").replace(/^0+/, "");
      if (digits.length < 10) { noPhone++; await rpc("trip_remind_log", { p_booking: r.booking_id, p_event: event_id, p_phone: r.phone || null, p_status: "no_phone", p_detail: "No WhatsApp number", p_user: user.id }); continue; }
      const destination = digits.length === 10 ? "+91" + digits : "+" + digits;
      const params = [clean(r.name), clean(r.title), inr(r.paid), inr(r.total), inr(r.left), clean(r.deadline)];
      const base = { apiKey: AISENSY_KEY, campaignName: t.campaign, destination, userName: clean(r.name), source: "glasswings-trip-reminder", templateParams: params,
        buttons: [{ type: "button", sub_type: "url", index: 0, parameters: [{ type: "text", text: r.code }] }] };
      const { buttons, ...noBtn } = base;
      const attempts = [base, noBtn, { ...noBtn, templateParams: [...params, r.code] }, { ...base, templateParams: [...params, r.code] }];
      let out = null;
      for (const a of attempts) { out = await aisensy(a); if (out.ok || !/param|button|variable|template/i.test(out.detail)) break; }
      if (out.ok) sent++; else { failed++; if (errors.length < 3) errors.push(`${r.name}: ${out.detail}`); }
      await rpc("trip_remind_log", { p_booking: r.booking_id, p_event: event_id, p_phone: destination, p_status: out.ok ? "sent" : "failed", p_detail: String(out.detail), p_user: user.id });
    }
    return res.status(200).json({ ok: failed === 0, total: rows.length, sent, failed, no_phone: noPhone, errors });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Couldn't send reminders" });
  }
}
