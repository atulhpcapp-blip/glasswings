// Glasswings — emails a ticket to the buyer via Resend.
// Called by the app right after a ticket is granted (paid or free).
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, (optional) RESEND_FROM
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
function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const API = process.env.RESEND_API_KEY;
  if (!API) return res.status(200).json({ skipped: "email not configured" });
  const FROM = process.env.RESEND_FROM || "Glasswings Events <onboarding@resend.dev>";

  const body = (typeof req.body === "object" && req.body) ? req.body : await readBody(req);
  const { access_token, event_id, for_user } = body;

  try {
    const { data: ures } = await sb.auth.getUser(access_token);
    const callerId = ures?.user?.id;
    let uid = callerId;
    let to = ures?.user?.email;
    if (!callerId || !event_id) return res.status(200).json({ skipped: "missing data" });

    // staff can send a ticket email to another member (guest-list comps)
    if (for_user && for_user !== callerId) {
      const { data: caller } = await sb.from("profiles").select("roles, role").eq("id", callerId).single();
      const staff = (caller?.roles || []).some(r => ["superadmin", "admin", "subadmin", "organiser"].includes(r)) || ["superadmin", "admin", "subadmin"].includes(caller?.role);
      if (!staff) return res.status(403).json({ error: "Not allowed." });
      const { data: target } = await sb.auth.admin.getUserById(for_user);
      if (!target?.user?.email) return res.status(200).json({ skipped: "guest has no email" });
      uid = for_user; to = target.user.email;
    }
    if (!to) return res.status(200).json({ skipped: "missing data" });

    const [{ data: ev }, { data: me }, { data: tks }] = await Promise.all([
      sb.from("events").select("title, emoji, event_date, venue, city").eq("id", event_id).single(),
      sb.from("profiles").select("full_name").eq("id", uid).single(),
      sb.from("event_tickets").select("id, quantity").eq("event_id", event_id).eq("user_id", uid).order("created_at", { ascending: true }),
    ]);
    if (!ev) return res.status(200).json({ skipped: "no event" });

    const qty = (tks || []).reduce((a, r) => a + (r.quantity || 1), 0) || 1;
    const base = ((tks && tks[0]?.id) || (uid + event_id)).replace(/-/g, "");
    const code = "GW-" + (base.slice(0, 8).toUpperCase() || "TICKET");
    const name = me?.full_name || "Member";
    const place = [ev.venue, ev.city].filter(Boolean).join(", ");

    const html = `
<div style="background:#eef2f1;padding:24px;font-family:Segoe UI,system-ui,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,.10)">
    <tr><td style="background:linear-gradient(135deg,#008069,#04B08F);padding:22px 24px;color:#fff">
      <div style="font-size:11px;letter-spacing:3px;font-weight:800;opacity:.9">G L A S S W I N G S</div>
      <div style="font-size:22px;font-weight:800;margin-top:8px">${esc((ev.emoji || "🎟️") + " " + ev.title)}</div>
      ${ev.event_date ? `<div style="font-size:14px;margin-top:10px;opacity:.96">📅 ${esc(ev.event_date)}</div>` : ""}
      ${place ? `<div style="font-size:14px;margin-top:5px;opacity:.96">📍 ${esc(place)}</div>` : ""}
    </td></tr>
    <tr><td style="padding:22px 24px">
      <div style="font-size:11px;letter-spacing:1.5px;color:#5a6b67;text-transform:uppercase;font-weight:700">Attendee</div>
      <div style="font-size:20px;font-weight:800;color:#0b1f1c;margin:2px 0 16px">${esc(name)}</div>
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
      <div style="border-top:1px solid #e6ebe9;margin-top:20px;padding-top:14px;font-size:12.5px;color:#5a6b67">Show this email or your in-app ticket at entry. See you there!</div>
    </td></tr>
  </table>
  <div style="text-align:center;color:#9aa7a3;font-size:11px;margin-top:14px">Glasswings Events · glass-wings.com</div>
</div>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${API}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject: `🎟️ Your ticket — ${ev.title}`, html }),
    });
    const out = await r.json();
    if (!r.ok) return res.status(502).json({ error: out?.message || "Email failed." });
    return res.status(200).json({ ok: true, id: out.id });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Something went wrong." });
  }
}
