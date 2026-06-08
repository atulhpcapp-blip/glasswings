// Glasswings — Razorpay: create an order (Vercel serverless function).
// The PRICE is always computed here from the database, never trusted from the
// client. Required env vars (Vercel → Settings → Environment Variables):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
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

  const body = (typeof req.body === "object" && req.body) ? req.body : await readBody(req);
  const { access_token, purpose = "ticket", event_id, ticket_type_id, room_id, plan_id, plan_months } = body;
  const qty = Math.max(1, parseInt(body.quantity) || 1);
  // cart: [{ticket_type_id, quantity}] — falls back to the legacy single-type fields
  let items = Array.isArray(body.items) && body.items.length
    ? body.items.map(i => ({ ticket_type_id: i.ticket_type_id || null, quantity: Math.max(1, parseInt(i.quantity) || 1) }))
    : [{ ticket_type_id: ticket_type_id || null, quantity: qty }];
  const totalQty = items.reduce((a, i) => a + i.quantity, 0);
  if (totalQty > 10) return res.status(400).json({ error: "You can buy up to 10 tickets per order." });
  const addonSel = Array.isArray(body.addons) ? body.addons : [];   // [{id, qty}]
  const refCode = (body.ref || "").toString().trim();

  try {
    const { data: ures } = await sb.auth.getUser(access_token);
    const uid = ures?.user?.id;
    if (!uid) return res.status(401).json({ error: "Please log in again." });
    const { data: me } = await sb.from("profiles").select("gender, founding_member").eq("id", uid).single();

    let amount = 0;          // paise
    let creditsGrant = 0;    // credits to grant when purpose==="credits"
    let addonRows = [];      // resolved [{id,name,price,qty}]
    let ticketRev = 0;       // rupees (for commission)
    const notes = { purpose, uid };

    // resolve add-ons from the DB (never trust client prices)
    async function resolveAddons() {
      if (!event_id || !addonSel.length) return 0;
      const ids = addonSel.map(a => a.id).filter(Boolean);
      if (!ids.length) return 0;
      const { data: defs } = await sb.from("event_addons").select("*").eq("event_id", event_id).in("id", ids);
      let sum = 0;
      (defs || []).forEach(d => {
        const want = addonSel.find(a => a.id === d.id);
        const aq = Math.max(0, parseInt(want?.qty) || 0);
        if (aq > 0) { addonRows.push({ id: d.id, name: d.name, price: d.price, qty: aq }); sum += (d.price || 0) * aq; }
      });
      return sum;
    }

    if (purpose === "ticket") {
      const typedIds = items.filter(i => i.ticket_type_id).map(i => i.ticket_type_id);
      const hasBase = items.some(i => !i.ticket_type_id);
      if (hasBase && typedIds.length) return res.status(400).json({ error: "Invalid cart." });

      // fetch everything needed in parallel
      const [{ data: typeRows }, { data: ev }, { data: tk }, addonSum] = await Promise.all([
        typedIds.length ? sb.from("event_ticket_types").select("*").in("id", typedIds) : Promise.resolve({ data: [] }),
        sb.from("events").select("ticket_price, balance_on, men_per_woman, men_open_start, member_discount_pct").eq("id", event_id).single(),
        sb.from("event_tickets").select("user_id, ticket_type_id, quantity").eq("event_id", event_id),
        resolveAddons(),
      ]);
      const typeMap = {}; (typeRows || []).forEach(t => { typeMap[t.id] = t; });

      // room-discount memberships for any discounted types, in one query
      const discRooms = [...new Set((typeRows || []).filter(t => t.discount_room_id && t.discount_value).map(t => t.discount_room_id))];
      let mySubs = new Set();
      if (discRooms.length) {
        const { data: srows } = await sb.from("room_subscriptions").select("room_id").eq("user_id", uid).eq("status", "active").in("room_id", discRooms);
        mySubs = new Set((srows || []).map(r => r.room_id));
      }
      // 💎 plan-discount memberships
      const discPlans = [...new Set((typeRows || []).filter(t => t.discount_plan_id && t.discount_value).map(t => t.discount_plan_id))];
      let myPlanSet = new Set();
      if (discPlans.length) {
        const { data: prows } = await sb.from("member_plans").select("plan_id, expires_at").eq("user_id", uid).in("plan_id", discPlans);
        (prows || []).forEach(m => { if (!m.expires_at || new Date(m.expires_at).getTime() > Date.now()) myPlanSet.add(m.plan_id); });
      }

      const soldBy = {}; let maleSold = 0, femaleSold = 0;
      const buyerIds = [...new Set((tk || []).map(r => r.user_id))];
      const genders = {};
      if (buyerIds.length) { const { data: ps } = await sb.from("profiles").select("id, gender").in("id", buyerIds); (ps || []).forEach(pr => { genders[pr.id] = pr.gender; }); }
      (tk || []).forEach(r => {
        soldBy[r.ticket_type_id || "base"] = (soldBy[r.ticket_type_id || "base"] || 0) + (r.quantity || 1);
        const g = genders[r.user_id];
        if (g === "male") maleSold += (r.quantity || 1); else if (g === "female") femaleSold += (r.quantity || 1);
      });

      let subtotal = 0, maleWantQty = 0;
      const lineItems = [];
      for (const it of items) {
        if (it.ticket_type_id) {
          const t = typeMap[it.ticket_type_id];
          if (!t || t.event_id !== event_id) return res.status(400).json({ error: "Ticket not found." });
          let net = t.price || 0;
          if ((t.discount_room_id && t.discount_value && mySubs.has(t.discount_room_id)) ||
              (t.discount_plan_id && t.discount_value && myPlanSet.has(t.discount_plan_id))) {
            const d = t.discount_kind === "flat" ? t.discount_value : Math.round(net * t.discount_value / 100);
            net = Math.max(0, net - d);
          }
          const gp = me?.gender === "female" ? Number(t.disc_female_pct) : me?.gender === "male" ? Number(t.disc_male_pct) : 0;
          if (gp > 0) net = Math.max(0, Math.round(net * (100 - Math.min(gp, 100)) / 100));
          const soldQty = soldBy[t.id] || 0;
          if (t.capacity != null && t.capacity - soldQty - it.quantity < 0) return res.status(409).json({ error: `Not enough "${t.name}" tickets left.` });
          subtotal += net * it.quantity;
          lineItems.push({ ticket_type_id: t.id, quantity: it.quantity, net });
        } else {
          const net = ev?.ticket_price || 0;
          subtotal += net * it.quantity;
          lineItems.push({ ticket_type_id: null, quantity: it.quantity, net });
        }
      }

      // 💎 plan-member discount on ticket lines (after all other discounts)
      const mdp = Math.min(100, Math.max(0, Number(ev?.member_discount_pct) || 0));
      if (mdp > 0) {
        const { data: myPlanRows } = await sb.from("member_plans").select("id, expires_at").eq("user_id", uid);
        const isPlanMember = (myPlanRows || []).some(m => !m.expires_at || new Date(m.expires_at).getTime() > Date.now());
        if (isPlanMember) {
          subtotal = 0;
          for (const li of lineItems) { li.net = Math.round((li.net || 0) * (100 - mdp) / 100); subtotal += li.net * li.quantity; }
        }
      }

      const grand = subtotal + addonSum;
      if (grand <= 0) {
        // 💎 100% member discount (or fully free cart): issue tickets directly, no Razorpay
        const freeOrderId = "free_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
        for (let li = 0; li < lineItems.length; li++) {
          const { error: insErr } = await sb.from("event_tickets").insert({
            event_id, user_id: uid, ticket_type_id: lineItems[li].ticket_type_id || null,
            quantity: lineItems[li].quantity || 1, addons: li === 0 ? (addonRows || []) : [],
            razorpay_order_id: freeOrderId,
          });
          if (insErr && insErr.code !== "23505") throw insErr;
        }
        await sb.from("payments").insert({
          user_id: uid, purpose: "ticket", event_id, ticket_type_id: lineItems[0]?.ticket_type_id || null,
          quantity: totalQty, amount: 0, status: "paid", razorpay_order_id: freeOrderId,
          addons: addonRows, items: lineItems,
        });
        return res.status(200).json({ free: true });
      }
      ticketRev = subtotal;
      amount = grand * 100;
      items = lineItems;
      Object.assign(notes, { event_id, qty: totalQty, lines: lineItems.length, addons: addonRows.length });
    } else if (purpose === "plan") {
      const { data: pl } = await sb.from("plans").select("id, name, active, price_1m, price_3m, price_6m, price_12m").eq("id", plan_id).single();
      if (!pl || !pl.active) return res.status(400).json({ error: "Plan not found." });
      const pm = Number(plan_months) || 1;
      const planPrice = pm === 3 ? pl.price_3m : pm === 6 ? pl.price_6m : pm === 12 ? pl.price_12m : pl.price_1m;
      if (!planPrice || planPrice <= 0) return res.status(400).json({ error: "That duration is not available." });
      amount = planPrice * 100;
      Object.assign(notes, { plan_id, plan_months: pm });
    } else if (purpose === "room") {
      const { data: r } = await sb.from("rooms").select("id, price_monthly, price_3m, price_6m, price_12m").eq("id", room_id).single();
      if (!r) return res.status(400).json({ error: "Room not found." });
      const pm = Number(plan_months) || 1;
      const planPrice = pm === 3 ? r.price_3m : pm === 6 ? r.price_6m : pm === 12 ? r.price_12m : r.price_monthly;
      if (!planPrice || planPrice <= 0) return res.status(400).json({ error: "That plan is not available for this room." });
      amount = planPrice * 100;
      Object.assign(notes, { room_id, plan_months: pm });
    } else if (purpose === "credits") {
      const { data: pack } = await sb.from("credit_packs").select("id, credits, price, active").eq("id", body.pack_id).single();
      if (!pack || !pack.active) return res.status(400).json({ error: "Credit pack not found." });
      amount = pack.price * 100;
      creditsGrant = pack.credits;
      Object.assign(notes, { pack_id: pack.id, credits: pack.credits });
    } else {
      return res.status(400).json({ error: "Unknown purpose." });
    }

    // create the Razorpay order and resolve any promoter referral in parallel
    const auth = Buffer.from(`${KEY}:${SECRET}`).toString("base64");
    const [orderRes, refRes] = await Promise.all([
      fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency: "INR", receipt: `gw_${Date.now()}`, notes }),
      }),
      (purpose === "ticket" && refCode) ? sb.from("profiles").select("id, commission_pct").eq("promo_code", refCode.toUpperCase()).single() : Promise.resolve({ data: null }),
    ]);
    const order = await orderRes.json();
    if (!order.id) return res.status(502).json({ error: order.error?.description || "Could not start the payment." });

    let referrer_id = null, commission_amount = 0;
    const ref = refRes?.data;
    if (ref && ref.id !== uid) {
      referrer_id = ref.id;
      commission_amount = Math.round(ticketRev * (Number(ref.commission_pct) || 0));  // paise = rupees*pct
    }

    await sb.from("payments").insert({
      user_id: uid, purpose, event_id: event_id || null,
      ticket_type_id: (purpose === "ticket" ? (items[0]?.ticket_type_id || null) : null),
      room_id: room_id || null, plan_id: (purpose === "plan" ? plan_id : null), plan_months: (purpose === "room" || purpose === "plan" ? (Number(plan_months) || 1) : null), quantity: (purpose === "ticket" ? totalQty : purpose === "credits" ? creditsGrant : qty), amount, status: "created", razorpay_order_id: order.id,
      addons: addonRows, referrer_id, commission_amount,
      items: (purpose === "ticket" ? items : null),
    });

    return res.status(200).json({ order_id: order.id, amount, currency: "INR", key_id: KEY });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Something went wrong." });
  }
}
