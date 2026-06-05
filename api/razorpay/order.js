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
  const { access_token, purpose = "ticket", event_id, ticket_type_id, room_id } = body;
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
        sb.from("events").select("ticket_price, balance_on, men_per_woman, men_open_start").eq("id", event_id).single(),
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
          if (t.gender_restrict !== "any" && t.gender_restrict !== me?.gender) return res.status(403).json({ error: `You're not eligible for "${t.name}".` });
          let net = t.price || 0;
          if (t.discount_room_id && t.discount_value && mySubs.has(t.discount_room_id)) {
            const d = t.discount_kind === "flat" ? t.discount_value : Math.round(net * t.discount_value / 100);
            net = Math.max(0, net - d);
          }
          const soldQty = soldBy[t.id] || 0;
          if (t.capacity != null && t.capacity - soldQty - it.quantity < 0) return res.status(409).json({ error: `Not enough "${t.name}" tickets left.` });
          if (t.gender_restrict === "male") maleWantQty += it.quantity;
          subtotal += net * it.quantity;
          lineItems.push({ ticket_type_id: t.id, quantity: it.quantity, net });
        } else {
          const net = ev?.ticket_price || 0;
          subtotal += net * it.quantity;
          lineItems.push({ ticket_type_id: null, quantity: it.quantity, net });
        }
      }

      if (maleWantQty > 0 && ev?.balance_on === true) {
        const ratio = ev.men_per_woman == null ? 2 : Number(ev.men_per_woman);
        const budget = (Number(ev.men_open_start) || 0) + Math.floor(femaleSold * ratio);
        if (budget - maleSold - maleWantQty < 0) return res.status(409).json({ error: "Men's tickets aren't open yet — they release as more women join." });
      }

      const grand = subtotal + addonSum;
      if (grand <= 0) return res.status(400).json({ error: "These tickets are free for you — just tap Get." });
      ticketRev = subtotal;
      amount = grand * 100;
      items = lineItems;
      Object.assign(notes, { event_id, qty: totalQty, lines: lineItems.length, addons: addonRows.length });
    } else if (purpose === "room") {
      const { data: r } = await sb.from("rooms").select("*").eq("id", room_id).single();
      if (!r) return res.status(400).json({ error: "Room not found." });
      if (r.gender_restrict === "female" && me?.gender !== "female") return res.status(403).json({ error: "This room is for women only." });
      if ((r.price_monthly || 0) === 0 || me?.gender !== "male" || me?.founding_member) return res.status(400).json({ error: "This room is free for you — just tap Join." });
      amount = (r.price_monthly || 0) * 100;
      Object.assign(notes, { room_id });
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
      room_id: room_id || null, quantity: (purpose === "ticket" ? totalQty : qty), amount, status: "created", razorpay_order_id: order.id,
      addons: addonRows, referrer_id, commission_amount,
      items: (purpose === "ticket" ? items : null),
    });

    return res.status(200).json({ order_id: order.id, amount, currency: "INR", key_id: KEY });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Something went wrong." });
  }
}
