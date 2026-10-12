// Shared server-only helpers. Never import this file from App.jsx.
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const DB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RZ_KEY = process.env.RAZORPAY_KEY_ID || process.env.RZP_KEY_ID;
const RZ_SECRET = process.env.RAZORPAY_KEY_SECRET || process.env.RZP_KEY_SECRET;
function db() {
  if (!DB_URL || !SERVICE_KEY) throw Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(DB_URL, SERVICE_KEY, { auth: { persistSession:false, autoRefreshToken:false } });
}
function fail(res,status,message){return res.status(status).json({ok:false,error:message});}
function bearer(req){return String(req.body?.access_token || req.headers.authorization || '').replace(/^Bearer\s+/i,'').trim();}
async function requireUser(req,res){
  const key=bearer(req); if(!key){fail(res,401,'Please log in');return null;}
  const svc=db();const {data,error}=await svc.auth.getUser(key);
  if(error||!data?.user){fail(res,401,'Session expired');return null;}
  const uid=data.user.id;
  const {data:p}=await svc.from('profiles').select('role,roles').eq('id',uid).maybeSingle();
  const roles=[p?.role,...(Array.isArray(p?.roles)?p.roles:[])];
  const isStaff=roles.includes('admin')||roles.includes('superadmin');
  const {data:hosts}=await svc.from('events').select('id').eq('host_id',uid).eq('host_type','partner').limit(1);
  if(!isStaff&&!roles.includes('organiser')&&!hosts?.length){fail(res,403,'WhatsApp credits are for approved organisers');return null;}
  return {svc,uid,isStaff};
}
function rzpHeaders(){
  if(!RZ_KEY||!RZ_SECRET)throw Error('Razorpay server keys missing');
  return {Authorization:'Basic '+Buffer.from(`${RZ_KEY}:${RZ_SECRET}`).toString('base64'),'Content-Type':'application/json'};
}
async function rzp(path,opts={}){
  const r=await fetch('https://api.razorpay.com/v1'+path,{...opts,headers:{...rzpHeaders(),...(opts.headers||{})}});
  const j=await r.json().catch(()=>({})); if(!r.ok)throw Error(j.error?.description||'Razorpay request failed');return j;
}
function secureEq(a,b){if(!a||!b)return false;const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
module.exports={db,fail,requireUser,rzp,secureEq,crypto,RZ_KEY,RZ_SECRET};
