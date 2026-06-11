// Glasswings — WhatsApp campaign to a SEGMENT via AiSensy (Vercel function).
// Place this file in your repo at:  api/whatsapp/segment-blast.js
//
// SETUP (one time):
// 1) AiSensy dashboard → create a TEMPLATE (gets Meta approval), then create
//    an "API Campaign" linked to that template. Note the exact Campaign Name.
// 2) AiSensy dashboard → Manage → API Key → copy the key.
// 3) Vercel → your project → Settings → Environment Variables → add:
//       AISENSY_API_KEY = <the key>     → then Redeploy.
//
// The app sends: { access_token, segment_id, campaign, params }
//  - campaign: the exact AiSensy API Campaign name
//  - params: optional template variable values, comma-separated, in order
//    ({{name}} is filled automatically per member as userName)
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

const STAFF = ["admin", "superadmin", "subadmin"];

// Normalise Indian numbers to 91XXXXXXXXXX
function normPhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length === 10) return "91" + d;
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length === 11 && d.startsWith("0")) return "91" + d.slice(1);
  return d.length >= 11 ? d : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!process.env.AISENSY_API_KEY) {
    return res.status(500).json({ error: "WhatsApp is not configured yet — add AISENSY_API_KEY in Vercel → Settings → Environment Variables, then redeploy." });
  }

  const body = (typeof req.body === "object" && req.body) ? req.body : await readBody(req);
  const { access_token, segment_id } = body;
  const campaign = String(body.campaign || "").trim();
  const params = String(body.params || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!segment_id || !campaign) return res.status(400).json({ error: "Missing campaign name." });

  try {
    // caller must be staff
    const { data: ures } = await sb.auth.getUser(access_token);
    const uid = ures?.user?.id;
    if (!uid) return res.status(401).json({ error: "Please log in again." });
    const { data: me } = await sb.from("profiles").select("role, roles").eq("id", uid).single();
    const isStaff = STAFF.includes(me?.role) || (me?.roles || []).some((r) => STAFF.includes(r));
    if (!isStaff) return res.status(403).json({ error: "Not authorised." });

    // segment phone list
    const { data: list, error: lerr } = await sb.rpc("segment_phones", { p_segment: segment_id });
    if (lerr) return res.status(500).json({ error: lerr.message });
    const recipients = (list || [])
      .map((r) => ({ phone: normPhone(r.phone), name: (r.full_name || "there").split(" ")[0] }))
      .filter((r) => r.phone);
    if (!recipients.length) return res.status(400).json({ error: "This segment has no members with a valid phone number." });

    // send via AiSensy — in parallel chunks of 20
    let sent = 0, failed = 0, detail = "";
    const sendOne = async (r) => {
      try {
        const resp = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: process.env.AISENSY_API_KEY,
            campaignName: campaign,
            destination: r.phone,
            userName: r.name,
            templateParams: params,
            source: "glasswings-segments",
          }),
        });
        if (resp.ok) sent++;
        else {
          failed++;
          if (!detail) {
            let t = ""; try { t = await resp.text(); } catch {}
            detail = `HTTP ${resp.status}: ${(t || "(empty response)").slice(0, 300)}`;
          }
        }
      } catch (e) { failed++; if (!detail) detail = String(e.message || e).slice(0, 300); }
    };
    for (let i = 0; i < recipients.length; i += 20) {
      await Promise.all(recipients.slice(i, i + 20).map(sendOne));
    }
    return res.status(200).json({ ok: true, sent, failed, total: recipients.length, detail });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Something went wrong." });
  }
}
