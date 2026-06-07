// GET /api/gif?q=term — GIPHY proxy (key stays server-side)
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const KEY = process.env.GIPHY_API_KEY;
  if (!KEY) return res.status(503).json({ error: "setup" });
  const q = (req.query.q || "").toString().slice(0, 60).trim();
  try {
    const url = q
      ? `https://api.giphy.com/v1/gifs/search?api_key=${KEY}&q=${encodeURIComponent(q)}&limit=24&rating=pg-13`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${KEY}&limit=24&rating=pg-13`;
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.message || "GIPHY error" });
    const gifs = (data.data || []).map(g => ({
      id: g.id,
      tiny: g.images?.fixed_height_small?.url || g.images?.fixed_height?.url,
      full: g.images?.downsized?.url || g.images?.original?.url,
    })).filter(g => g.tiny && g.full);
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ gifs });
  } catch (e) {
    return res.status(500).json({ error: e.message || "GIF search failed" });
  }
}
