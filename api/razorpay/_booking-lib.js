// Shared helpers for booking payments. No npm packages needed (Node 18+ fetch + crypto).
// Reads the same kind of env vars your other Razorpay/Supabase API files use.
import crypto from "node:crypto";

const env = (...names) => { for (const n of names) { if (process.env[n]) return process.env[n]; } return ""; };
export const SB_URL = env("SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
export const SB_SERVICE = env("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE", "SERVICE_ROLE_KEY");
export const RZP_KEY_ID = env("RAZORPAY_KEY_ID", "RZP_KEY_ID", "RAZORPAY_KEY", "VITE_RAZORPAY_KEY_ID");
export const RZP_SECRET = env("RAZORPAY_KEY_SECRET", "RAZORPAY_SECRET", "RZP_KEY_SECRET", "RZP_SECRET");

export function missingEnv() {
  const m = [];
  if (!SB_URL) m.push("SUPABASE_URL"); if (!SB_SERVICE) m.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!RZP_KEY_ID) m.push("RAZORPAY_KEY_ID"); if (!RZP_SECRET) m.push("RAZORPAY_KEY_SECRET");
  return m;
}

export function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}

// Who is calling? Validates the member's Supabase access token.
export async function getUser(accessToken) {
  if (!accessToken) return null;
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

// Calls a Postgres function with the service-role key (server only).
export async function rpc(fn, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new Error((data && (data.message || data.error)) || `Database error (${r.status})`);
  return data;
}

const rzpAuth = () => "Basic " + Buffer.from(`${RZP_KEY_ID}:${RZP_SECRET}`).toString("base64");
export async function rzpCreateOrder(payload) {
  const r = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: rzpAuth(), "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.description || "Razorpay order failed");
  return j;
}
export async function rzpGetPayment(id) {
  const r = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(id)}`, { headers: { Authorization: rzpAuth() } });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.description || "Couldn't fetch payment");
  return j;
}
export async function rzpCapture(id, amount) {
  const r = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(id)}/capture`, { method: "POST", headers: { Authorization: rzpAuth(), "Content-Type": "application/json" }, body: JSON.stringify({ amount, currency: "INR" }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.description || "Couldn't capture payment");
  return j;
}

export function signatureOk(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac("sha256", RZP_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
