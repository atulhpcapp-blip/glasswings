// Shared helper (not a public endpoint): sends the automatic getaway WhatsApps through AiSensy.
//  • "trip_payment_received"  {{1}} name {{2}} amount {{3}} trip {{4}} paid so far {{5}} total {{6}} balance {{7}} due date
//  • "trip_pass_ready"        {{1}} name {{2}} trip {{3}} dates {{4}} booking code
//  Both have a dynamic URL button: https://glass-wings.com/?trip={{1}}  (the booking code)
import { rpc } from "../razorpay/_booking-lib.js";

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
async function sendTemplate(campaign, to, name, params, code) {
  const base = { apiKey: AISENSY_KEY, campaignName: campaign, destination: to, userName: clean(name), source: "glasswings-trip", templateParams: params,
    buttons: [{ type: "button", sub_type: "url", index: 0, parameters: [{ type: "text", text: code }] }] };
  const { buttons, ...noBtn } = base;
  const attempts = [base, noBtn, { ...noBtn, templateParams: [...params, code] }, { ...base, templateParams: [...params, code] }];
  let out = null;
  for (const a of attempts) { out = await aisensy(a); if (out.ok || !/param|button|variable|template/i.test(out.detail)) break; }
  return out;
}

// Sends every not-yet-sent receipt for this booking, and the Trip Pass if it just became fully paid.
export async function notifyTrip(bookingId) {
  if (!AISENSY_KEY || !bookingId) return { skipped: true };
  const p = await rpc("trip_notify_payload", { p_booking: bookingId });
  if (!p?.ok) return { skipped: true };
  const code = clean(p.code);
  const results = [];
  for (const pay of p.payments || []) {
    if (!(await rpc("trip_notify_claim", { p_payment: pay.id, p_booking: null }))) continue;
    const to = dest(pay.phone) || dest(p.booker_phone);
    const name = pay.phone ? pay.name : p.booker_name;
    if (!to) { await rpc("trip_notify_mark", { p_payment: pay.id, p_booking: null, p_status: "no_phone", p_detail: "No WhatsApp number" }); continue; }
    const out = await sendTemplate(p.paid_campaign, to, name, [clean(name), inr(pay.amount), clean(p.title), inr(p.paid), inr(p.total), inr(p.left), clean(p.deadline)], code);
    await rpc("trip_notify_mark", { p_payment: pay.id, p_booking: null, p_status: out.ok ? "sent" : "failed", p_detail: String(out.detail) });
    results.push({ type: "receipt", ok: out.ok, detail: out.detail });
  }
  if (p.pass_pending && (await rpc("trip_notify_claim", { p_payment: null, p_booking: bookingId }))) {
    const list = [{ phone: p.booker_phone, name: p.booker_name }, ...(p.pass_to || [])];
    const seen = new Set(); let okAny = false, last = "no phone";
    for (const r of list) {
      const to = dest(r.phone); if (!to || seen.has(to)) continue; seen.add(to);
      const out = await sendTemplate(p.pass_campaign, to, r.name, [clean(r.name), clean(p.title), clean(p.when), code], code);
      okAny = okAny || out.ok; last = out.detail;
    }
    await rpc("trip_notify_mark", { p_payment: null, p_booking: bookingId, p_status: okAny ? "sent" : (seen.size ? "failed" : "no_phone"), p_detail: String(last) });
    results.push({ type: "pass", ok: okAny, detail: last });
  }
  return { results };
}
