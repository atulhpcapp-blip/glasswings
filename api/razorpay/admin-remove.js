// Glasswings — admin: remove a member from a room.
// If the membership was a paid Razorpay subscription, cancels it at Razorpay
// (so billing stops) and then removes access. Admin-only.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const body = (typeof req.body === "object" && req.body) ? req.body : await readBody(req);
  const { access_token, user_id, room_id } = body;

  try {
    const { data: ures } = await sb.auth.getUser(access_token);
    const callerId = ures?.user?.id;
    if (!callerId) return res.status(401).json({ error: "Please log in again." });
    const { data: caller } = await sb.from("profiles").select("role").eq("id", callerId).single();
    if (caller?.role !== "admin") return res.status(403).json({ error: "Admins only." });

    const { data: row } = await sb.from("room_subscriptions").select("id, razorpay_subscription_id").eq("room_id", room_id).eq("user_id", user_id).maybeSingle();
    if (!row) return res.status(200).json({ ok: true });   // already not a member

    if (row.razorpay_subscription_id && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      const auth = "Basic " + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
      await fetch(`https://api.razorpay.com/v1/subscriptions/${row.razorpay_subscription_id}/cancel`, {
        method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ cancel_at_cycle_end: 0 }),
      }).catch(() => {});
    }

    await sb.from("room_subscriptions").delete().eq("id", row.id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Something went wrong." });
  }
}
