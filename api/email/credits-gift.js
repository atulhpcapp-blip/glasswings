// Glasswings — send a warm "credits gifted" email (Vercel serverless function).
// Place this file in your repo at:  api/email/credits-gift.js
// Required env vars (already set for your other emails):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
// Optional: RESEND_FROM — the sender, e.g.  Glasswings <hello@glass-wings.com>
// (If gift emails don't arrive, copy the exact `from:` value used in your
//  existing api/email/ticket.js into RESEND_FROM or the fallback below.)
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: "Email is not configured." });

  const body = (typeof req.body === "object" && req.body) ? req.body : await readBody(req);
  const { access_token, for_user } = body;
  const amount = Math.max(1, parseInt(body.amount) || 0);
  if (!for_user || !amount) return res.status(400).json({ error: "Missing details." });

  try {
    // 1) The caller must be a logged-in staff member
    const { data: ures } = await sb.auth.getUser(access_token);
    const uid = ures?.user?.id;
    if (!uid) return res.status(401).json({ error: "Please log in again." });
    const { data: me } = await sb.from("profiles").select("role, roles").eq("id", uid).single();
    const isStaff = STAFF.includes(me?.role) || (me?.roles || []).some((r) => STAFF.includes(r));
    if (!isStaff) return res.status(403).json({ error: "Not authorised." });

    // 2) Recipient name + email
    const { data: prof } = await sb.from("profiles").select("full_name").eq("id", for_user).single();
    const { data: au } = await sb.auth.admin.getUserById(for_user);
    const email = au?.user?.email;
    if (!email) return res.status(404).json({ error: "Member has no email on file." });
    const first = (prof?.full_name || "there").split(" ")[0];

    // 3) The email
    const html = `
<div style="margin:0;padding:0;background:#F0F2F5;padding:28px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#008069,#0aa07e);padding:34px 24px;text-align:center;color:#ffffff;">
      <div style="font-size:46px;line-height:1;">🎁</div>
      <div style="font-size:22px;font-weight:800;margin-top:10px;">A gift from Glasswings!</div>
    </div>
    <div style="padding:28px 26px 10px;color:#111B21;">
      <p style="font-size:15.5px;line-height:1.65;margin:0;">Hi ${first},</p>
      <p style="font-size:15.5px;line-height:1.65;margin:14px 0 0;">Something nice just landed in your wallet — we've gifted you</p>
      <div style="text-align:center;margin:22px 0;">
        <span style="display:inline-block;background:#E7F6EF;color:#008069;font-size:30px;font-weight:800;padding:14px 30px;border-radius:14px;">✨ ${amount} credits ✨</span>
      </div>
      <p style="font-size:15.5px;line-height:1.65;margin:0;">…with love from the Glasswings team 💚</p>
      <p style="font-size:14.5px;line-height:1.65;color:#667781;margin:14px 0 0;">Use them on games like Friday Clash and Blind Date Night, or on add-ons at our events. Your balance is waiting in <b>Profile → Wallet</b>.</p>
      <div style="text-align:center;margin:26px 0 8px;">
        <a href="https://glass-wings.com" style="display:inline-block;background:#008069;color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;padding:13px 34px;border-radius:12px;">Open Glasswings</a>
      </div>
    </div>
    <div style="padding:16px 26px 26px;text-align:center;color:#98A5A1;font-size:12px;line-height:1.6;">
      See you at the next party! ✨<br/>— Team Glasswings
    </div>
  </div>
</div>`;

    const from = process.env.RESEND_FROM || "Glasswings <hello@glass-wings.com>";
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from, to: [email], subject: `🎁 You've received ${amount} Glasswings credits!`, html }),
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ error: "Email send failed: " + t.slice(0, 200) });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Something went wrong." });
  }
}
