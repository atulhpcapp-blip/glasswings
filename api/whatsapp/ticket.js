// POST /api/whatsapp/ticket
// body: { access_token, event_id, for_user? }   (same body the app sends to /api/email/ticket)
// Sends the member's ticket on WhatsApp via AiSensy: QR image + details + "View ticket" button.
// Each ticket is sent only once (tracked in whatsapp_ticket_log), so repeat calls are harmless.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AISENSY_API_KEY
import { body, getUser, rpc, SB_URL, SB_SERVICE } from "../razorpay/_booking-lib.js";

const AISENSY_KEY = process.env.AISENSY_API_KEY || process.env.AISENSY_KEY || "";
const AISENSY_URL = "https://backend.aisensy.com/campaign/t1/api/v2";
const clean = s => String(s == null ? "" : s).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 200) || "-";

async function aisensy(payload) {
  const r = await fetch(AISENSY_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch { j = null; }
  const ok = r.ok && !(j && (j.success === false || j.success === "false" || j.status === "error" || j.errorMessage || j.error));
  return { ok, detail: ok ? "sent" : ((j && (j.errorMessage || j.message || j.error)) || text || `HTTP ${r.status}`) };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!SB_URL || !SB_SERVICE || !AISENSY_KEY) return res.status(200).json({ ok: false, skipped: "not_configured", missing: [!SB_URL && "SUPABASE_URL", !SB_SERVICE && "SUPABASE_SERVICE_ROLE_KEY", !AISENSY_KEY && "AISENSY_API_KEY"].filter(Boolean) });
  try {
    const { access_token, event_id, for_user, mode, force } = body(req);
    if (mode || !event_id) return res.status(200).json({ ok: false, skipped: "not a member ticket" });
    const user = await getUser(access_token);
    if (!user) return res.status(401).json({ error: "Please log in again" });
    const target = for_user || user.id;

    // force = admin "send me a test" for their OWN ticket only (re-sends even if sent before)
    const p = await rpc("gw_ticket_whatsapp_payload", { p_event: event_id, p_user: target, p_force: !!force && target === user.id });
    if (!p?.ok) return res.status(200).json({ ok: false, skipped: p?.reason || "nothing to send" });

    const ids = p.ticket_ids || [];
    const digits = String(p.phone || "").replace(/\D/g, "");
    if (digits.length < 10) {
      await rpc("gw_ticket_whatsapp_mark", { p_ticket_ids: ids, p_event: event_id, p_user: target, p_phone: p.phone || null, p_status: "no_phone", p_detail: "Member has no phone number" });
      return res.status(200).json({ ok: false, skipped: "no phone" });
    }
    const destination = digits.length === 10 ? "+91" + digits : "+" + digits;
    const code = clean(p.code);
    const payload = {
      apiKey: AISENSY_KEY,
      campaignName: p.campaign,
      destination,
      userName: clean(p.name),
      source: "glasswings-ticket",
      templateParams: [clean(p.name), clean(p.title), clean(p.when), clean(p.venue), clean(p.tickets), code],
      media: { url: "https://api.qrserver.com/v1/create-qr-code/?size=800x800&margin=40&format=png&data=" + encodeURIComponent(code), filename: `ticket-${code}.png` },
      buttons: [{ type: "button", sub_type: "url", index: 0, parameters: [{ type: "text", text: code }] }],
    };

    // Try the standard format first, then the variants AiSensy sometimes expects:
    //  - button URL variable counted inside templateParams (7 values)
    //  - no separate "buttons" field
    const { buttons, ...noBtn } = payload;
    const p7 = [...payload.templateParams, code];
    const attempts = [
      payload,
      noBtn,
      { ...noBtn, templateParams: p7 },
      { ...payload, templateParams: p7 },
    ];
    let out = null, used = 0;
    for (let i = 0; i < attempts.length; i++) {
      out = await aisensy(attempts[i]);
      used = i;
      if (out.ok) break;
      if (!/param|button|variable|template/i.test(out.detail)) break;   // other errors: no point retrying
    }
    if (out.ok && used > 0) out.detail = `sent (format ${used + 1})`;

    await rpc("gw_ticket_whatsapp_mark", { p_ticket_ids: ids, p_event: event_id, p_user: target, p_phone: destination, p_status: out.ok ? "sent" : "failed", p_detail: String(out.detail).slice(0, 500) });
    return res.status(200).json({ ok: out.ok, detail: out.detail });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Couldn't send WhatsApp ticket" });
  }
}
