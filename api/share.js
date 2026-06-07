// Glasswings — social share previews (Open Graph) for events.
// Crawlers (WhatsApp/Facebook/Twitter) get the event banner + branding;
// humans are instantly redirected into the app.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const GAMES = {
  antakshari: {
    title: "🎵 Antakshari — GLASSWINGS",
    descr: "The community song chain is LIVE! Sing a song, pass the letter, climb the leaderboard. Free to play — join Glasswings and keep the chain alive 🎤",
  },
  trivia: {
    title: "🎮 Daily Trivia — GLASSWINGS",
    descr: "5 fresh questions every day. Beat the community, build your streak 🔥 Free to play — join Glasswings and take today's quiz!",
  },
  ludo: {
    title: "🎲 Ludo — GLASSWINGS",
    descr: "Classic Ludo with friends! Create a game, share the code, play 2-4 players. Free on Glasswings — join the fun 🎉",
  },
  vibe: {
    title: "💘 Vibe Check — GLASSWINGS",
    descr: "How compatible are you two? Answer 10 questions, get your match % and see where you click. Free on Glasswings 😏",
  },
};

export default async function handler(req, res) {
  const gameKey = (req.query.game || "").toString().toLowerCase();
  if (GAMES[gameKey]) {
    const g = GAMES[gameKey];
    const origin = "https://glass-wings.com";
    const url = `${origin}/?game=${gameKey}`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=1200");
    return res.status(200).send(`<!doctype html><html><head><meta charset="utf-8">
<title>${esc(g.title)}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="GLASSWINGS">
<meta property="og:title" content="${esc(g.title)}">
<meta property="og:description" content="${esc(g.descr)}">
<meta property="og:image" content="${origin}/icon-512.png">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(g.title)}">
<meta name="twitter:description" content="${esc(g.descr)}">
<meta http-equiv="refresh" content="0;url=${esc(url)}">
</head><body><script>location.replace(${JSON.stringify(url)})</script>
<a href="${esc(url)}">Open Glasswings</a></body></html>`);
  }
  const id = (req.query.event || "").toString();
  let ev = null;
  if (id) {
    const { data } = await sb.from("events")
      .select("id,title,emoji,description,event_date,venue,city,banner_url,banner_type,poster_url")
      .eq("id", id).maybeSingle();
    ev = data;
  }
  const origin = "https://glass-wings.com";
  const url = ev ? `${origin}/?event=${ev.id}` : origin;
  const title = ev ? `${ev.emoji || "🎟️"} ${ev.title} — GLASSWINGS EVENTS` : "GLASSWINGS EVENTS";
  const place = [ev?.venue, ev?.city].filter(Boolean).join(", ");
  const descr = ev
    ? [ev.event_date, place, ev.description].filter(Boolean).join(" · ").slice(0, 200)
    : "Community events, socials & meetups";
  const img = (ev?.banner_url && ev.banner_type !== "video") ? ev.banner_url
    : (ev?.poster_url || `${origin}/icon-512.png`);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.status(200).send(`<!doctype html><html><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="GLASSWINGS EVENTS">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(descr)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(descr)}">
<meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${esc(url)}">
</head><body style="font-family:system-ui;padding:30px;text-align:center">
<script>location.replace(${JSON.stringify(url)})</script>
<a href="${esc(url)}">Open ${esc(ev ? ev.title : "Glasswings")}</a>
</body></html>`);
}
