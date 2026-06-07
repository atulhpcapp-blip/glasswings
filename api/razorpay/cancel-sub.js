// Glasswings — Razorpay: cancel a member's room subscription.
// Stops future charges at Razorpay (if it was a paid subscription) and removes
// the member's access. Admin-granted (free) memberships just get removed.
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
  const { access_token, room_id, member_plan_id } = body;

  try {
    const { data: ures } = await sb.auth.getUser(access_token);
    const uid = ures?.user?.id;
    if (!uid) return res.status(401).json({ error: "Please log in again." });

    // 💎 stop auto-renew on a membership plan (access stays till expiry)
    if (member_plan_id) {
      const { data: mp } = await sb.from("member_plans").select("id, user_id, razorpay_subscription_id").eq("id", member_plan_id).maybeSingle();
      if (!mp || mp.user_id !== uid) return res.status(400).json({ error: "Membership not found." });
      if (!mp.razorpay_subscription_id) return res.status(400).json({ error: "Auto-renew is not active on this membership." });
      if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        const auth2 = "Basic " + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
        await fetch(`https://api.razorpay.com/v1/subscriptions/${mp.razorpay_subscription_id}/cancel`, {
          method: "POST", headers: { Authorization: auth2, "Content-Type": "application/json" },
          body: JSON.stringify({ cancel_at_cycle_end: 0 }),
        }).catch(() => {});
      }
      await sb.from("member_plans").update({ razorpay_subscription_id: null }).eq("id", mp.id);
      return res.status(200).json({ ok: true });
    }

    const { data: row } = await sb.from("room_subscriptions").select("id, razorpay_subscription_id").eq("room_id", room_id).eq("user_id", uid).maybeSingle();
    if (!row) return res.status(400).json({ error: "You're not subscribed to this room." });

    if (row.razorpay_subscription_id && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      const auth = "Basic " + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
      // Best effort — if it's already cancelled at Razorpay this may error, which is fine.
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
