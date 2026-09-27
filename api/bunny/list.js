// Glasswings — one-click Bunny Stream import.
// Lists all videos in your Bunny library and returns ready-to-use HLS links.
// Requires Vercel env vars (already present if your other /api functions work):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// The Bunny library id / api key / cdn host are read from the app_secrets table
// (set once in the app: Shorts admin → Bunny auto-import).

export default async function handler(req, res) {
  if (req.method === "GET") return res.status(200).json({ ok: true, ping: "bunny/list" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SUPA = process.env.SUPABASE_URL;
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!SUPA || !SRK) return res.status(500).json({ error: "Server not configured (Supabase env vars missing)." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const token = body.access_token;
    if (!token) return res.status(401).json({ error: "Not signed in." });

    // 1) Who is calling?
    const uRes = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: SRK, Authorization: `Bearer ${token}` } });
    if (!uRes.ok) return res.status(401).json({ error: "Session expired — please sign in again." });
    const user = await uRes.json();
    const uid = user && user.id;
    if (!uid) return res.status(401).json({ error: "Not signed in." });

    // 2) Must be staff (admin/superadmin/subadmin).
    const pRes = await fetch(`${SUPA}/rest/v1/profiles?id=eq.${uid}&select=roles`, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } });
    const prof = (await pRes.json())[0];
    const roles = (prof && prof.roles) || [];
    if (!roles.some(r => ["superadmin", "admin", "subadmin"].includes(r))) return res.status(403).json({ error: "Staff only." });

    // 3) Read Bunny credentials from app_secrets (service role).
    const sRes = await fetch(`${SUPA}/rest/v1/app_secrets?key=in.(bunny_library_id,bunny_api_key,bunny_cdn_host)&select=key,val`, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } });
    const secrets = {};
    (await sRes.json()).forEach(r => { secrets[r.key] = r.val; });
    const lib = secrets.bunny_library_id, key = secrets.bunny_api_key, host = (secrets.bunny_cdn_host || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!lib || !key || !host) return res.status(400).json({ error: "Bunny not set up yet. Add your Library ID, API key and CDN host in the app first." });

    // 4) List videos from Bunny Stream.
    const bRes = await fetch(`https://video.bunnycdn.com/library/${lib}/videos?page=1&itemsPerPage=100&orderBy=date`, { headers: { AccessKey: key, accept: "application/json" } });
    if (!bRes.ok) { const t = await bRes.text(); return res.status(502).json({ error: "Bunny rejected the request. Check your Library ID and API key. " + t.slice(0, 120) }); }
    const data = await bRes.json();
    const items = (data && data.items) || [];
    const videos = items.map(it => ({
      guid: it.guid,
      title: it.title || "Untitled",
      status: it.status,                       // 4 = Finished
      url: `https://${host}/${it.guid}/playlist.m3u8`,
      poster: `https://${host}/${it.guid}/thumbnail.jpg`,
    }));
    return res.status(200).json({ ok: true, count: videos.length, videos });
  } catch (e) {
    return res.status(500).json({ error: "Import failed: " + (e && e.message ? e.message : String(e)) });
  }
}
