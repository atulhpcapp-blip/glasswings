// Glasswings — email marketing to a SEGMENT (Vercel serverless function).
// Place this file in your repo at:  api/email/segment-blast.js
// Required env vars (already set): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
// Optional: RESEND_FROM — e.g.  Glasswings <hello@glass-wings.com>
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); } });
  });
}

const STAFF = ["admin", "superadmin", "subadmin"];
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: "Email is not configured." });

  const body = (typeof req.body === "object" && req.body) ? req.body : await readBody(req);
  const { access_token, segment_id } = body;
  const subject = String(body.subject || "").trim();
  const message = String(body.message || "").trim();
  if (!segment_id || !subject || !message) return res.status(400).json({ error: "Missing details." });

  try {
    // caller must be staff
    const { data: ures } = await sb.auth.getUser(access_token);
    const uid = ures?.user?.id;
    if (!uid) return res.status(401).json({ error: "Please log in again." });
    const { data: me } = await sb.from("profiles").select("role, roles").eq("id", uid).single();
    const isStaff = STAFF.includes(me?.role) || (me?.roles || []).some((r) => STAFF.includes(r));
    if (!isStaff) return res.status(403).json({ error: "Not authorised." });

    // segment recipients
    const { data: list, error: lerr } = await sb.rpc("segment_emails", { p_segment: segment_id });
    if (lerr) return res.status(500).json({ error: lerr.message });
    const recipients = (list || []).filter((r) => r.email);
    if (!recipients.length) return res.status(400).json({ error: "This segment has no members with an email." });

    const from = process.env.RESEND_FROM || "Glasswings <hello@glass-wings.com>";
    const wrap = (first) => `
<div style="margin:0;padding:0;background:#F0F2F5;padding:26px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#008069,#0aa07e);padding:22px 24px;color:#ffffff;">
      <div style="font-size:18px;font-weight:800;">Glasswings ✨</div>
    </div>
    <div style="padding:26px;color:#111B21;">
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Hi ${esc(first)},</p>
      <div style="font-size:15px;line-height:1.7;">${esc(message).replace(/\n/g, "<br/>")}</div>
      <div style="text-align:center;margin:26px 0 4px;">
        <a href="https://glass-wings.com" style="display:inline-block;background:#008069;color:#ffffff;text-decoration:none;font-weight:800;font-size:14.5px;padding:12px 30px;border-radius:12px;">Open Glasswings</a>
      </div>
    </div>
    <div style="padding:14px 26px 24px;text-align:center;color:#98A5A1;font-size:12px;">— Team Glasswings</div>
  </div>
</div>`;

    // send in batches of 50 via Resend's batch endpoint
    let sent = 0;
    for (let i = 0; i < recipients.length; i += 50) {
      const chunk = recipients.slice(i, i + 50).map((r) => ({
        from, to: [r.email], subject,
        html: wrap((r.full_name || "there").split(" ")[0]),
      }));
      const resp = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify(chunk),
      });
      if (resp.ok) sent += chunk.length;
      else {
        const t = await resp.text();
        return res.status(500).json({ error: `Sent ${sent}, then failed: ` + t.slice(0, 200), sent });
      }
    }
    return res.status(200).json({ ok: true, sent });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Something went wrong." });
  }
}
