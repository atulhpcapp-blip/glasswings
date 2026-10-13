// GLASSWINGS — independent, notification-only Razorpay captured-payment webhook.
// New API endpoint: /api/razorpay/payment-notify
// Does NOT confirm bookings, grant tickets/credits or modify Razorpay transactions.
// Sends owner alerts via the existing gw_wa_outbox + protected 5-minute dispatcher.
// Env (server-only): GW_RAZORPAY_NOTIFY_WEBHOOK_SECRET, RAZORPAY_KEY_ID,
// RAZORPAY_KEY_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import crypto from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@supabase/supabase-js';

const reply = (status, body) => Response.json(body, { status });
const obj = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const first = (...values) => values.map(x => String(x ?? '').trim()).find(Boolean) || '';
const integer = value => Number.isFinite(Number(value)) && Number(value) > 0
  ? Math.min(9999, Math.floor(Number(value))) : 1;
const asDate = value => Number.isFinite(Number(value)) && Number(value) > 0
  ? new Date(Number(value) * 1000).toLocaleDateString('en-IN', { timeZone:'Asia/Kolkata', day:'2-digit', month:'short', year:'numeric' })
  : new Date().toLocaleDateString('en-IN', { timeZone:'Asia/Kolkata', day:'2-digit', month:'short', year:'numeric' });

function kindFor(purpose) {
  const p = String(purpose || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (['ticket','ticket_sale','event_ticket','ticket_booking'].includes(p)) return 'ticket_sale';
  if (/trip|travel|getaway|tour/.test(p)) return 'trip_payment';
  if (/door/.test(p)) return 'door_sale';
  if (/booking|advance|install?ment|milestone|stall|vendor|part_payment/.test(p)) return 'booking_payment';
  // Keep unrecognised categories visible to the owner rather than dropping payments.
  return 'payment_received';
}

function labelFor(purpose) {
  const p = String(purpose || '').toLowerCase().replace(/[\s-]+/g, '_');
  const labels = {
    event_booking:'Event booking', ticket:'Event tickets', ticket_sale:'Event tickets',
    stall_booking:'Stall booking', trip_payment:'Trip payment',
    donation:'Donation', sponsorship:'Sponsorship', sponsor:'Sponsorship',
    advance:'Booking advance', installment:'Instalment', instalment:'Instalment',
    part_payment:'Part payment', subscription:'Subscription',
    plan:'Membership plan', room:'Room payment', credits:'Credits purchase', boost:'Spotlight purchase',
  };
  return labels[p] || String(purpose || 'Glasswings payment').replace(/[_-]/g,' ').slice(0,100);
}

async function razorpayGet(path) {
  const key = process.env.RAZORPAY_KEY_ID || process.env.RZP_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET || process.env.RZP_KEY_SECRET;
  if (!key || !secret) throw Error('Razorpay server credentials missing');
  const result = await fetch(`https://api.razorpay.com/v1${path}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!result.ok) throw Error(`Razorpay validation HTTP ${result.status}`);
  return result.json();
}


// Wake the existing authorised dispatcher after queuing a captured payment.
// This is a background task. It must never hold up Razorpay's 200 acknowledgement.
// If it fails, the existing five-minute cron remains the retry mechanism.
async function wakeOwnerAlerts() {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[GW-WA-INSTANT] CRON_SECRET missing; scheduled backup will process the alert');
    return;
  }
  try {
    // Fixed, trusted destination: never derive the bearer-token target from an HTTP Host header.
    const response = await fetch('https://glass-wings.com/api/whatsapp/process-sales', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
      redirect: 'manual',
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      console.error('[GW-WA-INSTANT] Dispatcher HTTP status', response.status);
    } else {
      console.info('[GW-WA-INSTANT] Dispatcher accepted wake-up');
    }
  } catch (error) {
    // Avoid logging secrets or personally identifying payment data.
    console.error('[GW-WA-INSTANT] Dispatcher unavailable; cron backup remains active',
      error?.name === 'TimeoutError' ? 'timeout' : 'network failure');
  }
}

async function handle(request) {
  if (request.method !== 'POST') return reply(405, { ok:false, error:'POST only' });
  const secret = process.env.GW_RAZORPAY_NOTIFY_WEBHOOK_SECRET;
  if (!secret) return reply(503, { ok:false, error:'Notification webhook is not configured' });
  if (Number(request.headers.get('content-length') || 0) > 262144) return reply(413,{ok:false,error:'Payload too large'});

  // Web-standard Request.text() gives us the unmodified raw body required for HMAC.
  const raw = await request.text();
  if (!raw || raw.length > 262144) return reply(400,{ok:false,error:'Invalid payload'});
  const signature = first(request.headers.get('x-razorpay-signature'));
  const expected = crypto.createHmac('sha256',secret).update(raw,'utf8').digest('hex');
  const receivedBuffer = Buffer.from(signature,'utf8');
  const expectedBuffer = Buffer.from(expected,'utf8');
  if (!signature || receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer,expectedBuffer)) {
    return reply(401,{ok:false,error:'Invalid Razorpay signature'});
  }

  let event;
  try { event = JSON.parse(raw); }
  catch { return reply(400,{ok:false,error:'Invalid JSON'}); }
  if (event?.event !== 'payment.captured') return reply(200,{ok:true,ignored:event?.event||'other_event'});
  const paymentId = first(event?.payload?.payment?.entity?.id);
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) return reply(400,{ok:false,error:'Payment ID missing'});

  // Independently confirm actual capture against Razorpay's authenticated API.
  const payment = await razorpayGet(`/payments/${encodeURIComponent(paymentId)}`);
  if (payment?.id !== paymentId || payment?.status !== 'captured' || !(Number(payment.amount) > 0)) {
    return reply(200,{ok:true,ignored:'Payment not captured'});
  }
  // Existing approved AiSensy owner template formats its amount in INR.
  if (payment.currency !== 'INR') {
    console.error('GW-WA-NOTIFY unsupported currency; manual alert required', paymentId, payment.currency);
    return reply(422,{ok:false,error:'Currency not supported by current INR template'});
  }
  const order = payment.order_id
    ? await razorpayGet(`/orders/${encodeURIComponent(payment.order_id)}`)
    : null;
  if (order && order.id !== payment.order_id) throw Error('Razorpay order mismatch');

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) throw Error('Supabase server configuration missing');
  const db = createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const notes = {...obj(payment.notes),...obj(order?.notes)};

  // Optional enrichment. Failing to find app records must never suppress a real
  // captured-payment alert; payment-links and future categories may have no order.
  let stored = null, eventData = null, buyer = null;
  if (payment.order_id) {
    const result = await db.from('payments')
      .select('purpose,event_id,user_id,quantity,items')
      .eq('razorpay_order_id',payment.order_id).maybeSingle();
    if (!result.error) stored = result.data;
  }
  const eventId = first(notes.event_id,stored?.event_id);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) {
    const result = await db.from('events').select('title,event_date').eq('id',eventId).maybeSingle();
    if (!result.error) eventData = result.data;
  }
  const userId = first(notes.user_id,stored?.user_id);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    const result = await db.from('profiles').select('full_name,phone').eq('id',userId).maybeSingle();
    if (!result.error) buyer = result.data;
  }

  const purpose = first(notes.purpose,stored?.purpose,notes.payment_type,notes.category,'payment_received');
  const kind = kindFor(purpose);
  const label = labelFor(purpose);
  const eventTitle = first(eventData?.title,notes.event_title,notes.event_name,notes.title,
    notes.campaign_name,notes.description,payment.description);
  const eventText = eventTitle ? `${label} — ${eventTitle}` : label;
  const items = Array.isArray(stored?.items) ? stored.items : [];
  const itemQuantity = items.reduce((n,item)=>n+integer(item?.quantity),0);
  const quantity = integer(first(notes.quantity,stored?.quantity,itemQuantity||null));
  const payload = {
    kind,
    reference:`razorpay:${paymentId}`,
    event:eventText.slice(0,180),
    event_date:first(eventData?.event_date,notes.event_date,notes.trip_date,asDate(payment.created_at)),
    buyer:first(notes.customer_name,notes.full_name,notes.buyer_name,buyer?.full_name,payment.email,'Customer'),
    buyer_phone:first(payment.contact,notes.customer_phone,notes.phone,buyer?.phone,'Not provided'),
    amount:Number(payment.amount)/100,
    quantity,
    payment_id:paymentId,
    details:{
      category:purpose,
      order_id:payment.order_id||null,
      source:'razorpay-payment.captured',
      captured_at:asDate(payment.created_at),
      currency:payment.currency,
    },
  };

  // Exactly the same key as api/razorpay/verify.js; existing unique DB
  // constraint prevents a second OWNER queue row for the same captured payment.
  const {error} = await db.from('gw_wa_outbox').upsert({
    event_key:`razorpay:${paymentId}`,channel:'glasswings',payload,
  },{onConflict:'event_key,channel',ignoreDuplicates:true});
  if (error) throw Error(`WhatsApp queue failed (${error.code||'database'})`);
  // Respond to Razorpay promptly. The async wake-up runs after the HTTP response.
  // DB event_key + channel uniqueness and gw_wa_claim row locking guard against
  // duplicate webhook/cron sends for the same claimed queue item.
  waitUntil(wakeOwnerAlerts());
  return reply(200,{ok:true,queued_or_existing:true});
}

// Web-standard Vercel handler ensures reliable raw-body signature checking.
export default {
  async fetch(request) {
    try { return await handle(request); }
    catch (error) {
      // No credentials, tokens, webhook bodies or buyer details in logs.
      console.error('[GW-WA-PAYMENT-NOTIFY]',String(error?.message||'Server error').slice(0,180));
      return reply(500,{ok:false,error:'Notification processing failed; retry requested'});
    }
  },
};
