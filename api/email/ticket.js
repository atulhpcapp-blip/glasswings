// Glasswings — email engine via Resend (single function, two modes):
//  mode "ticket" (default): ticket email — event banner, QR, community,
//    optional marketing banner, upcoming events.
//  mode "blast": superadmin bulk email to all members — marketing banner,
//    message, community, upcoming events.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, (optional) RESEND_FROM
import { createClient } from "@supabase/supabase-js";

export const config = { maxDuration: 60 };

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
function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// ---------- shared sections ----------
async function getExtras() {
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: rooms }, { data: ups }, { data: mkt }] = await Promise.all([
    sb.from("rooms").select("name").limit(4),
    sb.from("events").select("id, title, emoji, event_date, city").eq("approved", true).gte("event_at", today).order("event_at", { ascending: true }).limit(4),
    sb.from("app_settings").select("value").eq("key", "marketing_banner_url").maybeSingle(),
  ]);
  return { rooms: rooms || [], ups: ups || [], mktUrl: (mkt?.value || "").trim() };
}

function communityHtml(rooms) {
  const names = rooms.map(r => r.name).filter(Boolean).slice(0, 4).join(" · ");
  return `
    <tr><td style="padding:0 24px 18px">
      <div style="background:linear-gradient(135deg,#0C1A16,#063b32);border-radius:14px;padding:20px;color:#fff">
        <div style="font-size:16px;font-weight:800">More than tickets — it's a community 💚</div>
        <div style="font-size:12.5px;opacity:.85;margin-top:5px;line-height:1.5">Glasswings is where your city's people actually meet — rooms, socials and event nights.</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px">
          <tr><td style="font-size:13px;padding:4px 0">💬&nbsp; <b>Rooms</b>${names ? ` — ${esc(names)}` : ""}</td></tr>
          <tr><td style="font-size:13px;padding:4px 0">✨&nbsp; <b>Meetups &amp; socials</b> — something every week</td></tr>
          <tr><td style="font-size:13px;padding:4px 0">🎟️&nbsp; <b>Event chats</b> — every event has its own room</td></tr>
        </table>
        <a href="https://glass-wings.com" style="display:inline-block;margin-top:14px;background:#2FD4A8;color:#08130F;font-weight:800;font-size:13px;text-decoration:none;padding:10px 18px;border-radius:10px">Explore the community →</a>
      </div>
    </td></tr>`;
}

function marketingHtml(url) {
  if (!url) return "";
  return `
    <tr><td style="padding:0 24px 18px">
      <a href="https://glass-wings.com" style="text-decoration:none">
        <img src="${esc(url)}" alt="" width="100%" style="display:block;width:100%;border-radius:12px" />
      </a>
    </td></tr>`;
}

function upcomingHtml(ups, excludeId) {
  const list = ups.filter(e => e.id !== excludeId).slice(0, 3);
  if (!list.length) return "";
  const rows = list.map(e => `
    <a href="https://glass-wings.com/e/${e.id}" style="display:block;text-decoration:none;border:1px solid #e6ebe9;border-radius:12px;padding:11px 13px;margin-bottom:8px">
      <span style="font-size:14px;font-weight:800;color:#0b1f1c">${esc((e.emoji || "🎟️") + " " + e.title)}</span><br/>
      <span style="font-size:12px;color:#5a6b67">${esc([e.event_date, e.city].filter(Boolean).join(" · "))}</span>
    </a>`).join("");
  return `
    <tr><td style="padding:0 24px 20px">
      <div style="font-size:13.5px;font-weight:800;color:#0b1f1c;margin-bottom:9px">🔥 Upcoming events</div>
      ${rows}
    </td></tr>`;
}

function wrap(inner) {
  return `
<div style="background:#eef2f1;padding:24px;font-family:Segoe UI,system-ui,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,.10)">
    ${inner}
  </table>
  <div style="text-align:center;color:#9aa7a3;font-size:11px;margin-top:14px">Glasswings Events · <a href="https://glass-wings.com" style="color:#9aa7a3">glass-wings.com</a></div>
</div>`;
}

async function sendResend(API, FROM, to, subject, html) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${API}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  return { ok: r.ok, out: await r.json() };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const API = process.env.RESEND_API_KEY;
  if (!API) return res.status(200).json({ skipped: "email not configured" });
  const FROM = process.env.RESEND_FROM || "Glasswings Events <onboarding@resend.dev>";

  const body = (typeof req.body === "object" && req.body) ? req.body : await readBody(req);
  const { access_token, event_id, for_user, mode } = body;

  try {
    const { data: ures } = await sb.auth.getUser(access_token);
    const callerId = ures?.user?.id;
    if (!callerId) return res.status(401).json({ error: "Please log in again." });

    // ================= VIBE CHECK EMAIL =================
    if (mode === "vibe_email") {
      const { match_id } = body;
      if (!match_id) return res.status(400).json({ error: "match_id required" });
      const { data: m } = await sb.from("vibe_matches").select("id, a, b, a_answers, b_answers, created_at").eq("id", match_id).maybeSingle();
      if (!m) return res.status(404).json({ error: "match not found" });
      if (m.a !== callerId && m.b !== callerId) return res.status(403).json({ error: "not your match" });

      // invite stage -> email b; answered stage -> email a
      const isInvite = !m.b_answers;
      const toId = isInvite ? m.b : m.a;
      const fromId = isInvite ? m.a : m.b;
      const { data: ppl } = await sb.from("profiles").select("id, full_name").in("id", [toId, fromId]);
      const nameOf = (id) => (ppl || []).find(x => x.id === id)?.full_name || "Someone";
      const { data: au } = await sb.auth.admin.getUserById(toId);
      const toEmail = au?.user?.email;
      if (!toEmail) return res.status(200).json({ skipped: "no email" });

      const fromName = nameOf(fromId);
      const subject = isInvite
        ? `\uD83D\uDC98 ${fromName} sent you a Vibe Check!`
        : `\u2728 ${fromName} answered \u2014 your match % is ready!`;
      const inner = isInvite
        ? `<p style="font-size:15px;color:#333;margin:0 0 14px"><b>${fromName}</b> wants to know how compatible you two are \uD83D\uDE0F</p>
           <p style="font-size:14px;color:#555;margin:0 0 18px">Answer 10 quick questions and your match % gets revealed to both of you.</p>`
        : `<p style="font-size:15px;color:#333;margin:0 0 14px"><b>${fromName}</b> just answered your Vibe Check \u2014 your compatibility score is waiting!</p>`;
      const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #eee;border-radius:14px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#EC4899,#8B5CF6);padding:26px 22px;text-align:center;color:#fff">
          <div style="font-size:30px">\uD83D\uDC98</div>
          <div style="font-size:20px;font-weight:800;margin-top:6px">Vibe Check</div>
          <div style="font-size:12px;opacity:.9;letter-spacing:2px;margin-top:3px">GLASSWINGS</div>
        </div>
        <div style="padding:24px 22px">
          ${inner}
          <a href="https://glass-wings.com/?game=vibe" style="display:block;text-align:center;background:#EC4899;color:#fff;text-decoration:none;font-weight:800;padding:13px;border-radius:11px;font-size:15px">${isInvite ? "Answer now \uD83D\uDC95" : "See your match % \u2728"}</a>
          <p style="font-size:11px;color:#999;text-align:center;margin:16px 0 0">Open the link, log in, and it takes you straight to the game.</p>
        </div>
      </div>`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${API}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [toEmail], subject, html }),
      });
      const out = await r.json();
      return res.status(200).json({ sent: true, id: out?.id });
    }

    // ================= BLAST MODE (superadmin bulk email) =================
    if (mode === "blast") {
      const { data: caller } = await sb.from("profiles").select("roles, role").eq("id", callerId).single();
      const isSuper = (caller?.roles || []).includes("superadmin") || caller?.role === "superadmin";
      if (!isSuper) return res.status(403).json({ error: "Only the superadmin can send bulk emails." });

      const subject = (body.subject || "").trim();
      const message = (body.message || "").trim();
      if (!subject || !message) return res.status(400).json({ error: "Subject and message are required." });

      const x = await getExtras();
      const msgHtml = message.split(/\n{2,}/).map(p =>
        `<p style="font-size:14px;color:#23332f;line-height:1.6;margin:0 0 12px">${esc(p).replace(/\n/g, "<br/>")}</p>`).join("");
      const inner = `
        ${x.mktUrl ? `<tr><td><a href="https://glass-wings.com"><img src="${esc(x.mktUrl)}" alt="" width="100%" style="display:block;width:100%" /></a></td></tr>` : `
        <tr><td style="background:linear-gradient(135deg,#008069,#04B08F);padding:20px 24px;color:#fff">
          <div style="font-size:11px;letter-spacing:3px;font-weight:800;opacity:.9">G L A S S W I N G S &nbsp; E V E N T S</div>
        </td></tr>`}
        <tr><td style="padding:22px 24px 6px">
          <div style="font-size:19px;font-weight:800;color:#0b1f1c;margin-bottom:12px">${esc(subject)}</div>
          ${msgHtml}
        </td></tr>
        ${communityHtml(x.rooms)}
        ${upcomingHtml(x.ups, null)}`;
      const html = wrap(inner);

      // recipient list: explicit segment emails, or every member
      let emails = [];
      if (Array.isArray(body.emails) && body.emails.length) {
        emails = body.emails.filter(e2 => typeof e2 === "string" && e2.includes("@")).slice(0, 5000);
      } else {
        let page = 1;
        while (page < 40) {
          const { data: pageData, error: le } = await sb.auth.admin.listUsers({ page, perPage: 200 });
          if (le) break;
          const users = pageData?.users || [];
          users.forEach(u => { if (u.email) emails.push(u.email); });
          if (users.length < 200) break;
          page++;
        }
      }
      const uniq = [...new Set(emails)];

      // send in batches of 90 via Resend's batch endpoint
      let sent = 0, failed = 0;
      for (let i = 0; i < uniq.length; i += 90) {
        const chunk = uniq.slice(i, i + 90).map(to => ({ from: FROM, to, subject, html }));
        const r = await fetch("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: { Authorization: `Bearer ${API}`, "Content-Type": "application/json" },
          body: JSON.stringify(chunk),
        });
        if (r.ok) sent += chunk.length; else failed += chunk.length;
      }
      return res.status(200).json({ ok: true, recipients: uniq.length, sent, failed });
    }

    // ================= SIGNUP NOTIFY (new member -> staff email) =================
    if (mode === "signup_notify") {
      const [{ data: me2 }, { data: cnt }] = await Promise.all([
        sb.from("profiles").select("full_name, gender, created_at").eq("id", callerId).single(),
        sb.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      // only notify for genuinely fresh profiles (avoid re-fires)
      if (me2?.created_at && Date.now() - new Date(me2.created_at).getTime() > 48 * 3600000)
        return res.status(200).json({ skipped: "not a new profile" });
      const { data: staff } = await sb.from("profiles").select("id")
        .or("role.in.(superadmin,admin),roles.ov.{superadmin,admin}");
      const tos = [];
      for (const st of (staff || [])) {
        const { data: u2 } = await sb.auth.admin.getUserById(st.id);
        if (u2?.user?.email) tos.push(u2.user.email);
      }
      if (!tos.length) return res.status(200).json({ skipped: "no staff emails" });
      const html = wrap(`
        <tr><td style="background:linear-gradient(135deg,#008069,#04B08F);padding:20px 24px;color:#fff">
          <div style="font-size:11px;letter-spacing:3px;font-weight:800;opacity:.9">G L A S S W I N G S</div>
          <div style="font-size:20px;font-weight:800;margin-top:8px">🎉 New member joined</div>
        </td></tr>
        <tr><td style="padding:20px 24px">
          <div style="font-size:18px;font-weight:800;color:#0b1f1c">${esc(me2?.full_name || "New member")} ${me2?.gender === "female" ? "♀" : me2?.gender === "male" ? "♂" : ""}</div>
          <div style="font-size:13px;color:#5a6b67;margin-top:6px">Joined just now · community is now <b>${(typeof cnt === "number" ? cnt : "")}</b> members strong.</div>
          <a href="https://glass-wings.com" style="display:inline-block;margin-top:14px;background:#008069;color:#fff;font-weight:800;font-size:13px;text-decoration:none;padding:10px 18px;border-radius:10px">Open Admin → Members</a>
        </td></tr>`);
      let sent2 = 0;
      for (const to2 of [...new Set(tos)]) {
        const { ok } = await sendResend(API, FROM, to2, `🎉 New Glasswings member: ${me2?.full_name || "someone"}`, html);
        if (ok) sent2++;
      }
      return res.status(200).json({ ok: true, notified: sent2 });
    }

    // ================= GUEST MODE (manual guest-list ticket) =================
    if (mode === "guest") {
      const { data: caller } = await sb.from("profiles").select("roles, role").eq("id", callerId).single();
      const staff = (caller?.roles || []).some(r => ["superadmin", "admin", "subadmin", "organiser"].includes(r)) || ["superadmin", "admin", "subadmin"].includes(caller?.role);
      if (!staff) return res.status(403).json({ error: "Not allowed." });
      const { data: g } = await sb.from("guest_tickets").select("*").eq("id", body.guest_id).maybeSingle();
      if (!g) return res.status(400).json({ error: "Guest not found." });
      if (!g.email) return res.status(200).json({ skipped: "guest has no email" });
      const [{ data: gev }, gx] = await Promise.all([
        sb.from("events").select("title, emoji, event_date, venue, city, banner_url, banner_type, poster_url").eq("id", g.event_id).single(),
        getExtras(),
      ]);
      if (!gev) return res.status(200).json({ skipped: "no event" });
      const gbanner = (gev.banner_url && gev.banner_type !== "video") ? gev.banner_url : (gev.poster_url || null);
      const gplace = [gev.venue, gev.city].filter(Boolean).join(", ");
      const gqr = "https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=1&data=" + encodeURIComponent(g.code);
      const ginner = `
      ${gbanner ? `<tr><td><img src="${esc(gbanner)}" alt="" width="100%" style="display:block;width:100%;max-height:240px;object-fit:cover" /></td></tr>` : ""}
      <tr><td style="background:linear-gradient(135deg,#008069,#04B08F);padding:20px 24px;color:#fff">
        <div style="font-size:11px;letter-spacing:3px;font-weight:800;opacity:.9">G L A S S W I N G S &nbsp; E V E N T S</div>
        <div style="font-size:22px;font-weight:800;margin-top:8px">${esc((gev.emoji || "🎟️") + " " + gev.title)}</div>
        ${gev.event_date ? `<div style="font-size:14px;margin-top:10px;opacity:.96">📅 ${esc(gev.event_date)}</div>` : ""}
        ${gplace ? `<div style="font-size:14px;margin-top:5px;opacity:.96">📍 ${esc(gplace)}</div>` : ""}
      </td></tr>
      <tr><td style="padding:22px 24px 8px">
        <div style="font-size:11px;letter-spacing:1.5px;color:#5a6b67;text-transform:uppercase;font-weight:700">Guest</div>
        <div style="font-size:20px;font-weight:800;color:#0b1f1c;margin:2px 0 14px">${esc(g.name)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:32px;vertical-align:top">
            <div style="font-size:11px;letter-spacing:1.5px;color:#5a6b67;text-transform:uppercase;font-weight:700">Entries</div>
            <div style="font-size:24px;font-weight:800;color:#0b1f1c">${g.quantity || 1}</div>
          </td>
          <td style="vertical-align:top">
            <div style="font-size:11px;letter-spacing:1.5px;color:#5a6b67;text-transform:uppercase;font-weight:700">Entry code</div>
            <div style="display:inline-block;margin-top:4px;background:#E7F6EF;color:#008069;font-weight:800;letter-spacing:1.5px;font-family:monospace;font-size:18px;padding:6px 12px;border-radius:9px">${esc(g.code)}</div>
          </td>
        </tr></table>
      </td></tr>
      <tr><td align="center" style="padding:6px 24px 18px">
        <div style="border:2px dashed #cfe3dd;border-radius:14px;display:inline-block;padding:14px 18px 10px">
          <img src="${gqr}" alt="Entry QR ${esc(g.code)}" width="180" height="180" style="display:block;border-radius:8px" />
          <div style="font-size:11px;letter-spacing:2px;color:#5a6b67;font-weight:800;margin-top:8px;text-align:center">SCAN AT ENTRY</div>
        </div>
        <div style="font-size:12px;margin-top:8px"><a href="https://glass-wings.com/?gt=${esc(g.code)}" style="color:#008069;font-weight:700">Open your ticket online →</a></div>
      </td></tr>
      ${communityHtml(gx.rooms)}
      ${marketingHtml(gx.mktUrl)}
      ${upcomingHtml(gx.ups, g.event_id)}
      <tr><td style="padding:0 24px 22px">
        <div style="border-top:1px solid #e6ebe9;padding-top:14px;font-size:12.5px;color:#5a6b67">Show the QR at the door. See you there!</div>
      </td></tr>`;
      const { ok: gok, out: gout } = await sendResend(API, FROM, g.email, `GLASSWINGS INVITATION FOR ${gev.title}`, wrap(ginner));
      if (!gok) return res.status(502).json({ error: gout?.message || "Email failed." });
      return res.status(200).json({ ok: true, id: gout.id });
    }

    // ================= TICKET MODE (default) =================
    let uid = callerId;
    let to = ures?.user?.email;
    if (!event_id) return res.status(200).json({ skipped: "missing data" });

    if (for_user && for_user !== callerId) {
      const { data: caller } = await sb.from("profiles").select("roles, role").eq("id", callerId).single();
      const staff = (caller?.roles || []).some(r => ["superadmin", "admin", "subadmin", "organiser"].includes(r)) || ["superadmin", "admin", "subadmin"].includes(caller?.role);
      if (!staff) return res.status(403).json({ error: "Not allowed." });
      const { data: target } = await sb.auth.admin.getUserById(for_user);
      if (!target?.user?.email) return res.status(200).json({ skipped: "guest has no email" });
      uid = for_user; to = target.user.email;
    }
    if (!to) return res.status(200).json({ skipped: "missing data" });

    const [{ data: ev }, { data: me }, { data: tks }, x] = await Promise.all([
      sb.from("events").select("title, emoji, event_date, venue, city, banner_url, banner_type, poster_url").eq("id", event_id).single(),
      sb.from("profiles").select("full_name").eq("id", uid).single(),
      sb.from("event_tickets").select("id, quantity").eq("event_id", event_id).eq("user_id", uid).order("created_at", { ascending: true }),
      getExtras(),
    ]);
    if (!ev) return res.status(200).json({ skipped: "no event" });

    const qty = (tks || []).reduce((a, r) => a + (r.quantity || 1), 0) || 1;
    const base = ((tks && tks[0]?.id) || (uid + event_id)).replace(/-/g, "");
    const code = "GW-" + (base.slice(0, 8).toUpperCase() || "TICKET");
    const name = me?.full_name || "Member";
    const place = [ev.venue, ev.city].filter(Boolean).join(", ");
    const banner = (ev.banner_url && ev.banner_type !== "video") ? ev.banner_url : (ev.poster_url || null);
    const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=1&data=" + encodeURIComponent(code);

    const inner = `
    ${banner ? `<tr><td><img src="${esc(banner)}" alt="" width="100%" style="display:block;width:100%;max-height:240px;object-fit:cover" /></td></tr>` : ""}
    <tr><td style="background:linear-gradient(135deg,#008069,#04B08F);padding:20px 24px;color:#fff">
      <div style="font-size:11px;letter-spacing:3px;font-weight:800;opacity:.9">G L A S S W I N G S &nbsp; E V E N T S</div>
      <div style="font-size:22px;font-weight:800;margin-top:8px">${esc((ev.emoji || "🎟️") + " " + ev.title)}</div>
      ${ev.event_date ? `<div style="font-size:14px;margin-top:10px;opacity:.96">📅 ${esc(ev.event_date)}</div>` : ""}
      ${place ? `<div style="font-size:14px;margin-top:5px;opacity:.96">📍 ${esc(place)}</div>` : ""}
    </td></tr>
    <tr><td style="padding:22px 24px 8px">
      <div style="font-size:11px;letter-spacing:1.5px;color:#5a6b67;text-transform:uppercase;font-weight:700">Attendee</div>
      <div style="font-size:20px;font-weight:800;color:#0b1f1c;margin:2px 0 14px">${esc(name)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:32px;vertical-align:top">
          <div style="font-size:11px;letter-spacing:1.5px;color:#5a6b67;text-transform:uppercase;font-weight:700">Tickets</div>
          <div style="font-size:24px;font-weight:800;color:#0b1f1c">${qty}</div>
        </td>
        <td style="vertical-align:top">
          <div style="font-size:11px;letter-spacing:1.5px;color:#5a6b67;text-transform:uppercase;font-weight:700">Ticket code</div>
          <div style="display:inline-block;margin-top:4px;background:#E7F6EF;color:#008069;font-weight:800;letter-spacing:1.5px;font-family:monospace;font-size:18px;padding:6px 12px;border-radius:9px">${esc(code)}</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td align="center" style="padding:6px 24px 18px">
      <div style="border:2px dashed #cfe3dd;border-radius:14px;display:inline-block;padding:14px 18px 10px">
        <img src="${qrUrl}" alt="Entry QR ${esc(code)}" width="180" height="180" style="display:block;border-radius:8px" />
        <div style="font-size:11px;letter-spacing:2px;color:#5a6b67;font-weight:800;margin-top:8px;text-align:center">SCAN AT ENTRY</div>
      </div>
    </td></tr>
    ${communityHtml(x.rooms)}
    ${marketingHtml(x.mktUrl)}
    ${upcomingHtml(x.ups, event_id)}
    <tr><td style="padding:0 24px 22px">
      <div style="border-top:1px solid #e6ebe9;padding-top:14px;font-size:12.5px;color:#5a6b67">Show the QR (or your in-app ticket) at the door. See you there!</div>
    </td></tr>`;

    const { ok, out } = await sendResend(API, FROM, to, `GLASSWINGS INVITATION FOR ${ev.title}`, wrap(inner));
    if (!ok) return res.status(502).json({ error: out?.message || "Email failed." });
    return res.status(200).json({ ok: true, id: out.id });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Something went wrong." });
  }
}
