// Glasswings — Razorpay: start a recurring monthly room subscription.
// Lazily creates a Plan for the room (or a fresh one if the price changed),
// then a Subscription, and returns its id for Checkout to authorize the mandate.
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
  const KEY = process.env.RAZORPAY_KEY_ID, SECRET = process.env.RAZORPAY_KEY_SECRET;
  if (!KEY || !SECRET) return res.status(500).json({ error: "Payments are not configured yet." });
  const auth = "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64");

  const body = (typeof req.body === "object" && req.body) ? req.body : await readBody(req);
  const { access_token, room_id, plan_id, plan_months } = body;

  try {
    const { data: ures } = await sb.auth.getUser(access_token);
    const uid = ures?.user?.id;
    if (!uid) return res.status(401).json({ error: "Please log in again." });

    // ---- 💎 membership-plan recurring subscription ----
    if (plan_id) {
      const pm = Number(plan_months) || 1;
      const [{ data: me2 }, { data: pl }] = await Promise.all([
        sb.from("profiles").select("gender").eq("id", uid).single(),
        sb.from("plans").select("*").eq("id", plan_id).single(),
      ]);
      if (!pl || !pl.active) return res.status(400).json({ error: "Plan not found." });
      if (pl.women_free && me2?.gender === "female") return res.status(400).json({ error: "This plan is free for you — your rooms are already open!" });
      const price = pm === 3 ? pl.price_3m : pm === 6 ? pl.price_6m : pm === 12 ? pl.price_12m : pl.price_1m;
      if (!price || price <= 0) return res.status(400).json({ error: "That duration is not available." });
      const amount = price * 100;

      // already auto-renewing this plan?
      const { data: existingMp } = await sb.from("member_plans").select("id, razorpay_subscription_id, expires_at").eq("user_id", uid).eq("plan_id", plan_id).maybeSingle();
      if (existingMp?.razorpay_subscription_id) return res.status(400).json({ error: "You already have auto-renew active on this plan. Manage it from your Profile." });

      // reuse / create a Razorpay plan for this (months, price)
      const ids = (pl.razorpay_plan_ids && typeof pl.razorpay_plan_ids === "object") ? pl.razorpay_plan_ids : {};
      let rzpPlanId = ids[String(pm)]?.id;
      if (!rzpPlanId || ids[String(pm)]?.amount !== amount) {
        const pr = await fetch("https://api.razorpay.com/v1/plans", {
          method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" },
          body: JSON.stringify({ period: "monthly", interval: pm, item: { name: `${pl.name} — ${pm} month${pm > 1 ? "s" : ""}`, amount, currency: "INR" } }),
        });
        const rp = await pr.json();
        if (!rp.id) return res.status(502).json({ error: rp.error?.description || "Could not set up the plan." });
        rzpPlanId = rp.id;
        await sb.from("plans").update({ razorpay_plan_ids: { ...ids, [String(pm)]: { id: rzpPlanId, amount } } }).eq("id", plan_id);
      }

      const totalCount = pm === 1 ? 60 : pm === 3 ? 20 : pm === 6 ? 10 : 5;
      const sr = await fetch("https://api.razorpay.com/v1/subscriptions", {
        method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: rzpPlanId, total_count: totalCount, quantity: 1, customer_notify: 1, notes: { uid, plan_id, plan_months: pm } }),
      });
      const subn = await sr.json();
      if (!subn.id) return res.status(502).json({ error: subn.error?.description || "Could not start the subscription." });

      await sb.from("payments").insert({
        user_id: uid, purpose: "plan", plan_id, plan_months: pm, amount, status: "created", razorpay_subscription_id: subn.id,
      });
      return res.status(200).json({ subscription_id: subn.id, key_id: KEY });
    }

    // independent reads in parallel
    const [{ data: me }, { data: room }, { data: existing }] = await Promise.all([
      sb.from("profiles").select("gender, founding_member").eq("id", uid).single(),
      sb.from("rooms").select("*").eq("id", room_id).single(),
      sb.from("room_subscriptions").select("id, status").eq("room_id", room_id).eq("user_id", uid).maybeSingle(),
    ]);
    if (!room) return res.status(400).json({ error: "Room not found." });
    if (room.gender_restrict === "female" && me?.gender !== "female") return res.status(403).json({ error: "This room is for women only." });
    if ((room.price_monthly || 0) === 0 || me?.gender !== "male" || me?.founding_member)
      return res.status(400).json({ error: "This room is free for you — just tap Join." });
    if (existing && existing.status === "active") return res.status(400).json({ error: "You're already subscribed to this room." });

    const amount = (room.price_monthly || 0) * 100; // paise

    // Ensure a plan that matches the current price.
    let planId = room.razorpay_plan_id;
    if (!planId || room.plan_amount !== amount) {
      const pr = await fetch("https://api.razorpay.com/v1/plans", {
        method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ period: "monthly", interval: 1, item: { name: `${room.name} membership`, amount, currency: "INR" } }),
      });
      const plan = await pr.json();
      if (!plan.id) return res.status(502).json({ error: plan.error?.description || "Could not set up the plan." });
      planId = plan.id;
      await sb.from("rooms").update({ razorpay_plan_id: planId, plan_amount: amount }).eq("id", room_id);
    }

    // Create the subscription (mandate authorized in Checkout).
    const sr = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId, total_count: 120, quantity: 1, customer_notify: 1, notes: { uid, room_id } }),
    });
    const subn = await sr.json();
    if (!subn.id) return res.status(502).json({ error: subn.error?.description || "Could not start the subscription." });

    await sb.from("payments").insert({
      user_id: uid, purpose: "room", room_id, amount, status: "created", razorpay_subscription_id: subn.id,
    });

    return res.status(200).json({ subscription_id: subn.id, key_id: KEY });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Something went wrong." });
  }
}
