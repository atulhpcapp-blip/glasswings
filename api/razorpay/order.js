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
      if (ticket_type_id) {
        const { data: t } = await sb.from("event_ticket_types").select("*").eq("id", ticket_type_id).single();
        if (!t || t.event_id !== event_id) return res.status(400).json({ error: "Ticket not found." });
        if (t.gender_restrict !== "any" && t.gender_restrict !== me?.gender) return res.status(403).json({ error: "You're not eligible for this ticket." });

        // fetch independent data in parallel (big latency win)
        const [{ data: s }, { data: ev }, { data: sold }, addonSum] = await Promise.all([
          (t.discount_room_id && t.discount_value) ? sb.from("room_subscriptions").select("room_id").eq("user_id", uid).eq("room_id", t.discount_room_id).eq("status", "active") : Promise.resolve({ data: [] }),
          sb.from("events").select("balance_on, men_per_woman, men_open_start").eq("id", event_id).single(),
          sb.from("event_tickets").select("quantity").eq("ticket_type_id", ticket_type_id),
          resolveAddons(),
        ]);

        let net = t.price || 0;
        if (t.discount_room_id && t.discount_value && (s || []).length) { const d = t.discount_kind === "flat" ? t.discount_value : Math.round(net * t.discount_value / 100); net = Math.max(0, net - d); }

        const soldQty = (sold || []).reduce((a, r) => a + (r.quantity || 1), 0);
        if (t.capacity != null && t.capacity - soldQty - qty < 0) return res.status(409).json({ error: "Not enough tickets left." });
        if (t.gender_restrict === "male" && ev?.balance_on === true) {
          const { data: tk } = await sb.from("event_tickets").select("user_id, quantity").eq("event_id", event_id);
          const ids = [...new Set((tk || []).map(r => r.user_id))];
          const genders = {};
          if (ids.length) { const { data: ps } = await sb.from("profiles").select("id, gender").in("id", ids); (ps || []).forEach(p => { genders[p.id] = p.gender; }); }
          let male = 0, female = 0;
          (tk || []).forEach(r => { const g = genders[r.user_id]; if (g === "male") male += (r.quantity || 1); else if (g === "female") female += (r.quantity || 1); });
          const ratio = ev.men_per_woman == null ? 2 : Number(ev.men_per_woman);
          const budget = (Number(ev.men_open_start) || 0) + Math.floor(female * ratio);
          if (budget - male - qty < 0) return res.status(409).json({ error: "Men's tickets aren't open yet — they release as more women join." });
        }

        const subtotal = net * qty + addonSum;
        if (subtotal <= 0) return res.status(400).json({ error: "This ticket is free for you — just tap Get." });
        ticketRev = net * qty;
        amount = subtotal * 100;
        Object.assign(notes, { event_id, ticket_type_id, qty, addons: addonRows.length });
      } else {
        const { data: ev } = await sb.from("events").select("ticket_price").eq("id", event_id).single();
        const net = ev?.ticket_price || 0;
        const addonSum = await resolveAddons();
        const subtotal = net * qty + addonSum;
        if (subtotal <= 0) return res.status(400).json({ error: "This event is free — just tap Get." });
        ticketRev = net * qty;
        amount = subtotal * 100;
        Object.assign(notes, { event_id, qty, addons: addonRows.length });
      }
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
      user_id: uid, purpose, event_id: event_id || null, ticket_type_id: ticket_type_id || null,
      room_id: room_id || null, quantity: qty, amount, status: "created", razorpay_order_id: order.id,
      addons: addonRows, referrer_id, commission_amount,
    });

    return res.status(200).json({ order_id: order.id, amount, currency: "INR", key_id: KEY });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Something went wrong." });
  }
}
