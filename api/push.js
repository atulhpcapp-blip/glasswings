// Glasswings — push sender (Vercel serverless function).
// Triggered by a Supabase Database Webhook on INSERT into public.messages.
// Env vars required (set in Vercel → Project → Settings → Environment Variables):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT, PUSH_SECRET
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:hello@glasswings.app",
  process.env.VAPID_PUBLIC,
  process.env.VAPID_PRIVATE
);

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); } });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (process.env.PUSH_SECRET && req.headers["x-push-secret"] !== process.env.PUSH_SECRET)
    return res.status(401).json({ error: "auth" });

  const body = typeof req.body === "object" && req.body ? req.body : await readBody(req);
  const m = body.record || body;
  if (!m || !m.group_type || !m.group_id) return res.status(200).json({ skipped: true });

  // ---- Work out who should be notified, and the notification title ----
  let recipientIds = [];
  let title = "Glasswings";
  try {
    if (m.group_type === "room") {
      const { data: subs } = await sb.from("room_subscriptions").select("user_id").eq("room_id", m.group_id).eq("status", "active");
      const { data: mods } = await sb.from("room_moderators").select("user_id").eq("room_id", m.group_id);
      recipientIds = [...(subs || []), ...(mods || [])].map((r) => r.user_id);
      const { data: room } = await sb.from("rooms").select("name").eq("id", m.group_id).single();
      title = room?.name || "Glasswings";
    } else if (m.group_type === "event") {
      const { data: tk } = await sb.from("event_tickets").select("user_id").eq("event_id", m.group_id);
      const { data: mods } = await sb.from("event_moderators").select("user_id").eq("event_id", m.group_id);
      recipientIds = [...(tk || []), ...(mods || [])].map((r) => r.user_id);
      const { data: ev } = await sb.from("events").select("title").eq("id", m.group_id).single();
      title = ev?.title || "Glasswings";
    } else if (m.group_type === "p2p") {
      const { data: th } = await sb.from("dm_threads").select("a, b").eq("id", m.group_id).maybeSingle();
      if (th) {
        recipientIds = [th.a === m.sender_id ? th.b : th.a];
        const { data: who } = await sb.from("profiles").select("full_name").eq("id", m.sender_id).single();
        title = who?.full_name || "New message";
      }
    } else if (m.group_type === "dm") {
      if (m.sender_id === m.group_id) {
        // member replied -> notify admins
        const { data: admins } = await sb.from("profiles").select("id")
          .or("role.in.(admin,superadmin,subadmin),roles.ov.{admin,superadmin,subadmin}");
        recipientIds = (admins || []).map((r) => r.id);
        const { data: who } = await sb.from("profiles").select("full_name").eq("id", m.sender_id).single();
        title = who?.full_name || "New reply";
      } else {
        recipientIds = [m.group_id];
        title = "Glasswings";
      }
    }
  } catch (e) {
    return res.status(200).json({ error: "lookup", detail: String(e) });
  }

  // Don't notify the sender; de-dupe
  recipientIds = [...new Set(recipientIds.filter((id) => id && id !== m.sender_id))];
  console.log("PUSH recipients", m.group_type, "count=", recipientIds.length);
  if (!recipientIds.length) return res.status(200).json({ recipients: 0 });

  // ---- Notification body ----
  let preview = m.body || "";
  if (m.media_type === "event") preview = "🎟️ " + (m.body ? m.body.split("\n")[0] : "New event");
  else if (m.media_type === "broadcast") preview = "📢 " + (m.body || "Announcement");
  else if (m.media_type === "image") preview = "📷 Photo";
  else if (m.media_type === "file") preview = "📎 Attachment";
  if (preview.length > 140) preview = preview.slice(0, 137) + "…";

  const payload = JSON.stringify({ title, body: preview, url: "/", tag: m.group_type + ":" + m.group_id });

  // ---- Fetch subscriptions and send ----
  const { data: subs } = await sb.from("push_subscriptions").select("*").in("user_id", recipientIds);
  console.log("PUSH subs found", (subs || []).length);
  let sent = 0;
  await Promise.all((subs || []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      sent++;
    } catch (err) {
      console.error("PUSH send error", err && err.statusCode, err && (err.body || err.message));
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
  }));

  console.log("PUSH done sent", sent, "of", (subs || []).length);
  return res.status(200).json({ recipients: recipientIds.length, sent });
}
