// Glasswings — admin alert email on every payment/subscription.
// Place at: api/email/payment-alert.js
// Env: RESEND_API_KEY, optional RESEND_FROM, ADMIN_ALERT_EMAIL (where alerts go),
//      GW_ALERT_SECRET (same random string you put in the SQL trigger).
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  let body = req.body;
  if (typeof body !== "object" || !body) { try { body = JSON.parse(await new Promise((r) => { let d = ""; req.on("data", c => d += c); req.on("end", () => r(d || "{}")); })); } catch { body = {}; } }

  // simple shared-secret check (the trigger sends this)
  if (!process.env.GW_ALERT_SECRET || body.secret !== process.env.GW_ALERT_SECRET) {
    return res.status(401).json({ error: "bad secret" });
  }
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: "email not configured" });

  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) return res.status(500).json({ error: "ADMIN_ALERT_EMAIL not set" });
  const from = process.env.RESEND_FROM || "Glasswings <hello@glass-wings.com>";
  const esc = s => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const purposeLabel = { ticket: "🎟️ Event ticket", plan: "💎 Membership plan", room: "💬 Room subscription" }[body.purpose] || body.purpose || "Payment";

  const html = `
<div style="margin:0;padding:24px 12px;background:#F0F2F5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 6px 22px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#008069,#04B08F);padding:20px 24px;color:#fff">
      <div style="font-size:12px;letter-spacing:2px;font-weight:800;opacity:.9">GLASSWINGS · NEW PAYMENT</div>
      <div style="font-size:22px;font-weight:800;margin-top:4px">₹${esc(body.amount)}</div>
    </div>
    <div style="padding:22px 24px;color:#111B21;font-size:15px;line-height:1.7">
      <div><b>${esc(body.member)}</b> just paid.</div>
      <div style="margin-top:10px;color:#667781">For: <b style="color:#111B21">${esc(purposeLabel)}</b></div>
      <div style="color:#667781">Status: ${esc(body.status)}</div>
      <div style="color:#667781">When: ${esc(body.at)}</div>
    </div>
    <div style="padding:0 24px 22px"><a href="https://glass-wings.com" style="display:inline-block;background:#008069;color:#fff;text-decoration:none;font-weight:800;font-size:14px;padding:11px 24px;border-radius:10px">Open Glasswings</a></div>
  </div>
</div>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from, to: [to], subject: `💰 ₹${body.amount} — ${body.member} (${purposeLabel})`, html }),
    });
    if (!r.ok) return res.status(500).json({ error: (await r.text()).slice(0, 200) });
    return res.status(200).json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}
