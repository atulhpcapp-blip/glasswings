// GET /api/gif?q=term — Tenor v2 proxy (key stays server-side)
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const KEY = process.env.TENOR_API_KEY;
  if (!KEY) return res.status(503).json({ error: "setup" });
  const q = (req.query.q || "trending").toString().slice(0, 60);
  try {
    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${KEY}&limit=24&media_filter=gif,tinygif&contentfilter=medium`;
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || "Tenor error" });
    const gifs = (data.results || []).map(g => ({
      id: g.id,
      tiny: g.media_formats?.tinygif?.url || g.media_formats?.gif?.url,
      full: g.media_formats?.gif?.url || g.media_formats?.tinygif?.url,
    })).filter(g => g.tiny && g.full);
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ gifs });
  } catch (e) {
    return res.status(500).json({ error: e.message || "GIF search failed" });
  }
}
