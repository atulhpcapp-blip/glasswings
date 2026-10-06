// POST /api/notify/event-review   body: { access_token, event_id, action }   (action: publish | changes | unpublish)
// Tells the organiser what the Glasswings team decided: EMAIL + WHATSAPP.
//  • Email works with whichever email service is already in Vercel:
//      RESEND_API_KEY, BREVO_API_KEY (or SENDINBLUE_API_KEY), SENDGRID_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASS (nodemailer).
//    Sender: EMAIL_FROM (or MAIL_FROM / RESEND_FROM / SMTP_FROM), else "Glasswings <noreply@glass-wings.com>".
//  • WhatsApp: AiSensy campaign saved in the app (e.g. "event_review_update"), template variables:
//      {{1}} organiser first name  {{2}} event title  {{3}} status line  {{4}} what to change (or "-")
//  • When an event is PUBLISHED and a "live" campaign is saved (e.g. "event_live"), that one is used instead:
//      {{1}} organiser first name  {{2}} event title  {{3}} date & place  {{4}} event link
import { body, getUser, rpc, SB_URL, SB_SERVICE } from "../razorpay/_booking-lib.js";

const env = (...n) => { for (const k of n) if (process.env[k]) return process.env[k]; return ""; };
const AISENSY_KEY = env("AISENSY_API_KEY", "AISENSY_KEY");
const FROM = env("EMAIL_FROM", "MAIL_FROM", "RESEND_FROM", "SMTP_FROM") || (env("SMTP_USER") ? `Glasswings <${env("SMTP_USER")}>` : "Glasswings <noreply@glass-wings.com>");
const clean = s => String(s == null ? "" : s).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 900) || "-";
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dest = p => { const d = String(p || "").replace(/\D/g, "").replace(/^0+/, ""); return d.length < 10 ? null : d.length === 10 ? "+91" + d : "+" + d; };

const STATUS = {
  publish: ["🎉 Congratulations! Your event is LIVE on Glasswings", "is now live on Glasswings. Members can see it and book tickets right away.", "#16A34A"],
  changes: ["✏️ Small changes needed before we publish", "needs a few changes before we can publish it.", "#D97706"],
  unpublish: ["⏸️ Your event has been unpublished", "has been taken off the app for now.", "#DC2626"],
};

async function sendEmail(to, subject, html, text) {
  try {
    if (env("RESEND_API_KEY")) {
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM, to: [to], subject, html, text }) });
      return r.ok ? "sent" : "failed: " + (await r.text()).slice(0, 200);
    }
    if (env("BREVO_API_KEY", "SENDINBLUE_API_KEY")) {
      const m = FROM.match(/^(.*)<(.+)>$/); const sender = m ? { name: m[1].trim() || "Glasswings", email: m[2].trim() } : { name: "Glasswings", email: FROM };
      const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": env("BREVO_API_KEY", "SENDINBLUE_API_KEY"), "Content-Type": "application/json" }, body: JSON.stringify({ sender, to: [{ email: to }], subject, htmlContent: html, textContent: text }) });
      return r.ok ? "sent" : "failed: " + (await r.text()).slice(0, 200);
    }
    if (env("SENDGRID_API_KEY")) {
      const m = FROM.match(/^(.*)<(.+)>$/); const from = m ? { name: m[1].trim(), email: m[2].trim() } : { email: FROM };
      const r = await fetch("https://api.sendgrid.com/v3/mail/send", { method: "POST", headers: { Authorization: `Bearer ${env("SENDGRID_API_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify({ personalizations: [{ to: [{ email: to }] }], from, subject, content: [{ type: "text/plain", value: text }, { type: "text/html", value: html }] }) });
      return r.ok ? "sent" : "failed: " + (await r.text()).slice(0, 200);
    }
    if (env("SMTP_HOST") && env("SMTP_USER")) {
      const nm = await import("nodemailer").catch(() => null);
      if (!nm) return "not_setup";
      const tr = (nm.default || nm).createTransport({ host: env("SMTP_HOST"), port: Number(env("SMTP_PORT") || 465), secure: Number(env("SMTP_PORT") || 465) === 465, auth: { user: env("SMTP_USER"), pass: env("SMTP_PASS", "SMTP_PASSWORD") } });
      await tr.sendMail({ from: FROM, to, subject, html, text });
      return "sent";
    }
    return "not_setup";
  } catch (e) { return "failed: " + (e.message || e); }
}

async function sendWhatsApp(campaign, to, name, params) {
  if (!AISENSY_KEY || !campaign) return "not_setup";
  try {
    const r = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: AISENSY_KEY, campaignName: campaign, destination: to, userName: clean(name), source: "glasswings-event-review", templateParams: params }) });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { }
    const ok = r.ok && !(j && (j.success === false || j.success === "false" || j.status === "error" || j.errorMessage || j.error));
    return ok ? "sent" : "failed: " + ((j && (j.errorMessage || j.message || j.error)) || t).toString().slice(0, 200);
  } catch (e) { return "failed: " + (e.message || e); }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!SB_URL || !SB_SERVICE) return res.status(200).json({ ok: false, error: "Supabase keys are missing in Vercel." });
  try {
    const { access_token, event_id, action } = body(req);
    const user = await getUser(access_token);
    if (!user) return res.status(401).json({ error: "Please log in again" });
    const info = await rpc("event_review_notify_info", { p_event: event_id, p_user: user.id });
    if (!info?.ok) return res.status(403).json({ error: info?.error || "Not allowed" });
    const c = info.contact || {};
    const st = STATUS[action] || STATUS.changes;
    const link = `https://glass-wings.com/e/${c.event_id}`;
    const note = c.note ? String(c.note) : "";
    const subject = `${st[0]}: ${c.title}`;
    const text = `Hi ${c.first},\n\nYour event "${c.title}" ${st[1]}${note ? `\n\nWhat to change:\n${note}\n\nPlease update it in the Glasswings app (Admin → Events → open the event), then tap "📤 Send for review" again.` : ""}\n\n${action === "publish" ? `See it live: ${link}` : ""}\n\nTeam Glasswings`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:14px;overflow:hidden">
      <div style="background:${st[2]};color:#fff;padding:18px 20px;font-size:18px;font-weight:bold">${esc(st[0])}</div>
      <div style="padding:20px;color:#111;font-size:15px;line-height:1.55">
        <p>Hi ${esc(c.first)},</p>
        <p>Your event <b>${esc(c.title)}</b> ${esc(st[1])}</p>
        ${note ? `<div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:12px 14px;margin:14px 0"><b>✏️ What to change</b><br>${esc(note).replace(/\n/g, "<br>")}</div>
        <p>Please update it in the Glasswings app (<b>Admin → Events → open the event</b>), then tap <b>📤 Send for review</b> again. We'll check it quickly.</p>` : ""}
        ${action === "publish" ? `<p><a href="${link}" style="display:inline-block;background:#008069;color:#fff;text-decoration:none;padding:11px 18px;border-radius:999px;font-weight:bold">See it live</a></p>` : ""}
        <p style="color:#666">Team Glasswings</p>
      </div></div>`;
    let mailHtml = html, mailText = text, mailSubject = subject;
    if (action === "publish") {
      const when = [c.event_date, c.place].filter(Boolean).join(" · ");
      mailSubject = `🎉 Congratulations! "${c.title}" is now LIVE on Glasswings`;
      mailText = `Hi ${c.first},\n\nCongratulations! 🎉 Your event "${c.title}" has been reviewed by the Glasswings team and is now LIVE.\n${when ? when + "\n" : ""}\nMembers can now see it and book tickets.\n\nYour event link: ${link}\n\nWhat to do next:\n1. Share the link on WhatsApp, Instagram and your groups.\n2. Watch your bookings in the Glasswings app: Admin → Events → your event → Sales.\n3. On the day, use ✅ Check-in to scan tickets at the door.\n\nNeed help? Just reply to this email.\n\nAll the best for a full house!\nTeam Glasswings`;
      mailHtml = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#047857,#10B981);color:#fff;padding:24px 22px;text-align:center">
          <div style="font-size:40px">🎉</div>
          <div style="font-size:22px;font-weight:bold;margin-top:4px">Congratulations, ${esc(c.first)}!</div>
          <div style="font-size:15px;opacity:.95;margin-top:4px">Your event is now LIVE on Glasswings</div>
        </div>
        ${c.image ? `<img src="${esc(c.image)}" alt="" style="width:100%;max-height:340px;object-fit:cover;display:block">` : ""}
        <div style="padding:20px 22px;color:#111;font-size:15px;line-height:1.6">
          <div style="font-size:19px;font-weight:bold">${esc(c.title)}</div>
          ${when ? `<div style="color:#555;margin-top:2px">📅 ${esc(when)}</div>` : ""}
          <p>Our team has checked your event and it is now visible to all Glasswings members. They can book tickets right away. ✅</p>
          <p style="text-align:center;margin:20px 0"><a href="${link}" style="display:inline-block;background:#008069;color:#fff;text-decoration:none;padding:13px 24px;border-radius:999px;font-weight:bold;font-size:16px">👀 See your live event</a></p>
          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:12px 14px">
            <b>What to do next</b>
            <ol style="margin:8px 0 0 18px;padding:0">
              <li>📲 <b>Share your link</b> on WhatsApp, Instagram and your groups:<br><a href="${link}" style="color:#008069">${esc(link)}</a></li>
              <li>💰 <b>Watch your bookings</b> in the app: Admin → Events → your event → Sales.</li>
              <li>✅ <b>On the day</b>, use Check-in to scan tickets at the door.</li>
            </ol>
          </div>
          <p style="color:#555">Need help? Just reply to this email.</p>
          <p>All the best for a full house! 🙌<br><b>Team Glasswings</b></p>
        </div></div>`;
    }
    const email = c.email ? await sendEmail(c.email, mailSubject, mailHtml, mailText) : "no_email";
    const to = dest(c.phone);
    const liveCamp = action === "publish" ? info.live_campaign : null;
    const wa = !to ? "no_phone"
      : liveCamp ? await sendWhatsApp(liveCamp, to, c.first, [clean(c.first), clean(c.title), clean([c.event_date, c.place].filter(Boolean).join(" · ") || "-"), link.replace(/^https?:\/\//, "")])
      : await sendWhatsApp(info.campaign, to, c.first, [clean(c.first), clean(c.title), clean(st[0]), clean(note || "-")]);
    try { await rpc("event_review_notify_log", { p_event: event_id, p_user: user.id, p_action: action || "", p_email: String(email).slice(0, 300), p_wa: String(wa).slice(0, 300) }); } catch { }
    return res.status(200).json({ ok: true, email, whatsapp: wa, contact: { name: c.name, first: c.first, phone: c.phone, email: c.email } });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Couldn't notify" });
  }
}
