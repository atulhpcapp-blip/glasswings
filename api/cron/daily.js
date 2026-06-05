// Glasswings — daily scheduler (Vercel Cron).
// 1) posts one "Upcoming events" digest into every room
// 2) clears chat messages of events that finished 3+ days ago (tickets/records kept)
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET
// Scheduled by vercel.json. Vercel sends "Authorization: Bearer <CRON_SECRET>".
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function ymd(d) { return d.toISOString().slice(0, 10); }

export default async function handler(req, res) {
  // auth: Vercel Cron Authorization header, or ?secret= for manual runs
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || "";
  const qsecret = (req.query && req.query.secret) || "";
  if (secret && auth !== `Bearer ${secret}` && qsecret !== secret) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const today = ymd(new Date());
  const cutoff = ymd(new Date(Date.now() - 3 * 86400000)); // 3 days ago
  const result = { posted_rooms: 0, cleared_events: 0 };

  try {
    // ---- 1) Upcoming-events digest -------------------------------------
    const { data: ups } = await sb.from("events")
      .select("title, emoji, event_date, event_at, city")
      .eq("approved", true)
      .gte("event_at", today).order("event_at", { ascending: true }).limit(15);

    if (ups && ups.length) {
      // sender = a superadmin
      let senderId = null;
      const { data: sa } = await sb.from("profiles").select("id").contains("roles", ["superadmin"]).limit(1);
      if (sa && sa.length) senderId = sa[0].id;
      if (!senderId) { const { data: sa2 } = await sb.from("profiles").select("id").eq("role", "superadmin").limit(1); if (sa2 && sa2.length) senderId = sa2[0].id; }

      if (senderId) {
        const lines = ups.map(e => `• ${e.emoji || "🎟️"} ${e.title} — ${e.event_date || ""}${e.city ? " · " + e.city : ""}`).join("\n");
        const body = `📅 Upcoming events\n\n${lines}\n\nTap Events to grab your tickets.`;
        const { data: rooms } = await sb.from("rooms").select("id");
        if (rooms && rooms.length) {
          const rows = rooms.map(r => ({ group_type: "room", group_id: r.id, sender_id: senderId, body }));
          const { error } = await sb.from("messages").insert(rows);
          if (!error) result.posted_rooms = rows.length;
        }
      }
    }

    // ---- 2) Clear chats of events finished 3+ days ago -----------------
    const { data: old } = await sb.from("events")
      .select("id").not("event_at", "is", null).lt("event_at", cutoff).eq("chat_cleared", false).limit(200);
    for (const e of (old || [])) {
      await sb.from("messages").delete().eq("group_type", "event").eq("group_id", e.id);
      await sb.from("events").update({ chat_cleared: true }).eq("id", e.id);
      result.cleared_events++;
    }

    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message || err) });
  }
}
