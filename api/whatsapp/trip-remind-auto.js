// POST /api/whatsapp/trip-remind-auto
// Called automatically every morning by Supabase (body: { secret }), or by an admin from the app
// (body: { access_token }) to "check now". Sends the "trip_payment_reminder" WhatsApp to travellers
// who still owe money on a reminder day (every Sunday, 3 days before the deadline, deadline day).
// Who is due, and making sure nobody gets it twice, is decided in Supabase (trip_auto_remind_claim).
import { body, getUser, rpc, SB_URL, SB_SERVICE } from "../razorpay/_booking-lib.js";

const AISENSY_KEY = process.env.AISENSY_API_KEY || process.env.AISENSY_KEY || "";
const AISENSY_URL = "https://backend.aisensy.com/campaign/t1/api/v2";
const clean = s => String(s == null ? "" : s).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 200) || "-";
const inr = n => Math.round(Number(n) || 0).toLocaleString("en-IN");
const dest = p => { const d = String(p || "").replace(/\D/g, "").replace(/^0+/, ""); return d.length < 10 ? null : d.length === 10 ? "+91" + d : "+" + d; };

async function aisensy(payload) {
  const r = await fetch(AISENSY_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch { j = null; }
  const ok = r.ok && !(j && (j.success === false || j.success === "false" || j.status === "error" || j.errorMessage || j.error));
  return { ok, detail: ok ? "sent" : ((j && (j.errorMessage || j.message || j.error)) || text || `HTTP ${r.status}`) };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!SB_URL || !SB_SERVICE) return res.status(200).json({ ok: false, error: "Supabase keys are missing in Vercel." });
  if (!AISENSY_KEY) return res.status(200).json({ ok: false, error: "WhatsApp isn't set up: AISENSY_API_KEY is missing in Vercel." });
  try {
    const { secret, access_token } = body(req);
    let userId = null;
    if (!secret) {
      const user = await getUser(access_token);
      if (!user) return res.status(401).json({ error: "Please log in again" });
      userId = user.id;
    }
    let sent = 0, failed = 0, noPhone = 0, rounds = 0; const errors = [];
    const started = Date.now();
    // up to 4 rounds of 25 per call (≈100 people); the morning job calls again every 5 minutes for the rest
    while (rounds < 4 && Date.now() - started < 40000) {
      rounds++;
      const t = await rpc("trip_auto_remind_claim", { p_secret: secret || null, p_user: userId, p_limit: 25 });
      if (!t?.ok) return res.status(403).json({ error: t?.error || "Not allowed" });
      const rows = t.rows || [];
      if (!rows.length) break;
      for (const r of rows) {
        const to = dest(r.phone);
        if (!to) { noPhone++; await rpc("trip_auto_remind_mark", { p_log: r.log_id, p_phone: r.phone || null, p_status: "no_phone", p_detail: "No WhatsApp number" }); continue; }
        const params = [clean(r.name), clean(r.title), inr(r.paid), inr(r.total), inr(r.left), clean(r.deadline)];
        const noBtn = { apiKey: AISENSY_KEY, campaignName: t.campaign, destination: to, userName: clean(r.name), source: "glasswings-trip-auto", templateParams: params };
        const withBtn = { ...noBtn, buttons: [{ type: "button", sub_type: "url", index: 0, parameters: [{ type: "text", text: r.code }] }] };
        const attempts = t.button ? [withBtn, { ...withBtn, templateParams: [...params, r.code] }] : [noBtn];
        let out = null;
        try {
          for (const a of attempts) { out = await aisensy(a); if (out.ok || !/param|button|variable|template/i.test(out.detail)) break; }
        } catch (e) { out = { ok: false, detail: e.message || "network error" }; }
        if (out.ok) sent++; else { failed++; if (errors.length < 3) errors.push(`${r.name}: ${out.detail}`); }
        await rpc("trip_auto_remind_mark", { p_log: r.log_id, p_phone: to, p_status: out.ok ? "sent" : "failed", p_detail: String(out.detail) });
      }
      if (rows.length < 25) break;
    }
    const result = { at: new Date().toISOString(), by: secret ? "schedule" : "admin", sent, failed, no_phone: noPhone, errors };
    try { await rpc("trip_auto_remind_done", { p_result: result }); } catch { }
    return res.status(200).json({ ok: failed === 0, ...result });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Couldn't send reminders" });
  }
}
