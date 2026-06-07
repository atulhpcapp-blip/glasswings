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

    // sender = a superadmin (used by digest + reminders)
    let senderId = null;
    const { data: sa } = await sb.from("profiles").select("id").contains("roles", ["superadmin"]).limit(1);
    if (sa && sa.length) senderId = sa[0].id;
    if (!senderId) { const { data: sa2 } = await sb.from("profiles").select("id").eq("role", "superadmin").limit(1); if (sa2 && sa2.length) senderId = sa2[0].id; }

    if (ups && ups.length) {
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

    // ---- 1.5) Membership expiry reminders (T-7 and T-1) + cleanup ------
    try {
      const now = Date.now();
      const winStart = (d) => new Date(now + (d - 0.5) * 86400000).toISOString();
      const winEnd = (d) => new Date(now + (d + 0.5) * 86400000).toISOString();
      const { data: plansList } = await sb.from("plans").select("id, name, emoji");
      const planName = (id) => { const p = (plansList || []).find(x => x.id === id); return p ? `${p.emoji || "💎"} ${p.name}` : "💎 membership"; };
      for (const d of [7, 1]) {
        const { data: expiring } = await sb.from("member_plans")
          .select("id, user_id, plan_id, expires_at")
          .gte("expires_at", winStart(d)).lt("expires_at", winEnd(d));
        for (const mp of (expiring || [])) {
          const till = new Date(mp.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
          const body = d === 1
            ? `⌛ Your ${planName(mp.plan_id)} expires TOMORROW (${till})!\n\nRenew from your Profile to keep your rooms, games and ticket discounts running without a break. 💚`
            : `⌛ Heads up — your ${planName(mp.plan_id)} expires in 7 days (${till}).\n\nRenew anytime from your Profile and your validity simply extends. 💚`;
          if (senderId) await sb.from("messages").insert({ group_type: "dm", group_id: mp.user_id, sender_id: senderId, media_type: "broadcast", body });
          result.plan_reminders = (result.plan_reminders || 0) + 1;
        }
      }
      // expired 3+ days ago → remove plan rows (grace over)
      const { data: dead } = await sb.from("member_plans").select("id")
        .not("expires_at", "is", null).lt("expires_at", new Date(now - 3 * 86400000).toISOString()).limit(200);
      for (const m of (dead || [])) { await sb.from("member_plans").delete().eq("id", m.id); result.plans_expired = (result.plans_expired || 0) + 1; }
    } catch (e) { result.plan_reminder_error = String(e && e.message || e); }

    // ---- 1.7) Snaps vanish after 24h (Snapchat-style) -------------------
    try {
      const { data: deadSnaps } = await sb.from("messages").select("id")
        .eq("media_type", "snap").lt("created_at", new Date(Date.now() - 24 * 3600000).toISOString()).limit(500);
      for (const m of (deadSnaps || [])) { await sb.from("messages").delete().eq("id", m.id); result.snaps_vanished = (result.snaps_vanished || 0) + 1; }
    } catch (e) { result.snap_error = String(e && e.message || e); }

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
