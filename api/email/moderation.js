// Glasswings — ask a member to update their profile (Vercel serverless function).
// Place this file in your repo at:  api/email/moderation.js
// Required env vars (already set for your other emails):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
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

const STAFF = ["admin", "superadmin"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: "Email is not configured." });

  const body = (typeof req.body === "object" && req.body) ? req.body : await readBody(req);
  const { access_token, user_id } = body;
  if (!user_id) return res.status(400).json({ error: "Missing member." });

  try {
    const { data: ures } = await sb.auth.getUser(access_token);
    const uid = ures?.user?.id;
    if (!uid) return res.status(401).json({ error: "Please log in again." });
    const { data: me } = await sb.from("profiles").select("role, roles").eq("id", uid).single();
    const isAdmin = STAFF.includes(me?.role) || (me?.roles || []).some((r) => STAFF.includes(r));
    if (!isAdmin) return res.status(403).json({ error: "Not authorised." });

    const { data: prof } = await sb.from("profiles").select("full_name, review_flag").eq("id", user_id).single();
    const { data: au } = await sb.auth.admin.getUserById(user_id);
    const email = au?.user?.email;
    if (!email) return res.status(404).json({ error: "Member has no email on file." });
    const first = (prof?.full_name || "there").split(" ")[0];
    const item = prof?.review_flag === "phone" ? "phone number" : "profile photo";

    const html = `
<div style="margin:0;padding:0;background:#F0F2F5;padding:28px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#6D28D9,#9333EA);padding:32px 24px;text-align:center;color:#ffffff;">
      <div style="font-size:42px;line-height:1;">📸</div>
      <div style="font-size:21px;font-weight:800;margin-top:10px;">Please update your profile</div>
    </div>
    <div style="padding:26px 26px 8px;color:#111B21;">
      <p style="font-size:15.5px;line-height:1.65;margin:0;">Hi ${first},</p>
      <p style="font-size:15.5px;line-height:1.65;margin:14px 0 0;">To keep Glasswings a safe and friendly community, we need you to update your <b>${item}</b> in the app.</p>
      <p style="font-size:15.5px;line-height:1.65;margin:14px 0 0;">Until it's updated, your profile won't appear to other members in the Meet section. As soon as you fix it, you'll be visible again automatically.</p>
      <p style="font-size:15.5px;line-height:1.65;margin:14px 0 0;">Just open the app → <b>Profile → Edit profile</b> and update your ${item}.</p>
      <div style="text-align:center;margin:22px 0;">
        <a href="https://glass-wings.com" style="display:inline-block;background:#008069;color:#fff;text-decoration:none;font-weight:800;font-size:15px;padding:13px 26px;border-radius:12px;">Open Glasswings</a>
      </div>
      <p style="font-size:13px;line-height:1.6;color:#667781;margin:14px 0 0;">Questions? Just reply to this email or message us on WhatsApp. Thanks for being part of the community 💚</p>
      <p style="font-size:13px;line-height:1.6;color:#667781;margin:18px 0 0;">— The Glasswings Team</p>
    </div>
    <div style="padding:16px 26px 24px;text-align:center;color:#9aa5a1;font-size:11.5px;">Glasswings · glass-wings.com</div>
  </div>
</div>`;

    const from = process.env.RESEND_FROM || "Glasswings <hello@glass-wings.com>";
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: email, subject: "Please update your Glasswings profile", html }),
    });
    if (!r.ok) { const t = await r.text(); return res.status(500).json({ error: "Email failed", detail: t }); }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Something went wrong." });
  }
}
