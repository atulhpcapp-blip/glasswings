import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient.js";
import * as appCfg from "./config.js";
import {
  MessageCircle, Compass, Shield, User, ArrowLeft, Send, Plus, LogOut, Lock,
  Pin, Trash2, Settings, IndianRupee, Crown, Smile, Paperclip, Camera, X, Users, Phone, Zap, Calendar, MapPin, Ticket, Printer, Share2, Check, Pencil, Image as ImageIcon
} from "lucide-react";

const W = { teal: "#008069", sent: "#D9FDD3", recv: "#fff", wall: "#EAE2D8", ink: "#111B21", soft: "#667781", line: "#E9EDEF", blue: "#53BDEB", pink: "#D81B7A", bg: "#F0F2F5" };
const WALL = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><g fill='none' stroke='%23000' stroke-opacity='0.03' stroke-width='2'><circle cx='20' cy='20' r='6'/><path d='M50 14 l8 8 M58 14 l-8 8'/><rect x='48' y='48' width='14' height='14' rx='3'/><path d='M14 54 q8 -10 16 0'/></g></svg>`);
const EVENT_CATS = ["Music", "Comedy", "Sports", "Workshop", "Social", "Food & Drink", "Other"];
function escapeHtml(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function waNum(p) { const d = String(p || "").replace(/\D/g, ""); if (!d) return ""; return d.length === 10 ? "91" + d : d; }
function netPrice(t, subs) {
  const base = t.price || 0;
  if (!t.discount_room_id || !t.discount_value || !(subs || []).includes(t.discount_room_id)) return base;
  const d = t.discount_kind === "flat" ? t.discount_value : Math.round(base * t.discount_value / 100);
  return Math.max(0, base - d);
}
function genderNet(t, subs, profile) {
  let n = netPrice(t, subs);
  const pct = profile?.gender === "female" ? Number(t.disc_female_pct) : profile?.gender === "male" ? Number(t.disc_male_pct) : 0;
  if (pct > 0) n = Math.max(0, Math.round(n * (100 - Math.min(pct, 100)) / 100));
  return n;
}
// Availability for a ticket type: capacity only
function ticketStatus(t, e, stats, typeSold) {
  const sold = (typeSold && typeSold[t.id]) || 0;
  const hasCap = t.capacity != null && t.capacity !== "";
  if (hasCap && t.capacity - sold <= 0) return { ok: false, label: "Sold out" };
  return { ok: true, label: hasCap ? `${t.capacity - sold} left` : "" };
}
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function loadRazorpay() {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true); s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
function fitText(x, t, max) { let s = String(t || ""); if (x.measureText(s).width <= max) return s; while (s.length > 1 && x.measureText(s + "X").width > max) s = s.slice(0, -1); return s + "…"; }
async function makeTicketBlob(d) {
  const Wd = 1000, Ht = 560, s = 2;
  const c = document.createElement("canvas"); c.width = Wd * s; c.height = Ht * s;
  const x = c.getContext("2d"); x.scale(s, s);
  x.fillStyle = "#0C1A16"; rr(x, 0, 0, Wd, Ht, 30); x.fill();
  x.fillStyle = "#2FD4A8"; rr(x, 0, 0, 12, Ht, 6); x.fill();
  x.fillStyle = "#2FD4A8"; x.font = "800 20px system-ui,Arial"; x.fillText("G L A S S W I N G S", 48, 60);
  x.fillStyle = "#ffffff"; x.font = "900 48px system-ui,Arial"; x.fillText(fitText(x, ((d.emoji ? d.emoji + " " : "") + d.title), 600), 48, 120);
  x.fillStyle = "rgba(255,255,255,.92)"; x.font = "500 24px system-ui,Arial";
  const meta = [d.dateStr, d.place].filter(Boolean).join("   ·   "); if (meta) x.fillText(fitText(x, meta, 600), 48, 166);
  x.strokeStyle = "rgba(255,255,255,.25)"; x.setLineDash([12, 10]); x.beginPath(); x.moveTo(Wd - 320, 30); x.lineTo(Wd - 320, Ht - 30); x.stroke(); x.setLineDash([]);
  x.fillStyle = "#2FD4A8"; x.font = "800 19px system-ui,Arial"; x.fillText("ATTENDEE", 48, 256);
  x.fillStyle = "#ffffff"; x.font = "800 36px system-ui,Arial"; x.fillText(fitText(x, d.name || "", 560), 48, 300);
  x.fillStyle = "rgba(255,255,255,.55)"; x.font = "700 18px system-ui,Arial"; x.fillText("TICKETS", 48, 372);
  x.fillStyle = "#ffffff"; x.font = "800 34px system-ui,Arial"; x.fillText(String(d.qty), 48, 416);
  x.fillStyle = "rgba(255,255,255,.55)"; x.font = "700 18px system-ui,Arial"; x.fillText("CODE", 230, 372);
  x.fillStyle = "#2FD4A8"; x.font = "800 28px ui-monospace,monospace"; x.fillText(d.code, 230, 414);
  x.fillStyle = "rgba(255,255,255,.5)"; x.font = "500 18px system-ui,Arial"; x.fillText("Show this ticket at entry", 48, 500);
  x.fillStyle = "#ffffff"; rr(x, Wd - 268, Ht / 2 - 110, 210, 210, 16); x.fill();
  try {
    const qrImg = await loadImg("https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=0&data=" + encodeURIComponent(d.code));
    x.drawImage(qrImg, Wd - 268 + 13, Ht / 2 - 110 + 13, 184, 184);
  } catch (e) {
    x.fillStyle = "#0C1A16"; x.font = "800 26px ui-monospace,monospace"; x.textAlign = "center";
    x.fillText(d.code, Wd - 268 + 105, Ht / 2 + 8); x.textAlign = "left";
  }
  x.fillStyle = "rgba(255,255,255,.6)"; x.font = "600 16px system-ui,Arial"; x.textAlign = "center";
  x.fillText("SCAN AT ENTRY", Wd - 268 + 105, Ht / 2 + 132); x.textAlign = "left";
  return await new Promise(res => c.toBlob(res, "image/png"));
}

function wrapLines(x, text, maxW) {
  const words = String(text || "").split(/\s+/); const lines = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
async function makePosterBlob(d) {
  const Wd = 800, Ht = 1150, s = 2, bh = 470;
  const c = document.createElement("canvas"); c.width = Wd * s; c.height = Ht * s;
  const x = c.getContext("2d"); x.scale(s, s);
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, Wd, Ht);
  let drew = false;
  if (d.bannerUrl && d.bannerType !== "video") {
    try {
      const img = await loadImg(d.bannerUrl);
      const scale = Math.max(Wd / img.width, bh / img.height);
      const w = img.width * scale, h = img.height * scale;
      x.save(); x.beginPath(); x.rect(0, 0, Wd, bh); x.clip();
      x.drawImage(img, (Wd - w) / 2, (bh - h) / 2, w, h); x.restore(); drew = true;
    } catch (e) { }
  }
  if (!drew) {
    const g = x.createLinearGradient(0, 0, Wd, bh); g.addColorStop(0, "#008069"); g.addColorStop(1, "#04B08F");
    x.fillStyle = g; x.fillRect(0, 0, Wd, bh);
    x.textAlign = "center"; x.fillStyle = "#fff"; x.font = "800 150px system-ui,Arial"; x.fillText(d.emoji || "\u{1F39F}", Wd / 2, bh / 2 + 52); x.textAlign = "left";
  }
  let y = bh + 58;
  x.fillStyle = "#008069"; x.font = "800 17px system-ui,Arial"; x.fillText("GLASSWINGS EVENTS", 50, y); y += 46;
  x.fillStyle = "#0b1f1c"; x.font = "800 46px system-ui,Arial";
  for (const ln of wrapLines(x, d.title, Wd - 100).slice(0, 3)) { x.fillText(ln, 50, y); y += 54; }
  y += 6;
  x.fillStyle = "#3a4a47"; x.font = "500 24px system-ui,Arial";
  if (d.dateStr) { x.fillText("\u{1F4C5}  " + d.dateStr, 50, y); y += 36; }
  if (d.place) { for (const ln of wrapLines(x, "\u{1F4CD}  " + d.place, Wd - 100).slice(0, 2)) { x.fillText(ln, 50, y); y += 34; } }
  const qrSize = 300, qy = Ht - qrSize - 86;
  x.strokeStyle = "#e6ebe9"; x.beginPath(); x.moveTo(50, qy - 34); x.lineTo(Wd - 50, qy - 34); x.stroke();
  x.textAlign = "center";
  x.fillStyle = "#008069"; x.font = "800 26px system-ui,Arial"; x.fillText("SCAN TO BUY TICKETS", Wd / 2, qy - 6);
  try { const qr = await loadImg("https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=0&data=" + encodeURIComponent(d.link)); x.drawImage(qr, (Wd - qrSize) / 2, qy + 6, qrSize, qrSize); } catch (e) { }
  x.fillStyle = "#5a6b67"; x.font = "500 18px system-ui,Arial"; x.fillText("glass-wings.com", Wd / 2, qy + qrSize + 40);
  x.textAlign = "left";
  return await new Promise(res => c.toBlob(res, "image/png"));
}
async function compressImage(file, maxW = 1600, quality = 0.82) {
  if (!file || !file.type || !file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, maxW / (img.width || maxW));
    if (scale === 1 && file.size < 400 * 1024) { URL.revokeObjectURL(url); return file; }
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", quality));
    if (blob && blob.size < file.size) return new File([blob], (file.name || "image").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
    return file;
  } catch { return file; }
}
async function uploadPhoto(userId, file) {
  file = await compressImage(file);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

async function uploadChatFile(roomId, file) {
  file = await compressImage(file);
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${roomId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage.from("chat").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("chat").getPublicUrl(path).data.publicUrl;
}

const VAPID_PUBLIC_KEY = appCfg.VAPID_PUBLIC_KEY || "";
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
async function subscribeToPush(userId, force) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("This browser doesn't support notifications.");
  if (!VAPID_PUBLIC_KEY) throw new Error("Notifications aren't configured yet (missing VAPID key).");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notifications were blocked. Enable them in your browser settings.");
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && force) { try { await sub.unsubscribe(); } catch (e) {} sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  const j = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}

function PushToggle({ user }) {
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [state, setState] = useState(supported ? "checking" : "no");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const isStandalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone);
  const isIOS = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  useEffect(() => {
    if (!supported) return;
    (async () => {
      if (Notification.permission !== "granted") { setState("off"); return; }
      try {
        try { await subscribeToPush(user.id, false); }
        catch (e1) { await subscribeToPush(user.id, true); }
        setState("on");
      } catch (e) { setState("off"); setMsg(e.message || String(e)); }
    })();
  }, []);
  const enable = async (force) => {
    setBusy(true); setMsg("");
    try { await subscribeToPush(user.id, force); setState("on"); setMsg(force ? "Device registered." : "Notifications are on for this device."); }
    catch (e) {
      try { await subscribeToPush(user.id, true); setState("on"); setMsg("Device registered."); }
      catch (e2) { setMsg(e2.message || String(e2)); }
    }
    setBusy(false);
  };
  if (state === "no") return null;
  return (
    <div style={{ marginTop: 18, background: "#fff", border: `1px solid ${W.line}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <MessageCircle size={18} color={W.teal} />
        <span style={{ fontWeight: 700, color: W.ink, fontSize: 15 }}>Notifications</span>
      </div>
      {state === "checking" ? (
        <div style={{ fontSize: 13.5, color: W.soft }}>Checking…</div>
      ) : state === "on" ? (
        <>
          <div style={{ fontSize: 13.5, color: W.teal, fontWeight: 600 }}>✅ On for this device.</div>
          <button onClick={() => enable(true)} disabled={busy} style={{ marginTop: 8, background: "none", border: "none", color: W.soft, fontSize: 12.5, textDecoration: "underline", cursor: "pointer", padding: 0 }}>{busy ? "Working…" : "Re-register this device"}</button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: W.soft, marginBottom: 12 }}>Get notified of new messages and announcements, even when Glasswings is closed.</div>
          {isIOS && !isStandalone && (
            <div style={{ fontSize: 12.5, color: "#9a6b00", background: "#FFF6E6", borderRadius: 9, padding: 10, marginBottom: 12 }}>
              On iPhone: tap the <b>Share</b> icon → <b>Add to Home Screen</b>, open Glasswings from that icon, then turn this on.
            </div>
          )}
          <button onClick={() => enable(true)} disabled={busy} style={{ ...btn(W.teal, "#fff"), width: "100%", justifyContent: "center", opacity: busy ? .6 : 1 }}>
            {busy ? "Enabling…" : "Turn on notifications"}
          </button>
        </>
      )}
      {msg && <div style={{ fontSize: 12.5, color: state === "on" ? W.teal : "#C0392B", marginTop: 10 }}>{msg}</div>}
    </div>
  );
}

function GuestTicketPage({ code }) {
  const [t, setT] = useState(undefined);
  useEffect(() => { supabase.rpc("guest_ticket_public", { p_code: code }).then(({ data, error }) => setT(error ? null : (data || null))); }, [code]);
  if (t === undefined) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#5d6f6b", fontSize: 14 }}>Loading your ticket…</div>;
  if (!t) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#eef2f1", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "28px 24px", textAlign: "center", maxWidth: 380 }}>
        <div style={{ fontSize: 34 }}>🎟️</div>
        <div style={{ fontWeight: 800, fontSize: 17, color: "#1b2a27", marginTop: 8 }}>Ticket not found</div>
        <div style={{ fontSize: 13.5, color: "#5d6f6b", marginTop: 6 }}>This ticket link is invalid or has been removed. Please contact the organiser.</div>
      </div>
    </div>
  );
  const qr = "https://api.qrserver.com/v1/create-qr-code/?size=210x210&margin=0&data=" + encodeURIComponent(t.code);
  const place = [t.venue, t.city].filter(Boolean).join(", ");
  return (
    <div style={{ minHeight: "100vh", background: "#eef2f1", padding: "26px 14px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 420, width: "100%" }}>
        <div style={{ background: "#0C1A16", borderRadius: 20, overflow: "hidden", boxShadow: "0 12px 34px rgba(0,0,0,.25)" }}>
          <div style={{ padding: "22px 22px 18px", borderLeft: "6px solid #2FD4A8" }}>
            <div style={{ fontSize: 11, letterSpacing: 4, fontWeight: 800, color: "#2FD4A8" }}>GLASSWINGS EVENTS</div>
            <div style={{ fontSize: 25, fontWeight: 900, marginTop: 8, lineHeight: 1.15, color: "#fff" }}>{t.title}</div>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.9)", marginTop: 8 }}>{t.event_date || ""}{place ? ` · ${place}` : ""}</div>
          </div>
          <div style={{ borderTop: "2px dashed rgba(255,255,255,.25)", padding: "18px 22px", display: "flex", gap: 18, alignItems: "center" }}>
            <img src={qr} alt="Entry QR" width={132} height={132} style={{ background: "#fff", padding: 8, borderRadius: 10, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: "rgba(255,255,255,.55)", fontWeight: 700 }}>GUEST</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>{t.name}</div>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: "rgba(255,255,255,.55)", fontWeight: 700, marginTop: 8 }}>ENTRIES</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>{t.qty}{t.ticket_type ? ` · ${t.ticket_type}` : ""}</div>
              <div style={{ display: "inline-block", marginTop: 10, fontSize: 16, fontWeight: 800, color: "#08130F", background: "#2FD4A8", fontFamily: "ui-monospace,monospace", letterSpacing: 1, padding: "5px 12px", borderRadius: 8 }}>{t.code}</div>
            </div>
          </div>
          <div style={{ background: "#08130F", color: "rgba(255,255,255,.6)", fontSize: 11.5, textAlign: "center", padding: "11px 0", letterSpacing: .5 }}>{t.checked_in ? "✓ Already checked in" : "Show this QR at the door"}</div>
        </div>
      </div>
    </div>
  );
}
export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    try { const sp = new URLSearchParams(window.location.search); const r = sp.get("ref"); if (r) localStorage.setItem("gw_ref", r.trim()); const ev = sp.get("event"); if (ev) localStorage.setItem("gw_event", ev.trim()); } catch {}
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => { setSession(s); if (e === "PASSWORD_RECOVERY") setRecovery(true); });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => sub.subscription.unsubscribe();
  }, []);
  if (loading) return <Shell><Splash /></Shell>;
  if (recovery) return <Shell><RecoverPassword onDone={() => setRecovery(false)} /></Shell>;
  let gtCode = null; try { gtCode = new URLSearchParams(window.location.search).get("gt"); } catch {}
  if (gtCode) return <Shell><GuestTicketPage code={gtCode} /></Shell>;
  if (!session) return <PublicLanding />;
  return <Shell><Main user={session.user} /></Shell>;
}

function useWide(bp = 1000) {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 0);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return w >= bp;
}
function Shell({ children }) {
  const wide = useWide(900);
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", display: "flex", justifyContent: "center", minHeight: "100vh", width: "100%", overflowX: "hidden", position: "relative", background: wide ? W.bg : "#d9d9d9" }}>
      <style>{`html,body,#root{margin:0;padding:0;width:100%;max-width:100%;overflow-x:hidden;}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}input,button{font-family:inherit;}::-webkit-scrollbar{width:0;}.chatscreen{height:100vh;height:100dvh;}`}</style>
      <div style={{ width: "100%", maxWidth: wide ? "none" : 430, minHeight: "100vh", background: W.bg, boxShadow: wide ? "none" : "0 0 60px rgba(0,0,0,.15)", position: "relative", zIndex: 2, overflowX: "hidden" }}>{children}</div>
    </div>
  );
}
function DesktopSidebar({ tab, setTab, isAdmin, width }) {
  const items = [{ id: "chats", icon: MessageCircle, label: "Chats" }, { id: "explore", icon: Compass, label: "Explore" }, { id: "events", icon: Calendar, label: "Events" }, { id: "gallery", icon: ImageIcon, label: "Gallery" }, ...(isAdmin ? [{ id: "admin", icon: Shield, label: "Admin" }] : []), { id: "profile", icon: User, label: "Profile" }];
  return (
    <div style={{ position: "fixed", left: 0, top: 0, height: "100vh", width, background: "#0c1f26", display: "flex", flexDirection: "column", padding: "18px 12px", gap: 4, zIndex: 40 }}>
      <img src="/logo-white.png" alt="Glasswings Events" style={{ height: 32, objectFit: "contain", margin: "8px 12px 22px", alignSelf: "flex-start", maxWidth: "82%" }} />
      {items.map(it => { const on = tab === it.id; const I = it.icon; return <button key={it.id} onClick={() => setTab(it.id)} style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 15px", borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left", background: on ? W.teal : "transparent", color: on ? "#fff" : "rgba(255,255,255,.72)", fontWeight: on ? 700 : 600, fontSize: 15 }}><I size={20} strokeWidth={on ? 2.4 : 2} />{it.label}</button>; })}
    </div>
  );
}
function ChatListPane({ chats, open, onOpen, width }) {
  return (
    <div style={{ width, flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto", background: "#fff", borderRight: `1px solid ${W.line}`, zIndex: 10 }}>
      <div style={{ padding: "18px 18px 12px", fontWeight: 800, fontSize: 20, color: W.ink }}>Chats</div>
      {chats.length === 0 && <div style={{ padding: "8px 18px", color: W.soft, fontSize: 13.5, lineHeight: 1.5 }}>No chats yet. Open <b>Explore</b> to join a room.</div>}
      {chats.map(c => {
        const on = open && open.id === c.id && open.type === c.type;
        return (
          <div key={c.type + c.id} onClick={() => onOpen(c)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", cursor: "pointer", background: on ? "#E7F6EF" : "transparent", borderLeft: on ? `3px solid ${W.teal}` : "3px solid transparent" }}>
            <Avatar room={c} size={46} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: W.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
              <div style={{ fontSize: 12.5, color: W.soft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
function EmptyConvo() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: W.wall, backgroundImage: `url("${WALL}")` }}>
      <div style={{ width: 92, height: 92, borderRadius: "50%", background: W.teal, display: "flex", alignItems: "center", justifyContent: "center" }}><MessageCircle size={46} color="#fff" /></div>
      <div style={{ fontSize: 16.5, color: W.ink, fontWeight: 600 }}>Select a chat to start messaging</div>
      <div style={{ fontSize: 13.5, color: W.soft }}>Your rooms, events &amp; organiser messages live here.</div>
    </div>
  );
}
function Splash() { return <div style={{ height: "100vh", background: "linear-gradient(135deg,#0E5C54,#061f1c)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}><img src="/logo-white.png" alt="" style={{ width: 200, maxWidth: "60%" }} /></div>; }

/* ---------------- auth ---------------- */
function Auth({ initialMode = "login", onClose }) {
  const [mode, setMode] = useState(initialMode);
  const buying = (() => { try { return !!localStorage.getItem("gw_buy"); } catch { return false; } })();
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [pass, setPass] = useState(""), [gender, setGender] = useState("male");
  const [err, setErr] = useState(""), [note, setNote] = useState(""), [busy, setBusy] = useState(false);
  const go = async () => {
    setErr(""); setNote("");
    if (mode === "reset") {
      if (!email) return setErr("Enter your email and we'll send a reset link.");
      setBusy(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) setErr(error.message); else setNote("If that email has an account, a password-reset link is on its way. Check your inbox (and spam).");
      setBusy(false); return;
    }
    if (!email || !pass || (mode === "signup" && !name)) return setErr("Please fill in all fields.");
    setBusy(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password: pass, options: { data: { full_name: name, gender } } });
      if (error) { setErr(error.message); }
      else {
        try {
          const buying = localStorage.getItem("gw_buy");
          if (buying && data?.session?.user) await supabase.from("profiles").update({ full_name: name, gender, profile_completed: true }).eq("id", data.session.user.id);
          if (data?.session?.user) { try { localStorage.setItem("gw_open_explore", "1"); } catch {} }
        } catch {}
        if (!data?.session) setNote("Account created! Please log in to continue.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) setErr(error.message);
    }
    setBusy(false);
  };
  const inp = (ph, v, s, t = "text") => <input value={v} onChange={e => s(e.target.value)} placeholder={ph} type={t} style={{ width: "100%", padding: "13px 15px", borderRadius: 10, border: `1px solid ${W.line}`, fontSize: 15, outline: "none", color: W.ink }} />;
  return (
    <div style={{ minHeight: "100vh", padding: "0 22px 44px", display: "flex", flexDirection: "column", alignItems: "center", position: "relative", backgroundImage: "linear-gradient(rgba(6,22,28,.72), rgba(6,18,26,.93)), url(/hero.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}>
      {onClose && <button onClick={onClose} style={{ position: "absolute", top: 14, left: 14, background: "rgba(255,255,255,.16)", color: "#fff", border: "none", borderRadius: 9, padding: "8px 13px", fontWeight: 700, fontSize: 13, cursor: "pointer", zIndex: 3 }}>‹ Events</button>}
      <div style={{ textAlign: "center", paddingTop: 56 }}>
        <img src="/logo-white.png" alt="Glasswings Events" style={{ width: 200, maxWidth: "66%", objectFit: "contain" }} />
        <div style={{ fontSize: 29, fontWeight: 800, color: "#fff", marginTop: 18, lineHeight: 1.18, letterSpacing: 0.3 }}>Discover the best<br />events &amp; meetups</div>
        <div style={{ color: "rgba(255,255,255,.82)", marginTop: 9, fontSize: 14.5 }}>Tickets · Rooms · Community — all in one place</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 18, padding: 20, marginTop: 30, width: "100%", maxWidth: 384, boxShadow: "0 24px 60px rgba(0,0,0,.4)" }}>
        {buying && mode === "signup" && <div style={{ background: "#E7F6EF", color: W.teal, fontSize: 13, fontWeight: 600, borderRadius: 10, padding: "10px 12px", marginBottom: 14, textAlign: "center", lineHeight: 1.4 }}>You're one step from your ticket — create your free account.</div>}
        <div style={{ display: "flex", background: W.bg, borderRadius: 10, padding: 4, marginBottom: 16 }}>
          {["login", "signup"].map(m => <button key={m} onClick={() => { setMode(m); setErr(""); setNote(""); }} style={{ flex: 1, padding: 9, border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14, background: mode === m ? W.teal : "transparent", color: mode === m ? "#fff" : W.soft }}>{m === "login" ? "Log in" : "Sign up"}</button>)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {mode === "signup" && inp("Full name", name, setName)}
          {inp("Email", email, setEmail, "email")}
          {mode !== "reset" && inp("Password (min 6 characters)", pass, setPass, "password")}
          {mode === "login" && <div style={{ textAlign: "right", marginTop: -4 }}><span onClick={() => { setMode("reset"); setErr(""); setNote(""); }} style={{ color: W.teal, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Forgot password?</span></div>}
          {mode === "reset" && <div style={{ fontSize: 13, color: W.soft, lineHeight: 1.5 }}>Enter your account email and we'll send you a link to set a new password.</div>}
          {mode === "signup" && (
            <div>
              <div style={{ fontSize: 13, color: W.soft, marginBottom: 7, fontWeight: 600 }}>I am</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[["male", "Man"], ["female", "Woman"], ["other", "Other"]].map(([v, l]) => <button key={v} onClick={() => setGender(v)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${gender === v ? W.teal : W.line}`, background: gender === v ? "#E7F6EF" : "#fff", color: W.ink, fontWeight: 600, fontSize: 14 }}>{l}</button>)}
              </div>
            </div>
          )}
          {err && <div style={{ color: "#C0392B", fontSize: 13 }}>{err}</div>}
          {note && <div style={{ color: W.teal, fontSize: 13 }}>{note}</div>}
          <button onClick={go} disabled={busy} style={{ padding: 14, borderRadius: 10, border: "none", cursor: "pointer", background: W.teal, color: "#fff", fontWeight: 700, fontSize: 15, opacity: busy ? .6 : 1 }}>{busy ? "Please wait…" : mode === "login" ? "Log in" : mode === "signup" ? "Create account" : "Send reset link"}</button>
          {mode === "reset" && <div style={{ textAlign: "center" }}><span onClick={() => { setMode("login"); setErr(""); setNote(""); }} style={{ color: W.soft, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>‹ Back to log in</span></div>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- profile completion (with photo) ---------------- */
function RecoverPassword({ onDone }) {
  const [p1, setP1] = useState(""), [p2, setP2] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const save = async () => {
    setErr("");
    if (p1.length < 6) return setErr("Password must be at least 6 characters.");
    if (p1 !== p2) return setErr("Those passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) return setErr(error.message);
    setDone(true);
  };
  const ip = { width: "100%", padding: "13px 15px", borderRadius: 10, border: `1px solid ${W.line}`, fontSize: 15, outline: "none", color: W.ink };
  return (
    <div style={{ minHeight: "100vh", padding: "0 22px 44px", display: "flex", flexDirection: "column", alignItems: "center", backgroundImage: "linear-gradient(rgba(6,22,28,.72), rgba(6,18,26,.93)), url(/hero.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}>
      <div style={{ textAlign: "center", paddingTop: 56 }}>
        <img src="/logo-white.png" alt="Glasswings Events" style={{ width: 200, maxWidth: "66%", objectFit: "contain" }} />
      </div>
      <div style={{ background: "#fff", borderRadius: 18, padding: 22, marginTop: 30, width: "100%", maxWidth: 384, boxShadow: "0 24px 60px rgba(0,0,0,.4)" }}>
        <div style={{ fontWeight: 800, fontSize: 19, color: W.ink, marginBottom: 4 }}>Set a new password</div>
        {done ? (
          <>
            <div style={{ color: W.teal, fontSize: 14, marginTop: 10, lineHeight: 1.5 }}>Your password has been updated. You're all set.</div>
            <button onClick={onDone} style={{ ...btn(W.teal, "#fff"), width: "100%", justifyContent: "center", marginTop: 16 }}>Continue</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: W.soft, marginBottom: 14 }}>Pick a new password for your account.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <input value={p1} onChange={e => setP1(e.target.value)} type="password" placeholder="New password (min 6 characters)" style={ip} />
              <input value={p2} onChange={e => setP2(e.target.value)} type="password" placeholder="Confirm new password" style={ip} />
              {err && <div style={{ color: "#C0392B", fontSize: 13 }}>{err}</div>}
              <button onClick={save} disabled={busy} style={{ padding: 14, borderRadius: 10, border: "none", cursor: "pointer", background: W.teal, color: "#fff", fontWeight: 700, fontSize: 15, opacity: busy ? .6 : 1 }}>{busy ? "Saving…" : "Update password"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function PromoPctEditor({ event: e, onUpdate, canApprove }) {
  const [v, setV] = useState(e.promo_pct ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setV(e.promo_pct ?? ""); }, [e.id, e.promo_pct]);
  if (!canApprove) {
    return e.promo_pct != null ? (
      <div style={{ marginTop: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: W.ink }}>Promotion service</label>
        <div style={{ marginTop: 8, background: "#EFEAFB", border: "1px solid #E4D5FB", color: "#7C3AED", borderRadius: 10, padding: "10px 13px", fontSize: 13, fontWeight: 700 }}>📣 Glasswings promotion on this event · {e.promo_pct}% of ticket sales</div>
      </div>
    ) : null;
  }
  const save = async () => {
    setBusy(true);
    const val = (v ?? "").toString().trim();
    await onUpdate(e.id, { promo_pct: val === "" ? null : Number(val) });
    setBusy(false);
  };
  return (
    <div style={{ marginTop: 16 }}>
      <label style={{ fontSize: 13, fontWeight: 700, color: W.ink }}>Promotion service % <span style={{ fontWeight: 500, color: W.soft }}>(this event only — leave blank for none)</span></label>
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
        <input value={v} onChange={ev => setV(ev.target.value.replace(/[^\d.]/g, ""))} placeholder="—" inputMode="decimal" style={{ width: 70, padding: "9px 10px", borderRadius: 9, border: `1px solid ${W.line}`, fontSize: 13.5, outline: "none", textAlign: "center" }} />
        <span style={{ fontSize: 13, color: W.soft, fontWeight: 700 }}>% of this event's ticket sales</span>
        <button onClick={save} disabled={busy} style={{ ...btn("#7C3AED", "#fff"), padding: "8px 14px", fontSize: 12.5, marginLeft: "auto" }}>{busy ? "…" : "Save"}</button>
      </div>
      <div style={{ fontSize: 11.5, color: W.soft, marginTop: 6 }}>Charged as a deduction in the organiser's settlement, only for events where promotion was agreed.</div>
    </div>
  );
}
function EventMediaEditor({ event: e, onUpdate }) {
  const pRef = useRef(null), bRef = useRef(null);
  const [up, setUp] = useState(false);
  const pick = async (file, kind) => {
    if (!file) return;
    setUp(true);
    try {
      const url = await uploadChatFile("banners", file);
      if (kind === "poster") await onUpdate(e.id, { poster_url: url });
      else await onUpdate(e.id, { banner_url: url, banner_type: file.type.startsWith("video") ? "video" : "image" });
    } catch (x) { alert("Upload failed: " + x.message); }
    setUp(false);
  };
  const tile = { flex: 1, minWidth: 0, padding: "9px 10px", borderRadius: 9, border: `1px solid ${W.line}`, background: "#fff", fontSize: 12.5, color: W.ink, fontWeight: 600, cursor: "pointer", textAlign: "center" };
  return (
    <div style={{ marginTop: 16 }}>
      <label style={{ fontSize: 13, fontWeight: 700, color: W.ink }}>Event media</label>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={() => pRef.current?.click()} disabled={up} style={tile}>{up ? "Uploading…" : (e.poster_url ? "Replace poster (3:4)" : "+ Poster (3:4)")}</button>
        <button onClick={() => bRef.current?.click()} disabled={up} style={tile}>{up ? "Uploading…" : (e.banner_url ? "Replace banner / video" : "+ Banner / video")}</button>
      </div>
      <div style={{ fontSize: 11.5, color: W.soft, marginTop: 6 }}>Poster shows on event cards; banner (or video) shows on the slider and event page.</div>
      <input ref={pRef} type="file" accept="image/*" onChange={ev => { pick(ev.target.files?.[0], "poster"); ev.target.value = ""; }} style={{ display: "none" }} />
      <input ref={bRef} type="file" accept="image/*,video/*" onChange={ev => { pick(ev.target.files?.[0], "banner"); ev.target.value = ""; }} style={{ display: "none" }} />
    </div>
  );
}
function FiltersPanel({ categories, cities, dims, optsAll, onAddOption, onDelOption, onSetOptionImage, onChanged }) {
  const [newDim, setNewDim] = useState("");
  const addDim = async () => {
    const n = newDim.trim(); if (!n) return;
    const { error } = await supabase.from("filter_dimensions").insert({ name: n });
    if (error) return alert(error.message);
    setNewDim(""); onChanged && onChanged();
  };
  const delDim = async (d) => {
    if (!window.confirm(`Delete the "${d.name}" filter and all its options?`)) return;
    await supabase.from("event_options").delete().eq("kind", d.name);
    const { error } = await supabase.from("filter_dimensions").delete().eq("id", d.id);
    if (error) return alert(error.message);
    onChanged && onChanged();
  };
  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: 16.5, color: W.ink, marginBottom: 4 }}>Event filters</div>
      <div style={{ fontSize: 12.5, color: W.soft, marginBottom: 14 }}>These power the browse experience — categories appear as image tiles, cities as filter chips, on the events page and public landing.</div>
      <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: 14, display: "flex", flexDirection: "column", gap: 18 }}>
        <OptionList label="Categories" kind="category" items={categories} onAdd={onAddOption} onDel={onDelOption} onSetImage={onSetOptionImage} />
        <OptionList label="Cities" kind="city" items={cities} onAdd={onAddOption} onDel={onDelOption} />
      </div>
      <div style={{ fontWeight: 800, fontSize: 15.5, color: W.ink, margin: "20px 0 4px" }}>Custom filter dimensions</div>
      <div style={{ fontSize: 12.5, color: W.soft, marginBottom: 10 }}>Add your own filter — e.g. Language, Age group, Vibe. It appears in the create-event form and as filter chips on the browse pages.</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={newDim} onChange={ev => setNewDim(ev.target.value)} placeholder="New dimension name… e.g. Language" style={{ flex: 1, minWidth: 0, border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 12px", fontSize: 14, outline: "none" }} />
        <button onClick={addDim} style={btn(W.teal, "#fff")}>Add</button>
      </div>
      {(dims || []).map(d => (
        <div key={d.id} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontWeight: 800, color: W.ink }}>{d.name}</span>
            <button onClick={() => delDim(d)} style={{ ...btn("#fff", "#C0392B"), border: "1px solid #F2C4C0", padding: "5px 11px", fontSize: 12 }}>Delete dimension</button>
          </div>
          <OptionList label={`${d.name} options`} kind={d.name} items={(optsAll || []).filter(o => o.kind === d.name)} onAdd={onAddOption} onDel={onDelOption} />
        </div>
      ))}
    </div>
  );
}
function SettlementsPanel({ isSuper }) {
  const [rows, setRows] = useState(null);
  const [draft, setDraft] = useState({});
  const [gwDraft, setGwDraft] = useState(null);
  const [saving, setSaving] = useState(null);
  const load = () => supabase.rpc("organiser_settlements").then(({ data, error }) => setRows(error ? [] : (data || [])));
  useEffect(() => { load(); }, []);
  const gwPct = rows && rows.length ? rows[0].gateway_pct : null;
  const inr = n => n == null ? "—" : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const savePct = async (uid) => {
    setSaving(uid);
    const v = (draft[uid] ?? "").toString().trim();
    const { error } = await supabase.rpc("set_org_commission", { p_user: uid, p_pct: v === "" ? null : Number(v) });
    setSaving(null);
    if (error) return alert(error.message);
    setDraft(d => { const n = { ...d }; delete n[uid]; return n; });
    load();
  };
  const saveGw = async () => {
    setSaving("gw");
    const v = (gwDraft ?? "").toString().trim();
    const { error } = await supabase.rpc("set_gateway_fee", { p_pct: v === "" ? null : Number(v) });
    setSaving(null);
    if (error) return alert(error.message);
    setGwDraft(null); load();
  };
  const exportPdf = (subset, label) => {
    const w = window.open("", "_blank", "width=860,height=960"); if (!w) return;
    const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const f = n => n == null ? "—" : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
    const tot = k => subset.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    const allOk = subset.every(r => r.pct != null && r.gateway_pct != null);
    const rowsHtml = subset.map((r, i2) => `<tr style="background:${i2 % 2 ? "#F4FAF8" : "#fff"}">
      <td><b>${escapeHtml(r.host_name || "Organiser")}</b></td>
      <td class="r">${r.events_count}</td><td class="r">${r.tickets_sold}</td>
      <td class="r"><b>${f(r.gross)}</b></td>
      <td class="r rz">${r.gateway_pct == null ? "—" : `${r.gateway_pct}%<br><b>− ${f(r.gateway_fee)}</b>`}</td>
      <td class="r pf">${r.pct == null ? "—" : `${r.pct}%<br><b>− ${f(r.platform_cut)}</b>`}</td>
      <td class="r pm">${Number(r.promo_fees) > 0 ? `<b>− ${f(r.promo_fees)}</b>` : "—"}</td>
      <td class="r pay"><b>${r.payable == null ? "—" : f(r.payable)}</b></td>
    </tr>`).join("");
    const single = subset.length === 1 ? subset[0] : null;
    const sumBoxes = single ? `
      <div class="boxes">
        <div class="bx" style="background:#E8F2FB;color:#1B6FB8"><div class="bl">GROSS COLLECTED</div><div class="bv">${f(single.gross)}</div></div>
        <div class="bx" style="background:#FBE9E7;color:#C0392B"><div class="bl">RAZORPAY FEE ${single.gateway_pct == null ? "" : "(" + single.gateway_pct + "%)"}</div><div class="bv">${single.gateway_fee == null ? "—" : "− " + f(single.gateway_fee)}</div></div>
        <div class="bx" style="background:#FDF6EC;color:#B45309"><div class="bl">PLATFORM CUT ${single.pct == null ? "" : "(" + single.pct + "%)"}</div><div class="bv">${single.platform_cut == null ? "—" : "− " + f(single.platform_cut)}</div></div>
        ${Number(single.promo_fees) > 0 ? `<div class="bx" style="background:#EFEAFB;color:#7C3AED"><div class="bl">PROMOTION FEES</div><div class="bv">− ${f(single.promo_fees)}</div></div>` : ""}
        <div class="bx" style="background:#E7F6EF;color:#008069"><div class="bl">PAYABLE TO ORGANISER</div><div class="bv">${single.payable == null ? "—" : f(single.payable)}</div></div>
      </div>` : "";
    w.document.write(`<!doctype html><html><head><title>Glasswings — Organiser settlement</title><style>
      body{font-family:system-ui,Arial,sans-serif;color:#1b2a27;margin:0;padding:0}
      .band{background:linear-gradient(135deg,#008069,#04B08F);color:#fff;padding:30px 36px}
      .br{font-size:11px;letter-spacing:4px;font-weight:800;opacity:.92}
      h1{font-size:23px;margin:8px 0 3px} .sub{font-size:13px;opacity:.92}
      .wrap{padding:26px 36px}
      .boxes{display:flex;gap:12px;margin-bottom:22px}
      .bx{flex:1;border-radius:14px;padding:14px}
      .bl{font-size:9.5px;font-weight:800;letter-spacing:.8px}
      .bv{font-size:21px;font-weight:800;margin-top:5px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      thead th{background:#008069;color:#fff;font-size:10.5px;letter-spacing:.6px;text-transform:uppercase;text-align:left;padding:10px 9px}
      thead th.r{text-align:right}
      td{padding:10px 9px;border-bottom:1px solid #e4ecea;vertical-align:top} .r{text-align:right}
      .rz{color:#C0392B} .pf{color:#B45309} .pm{color:#7C3AED} .pay{color:#008069;font-size:14px}
      tfoot td{font-weight:800;border-top:2.5px solid #008069;border-bottom:none;background:#F4FAF8}
      .note{margin-top:16px;font-size:11.5px;color:#5d6f6b;background:#F4FAF8;border-radius:10px;padding:11px 14px}
      .ft{margin-top:18px;font-size:11px;color:#8a9b97}
      @media print{.band{-webkit-print-color-adjust:exact;print-color-adjust:exact}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
      <div class="band"><div class="br">G L A S S W I N G S &nbsp; E V E N T S</div>
        <h1>Organiser settlement statement</h1>
        <div class="sub">${escapeHtml(label)} · Generated on ${today} · Paid ticket revenue only</div></div>
      <div class="wrap">
        ${sumBoxes}
        <table><thead><tr><th>Organiser</th><th class="r">Events</th><th class="r">Tickets</th><th class="r">Gross</th><th class="r">Razorpay fee</th><th class="r">Platform cut</th><th class="r">Promo fees</th><th class="r">Payable</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><td>Total</td><td class="r">${tot("events_count")}</td><td class="r">${tot("tickets_sold")}</td><td class="r">${f(tot("gross"))}</td><td class="r rz">${allOk ? "− " + f(tot("gateway_fee")) : "—"}</td><td class="r pf">${allOk ? "− " + f(tot("platform_cut")) : "—"}</td><td class="r pm">${tot("promo_fees") > 0 ? "− " + f(tot("promo_fees")) : "—"}</td><td class="r pay">${allOk ? f(tot("payable")) : "—"}</td></tr></tfoot></table>
        <div class="note"><b>How payable is calculated:</b> Payable = Online gross − Razorpay gateway fee − Glasswings platform cut − Promotion fees. The platform and promotion percentages apply on TOTAL sales (online + door cash/UPI); the Razorpay fee applies on online sales only. Door money is collected directly by the organiser, so its fees are recovered from the online payout.</div>
        <div class="ft">Glasswings Events · glass-wings.com · This statement is generated from recorded payments and is subject to reconciliation.</div>
      </div>
      <script>window.onload=function(){setTimeout(function(){window.print()},380)}<\/script></body></html>`);
    w.document.close();
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontWeight: 800, fontSize: 16.5, color: W.ink }}>Organiser payouts</div>
        {rows && rows.length > 0 && <button onClick={() => exportPdf(rows, isSuper ? "All organisers" : "Your settlement")} style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, padding: "7px 13px", fontSize: 12.5 }}>📄 Export PDF</button>}
      </div>
      <div style={{ fontSize: 12.5, color: W.soft, marginBottom: 12 }}>Gross = online + door sales (cash/UPI). Platform % and promotion % are charged on the full gross; the Razorpay fee only on online sales. Payable = Online gross − Razorpay fee − Platform cut − Promotion fees.</div>
      <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: "12px 14px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 800, color: W.ink, fontSize: 14 }}>Razorpay gateway fee</div>
          <div style={{ fontSize: 11.5, color: W.soft, marginTop: 2 }}>Charged by Razorpay on every transaction — update here if their rate changes.</div>
        </div>
        {isSuper ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input value={gwDraft ?? (gwPct ?? "")} onChange={ev => setGwDraft(ev.target.value.replace(/[^\d.]/g, ""))} placeholder="—" inputMode="decimal" style={{ width: 58, padding: "7px 9px", borderRadius: 9, border: `1px solid ${W.line}`, fontSize: 13.5, outline: "none", textAlign: "center" }} />
            <span style={{ fontSize: 13, color: W.soft, fontWeight: 700 }}>%</span>
            <button onClick={saveGw} disabled={saving === "gw"} style={{ ...btn(W.teal, "#fff"), padding: "7px 13px", fontSize: 12.5 }}>{saving === "gw" ? "…" : "Save"}</button>
          </div>
        ) : (
          <span style={{ fontWeight: 800, color: "#C0392B", fontSize: 14 }}>{gwPct == null ? "to be set" : `${gwPct}%`}</span>
        )}
      </div>
      {rows === null ? <Center>loading…</Center> : rows.length === 0 ? <Center>No organiser revenue yet.</Center> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map(r => (
            <div key={r.host_id} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ fontWeight: 800, color: W.ink, fontSize: 15 }}>{r.host_name || "Organiser"}</span>
                  <button onClick={() => exportPdf([r], r.host_name || "Organiser")} title="Export this organiser's statement" style={{ ...btn("#fff", W.soft), border: `1px solid ${W.line}`, padding: "4px 9px", fontSize: 11.5 }}>📄</button>
                </div>
                {isSuper ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: W.soft, fontWeight: 700 }}>Platform %</span>
                    <input value={draft[r.host_id] ?? (r.pct ?? "")} onChange={ev => setDraft(d => ({ ...d, [r.host_id]: ev.target.value.replace(/[^\d.]/g, "") }))} placeholder="—" inputMode="decimal" style={{ width: 58, padding: "7px 9px", borderRadius: 9, border: `1px solid ${W.line}`, fontSize: 13.5, outline: "none", textAlign: "center" }} />
                    <button onClick={() => savePct(r.host_id)} disabled={saving === r.host_id} style={{ ...btn(W.teal, "#fff"), padding: "7px 13px", fontSize: 12.5 }}>{saving === r.host_id ? "…" : "Save"}</button>
                  </div>
                ) : (
                  <span style={{ fontSize: 12.5, color: W.soft, fontWeight: 700 }}>Platform cut: {r.pct == null ? "to be set" : `${r.pct}%`}</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 18, marginTop: 11, flexWrap: "wrap" }}>
                <div><div style={{ fontSize: 11, color: W.soft, fontWeight: 700 }}>EVENTS</div><div style={{ fontWeight: 800, color: W.ink, fontSize: 16 }}>{r.events_count}</div></div>
                <div><div style={{ fontSize: 11, color: W.soft, fontWeight: 700 }}>TICKETS</div><div style={{ fontWeight: 800, color: W.ink, fontSize: 16 }}>{r.tickets_sold}</div></div>
                <div><div style={{ fontSize: 11, color: W.soft, fontWeight: 700 }}>GROSS (ALL)</div><div style={{ fontWeight: 800, color: W.ink, fontSize: 16 }}>{inr(r.gross)}</div><div style={{ fontSize: 10.5, color: W.soft, marginTop: 1 }}>online {inr(r.online_gross)} · door {inr(r.door_gross)}</div></div>
                <div><div style={{ fontSize: 11, color: W.soft, fontWeight: 700 }}>RAZORPAY FEE</div><div style={{ fontWeight: 800, color: "#C0392B", fontSize: 16 }}>{r.gateway_pct == null ? "set % first" : "− " + inr(r.gateway_fee)}</div></div>
                <div><div style={{ fontSize: 11, color: W.soft, fontWeight: 700 }}>PLATFORM CUT</div><div style={{ fontWeight: 800, color: "#B45309", fontSize: 16 }}>{r.pct == null ? "set % first" : "− " + inr(r.platform_cut)}</div></div>
                {Number(r.promo_fees) > 0 && <div><div style={{ fontSize: 11, color: W.soft, fontWeight: 700 }}>PROMO FEES</div><div style={{ fontWeight: 800, color: "#7C3AED", fontSize: 16 }}>− {inr(r.promo_fees)}</div></div>}
                <div><div style={{ fontSize: 11, color: W.soft, fontWeight: 700 }}>PAYABLE</div><div style={{ fontWeight: 800, color: W.teal, fontSize: 16 }}>{r.payable == null ? "—" : inr(r.payable)}</div></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function RideButtons({ e, compact }) {
  const hasGeo = e.venue_lat && e.venue_lng;
  if (!hasGeo && !e.venue) return null;
  const name = encodeURIComponent(e.venue || e.title || "Event venue");
  const uber = hasGeo
    ? `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${e.venue_lat}&dropoff[longitude]=${e.venue_lng}&dropoff[nickname]=${name}`
    : `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${name}`;
  const ola = hasGeo
    ? `https://book.olacabs.com/?serviceType=p2p&drop_lat=${e.venue_lat}&drop_lng=${e.venue_lng}`
    : `https://book.olacabs.com/`;
  const a = (href, bg, fg, label, icon) => (
    <a key={label} href={href} target="_blank" rel="noreferrer" style={{ ...btn(bg, fg), padding: compact ? "8px 13px" : "10px 16px", fontSize: compact ? 12.5 : 13.5, textDecoration: "none", flex: compact ? "0 0 auto" : 1, justifyContent: "center" }}>{icon} {label}</a>
  );
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {a(uber, "#000", "#fff", "Uber", "🚕")}
      {a(ola, "#C6D62E", "#1b1b1b", "Ola", "🚖")}
      {hasGeo ? a(`https://www.google.com/maps/dir/?api=1&destination=${e.venue_lat},${e.venue_lng}`, "#fff", W.ink, "Directions", "🗺️") : null}
    </div>
  );
}
function PosterCard({ e, price, popular, going, onOpen, date, unpublished }) {
  return (
    <div id={"ev-" + e.id} onClick={() => onOpen(e.id)} style={{ cursor: "pointer" }}>
      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "3/4", background: "linear-gradient(135deg,#008069,#04B08F)", boxShadow: "0 3px 12px rgba(0,0,0,.10)" }}>
        {(e.poster_url || (e.banner_url && e.banner_type !== "video"))
          ? <img src={e.poster_url || e.banner_url} alt={e.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52 }}>{e.emoji || "🎟️"}</div>}
        {popular && <span style={{ position: "absolute", top: 8, left: 8, background: "#D35400", color: "#fff", fontSize: 10.5, fontWeight: 800, padding: "3px 9px", borderRadius: 10 }}>🔥 Popular</span>}
        {going && <span style={{ position: "absolute", top: 8, right: 8, background: "#008069", color: "#fff", fontSize: 10.5, fontWeight: 800, padding: "3px 9px", borderRadius: 10 }}>✓ Going</span>}
        {unpublished && <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: "rgba(40,48,46,.9)", color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textAlign: "center", padding: "5px 0" }}>UNPUBLISHED</div>}
        {date && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "linear-gradient(transparent, rgba(0,0,0,.74))", padding: "26px 10px 8px", color: "#fff", fontSize: 11.5, fontWeight: 700 }}>{date}</div>}
      </div>
      <div style={{ padding: "8px 2px 0" }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: W.ink, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.title}</div>
        <div style={{ fontSize: 12.5, color: W.teal, fontWeight: 800, marginTop: 3 }}>{price}</div>
      </div>
    </div>
  );
}
const PRICE_BANDS = ["Free", "\u20b91\u2013500", "\u20b9501\u20131000", "\u20b91001\u20131500", "Above \u20b91500"];
function priceBand(n) {
  if (n == null || isNaN(n)) return null;
  if (n === 0) return "Free";
  if (n <= 500) return "\u20b91\u2013500";
  if (n <= 1000) return "\u20b9501\u20131000";
  if (n <= 1500) return "\u20b91001\u20131500";
  return "Above \u20b91500";
}
function dateBucketSet() {
  const iso = d => d.toISOString().slice(0, 10);
  const today = new Date();
  const tm = new Date(today); tm.setDate(tm.getDate() + 1);
  const sat = new Date(today); sat.setDate(sat.getDate() + ((6 - sat.getDay() + 7) % 7));
  const sun = new Date(sat); sun.setDate(sun.getDate() + 1);
  return { "Today": new Set([iso(today)]), "Tomorrow": new Set([iso(tm)]), "This weekend": new Set([iso(sat), iso(sun)]) };
}
const DATE_LABELS = ["Today", "Tomorrow", "This weekend"];
const SORT_OPTS = [["relevance", "Relevance", "Best picks first"], ["price_lo", "Price: low to high", "Lowest price first"], ["price_hi", "Price: high to low", "Highest price first"], ["date", "Date", "Earliest event first"], ["newest", "Newest added", "Recently added first"]];
function emptyFlt() { return { date: [], category: [], city: [], price: [], venue: [], tags: {} }; }
function fltCount(f) { return f.date.length + f.category.length + f.city.length + f.price.length + f.venue.length + Object.values(f.tags || {}).reduce((a, v) => a + v.length, 0); }
function eventMatches(e, f, getMin) {
  const b = dateBucketSet();
  if (f.date.length && !f.date.some(d => b[d] && b[d].has(e.event_at))) return false;
  if (f.category.length && !f.category.includes(e.category)) return false;
  if (f.city.length && !f.city.includes(e.city)) return false;
  if (f.venue.length && !f.venue.includes(e.venue)) return false;
  if (f.price.length && !f.price.includes(priceBand(getMin(e)))) return false;
  for (const dim in (f.tags || {})) { const arr = f.tags[dim]; if (arr && arr.length && !arr.includes((e.tags || {})[dim])) return false; }
  return true;
}
function sortEvents(list, sortBy, getMin) {
  const a = [...list];
  if (sortBy === "price_lo") a.sort((x, y) => getMin(x) - getMin(y));
  else if (sortBy === "price_hi") a.sort((x, y) => getMin(y) - getMin(x));
  else if (sortBy === "date") a.sort((x, y) => (x.event_at || "9999").localeCompare(y.event_at || "9999"));
  else if (sortBy === "newest") a.sort((x, y) => String(y.created_at || y.id).localeCompare(String(x.created_at || x.id)));
  return a;
}
const filterPill = (active) => ({ flexShrink: 0, padding: "8px 16px", borderRadius: 20, border: `1px solid ${active ? W.teal : W.line}`, background: active ? W.teal : "#fff", color: active ? "#fff" : W.ink, fontWeight: 700, fontSize: 13.5, cursor: "pointer" });
function SortSheet({ value, onPick, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", width: "100%", borderRadius: "18px 18px 0 0", maxHeight: "80vh", overflowY: "auto", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ padding: "16px 18px", fontWeight: 800, fontSize: 18, color: W.ink }}>Sort By</div>
        {SORT_OPTS.map(([k, t, sub]) => (
          <div key={k} onClick={() => onPick(k)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderTop: `1px solid ${W.line}`, cursor: "pointer" }}>
            <div><div style={{ fontWeight: 700, color: W.ink, fontSize: 15 }}>{t}</div><div style={{ fontSize: 12.5, color: W.soft }}>{sub}</div></div>
            <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${value === k ? W.teal : W.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{value === k && <div style={{ width: 11, height: 11, borderRadius: "50%", background: W.teal }} />}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function CitySheet({ cities, value, onPick, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", width: "100%", borderRadius: "18px 18px 0 0", maxHeight: "70vh", overflowY: "auto", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ padding: "16px 18px", fontWeight: 800, fontSize: 18, color: W.ink }}>Choose your city</div>
        {["All cities", ...cities].map(c => (
          <div key={c} onClick={() => onPick(c)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderTop: `1px solid ${W.line}`, cursor: "pointer" }}>
            <span style={{ fontWeight: value === c ? 800 : 600, color: value === c ? W.teal : W.ink, fontSize: 15 }}>{c === "All cities" ? "🌏 All cities" : `📍 ${c}`}</span>
            <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${value === c ? W.teal : W.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{value === c && <div style={{ width: 11, height: 11, borderRadius: "50%", background: W.teal }} />}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function FilterSheet({ events, dims, opts, getMin, value, onApply, onClose }) {
  const [sel, setSel] = useState(() => ({ date: [...value.date], category: [...value.category], city: [...value.city], price: [...value.price], venue: [...value.venue], tags: JSON.parse(JSON.stringify(value.tags || {})) }));
  const [active, setActive] = useState(0);
  const distinct = key => { const m = {}; events.forEach(e => { const v = e[key]; if (v) m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const tagDistinct = name => { const m = {}; (opts || []).filter(o => o.kind === name).forEach(o => { m[o.name] = 0; }); events.forEach(e => { const v = (e.tags || {})[name]; if (v) m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const dateOpts = (() => { const b = dateBucketSet(); return DATE_LABELS.map(l => [l, events.filter(e => b[l].has(e.event_at)).length]).filter(([, n]) => n > 0); })();
  const priceOpts = PRICE_BANDS.map(bnd => [bnd, events.filter(e => priceBand(getMin(e)) === bnd).length]).filter(([, n]) => n > 0);
  const toggleArr = (key, v) => setSel(s => ({ ...s, [key]: s[key].includes(v) ? s[key].filter(x => x !== v) : [...s[key], v] }));
  const toggleTag = (name, v) => setSel(s => { const cur = s.tags[name] || []; return { ...s, tags: { ...s.tags, [name]: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] } }; });
  const sections = [
    { key: "date", label: "Date", opts: dateOpts, get: () => sel.date, toggle: v => toggleArr("date", v) },
    { key: "category", label: "Category", opts: distinct("category"), get: () => sel.category, toggle: v => toggleArr("category", v) },
    { key: "city", label: "City", opts: distinct("city"), get: () => sel.city, toggle: v => toggleArr("city", v) },
    ...(dims || []).map(d => ({ key: "t:" + d.name, label: d.name, opts: tagDistinct(d.name), get: () => sel.tags[d.name] || [], toggle: v => toggleTag(d.name, v) })),
    { key: "price", label: "Price", opts: priceOpts, get: () => sel.price, toggle: v => toggleArr("price", v) },
    { key: "venue", label: "Venue", opts: distinct("venue"), get: () => sel.venue, toggle: v => toggleArr("venue", v) },
  ].filter(sec => sec.opts.length);
  const sec = sections[active] || sections[0];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "#fff", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 12px", borderBottom: `1px solid ${W.line}` }}>
        <ArrowLeft size={24} onClick={onClose} style={{ cursor: "pointer" }} />
        <div style={{ fontWeight: 800, fontSize: 20, color: W.ink }}>Filter</div>
        <button onClick={() => setSel(emptyFlt())} style={{ marginLeft: "auto", background: "none", border: "none", color: W.teal, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>Reset</button>
      </div>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ width: 132, flexShrink: 0, background: "#F4F4F5", overflowY: "auto" }}>
          {sections.map((x, i) => (
            <div key={x.key} onClick={() => setActive(i)} style={{ padding: "16px 14px", fontWeight: active === i ? 800 : 500, color: active === i ? W.ink : W.soft, background: active === i ? "#fff" : "transparent", cursor: "pointer", fontSize: 14.5 }}>
              {x.label}{x.get().length > 0 && <span style={{ marginLeft: 5, color: W.teal, fontSize: 11.5, fontWeight: 800 }}>({x.get().length})</span>}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "2px 16px 2px 18px" }}>
          {sec.opts.map(([name, n]) => { const on = sec.get().includes(name); return (
            <div key={name} onClick={() => sec.toggle(name)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 0", cursor: "pointer", borderBottom: `1px solid ${W.bg}` }}>
              <span style={{ fontSize: 15.5, color: W.ink, paddingRight: 10 }}>{name} <span style={{ color: W.soft }}>({n})</span></span>
              <div style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${on ? W.teal : "#aab"}`, background: on ? W.teal : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{on && <Check size={15} color="#fff" />}</div>
            </div>
          ); })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", borderTop: `1px solid ${W.line}` }}>
        <button onClick={onClose} style={{ flex: 1, padding: 14, borderRadius: 10, border: `1px solid ${W.teal}`, background: "#fff", color: W.teal, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Close</button>
        <button onClick={() => onApply(sel)} style={{ flex: 1, padding: 14, borderRadius: 10, border: "none", background: W.teal, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Apply All</button>
      </div>
    </div>
  );
}
function CategoryTiles({ cats, val, set }) {
  if (!cats || !cats.length) return null;
  const tile = (key, name, img, emoji) => (
    <div key={key} onClick={() => set(name)} style={{ flexShrink: 0, width: 74, cursor: "pointer", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, margin: "0 auto", borderRadius: 18, overflow: "hidden", border: `2.5px solid ${val === name ? "#008069" : "transparent"}`, boxShadow: "0 2px 8px rgba(0,0,0,.09)", background: "linear-gradient(135deg,#008069,#04B08F)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {img ? <img src={img} alt={name} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <span style={{ fontSize: 26, color: "#fff" }}>{emoji}</span>}
      </div>
      <div style={{ fontSize: 11.5, fontWeight: val === name ? 800 : 600, color: val === name ? W.teal : W.ink, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "12px 14px 10px", background: "#fff", borderBottom: `1px solid ${W.line}` }}>
      {tile("__all", "All", null, "✦")}
      {cats.map(c => tile(c.id || c.name, c.name, c.image_url, "🎟️"))}
    </div>
  );
}
function PublicEventPage({ e, types, addons, popular, events, wide, onBack, onBuy, onPick, profile, hasTicket, onViewTicket, onOpenChat, stats, typeSold, initialCart }) {
  const [showTerms, setShowTerms] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/e/${e.id}`;
  const share = async () => { try { if (navigator.share) await navigator.share({ title: e.title, url: link }); else { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } } catch {} };
  const visTypes = types;
  const prices = visTypes.length ? visTypes.map(t => t.price || 0) : [e.ticket_price || 0];
  const minPrice = Math.min(...prices);
  const MAX_TIX = 10;
  const [qtyMap, setQtyMap] = useState(() => initialCart || {});
  const totalQty = m => Object.values(m).reduce((a, q) => a + q, 0);
  const setQ = (key, q) => setQtyMap(m => {
    const n = { ...m };
    if (q <= 0) { delete n[key]; return n; }
    n[key] = q;
    return totalQty(n) > MAX_TIX ? m : n;
  });
  const cart = Object.entries(qtyMap).filter(([, q]) => q > 0)
    .map(([k, q]) => ({ type: k === "__base" ? null : visTypes.find(t => t.id === k), qty: q }))
    .filter(c => c.type !== undefined || c.type === null);
  const selQty = cart.reduce((a, c) => a + c.qty, 0);
  const selTotal = cart.reduce((a, c) => a + (c.type ? genderNet(c.type, null, profile) : (e.ticket_price || 0)) * c.qty, 0);
  const leftFor = t => { const cap = t.capacity != null && t.capacity !== "" ? Number(t.capacity) : null; return cap != null ? Math.max(0, cap - ((typeSold && typeSold[t.id]) || 0)) : null; };
  const stepper = (key, q, max) => (
    <div style={{ display: "flex", alignItems: "center", gap: 0, border: `1.5px solid ${W.teal}`, borderRadius: 10, overflow: "hidden" }}>
      <button onClick={() => setQ(key, q - 1)} style={{ width: 36, height: 36, border: "none", background: "#fff", color: W.teal, fontSize: 20, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}>−</button>
      <span style={{ minWidth: 26, textAlign: "center", fontWeight: 800, color: W.teal, fontSize: 15 }}>{q}</span>
      <button onClick={() => max != null && q >= max ? null : setQ(key, q + 1)} disabled={max != null && q >= max} style={{ width: 36, height: 36, border: "none", background: "#fff", color: max != null && q >= max ? "#bbb" : W.teal, fontSize: 20, fontWeight: 700, cursor: max != null && q >= max ? "default" : "pointer", lineHeight: 1 }}>+</button>
    </div>
  );
  const addBtn = (key) => <button onClick={() => setQ(key, 1)} style={{ ...btn("#fff", W.teal), border: `1.5px solid ${W.teal}`, padding: "8px 22px", fontWeight: 800 }}>Add</button>;
  const sched = (e.schedule || "").split("\n").map(s => s.trim()).filter(Boolean);
  const sibs = e.series_id ? events.filter(x => x.series_id === e.series_id && x.id !== e.id).slice(0, 8) : [];
  const excl = e.exclusions || [];
  const gl = { any: ["Anyone", "#ECEFEE", W.soft], male: ["Men only", "#E8F2FB", "#1B6FB8"], female: ["Women only", "#FBE9F2", "#C0246E"] };
  const aud = gr => { const [l, bg, c] = gl[gr] || gl.any; return <span style={{ background: bg, color: c, fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>{l}</span>; };
  const Sec = ({ title, children }) => (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontWeight: 800, fontSize: 17.5, color: W.ink, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
  const ticketList = (
    <div>
      {hasTicket && (
        <div style={{ background: "#E7F6EF", borderRadius: 12, padding: "12px 14px", margin: "10px 0 4px" }}>
          <div style={{ fontWeight: 800, color: W.teal, fontSize: 14.5 }}>🎟️ You're going!</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {onViewTicket && <button onClick={onViewTicket} style={{ ...btn(W.teal, "#fff"), flex: 1, justifyContent: "center", padding: "9px 8px", fontSize: 13 }}>View my ticket</button>}
            {onOpenChat && <button onClick={onOpenChat} style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, flex: 1, justifyContent: "center", padding: "9px 8px", fontSize: 13 }}>Event chat</button>}
          </div>
        </div>
      )}
      {profile && types.length > 0 && visTypes.length === 0 ? (
        <div style={{ padding: "14px 0", fontSize: 13.5, color: W.soft }}>These tickets aren't available for your profile.</div>
      ) : visTypes.length ? (<>
      <div style={{ fontSize: 11.5, color: W.soft, padding: "6px 0 2px" }}>You can add up to {MAX_TIX} tickets — mix ticket types in one order. Prices include processing fee.</div>
      {visTypes.map(t => {
        const st = ticketStatus(t, e, stats, typeSold);
        const soldOut = !st.ok && st.label === "Sold out";
        const left = leftFor(t);
        const fast = st.ok && left != null && left > 0 && left <= 5;
        const tag = soldOut ? ["Sold out", "#C0392B"] : !st.ok ? [st.label, "#B45309"] : fast ? [`Only ${left} left · fast filling`, "#D35400"] : null;
        const q = qtyMap[t.id] || 0;
        const max = Math.min(q + (MAX_TIX - selQty), left == null ? MAX_TIX : left);
        return (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: `1px solid ${W.line}`, opacity: soldOut ? .5 : 1 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: W.ink, display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>{t.name}
              {Number(t.disc_female_pct) > 0 && <span style={{ background: "#FCE7F1", color: "#D6618F", fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>{t.disc_female_pct}% off for women</span>}
              {Number(t.disc_male_pct) > 0 && <span style={{ background: "#E8F2FB", color: "#1B6FB8", fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>{t.disc_male_pct}% off for men</span>}
            </div>
            <div style={{ fontSize: 13.5, color: W.teal, fontWeight: 800, marginTop: 2 }}>{(() => { const base = t.price || 0; const eff = genderNet(t, null, profile); return eff === 0 ? "Free" : eff < base ? <>{`₹${eff} `}<s style={{ color: W.soft, fontWeight: 600 }}>₹{base}</s></> : `₹${base}`; })()}</div>
            {tag && <div style={{ fontSize: 11.5, color: tag[1], fontWeight: 700, marginTop: 3 }}>{tag[0]}</div>}
          </div>
          {!st.ok
            ? <button disabled style={{ ...btn("#EEE", "#999"), padding: "9px 15px", cursor: "not-allowed" }}>{soldOut ? "Sold out" : "Closed"}</button>
            : q > 0 ? stepper(t.id, q, max) : addBtn(t.id)}
        </div>
      ); })}</>) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: W.ink }}>Standard ticket</div>
            <div style={{ fontSize: 13.5, color: W.teal, fontWeight: 800, marginTop: 2 }}>{minPrice === 0 ? "Free" : `₹${minPrice}`}</div>
          </div>
          {(qtyMap.__base || 0) > 0 ? stepper("__base", qtyMap.__base, MAX_TIX) : addBtn("__base")}
        </div>
      )}
      <div style={{ fontSize: 11.5, color: W.soft, marginTop: 10, display: "flex", gap: 6, alignItems: "center" }}><Lock size={12} />Instant ticket · secure payment · sent to your email</div>
    </div>
  );
  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{width:0;height:0}`}</style>
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(8,18,24,.95)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: wide ? "12px 7%" : "10px 14px" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", border: "none", color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: "pointer", padding: 0 }}><ArrowLeft size={19} />All events</button>
        <img src="/logo-white.png" alt="Glasswings" style={{ height: 26, objectFit: "contain" }} />
        <button onClick={share} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid rgba(255,255,255,.4)", color: "#fff", borderRadius: 9, padding: "7px 13px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}><Share2 size={14} />{copied ? "Copied ✓" : "Share"}</button>
      </div>
      {e.approved === false && <div style={{ background: "#28302E", color: "#fff", fontSize: 12, fontWeight: 700, textAlign: "center", padding: "9px 14px", letterSpacing: .5 }}>⏳ UNPUBLISHED — members and the public can't see this event yet. Approve it from Admin → Events.</div>}
      {(e.banner_url || e.poster_url) && (e.banner_type === "video" && e.banner_url ? (
        <div style={{ background: "#0b1f1c" }}><BannerMedia url={e.banner_url} type={e.banner_type} style={{ width: "100%", height: wide ? 420 : 235, objectFit: "cover", display: "block" }} /></div>
      ) : (
        <div style={{ position: "relative", height: wide ? 420 : 235, background: "#0b1f1c", overflow: "hidden" }}>
          <img src={(e.banner_type !== "video" && e.banner_url) || e.poster_url} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(26px) brightness(.62)", transform: "scale(1.15)" }} />
          <img src={(e.banner_type !== "video" && e.banner_url) || e.poster_url} alt={e.title} decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      ))}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: wide ? "28px 24px 60px" : "20px 16px 110px", display: "flex", gap: 36, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {popular && <span style={{ background: "#FFF1E0", color: "#D35400", fontSize: 12, fontWeight: 800, padding: "4px 11px", borderRadius: 14 }}>🔥 Popular</span>}
            {e.category && <span style={{ background: "#E7F6EF", color: W.teal, fontSize: 12, fontWeight: 700, padding: "4px 11px", borderRadius: 14 }}>{e.category}</span>}
            {e.city && <span style={{ background: W.bg, color: W.soft, fontSize: 12, fontWeight: 700, padding: "4px 11px", borderRadius: 14 }}>{e.city}</span>}
          </div>
          <h1 style={{ fontSize: wide ? 34 : 24, fontWeight: 800, color: W.ink, margin: 0, lineHeight: 1.18 }}>{e.emoji} {e.title}</h1>
          <div style={{ background: W.bg, borderRadius: 14, padding: "14px 16px", marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {e.event_date && <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14.5, color: W.ink, fontWeight: 600 }}><Calendar size={17} color={W.teal} />{e.event_date}</div>}
            {(e.venue || e.city) && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14.5, color: W.ink, fontWeight: 600 }}>
                <MapPin size={17} color={W.teal} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{[e.venue, e.city].filter(Boolean).join(", ")}{e.venue_lat && <a href={`https://www.google.com/maps/search/?api=1&query=${e.venue_lat},${e.venue_lng}`} target="_blank" rel="noreferrer" style={{ color: W.teal, fontWeight: 700, marginLeft: 8, textDecoration: "none" }}>Directions →</a>}</span>
              </div>
            )}
          </div>
          {!wide && <Sec title="Tickets"><div style={{ border: `1px solid ${W.line}`, borderRadius: 14, padding: "4px 16px 14px" }}>{ticketList}</div></Sec>}
          {e.description && <Sec title="About this event"><div style={{ fontSize: 15, color: "#3c4a47", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{e.description}</div></Sec>}
          {sched.length > 0 && (
            <Sec title="Schedule">
              <div>
                {sched.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "7px 0" }}>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", background: W.teal, marginTop: 6, flexShrink: 0 }} />
                    <div style={{ fontSize: 14.5, color: "#3c4a47", lineHeight: 1.5 }}>{s}</div>
                  </div>
                ))}
              </div>
            </Sec>
          )}
          {profile && <TimeCapsule event={e} profile={profile} />}
          {(e.food_dining || "").trim() && (
            <Sec title="🍽️ Food & dining">
              <div>
                {(e.food_dining || "").split("\n").map(x => x.trim()).filter(Boolean).map((x, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "5px 0", fontSize: 14.5, color: "#3c4a47", lineHeight: 1.5 }}>
                    <span style={{ color: W.teal, fontWeight: 800 }}>•</span>{x}
                  </div>
                ))}
              </div>
            </Sec>
          )}
          {(e.facilities || "").trim() && (
            <Sec title="✨ Facilities at the event">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(e.facilities || "").split(/\n|,/).map(x => x.trim()).filter(Boolean).map((x, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: W.bg, border: `1px solid ${W.line}`, color: W.ink, fontSize: 13, fontWeight: 600, padding: "7px 13px", borderRadius: 20 }}><Check size={14} color={W.teal} />{x}</span>
                ))}
              </div>
            </Sec>
          )}
          {(e.dress_code || "").trim() && (
            <Sec title="👗 Dress code">
              <div style={{ background: "#FDF6EC", border: "1px solid #F2E2C4", borderRadius: 12, padding: "12px 15px", fontSize: 14.5, color: "#7a5a1e", fontWeight: 600, lineHeight: 1.5 }}>{e.dress_code}</div>
            </Sec>
          )}
          {sibs.length > 0 && (
            <Sec title="More dates">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {sibs.map(s => <button key={s.id} onClick={() => onPick(s)} style={{ padding: "8px 14px", borderRadius: 20, border: `1px solid ${W.line}`, background: "#fff", color: W.ink, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{s.event_date || "Date TBA"}</button>)}
              </div>
            </Sec>
          )}
          {addons.length > 0 && (
            <Sec title="Optional add-ons">
              {addons.map(a => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 0", borderBottom: `1px solid ${W.line}`, fontSize: 14.5 }}>
                  <span style={{ color: W.ink, fontWeight: 600 }}>{a.name}</span>
                  <span style={{ color: W.teal, fontWeight: 800 }}>{(a.price || 0) === 0 ? "Free" : `+₹${a.price}`}</span>
                </div>
              ))}
              <div style={{ fontSize: 12, color: W.soft, marginTop: 8 }}>Choose add-ons while booking.</div>
            </Sec>
          )}
          {excl.length > 0 && (
            <Sec title="Not included">
              {excl.map((x, i) => <div key={i} style={{ display: "flex", gap: 9, alignItems: "center", padding: "5px 0", fontSize: 14.5, color: "#3c4a47" }}><span style={{ color: "#C0392B", fontWeight: 800 }}>✗</span>{x}</div>)}
            </Sec>
          )}
          {e.venue_lat && (
            <Sec title="Venue">
              <iframe title="map" src={`https://maps.google.com/maps?q=${e.venue_lat},${e.venue_lng}&z=15&output=embed`} style={{ border: 0, width: "100%", height: wide ? 260 : 200, borderRadius: 14 }} loading="lazy" />
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12.5, color: W.soft, fontWeight: 700, marginBottom: 7 }}>🚕 Getting there — opens a cab app with the venue pre-filled</div>
                <RideButtons e={e} />
              </div>
            </Sec>
          )}
          <Sec title="Hosted by">
            <div style={{ display: "flex", alignItems: "center", gap: 13, border: `1px solid ${W.line}`, borderRadius: 14, padding: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: W.teal, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 17, flexShrink: 0 }}>GE</div>
              <div>
                <div style={{ fontWeight: 800, color: W.ink, fontSize: 15 }}>Glasswings Events</div>
                <div style={{ fontSize: 12.5, color: W.soft }}>Community events, socials &amp; meetups</div>
              </div>
            </div>
          </Sec>
          {e.terms && (
            <div style={{ marginTop: 24 }}>
              <button onClick={() => setShowTerms(v => !v)} style={{ background: "none", border: "none", color: W.soft, fontWeight: 700, fontSize: 13.5, cursor: "pointer", padding: 0 }}>Terms &amp; conditions {showTerms ? "▴" : "▾"}</button>
              {showTerms && <div style={{ fontSize: 13, color: W.soft, lineHeight: 1.6, whiteSpace: "pre-wrap", marginTop: 8 }}>{e.terms}</div>}
            </div>
          )}
        </div>
        {wide && (
          <div style={{ width: 330, flexShrink: 0, position: "sticky", top: 76 }}>
            <div style={{ border: `1px solid ${W.line}`, borderRadius: 16, padding: "8px 18px 16px", boxShadow: "0 8px 28px rgba(0,0,0,.07)" }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: W.ink, padding: "12px 0 4px" }}>Tickets</div>
              {ticketList}
              {selQty > 0 && <button onClick={() => onBuy(e, cart)} style={{ ...btn(W.teal, "#fff"), width: "100%", justifyContent: "center", padding: 13, marginTop: 12, fontSize: 15 }}>{selTotal === 0 ? `Get ${selQty} ticket${selQty > 1 ? "s" : ""}` : `Proceed · ₹${selTotal}`}</button>}
            </div>
          </div>
        )}
      </div>
      {!wide && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30, background: "#fff", borderTop: `1px solid ${W.line}`, padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11.5, color: W.soft, fontWeight: 700 }}>{selQty > 0 ? `${selQty} ticket${selQty > 1 ? "s" : ""}` : types.length > 1 ? "From" : "Price"}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: W.ink }}>{(selQty > 0 ? selTotal : minPrice) === 0 ? "Free" : `₹${selQty > 0 ? selTotal : minPrice}`}</div>
          </div>
          {selQty > 0
            ? <button onClick={() => onBuy(e, cart)} style={{ ...btn(W.teal, "#fff"), padding: "13px 26px", fontSize: 15.5 }}><Ticket size={17} />Proceed</button>
            : <button onClick={() => onBuy(e, visTypes.length === 1 ? [{ type: visTypes[0], qty: 1 }] : null)} style={{ ...btn(W.teal, "#fff"), padding: "13px 26px", fontSize: 15.5 }}><Ticket size={17} />Get tickets</button>}
        </div>
      )}
    </div>
  );
}
function HeroSlider({ slides, wide, onSlide }) {
  const [i, setI] = useState(0);
  const tx = useRef(null);
  useEffect(() => { setI(0); }, [slides.length]);
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setI(x => (x + 1) % slides.length), 4000);
    return () => clearInterval(t);
  }, [slides.length]);
  if (!slides.length) return null;
  const start = (e) => { tx.current = e.touches[0].clientX; };
  const end = (e) => { if (tx.current == null) return; const d = e.changedTouches[0].clientX - tx.current; tx.current = null; if (Math.abs(d) > 40) setI(x => (x + (d < 0 ? 1 : -1) + slides.length) % slides.length); };
  const s = slides[i] || slides[0];
  return (
    <div onTouchStart={start} onTouchEnd={end} onClick={() => onSlide && onSlide(s)} style={{ position: "relative", height: wide ? 380 : 215, overflow: "hidden", background: "#0b1f1c", cursor: onSlide ? "pointer" : "default" }}>
      {slides.map((sl, idx) => (
        <div key={idx} style={{ position: "absolute", inset: 0, opacity: idx === i ? 1 : 0, transition: "opacity .6s ease" }}>
          <img src={sl.url} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(26px) brightness(.62)", transform: "scale(1.15)" }} />
          <img src={sl.url} alt="" decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      ))}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(rgba(6,18,26,.04) 38%, rgba(6,14,22,.8))" }} />
      {(s.title || s.cta) && (
        <div style={{ position: "absolute", left: wide ? "7%" : 16, right: wide ? "7%" : 16, bottom: 28, color: "#fff" }}>
          {s.title && <div style={{ fontSize: wide ? 30 : 19, fontWeight: 800, lineHeight: 1.15, textShadow: "0 2px 10px rgba(0,0,0,.45)" }}>{s.title}</div>}
          {s.sub && <div style={{ fontSize: wide ? 15 : 12.5, opacity: .93, marginTop: 4, textShadow: "0 1px 6px rgba(0,0,0,.4)" }}>{s.sub}</div>}
          {s.cta && <button onClick={(ev) => { ev.stopPropagation(); onSlide && onSlide(s); }} style={{ ...btn(W.teal, "#fff"), marginTop: 10, padding: wide ? "11px 20px" : "9px 16px" }}><Ticket size={15} />{s.cta}</button>}
        </div>
      )}
      {slides.length > 1 && (
        <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
          {slides.map((_, idx) => <div key={idx} onClick={(ev) => { ev.stopPropagation(); setI(idx); }} style={{ width: idx === i ? 18 : 7, height: 7, borderRadius: 4, background: idx === i ? "#fff" : "rgba(255,255,255,.55)", cursor: "pointer", transition: "width .3s" }} />)}
        </div>
      )}
    </div>
  );
}
function PublicLanding() {
  const wide = useWide(820);
  const [authMode, setAuthMode] = useState(null);
  const [events, setEvents] = useState([]);
  const [types, setTypes] = useState({});
  const [flt, setFlt] = useState(emptyFlt());
  const [sortBy, setSortBy] = useState("relevance");
  const [fsheet, setFsheet] = useState(false);
  const [ssheet, setSsheet] = useState(false);
  const [citySheet, setCitySheet] = useState(false);
  const [custom, setCustom] = useState([]);
  const [pop, setPop] = useState({});
  const [addonsMap, setAddonsMap] = useState({});
  const [detail, setDetail] = useState(() => { try { return new URLSearchParams(window.location.search).get("event"); } catch { return null; } });
  const [optCats, setOptCats] = useState([]);
  const [optsAllL, setOptsAllL] = useState([]);
  const [dimsL, setDimsL] = useState([]);
  const [tagSelL, setTagSelL] = useState({});
  useEffect(() => {
    supabase.from("events").select("*").order("created_at", { ascending: false }).then(({ data }) => setEvents(data || []));
    supabase.from("event_ticket_types").select("*").then(({ data }) => { const m = {}; (data || []).forEach(t => { (m[t.event_id] = m[t.event_id] || []).push(t); }); setTypes(m); });
    supabase.from("slider_images").select("*").order("position").order("created_at").then(({ data }) => setCustom(data || []));
    supabase.rpc("event_popularity").then(({ data }) => { const m = {}; (data || []).forEach(r => { m[r.event_id] = Number(r.sold); }); setPop(m); });
    supabase.from("event_addons").select("*").then(({ data }) => { const m = {}; (data || []).forEach(a => { (m[a.event_id] = m[a.event_id] || []).push(a); }); setAddonsMap(m); });
    supabase.from("event_options").select("*").order("name").then(({ data }) => { setOptCats((data || []).filter(o => o.kind === "category")); setOptsAllL(data || []); });
    supabase.from("filter_dimensions").select("*").order("name").then(({ data }) => setDimsL(data || []));
  }, []);
  useEffect(() => { if (detail && events.length && !events.find(x => x.id === detail)) setDetail(null); }, [events, detail]);
  const openDetail = (id) => { setDetail(id); try { history.replaceState(null, "", `/?event=${id}`); } catch {} window.scrollTo(0, 0); };
  const closeDetail = () => { setDetail(null); try { history.replaceState(null, "", "/"); } catch {} };
  const buyNow = (ev, cart) => {
    try {
      localStorage.setItem("gw_buy", ev.id); localStorage.setItem("gw_event", ev.id);
      if (cart && cart.length) { const m = {}; cart.forEach(c => { m[c.type ? c.type.id : "__base"] = c.qty || 1; }); localStorage.setItem("gw_buy_cart", JSON.stringify(m)); }
      else localStorage.removeItem("gw_buy_cart");
    } catch {}
    setAuthMode("signup");
  };
  const popSet = new Set(Object.entries(pop).filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id));
  const evSlide = ({ e, img }) => ({ url: img, title: `${e.emoji || "🎟️"} ${e.title}`, sub: [e.event_date, e.city].filter(Boolean).join(" · "), cta: "Get tickets", id: e.id });
  const promoSlides = events
    .filter(e => Number(e.promo_pct) > 0 && e.approved !== false)
    .map(e => ({ e, img: (e.banner_type !== "video" && e.banner_url) || e.poster_url }))
    .filter(x => x.img)
    .sort((a, b) => Number(b.e.promo_pct) - Number(a.e.promo_pct))
    .map(evSlide);
  const customSlides = custom.map(sl => ({ url: sl.url, id: sl.event_id || undefined }));
  const fallbackSlides = events.map(e => ({ e, img: (e.banner_type !== "video" && e.banner_url) || e.poster_url })).filter(x => x.img && x.e.approved !== false).slice(0, 6).map(evSlide);
  const featured = [...promoSlides, ...customSlides.filter(c => !promoSlides.some(ps => ps.id && ps.id === c.id))].slice(0, 6);
  const heroSlides = featured.length ? featured : fallbackSlides;
  if (authMode) return <Auth initialMode={authMode} onClose={() => setAuthMode(null)} />;
  const detailEvent = detail ? events.find(x => x.id === detail) : null;
  if (detailEvent) {
    const popSetD = new Set(Object.entries(pop).filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id));
    return <PublicEventPage e={detailEvent} types={types[detailEvent.id] || []} addons={addonsMap[detailEvent.id] || []} popular={popSetD.has(detailEvent.id)} events={events} wide={wide} onBack={closeDetail} onBuy={buyNow} onPick={(s) => openDetail(s.id)} />;
  }
  const cats = Array.from(new Set(events.map(e => e.category).filter(Boolean)));
  const cityList = Array.from(new Set(events.map(e => e.city).filter(Boolean)));
  const getMin = e => e.ticket_price || 0;
  const list = sortEvents(events.filter(e => eventMatches(e, flt, getMin)), sortBy, getMin);
  const priceFrom = (e) => {
    const ts = types[e.id] || [];
    const prices = ts.length ? ts.map(t => t.price || 0) : [e.ticket_price || 0];
    const m = Math.min(...prices);
    return m === 0 ? "Free" : `From ₹${m}`;
  };
  const chip = (on) => ({ flexShrink: 0, padding: "7px 14px", borderRadius: 20, border: `1px solid ${on ? W.teal : W.line}`, background: on ? W.teal : "#fff", color: on ? "#fff" : W.soft, fontWeight: 600, fontSize: 13, cursor: "pointer" });
  const Chips = ({ label, opts, val, set }) => opts.length ? (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "10px 14px", background: "#fff", borderBottom: `1px solid ${W.line}`, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: W.soft, fontWeight: 700, flexShrink: 0 }}>{label}</span>
      {["All", ...opts].map(o => <button key={o} onClick={() => set(o)} style={{ flexShrink: 0, padding: "6px 13px", borderRadius: 20, border: `1px solid ${val === o ? W.teal : W.line}`, background: val === o ? W.teal : "#fff", color: val === o ? "#fff" : W.soft, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{o}</button>)}
    </div>
  ) : null;
  return (
    <div style={{ minHeight: "100vh", background: W.bg, fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{width:0;height:0}`}</style>
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: W.teal, display: "flex", alignItems: "center", justifyContent: "space-between", padding: wide ? "13px 7%" : "12px 15px" }}>
        <img src="/logo-white.png" alt="Glasswings Events" style={{ height: wide ? 32 : 27, objectFit: "contain" }} />
        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={() => setAuthMode("login")} style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.6)", borderRadius: 9, padding: "9px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Log in</button>
          <button onClick={() => { try { localStorage.removeItem("gw_buy"); } catch {} setAuthMode("signup"); }} style={{ background: "#fff", color: W.teal, border: "none", borderRadius: 9, padding: "9px 17px", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Sign up</button>
        </div>
      </div>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: wide ? "30px 7% 60px" : "0 0 30px" }}>
        <div style={{ padding: wide ? "0 0 6px" : "18px 16px 4px" }}>
          <div style={{ fontWeight: 800, fontSize: wide ? 28 : 21.5, color: W.ink, letterSpacing: -0.3 }}>Your city. Your people. ✨</div>
          <div onClick={() => setCitySheet(true)} style={{ color: W.teal, fontWeight: 800, fontSize: 14, marginTop: 3, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>{flt.city.length === 1 ? flt.city[0] : "All cities"}&nbsp;{"\u203a"}</div>
        </div>
        <CategoryTiles cats={optCats.length ? optCats : cats.map(n => ({ name: n }))} val={flt.category.length === 1 ? flt.category[0] : "All"} set={name => setFlt(f => ({ ...f, category: name === "All" ? [] : [name] }))} />
        <div style={{ display: "flex", gap: 10, padding: wide ? "8px 0 12px" : "10px 14px", overflowX: "auto" }}>
          <button onClick={() => setFsheet(true)} style={filterPill(fltCount(flt) > 0)}>{"\u2630 Filters"}{fltCount(flt) > 0 ? ` (${fltCount(flt)})` : ""}</button>
          <button onClick={() => setSsheet(true)} style={filterPill(sortBy !== "relevance")}>{"\u2195 Sort By"}</button>
        </div>
        {heroSlides.length > 0 && <div style={{ marginBottom: 6 }}><HeroSlider slides={heroSlides} wide={wide} onSlide={(s) => { if (s.id) openDetail(s.id); else setAuthMode("signup"); }} /></div>}
        <div style={{ display: "grid", gridTemplateColumns: wide ? "repeat(auto-fill,minmax(200px,1fr))" : "repeat(2,1fr)", gap: 14, padding: wide ? "8px 0 0" : "6px 14px" }}>
          {list.length === 0 && <div style={{ gridColumn: "1/-1" }}><Center>No events yet — check back soon!</Center></div>}
          {list.map(e => <PosterCard key={e.id} e={e} date={e.event_date} price={priceFrom(e)} popular={popSet.has(e.id)} going={false} onOpen={openDetail} />)}
        </div>
        <div style={{ padding: wide ? "46px 0 8px" : "36px 16px 4px" }}>
          <div style={{ fontWeight: 800, fontSize: wide ? 26 : 20.5, color: W.ink, letterSpacing: -0.3 }}>More than tickets — it's a community 💚</div>
          <div style={{ fontSize: 14, color: W.soft, marginTop: 4 }}>Inside Glasswings you don't just attend. You belong.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: wide ? "repeat(3,1fr)" : "1fr", gap: 14, padding: wide ? "14px 0 0" : "12px 16px 0" }}>
          <div style={{ background: "#fff", border: `1px solid ${W.line}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 30 }}>💬</div>
            <div style={{ fontWeight: 800, color: W.ink, fontSize: 16.5, marginTop: 8 }}>Rooms inside</div>
            <div style={{ fontSize: 13.5, color: W.soft, lineHeight: 1.55, marginTop: 5 }}>Themed members-only rooms — girls-only, couples, premium lounges and more. Find your circle, chat every day, and plan your next night out together.</div>
          </div>
          <div style={{ background: "radial-gradient(ellipse at 50% 30%, #11332c, #0b1f1c)", borderRadius: 16, padding: 18, color: "#fff", position: "relative", overflow: "hidden" }}>
            <svg viewBox="0 0 300 100" style={{ position: "absolute", top: 0, left: 0, width: "100%", opacity: .9 }}>
              <line x1="40" y1="58" x2="105" y2="30" stroke="#2e6e5f" strokeWidth="1.2" />
              <line x1="105" y1="30" x2="170" y2="62" stroke="#2e6e5f" strokeWidth="1.2" />
              <line x1="170" y1="62" x2="236" y2="34" stroke="#2e6e5f" strokeWidth="1.2" />
              <line x1="105" y1="30" x2="236" y2="34" stroke="#24574b" strokeWidth="1" />
              <circle cx="40" cy="58" r="4" fill="#7AD6C0" /><circle cx="105" cy="30" r="5.5" fill="#fff" />
              <circle cx="170" cy="62" r="4" fill="#7AD6C0" /><circle cx="236" cy="34" r="4.5" fill="#F2C94C" />
              <circle cx="272" cy="68" r="2.5" fill="#5a8f84" /><circle cx="18" cy="22" r="2" fill="#5a8f84" />
            </svg>
            <div style={{ fontSize: 30, position: "relative" }}>✨</div>
            <div style={{ fontWeight: 800, fontSize: 16.5, marginTop: 8, position: "relative" }}>The Constellation</div>
            <div style={{ fontSize: 13.5, color: "#bfe3d9", lineHeight: 1.55, marginTop: 5, position: "relative" }}>Every member is a star. Meet someone at an event and a line connects your stars — for real, on a living map of the community. The more you show up, the brighter your universe gets.</div>
          </div>
          <div style={{ background: "#fff", border: `1px solid ${W.line}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 30 }}>🎟️</div>
            <div style={{ fontWeight: 800, color: W.ink, fontSize: 16.5, marginTop: 8 }}>Event rooms</div>
            <div style={{ fontSize: 13.5, color: W.soft, lineHeight: 1.55, marginTop: 5 }}>Every event has its own room with everyone who's going — see who's coming, hype it up before, and share the photos and memories after.</div>
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "24px 0 4px" }}>
          <button onClick={() => { try { localStorage.removeItem("gw_buy"); } catch {} setAuthMode("signup"); }} style={{ ...btn(W.teal, "#fff"), padding: "13px 26px", fontSize: 15 }}>Join the community — it's free</button>
        </div>
      </div>
      {fsheet && <FilterSheet events={events} dims={dimsL} opts={optsAllL} getMin={getMin} value={flt} onApply={f => { setFlt(f); setFsheet(false); }} onClose={() => setFsheet(false)} />}
      {ssheet && <SortSheet value={sortBy} onPick={k => { setSortBy(k); setSsheet(false); }} onClose={() => setSsheet(false)} />}
      {citySheet && <CitySheet cities={cityList} value={flt.city.length === 1 ? flt.city[0] : "All cities"} onPick={c => { setFlt(f => ({ ...f, city: c === "All cities" ? [] : [c] })); setCitySheet(false); }} onClose={() => setCitySheet(false)} />}
      <div style={{ textAlign: "center", color: W.soft, fontSize: 12.5, padding: "10px 20px 24px" }}>Already a member? <span onClick={() => setAuthMode("login")} style={{ color: W.teal, fontWeight: 700, cursor: "pointer" }}>Log in</span></div>
      <div style={{ borderTop: `1px solid ${W.line}`, padding: "20px", textAlign: "center" }}>
        <LegalLinks />
        <div style={{ color: W.soft, fontSize: 11.5, marginTop: 10 }}>© {new Date().getFullYear()} Glasswings Events</div>
      </div>
    </div>
  );
}
const PRIVACY = {
  title: "Privacy Policy",
  updated: "June 2026",
  sections: [
    { p: "Glasswings Events (\"we\", \"us\") operates glass-wings.com and the Glasswings community app. This policy explains what information we collect, why, and your choices. By using the app you agree to this policy." },
    { h: "Information we collect", p: "• Account details you provide: name, email, phone number, gender, age, city, profession, and profile photo.\n• Content you create: messages, photos and other posts in rooms and events.\n• Payment information: payments are processed by Razorpay. We do not see or store your full card / UPI details — only a record that a payment or subscription succeeded.\n• Notifications: if you enable them, a push token for your device so we can alert you.\n• Basic usage and device information needed to run the service securely." },
    { h: "How we use it", p: "To run the community, events, tickets and subscriptions; to send you organiser messages and notifications you opt into; to process payments and renewals; and to keep the service safe and prevent misuse." },
    { h: "Who we share it with", p: "We share only what's necessary with: Razorpay (to process payments and recurring subscriptions) and our hosting/database provider (Supabase) to store your data securely. We may disclose information if required by law. We do not sell your personal data." },
    { h: "Notifications", p: "If you turn on notifications, we store a device token to deliver them. You can turn notifications off any time from your Profile or your browser/device settings." },
    { h: "Data retention and your rights", p: "You can ask us to access or delete your personal data, or delete your account, by contacting us. Deleting your account removes your profile and associated data, except records we must keep for legal or accounting reasons (for example, payment records)." },
    { h: "Contact", p: "Questions about privacy? Email us at hello@glass-wings.com." },
  ],
};
const TERMS = {
  title: "Terms & Conditions",
  updated: "June 2026",
  sections: [
    { p: "These terms govern your use of the Glasswings Events app and website (glass-wings.com). By creating an account or making a payment, you accept these terms." },
    { h: "Membership & accounts", p: "You must be 18 or older to join. Provide accurate information and keep your login secure — you're responsible for activity on your account." },
    { h: "Rooms & subscriptions", p: "Some rooms are free and some are paid monthly subscriptions. When you subscribe to a paid room you authorise Razorpay to charge the monthly fee automatically each cycle until you cancel. You can cancel anytime from Profile → Your subscriptions; cancelling stops all future charges and ends your access to that room." },
    { h: "Event tickets", p: "Tickets are sold per event and may be limited in number. Any event-specific terms shown at the time of purchase (date, venue, entry rules) form part of these terms." },
    { h: "Refunds & cancellations", p: "Subscriptions: you may cancel at any time to stop future billing; fees already charged for the current cycle are non-refundable except where the law requires otherwise.\nEvent tickets: tickets are non-refundable unless the organiser cancels the event, in which case the ticket amount is refunded to the original payment method." },
    { h: "Community conduct", p: "Be respectful. No harassment, hate speech, illegal content, spam, or sharing others' private information. We may remove content or members who break these rules." },
    { h: "Liability", p: "The service and events are provided in good faith on an \"as is\" basis. To the extent permitted by law, we are not liable for indirect or incidental losses arising from use of the app or attendance at events." },
    { h: "Governing law", p: "These terms are governed by the laws of India. We may update these terms from time to time; continued use means you accept the changes." },
    { h: "Contact", p: "Questions? Email us at hello@glass-wings.com." },
  ],
};
function PolicyModal({ kind, onClose }) {
  const data = kind === "privacy" ? PRIVACY : TERMS;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "flex-start", overflowY: "auto", padding: "24px 12px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, maxWidth: 680, width: "100%", padding: "22px 22px 30px", margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontWeight: 800, fontSize: 20, color: W.ink }}>{data.title}</div>
          <X size={22} color={W.soft} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <div style={{ fontSize: 12, color: W.soft, marginBottom: 16 }}>Last updated: {data.updated}</div>
        {data.sections.map((s, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            {s.h && <div style={{ fontWeight: 700, fontSize: 15, color: W.ink, marginBottom: 5 }}>{s.h}</div>}
            <div style={{ fontSize: 13.5, color: W.ink, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{s.p}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function LegalLinks({ dark }) {
  const [show, setShow] = useState(null);
  const ls = { color: dark ? "rgba(255,255,255,.85)" : W.soft, fontSize: 13, cursor: "pointer", textDecoration: "underline" };
  return (
    <>
      <div style={{ display: "flex", gap: 18, justifyContent: "center", flexWrap: "wrap" }}>
        <span style={ls} onClick={() => setShow("privacy")}>Privacy Policy</span>
        <span style={ls} onClick={() => setShow("terms")}>Terms &amp; Conditions</span>
      </div>
      {show && <PolicyModal kind={show} onClose={() => setShow(null)} />}
    </>
  );
}
function ProfileGate({ user, profile, reload }) {
  const [name, setName] = useState(profile.full_name || "");
  const [phone, setPhone] = useState(""), [age, setAge] = useState(""), [area, setArea] = useState(""), [prof, setProf] = useState(""), [city, setCity] = useState("");  const [avatar, setAvatar] = useState(profile.avatar_url || "");
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [err, setErr] = useState("");
  const fileRef = useRef(null);
  useEffect(() => {
    supabase.from("member_details").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) { setAge(data.age || ""); setArea(data.area || ""); setProf(data.profession || ""); setCity(data.city || ""); } });
    supabase.from("member_phone").select("phone").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.phone) setPhone(data.phone); });
  }, [user.id]);
  const pick = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setErr(""); setUploading(true);
    try { setAvatar(await uploadPhoto(user.id, file)); } catch (x) { setErr("Photo upload failed: " + x.message); }
    setUploading(false);
  };
  const [tried, setTried] = useState(false);
  const buyLite = (() => { try { return !!localStorage.getItem("gw_buy"); } catch { return false; } })();
  const save = async () => {
    setErr(""); setTried(true);
    const fields = buyLite
      ? [["Full name", name], ["Phone number", phone]]
      : [["Full name", name], ["Phone number", phone], ["Age", age], ["Area / locality", area], ["City", city], ["Profession", prof]];
    const miss = fields.find(([, v]) => !String(v || "").trim());
    if (miss) return setErr(`${miss[0]} is required${buyLite ? "" : " to become a member"}.`);
    if (!buyLite && !avatar) return setErr("Please add a profile photo.");
    setBusy(true);
    const { error: e1 } = await supabase.from("member_details").upsert({ user_id: user.id, age: Number(age) || null, area, profession: prof, city });
    await supabase.from("member_phone").upsert({ user_id: user.id, phone });
    const { error: e2 } = await supabase.from("profiles").update({ full_name: name, avatar_url: avatar, profile_completed: true }).eq("id", user.id);
    try { localStorage.setItem("gw_open_explore", "1"); } catch {}
    setBusy(false);
    if (e1 || e2) return setErr((e1 || e2).message);
    reload();
  };
  const inp = (ph, v, s, t = "text", req = true) => <input value={v} onChange={e => s(e.target.value)} placeholder={ph + (req ? " *" : "")} type={t} style={{ width: "100%", padding: "13px 15px", borderRadius: 10, border: `1px solid ${req && tried && !String(v || "").trim() ? "#C0392B" : W.line}`, fontSize: 15, outline: "none", color: W.ink }} />;
  return (
    <div style={{ minHeight: "100vh", background: W.bg }}>
      <div style={{ background: W.teal, color: "#fff", padding: "16px 18px", position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 12 }}>
        <ArrowLeft size={23} style={{ cursor: "pointer", flexShrink: 0 }} onClick={async () => { if (window.confirm("Go back to login? Your details on this page won't be saved.")) { await supabase.auth.signOut(); window.location.reload(); } }} />
        <span style={{ fontSize: 21, fontWeight: 700 }}>Complete your profile</span>
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ color: W.soft, fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>{buyLite ? "🎟️ Almost there — just your name and phone number and your tickets are a tap away. You can complete the rest of your profile anytime from the Profile tab." : "Welcome to Glasswings! Add your photo and details to join rooms and events. Your phone number stays private — only the organiser can see it."}</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 18 }}>
          <div onClick={() => fileRef.current?.click()} style={{ position: "relative", cursor: "pointer", borderRadius: "50%", border: `3px solid ${!buyLite && tried && !avatar ? "#C0392B" : "transparent"}` }}>
            <PersonAvatar url={avatar} name={name} size={96} />
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderRadius: "50%", background: W.teal, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}><Camera size={16} /></div>
            {uploading && <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,.4)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>…</div>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
          <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 8, color: !buyLite && tried && !avatar ? "#C0392B" : W.soft }}>{buyLite ? "Profile photo (optional for now)" : "Profile photo * (required)"}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {inp("Full name", name, setName)}
          {inp("Phone number", phone, setPhone, "tel")}
          {inp("Age", age, setAge, "number", !buyLite)}
          {inp("Area / locality", area, setArea, "text", !buyLite)}
          {inp("City", city, setCity, "text", !buyLite)}
          {inp("Profession", prof, setProf, "text", !buyLite)}
          {err && <div style={{ color: "#C0392B", fontSize: 13 }}>{err}</div>}
          <button onClick={save} disabled={busy || uploading} style={{ padding: 14, borderRadius: 10, border: "none", cursor: "pointer", background: W.teal, color: "#fff", fontWeight: 700, fontSize: 15, opacity: (busy || uploading) ? .6 : 1 }}>{busy ? "Saving…" : "Save & continue"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- main ---------------- */
function Main({ user }) {
  const wide = useWide(900);
  const SW = 248;
  const [profile, setProfile] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [events, setEvents] = useState([]);
  const [subs, setSubs] = useState([]);
  const [settings, setSettings] = useState({ admin_can_add: true, admin_can_remove: true, show_age: true, show_area: true, show_city: true, show_profession: true });
  const [perms, setPerms] = useState([]);
  const [perksList, setPerksList] = useState([]);
  const [addons, setAddons] = useState({});
  const [subRows, setSubRows] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [mods, setMods] = useState([]);
  const [eventMods, setEventMods] = useState([]);
  const [payBusy, setPayBusy] = useState(false);
  const [eventPage, setEventPage] = useState(null);
  const [roomPage, setRoomPage] = useState(null);
  const [counts, setCounts] = useState({});
  const [eventCounts, setEventCounts] = useState({});
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [optsAll, setOptsAll] = useState([]);
  const [dims, setDims] = useState([]);
  const [ticketTypes, setTicketTypes] = useState({});  const [myTickets, setMyTickets] = useState({});
  const [eventStats, setEventStats] = useState({});
  const [typeSold, setTypeSold] = useState({});
  const [buyTarget, setBuyTarget] = useState(null);
  const [ticketView, setTicketView] = useState(null);
  const [hasDM, setHasDM] = useState(false);
  const [focusEvent, setFocusEvent] = useState(null);
  const openEvent = (id) => { setOpen(null); setTab("events"); setEventPage(id); };
  useEffect(() => { try { const ev = localStorage.getItem("gw_event"); if (ev) { localStorage.removeItem("gw_event"); setTab("events"); setEventPage(ev); } } catch {} }, []);
  useEffect(() => { loadRazorpay(); }, []);
  const [tab, setTab] = useState(() => {
    try { if (localStorage.getItem("gw_open_explore") === "1") { localStorage.removeItem("gw_open_explore"); return "explore"; } } catch {}
    return "chats";
  });
  const [open, setOpen] = useState(null); // { id, type }
  const [p2pThreads, setP2pThreads] = useState([]);
  const [stories, setStories] = useState([]);
  const loadStories = async () => {
    const { data } = await supabase.from("stories").select("id, event_id, user_id, media_url, created_at")
      .gt("created_at", new Date(Date.now() - 86400000).toISOString()).order("created_at", { ascending: true });
    setStories(data || []);
  };
  useEffect(() => {
    if (!user) return;
    loadStories();
    const iv = setInterval(loadStories, 60000);
    return () => clearInterval(iv);
  }, [user]);
  useEffect(() => {
    if (!user) return;
    let live = true;
    (async () => {
      const { data: ths } = await supabase.from("dm_threads").select("id, a, b, created_at").order("created_at", { ascending: false });
      const others = [...new Set((ths || []).map(t => (t.a === user.id ? t.b : t.a)))];
      let profs = {};
      if (others.length) {
        const { data: ps } = await supabase.from("profiles").select("id, full_name, avatar_url, last_seen").in("id", others);
        (ps || []).forEach(pr => { profs[pr.id] = pr; });
      }
      if (live) setP2pThreads((ths || []).map(t => {
        const o = t.a === user.id ? t.b : t.a;
        return { id: t.id, other: o, name: profs[o]?.full_name || "Member", avatar: profs[o]?.avatar_url || null, seen: profs[o]?.last_seen || null };
      }));
    })();
    return () => { live = false; };
  }, [user, open]);
  useEffect(() => {
    if (!user) return;
    const ping = () => { supabase.rpc("touch_presence"); };
    ping();
    const iv = setInterval(() => { if (document.visibilityState === "visible") ping(); }, 60000);
    const onVis = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [user]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [{ data: prof }, { data: rm }, { data: ev }, { data: sb }, { data: tk }, { data: md }, { data: emd }, { data: cnt }, { data: ecnt }, { data: opts }, { data: tt }, { data: dm }, { data: estat }, { data: tsold }, { data: stg }, { data: rp }, { data: pk }, { data: ad }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("rooms").select("*").order("created_at", { ascending: true }),
      supabase.from("events").select("*").order("created_at", { ascending: true }),
      supabase.from("room_subscriptions").select("room_id, status, razorpay_subscription_id").eq("user_id", user.id),
      supabase.from("event_tickets").select("id, event_id, quantity, ticket_type_id, purchased_at").eq("user_id", user.id),
      supabase.from("room_moderators").select("room_id").eq("user_id", user.id),
      supabase.from("event_moderators").select("event_id").eq("user_id", user.id),
      supabase.rpc("room_member_counts"),
      supabase.rpc("event_ticket_counts"),
      supabase.from("event_options").select("*").order("name", { ascending: true }),
      supabase.from("event_ticket_types").select("*").order("sort", { ascending: true }),
      supabase.from("messages").select("id").eq("group_type", "dm").eq("group_id", user.id).limit(1),
      supabase.rpc("event_ticket_stats"),
      supabase.rpc("ticket_type_sold"),
      supabase.from("staff_settings").select("*").maybeSingle(),
      supabase.from("role_perms").select("*"),
      supabase.from("event_perks").select("*").order("label", { ascending: true }),
      supabase.from("event_addons").select("*"),
    ]);
    setProfile(prof); setRooms(rm || []); setEvents(ev || []);
    setSubs((sb || []).map(x => x.room_id)); setSubRows(sb || []); setTickets([...new Set((tk || []).map(x => x.event_id))]);
    const mt = {}; (tk || []).forEach(r => { if (!mt[r.event_id]) mt[r.event_id] = []; mt[r.event_id].push(r); }); setMyTickets(mt);
    setMods((md || []).map(x => x.room_id)); setEventMods((emd || []).map(x => x.event_id));
    const cm = {}; (cnt || []).forEach(x => { cm[x.room_id] = Number(x.members); }); setCounts(cm);
    const ec = {}; (ecnt || []).forEach(x => { ec[x.event_id] = Number(x.going); }); setEventCounts(ec);
    const es = {}; (estat || []).forEach(x => { es[x.event_id] = { male: Number(x.male_sold), female: Number(x.female_sold) }; }); setEventStats(es);
    const ts = {}; (tsold || []).forEach(x => { ts[x.ticket_type_id] = Number(x.sold); }); setTypeSold(ts);
    if (stg) setSettings(stg);
    if (rp) setPerms(rp);
    setPerksList(pk || []);
    const am = {}; (ad || []).forEach(a => { if (!am[a.event_id]) am[a.event_id] = []; am[a.event_id].push(a); }); setAddons(am);
    setCategories((opts || []).filter(o => o.kind === "category"));
    setCities((opts || []).filter(o => o.kind === "city"));
    setOptsAll(opts || []);
    supabase.from("filter_dimensions").select("*").order("name").then(({ data }) => setDims(data || []));
    const tm = {}; (tt || []).forEach(t => { if (!tm[t.event_id]) tm[t.event_id] = []; tm[t.event_id].push(t); }); setTicketTypes(tm);
    setHasDM((dm || []).length > 0);
    setReady(true);
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  const myRoles = (profile?.roles && profile.roles.length) ? profile.roles : (profile?.role && profile.role !== "member" ? [profile.role] : []);
  const isSuper = myRoles.includes("superadmin");
  const myCity = profile?.staff_city || null;
  const capOf = (k) => isSuper || perms.some(p => myRoles.includes(p.role) && p[k]);
  const isAdmin = isSuper || myRoles.includes("admin");
  const isStaff = isSuper || myRoles.some(r => ["admin", "subadmin", "organiser", "promoter"].includes(r));
  const caps = { rooms: capOf("can_rooms"), host: capOf("can_host"), broadcast: capOf("can_broadcast"), members: capOf("can_view_members"), add: capOf("can_add"), remove: capOf("can_remove"), analytics: capOf("can_analytics"), editMembers: capOf("can_edit_members"), stamps: capOf("can_stamps") };
  const canAccess = (r) => isAdmin || subs.includes(r.id) || mods.includes(r.id);
  const canAccessEvent = (e) => isAdmin || tickets.includes(e.id) || eventMods.includes(e.id);
  const freeForUser = (r) => r.price_monthly === 0 || profile?.gender !== "male" || profile?.founding_member;

  const emailTicket = async (eventId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token; if (!token || !eventId) return;
      fetch("/api/email/ticket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: token, event_id: eventId }) });
    } catch {}
  };
  const startPayment = async (purpose, payload, onPaid) => {
    setPayBusy(true);
    const ready = await loadRazorpay();
    if (!ready) { setPayBusy(false); return setNotice("Couldn't open the payment window. Check your connection and try again."); }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    let order;
    try {
      const ref = (() => { try { return localStorage.getItem("gw_ref") || ""; } catch { return ""; } })();
      const r = await fetch("/api/razorpay/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: token, purpose, ref, ...payload }) });
      order = await r.json();
      if (!r.ok) { setPayBusy(false); return setNotice(order.error || "Could not start the payment."); }
    } catch { setPayBusy(false); return setNotice("Could not start the payment. Please try again."); }
    const rzp = new window.Razorpay({
      key: order.key_id, amount: order.amount, currency: order.currency, order_id: order.order_id,
      name: "Glasswings Events", description: purpose === "ticket" ? "Event ticket" : "Room subscription",
      image: "/icon-192.png", theme: { color: "#0E8C7F" },
      prefill: { name: profile?.full_name || "", email: user.email || "" },
      handler: async (resp) => {
        try {
          const v = await fetch("/api/razorpay/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...resp, access_token: token }) });
          const vd = await v.json();
          if (!v.ok || !vd.ok) return setNotice(vd.error || "We couldn't confirm the payment. If money was deducted, contact us and we'll sort it.");
          await load();
          if (purpose === "ticket" && payload?.event_id) emailTicket(payload.event_id);
          onPaid && onPaid();
        } catch { setNotice("Payment confirmation failed. If money was deducted, contact us and we'll sort it."); }
      },
    });
    rzp.on("payment.failed", () => setNotice("Payment failed or was cancelled — nothing was charged."));
    setPayBusy(false);
    rzp.open();
  };

  const startSubscription = async (room) => {
    setPayBusy(true);
    const ready = await loadRazorpay();
    if (!ready) { setPayBusy(false); return setNotice("Couldn't open the payment window. Check your connection and try again."); }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    let sub;
    try {
      const r = await fetch("/api/razorpay/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: token, room_id: room.id }) });
      sub = await r.json();
      if (!r.ok) { setPayBusy(false); return setNotice(sub.error || "Could not start the subscription."); }
    } catch { setPayBusy(false); return setNotice("Could not start the subscription. Please try again."); }
    const rzp = new window.Razorpay({
      key: sub.key_id, subscription_id: sub.subscription_id,
      name: "Glasswings Events", description: `${room.name} — ₹${room.price_monthly}/month`,
      image: "/icon-192.png", theme: { color: "#0E8C7F" },
      prefill: { name: profile?.full_name || "", email: user.email || "" },
      handler: async (resp) => {
        try {
          const v = await fetch("/api/razorpay/verify-sub", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...resp, access_token: token }) });
          const vd = await v.json();
          if (!v.ok || !vd.ok) return setNotice(vd.error || "We couldn't confirm the subscription. If money was deducted, contact us and we'll sort it.");
          await load();
          setOpen({ id: room.id, type: "room" });
        } catch { setNotice("Subscription confirmation failed. If money was deducted, contact us and we'll sort it."); }
      },
    });
    rzp.on("payment.failed", () => setNotice("Payment failed or was cancelled — nothing was charged."));
    setPayBusy(false);
    rzp.open();
  };

  const joinRoom = async (r) => {
    if (canAccess(r)) return setOpen({ id: r.id, type: "room" });
    if (r.gender_restrict === "male" && profile?.gender !== "male") return setNotice("This room is for men only.");
    if (r.gender_restrict === "female" && profile?.gender !== "female") return setNotice("This room is for women only.");
    if (!freeForUser(r)) return startSubscription(r);
    const { error } = await supabase.from("room_subscriptions").insert({ room_id: r.id, user_id: user.id });
    if (error) return setNotice(error.message);
    setSubs(p => [...p, r.id]); setCounts(c => ({ ...c, [r.id]: (c[r.id] || 0) + 1 })); setOpen({ id: r.id, type: "room" });
  };
  const buyTicket = (e, cartOrType = null, qty = 1) => {
    let cart = Array.isArray(cartOrType) ? cartOrType.filter(c => c && c.qty > 0)
      : [{ type: cartOrType, qty: Math.max(1, qty || 1) }];
    if (!cart.length) cart = [{ type: null, qty: 1 }];
    for (const c of cart) {
      if (c.type) {
      } else if ((ticketTypes[e.id] || []).length) {
        return setNotice("Please choose a ticket type for this event.");
      }
    }
    setBuyTarget({ event: e, cart });
  };
  const joinEvent = (e, type = null) => {
    if (canAccessEvent(e)) return setOpen({ id: e.id, type: "event" });
    if (type) {
    } else if ((ticketTypes[e.id] || []).length) {
      return setNotice("Please choose a ticket type for this event.");
    }
    setBuyTarget({ event: e, type });
  };
  const [resumeCart, setResumeCart] = useState(null);
  useEffect(() => {
    if (!events.length) return;
    let buy = null, cartRaw = null; try { buy = localStorage.getItem("gw_buy"); cartRaw = localStorage.getItem("gw_buy_cart"); } catch {}
    if (!buy) return;
    const e = events.find(x => x.id === buy);
    if (e) {
      try { localStorage.removeItem("gw_buy"); localStorage.removeItem("gw_buy_cart"); } catch {}
      if (cartRaw) { try { setResumeCart(JSON.parse(cartRaw)); } catch {} }
      setTab("events"); setEventPage(e.id);
    }
  }, [events]);
  const grantRoom = async (userId, roomId) => {
    const { data: ex } = await supabase.from("room_subscriptions").select("id").eq("room_id", roomId).eq("user_id", userId).maybeSingle();
    if (ex) return setNotice("⚠️ Member is already in this room.");
    const { error } = await supabase.rpc("admin_grant_room", { p_user: userId, p_room: roomId });
    if (error) return setNotice(/duplicate|unique/i.test(error.message) ? "⚠️ Member is already in this room." : error.message);
    setNotice("Member added to the room ✅");
    await load();
  };
  const savePerm = async (roleName, patch) => {
    setPerms(ps => ps.map(p => p.role === roleName ? { ...p, ...patch } : p));
    const { error } = await supabase.from("role_perms").update(patch).eq("role", roleName);
    if (error) setNotice(error.message);
  };
  const setRoles = async (userId, rolesArr, city) => {
    const { error } = await supabase.rpc("set_member_roles", { p_user: userId, p_roles: rolesArr, p_city: city || null });
    if (error) return setNotice(error.message);
    setNotice("Team member updated.");
  };
  const removeRoom = async (userId, roomId) => {
    if (!window.confirm("Remove this member from the room? If they were on a paid subscription, billing will be cancelled too.")) return;
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const r = await fetch("/api/razorpay/admin-remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: session?.access_token, user_id: userId, room_id: roomId }) });
      const d = await r.json();
      if (!r.ok || !d.ok) return setNotice(d.error || "Could not remove — please try again.");
    } catch { return setNotice("Could not remove — please try again."); }
    setNotice("Member removed from the room.");
    await load();
  };
  const cancelSub = async (roomId) => {
    if (!window.confirm("Cancel this subscription? You'll stop being charged and leave the room.")) return;
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const r = await fetch("/api/razorpay/cancel-sub", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: session?.access_token, room_id: roomId }) });
      const d = await r.json();
      if (!r.ok || !d.ok) return setNotice(d.error || "Could not cancel — please try again.");
    } catch { return setNotice("Could not cancel — please try again."); }
    setNotice("Subscription cancelled.");
    if (open && open.type === "room" && open.id === roomId) setOpen(null);
    await load();
  };
  const confirmPurchase = async (cart, sel = []) => {
    const { event: e } = buyTarget;
    const { data: phRow } = await supabase.from("member_phone").select("phone").eq("user_id", user.id).maybeSingle();
    if (((phRow?.phone || "").replace(/\D/g, "")).length < 8) {
      const entered = window.prompt("Please enter your phone number — your ticket and event updates are sent here. It stays private; only the organiser can see it.");
      if (entered === null) return;
      if ((entered.replace(/\D/g, "")).length < 8) { setBuyTarget(null); return setNotice("A valid phone number is required to buy tickets."); }
      await supabase.from("member_phone").upsert({ user_id: user.id, phone: entered.trim() });
    }
    for (const c of cart) {
      if (c.type) {
        const st = ticketStatus(c.type, e, eventStats, typeSold);
        if (!st.ok) { setBuyTarget(null); return setNotice(st.label === "Sold out" ? `"${c.type.name}" is sold out.` : "Men's tickets aren't open yet — they release as more women join."); }
      } else if ((ticketTypes[e.id] || []).length) { setBuyTarget(null); return setNotice("Please choose a ticket type for this event."); }
    }
    const chosen = sel.filter(a => (a.qty || 0) > 0);
    const addonTotal = chosen.reduce((s, a) => s + (a.price || 0) * a.qty, 0);
    const ticketTotal = cart.reduce((s2, c) => s2 + (c.type ? genderNet(c.type, subs, profile) : e.ticket_price || 0) * c.qty, 0);
    const total = ticketTotal + addonTotal;
    if (total > 0) {
      setBuyTarget(null);
      return startPayment("ticket", {
        event_id: e.id,
        items: cart.map(c => ({ ticket_type_id: c.type ? c.type.id : null, quantity: c.qty })),
        ticket_type_id: cart[0].type ? cart[0].type.id : null,
        quantity: cart.reduce((a, c) => a + c.qty, 0),
        addons: chosen.map(a => ({ id: a.id, qty: a.qty })),
      }, () => setOpen({ id: e.id, type: "event" }));
    }
    let referrer_id = null;
    try { const code = localStorage.getItem("gw_ref"); if (code) { const { data } = await supabase.rpc("resolve_ref", { p_code: code }); if (data && data !== user.id) referrer_id = data; } } catch {}
    for (let ci = 0; ci < cart.length; ci++) {
      const c = cart[ci];
      const { error } = await supabase.from("event_tickets").insert({ event_id: e.id, user_id: user.id, ticket_type_id: c.type ? c.type.id : null, quantity: c.qty, addons: ci === 0 ? chosen.map(a => ({ id: a.id, name: a.name, price: a.price, qty: a.qty })) : [], referrer_id });
      if (error && error.code !== "23505") { setBuyTarget(null); return setNotice(error.message); }
    }
    setBuyTarget(null);
    await load();
    emailTicket(e.id);
    setOpen({ id: e.id, type: "event" });
  };

  const createRoom = async (d) => { const { error } = await supabase.from("rooms").insert(d); if (error) return setNotice(error.message); await load(); };
  const updateRoom = async (id, p) => { const { error } = await supabase.from("rooms").update(p).eq("id", id); if (error) return setNotice(error.message); setRooms(prev => prev.map(r => r.id === id ? { ...r, ...p } : r)); };
  const deleteRoom = async (id) => { const { error } = await supabase.from("rooms").delete().eq("id", id); if (error) return setNotice(error.message); setRooms(prev => prev.filter(r => r.id !== id)); setOpen(null); };
  const announceToRooms = async (body, media_type, extra = {}) => {
    if (!rooms.length) return;
    const rows = rooms.map(r => ({ group_type: "room", group_id: r.id, sender_id: user.id, body, media_type, ...extra }));
    await supabase.from("messages").insert(rows);
  };
  const createEvent = async (d, dates, addonsList) => {
    let list = (dates && dates.length) ? dates : [{ label: d.event_date || "", iso: d.event_at || null }];
    list = list.map(x => typeof x === "string" ? { label: x, iso: null } : x);
    if (!list.length) list = [{ label: "", iso: null }];
    const sid = list.length > 1 ? (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) : null;
    let firstId = null; const ids = [];
    for (const dt of list) {
      const { data: ins, error } = await supabase.from("events").insert({ ...d, event_date: dt.label, event_at: dt.iso || null, host_id: user.id, series_id: sid }).select("id").single();
      if (error) return setNotice(error.message);
      if (!firstId) firstId = ins?.id;
      if (ins?.id) ids.push(ins.id);
    }
    if (addonsList && addonsList.length && ids.length) {
      const rows = [];
      ids.forEach(id => addonsList.forEach(a => { if ((a.name || "").trim()) rows.push({ event_id: id, name: a.name.trim(), price: Number(a.price) || 0 }); }));
      if (rows.length) await supabase.from("event_addons").insert(rows);
    }
    const line = [list[0].label, [d.venue, d.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
    await announceToRooms(`${d.emoji || "🎟️"} ${d.title}${list.length > 1 ? ` (${list.length} dates)` : ""}${line ? "\n" + line : ""}`, "event", { media_url: d.banner_url || null, file_name: d.banner_type || "image", event_ref: firstId });
    await load();
    if (!(isAdmin || (profile?.roles || []).includes("admin"))) setNotice("Event submitted ✅ — it will appear publicly once an admin reviews and approves it.");
  };
  const broadcast = async (text) => {
    const t = (text || "").trim(); if (!t) return;
    await announceToRooms(t, "broadcast");
    setNotice("Broadcast sent to all group chats.");
  };
  const broadcastEvent = async (e) => {
    const line = [e.event_date, [e.venue, e.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
    await announceToRooms(`${e.emoji || "🎟️"} ${e.title}${line ? "\n" + line : ""}`, "event", { media_url: e.banner_url || null, file_name: e.banner_type || "image", event_ref: e.id });
    setNotice("Event sent to all group chats.");
  };
  const sendDM = async (ids, text) => {
    const t = (text || "").trim(); if (!t || !ids.length) return;
    const rows = ids.map(id => ({ group_type: "dm", group_id: id, sender_id: user.id, body: t }));
    const { error } = await supabase.from("messages").insert(rows);
    if (error) return setNotice(error.message);
    setNotice(`Message sent to ${ids.length} member${ids.length === 1 ? "" : "s"}.`);
  };
  const sendEventDM = async (e, ids = null) => {
    let target = ids;
    if (!target) { const { data } = await supabase.from("profiles").select("id"); target = (data || []).map(p => p.id); }
    target = target.filter(id => id !== user.id);
    if (!target.length) return setNotice("No members to send to.");
    const line = [e.event_date, [e.venue, e.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
    const body = `${e.emoji || "🎟️"} ${e.title}${line ? "\n" + line : ""}`;
    const rows = target.map(id => ({ group_type: "dm", group_id: id, sender_id: user.id, body, media_type: "event", media_url: e.banner_url || null, file_name: e.banner_type || "image", event_ref: e.id }));
    const { error } = await supabase.from("messages").insert(rows);
    if (error) return setNotice(error.message);
    setNotice(`Event sent privately to ${target.length} member${target.length === 1 ? "" : "s"}.`);
  };
  const updateEvent = async (id, p) => { const { error } = await supabase.from("events").update(p).eq("id", id); if (error) return setNotice(error.message); setEvents(prev => prev.map(e => e.id === id ? { ...e, ...p } : e)); };
  const deleteEvent = async (id) => { const { error } = await supabase.from("events").delete().eq("id", id); if (error) return setNotice(error.message); setEvents(prev => prev.filter(e => e.id !== id)); setOpen(null); };
  const addOption = async (kind, name) => { const n = name.trim(); if (!n) return; const { error } = await supabase.from("event_options").insert({ kind, name: n }); if (error) return setNotice(error.message); await load(); };
  const delOption = async (id) => { const { error } = await supabase.from("event_options").delete().eq("id", id); if (error) return setNotice(error.message); await load(); };
  const setOptionImage = async (id, url) => { const { error } = await supabase.from("event_options").update({ image_url: url }).eq("id", id); if (error) return setNotice(error.message); await load(); };
  const addPerk = async (kind, label) => { const n = (label || "").trim(); if (!n) return; const { error } = await supabase.from("event_perks").insert({ kind, label: n }); if (error && !String(error.message).includes("duplicate")) return; await load(); };
  const delPerk = async (id) => { await supabase.from("event_perks").delete().eq("id", id); await load(); };
  const addAddon = async (eventId, d) => { const n = (d.name || "").trim(); if (!n) return; const { error } = await supabase.from("event_addons").insert({ event_id: eventId, name: n, price: Number(d.price) || 0 }); if (error) return setNotice(error.message); await load(); };
  const delAddon = async (id) => { await supabase.from("event_addons").delete().eq("id", id); await load(); };
  const addTicketType = async (eventId, d) => { const { error } = await supabase.from("event_ticket_types").insert({ event_id: eventId, ...d }); if (error) return setNotice(error.message); await load(); };
  const delTicketType = async (id) => { const { error } = await supabase.from("event_ticket_types").delete().eq("id", id); if (error) return setNotice(error.message); await load(); };

  if (!ready) return <Splash />;
  if (profile?.blocked) return (
    <div style={{ minHeight: "100vh", background: W.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 380, textAlign: "center", border: `1px solid ${W.line}` }}>
        <div style={{ fontSize: 40 }}>🚫</div>
        <div style={{ fontWeight: 800, fontSize: 18, color: W.ink, marginTop: 8 }}>Account blocked</div>
        <div style={{ fontSize: 14, color: W.soft, marginTop: 6, lineHeight: 1.5 }}>Your account has been blocked by the organiser. If you think this is a mistake, please contact the Glasswings team.</div>
        <button onClick={() => supabase.auth.signOut()} style={{ ...btn(W.ink, "#fff"), marginTop: 16, justifyContent: "center", width: "100%" }}>Sign out</button>
      </div>
    </div>
  );
  const pendingBuy = (() => { try { return !!localStorage.getItem("gw_buy"); } catch { return false; } })();
  if (profile && !profile.profile_completed && !pendingBuy) return <ProfileGate user={user} profile={profile} reload={load} />;

  const listW = 340;
  const twoPane = wide && (tab === "chats" || !!open);
  const convoLeft = wide ? (twoPane ? SW + listW : SW) : 0;

  let chatEl = null;
  if (open) {
    if (open.type === "dm") {
      const isOwn = open.id === user.id;
      chatEl = <RoomChat room={{ id: open.id, name: open.title || (isOwn ? "Glasswings" : "Member"), emoji: isOwn ? "📣" : "👤", logo_url: null, pinned: "" }} groupType="dm" user={user} profile={profile} isAdmin={false} memberCount={0} onBack={() => setOpen(null)} onUpdatePinned={() => { }} onOpenEvent={openEvent} wide={wide} sidebar={convoLeft} />;
    } else if (open.type === "p2p") {
      const t = p2pThreads.find(x => x.id === open.id);
      chatEl = <RoomChat room={{ id: open.id, name: open.title || t?.name || "Member", emoji: "👤", logo_url: t?.avatar || null, pinned: "", otherId: t?.other || null, otherSeen: t?.seen || null }} groupType="p2p" user={user} profile={profile} isAdmin={false} memberCount={0} onBack={() => setOpen(null)} onUpdatePinned={() => { }} onOpenEvent={openEvent}
        onDeleteThread={async () => {
          if (!window.confirm("Delete this chat? It disappears for both of you.")) return;
          const { error } = await supabase.rpc("delete_dm_thread", { p_thread: open.id });
          if (error) return alert(error.message);
          setOpen(null);
        }} wide={wide} sidebar={convoLeft} />;
    } else if (open.type === "room") {
      const r = rooms.find(x => x.id === open.id);
      if (r) chatEl = <RoomChat room={{ id: r.id, name: r.name, emoji: r.emoji, logo_url: r.logo_url, pinned: r.pinned }} groupType="room" user={user} profile={profile} isAdmin={isAdmin} memberCount={counts[r.id] || 0} onBack={() => setOpen(null)} onUpdatePinned={updateRoom} onOpenEvent={openEvent} onOpenDM={async (id, name) => { const { data: tid, error } = await supabase.rpc("get_dm_thread", { p_other: id }); if (error) return setNotice(error.message); setOpen({ id: tid, type: "p2p", title: name }); }} wide={wide} sidebar={convoLeft} />;
    } else {
      const e = events.find(x => x.id === open.id);
      if (e) chatEl = <RoomChat room={{ id: e.id, name: e.title, emoji: e.emoji, logo_url: null, pinned: e.pinned }} groupType="event" user={user} profile={profile} isAdmin={isAdmin} memberCount={eventCounts[e.id] || 0} onBack={() => setOpen(null)} onUpdatePinned={updateEvent} onOpenEvent={openEvent} onOpenDM={async (id, name) => { const { data: tid, error } = await supabase.rpc("get_dm_thread", { p_other: id }); if (error) return setNotice(error.message); setOpen({ id: tid, type: "p2p", title: name }); }} wide={wide} sidebar={convoLeft} />;
    }
  }
  if (chatEl && !wide) return chatEl;

  const myChats = [
    [{ id: user.id, type: "dm", name: "Glasswings", emoji: "📣", logo_url: null, sub: "Message the Glasswings team 💚" }][0],
    ...p2pThreads.map(t => ({ id: t.id, type: "p2p", name: t.name, emoji: "👤", logo_url: t.avatar, sub: lastSeenStr(t.seen) || "Direct chat" })),
    ...rooms.filter(canAccess).map(r => ({ id: r.id, type: "room", name: r.name, emoji: r.emoji, logo_url: r.logo_url, sub: (counts[r.id] || 0) + " members" })),
    ...events.filter(e => {
      if (!canAccessEvent(e)) return false;
      if (e.chat_cleared) return false;
      if (e.event_at) { const ended = new Date(e.event_at).getTime(); if (Date.now() - ended > 3 * 86400000) return false; }
      return true;
    }).map(e => ({ id: e.id, type: "event", name: e.title, emoji: e.emoji, logo_url: null, sub: e.event_date || ((eventCounts[e.id] || 0) + " going") })),
  ];

  const screen = (
    <>
      {tab === "chats" && <><StoriesBar stories={stories} events={events} meId={user.id} isStaff={isAdmin} canAccessEvent={canAccessEvent} onRefresh={loadStories} /><Chats chats={myChats} onOpen={setOpen} onExplore={() => setTab("explore")} /></>}
      {tab === "explore" && <Explore rooms={rooms} profile={profile} counts={counts} canAccess={canAccess} freeForUser={freeForUser} onJoin={joinRoom} onOpenRoom={setRoomPage} />}
      {tab === "events" && <Events events={events} dims={dims} optsAll={optsAll} categories={categories} cities={cities} profile={profile} ticketTypes={ticketTypes} subs={subs} stats={eventStats} typeSold={typeSold} addonsMap={addons} canAccessEvent={canAccessEvent} counts={eventCounts} onJoin={joinEvent} onTicket={setTicketView} onOpenDetail={setEventPage} focus={focusEvent} onFocusDone={() => setFocusEvent(null)} />}
      {tab === "admin" && isStaff && <Admin caps={caps} isSuper={isSuper} myCity={myCity} dims={dims} optsAll={optsAll} onReload={load} myEventsOnly={!(isAdmin || (profile?.roles || []).includes("subadmin"))} meId={user.id} canApprove={isAdmin || (profile?.roles || []).includes("admin")} perms={perms} onSavePerm={savePerm} onSetRoles={setRoles} rooms={rooms} events={(isSuper || !myCity) ? events : events.filter(e => e.city === myCity)} categories={categories} cities={cities} ticketTypes={ticketTypes} counts={counts} onCreateRoom={createRoom} onUpdateRoom={updateRoom} onDeleteRoom={deleteRoom} onCreateEvent={createEvent} onUpdateEvent={updateEvent} onDeleteEvent={deleteEvent} onAddOption={addOption} onDelOption={delOption} onSetOptionImage={setOptionImage} perksList={perksList} onAddPerk={addPerk} onDelPerk={delPerk} addonsMap={addons} onAddAddon={addAddon} onDelAddon={delAddon} onAddTicketType={addTicketType} onDelTicketType={delTicketType} onBroadcast={broadcast} onBroadcastEvent={broadcastEvent} onSendDM={sendDM} onSendEventDM={sendEventDM} onGrantRoom={grantRoom} onRemoveRoom={removeRoom} onOpenThread={(id, title) => setOpen({ id, type: "dm", title })} />}
      {tab === "gallery" && <Gallery isAdmin={isAdmin} />}
      {tab === "profile" && <Profile user={user} profile={profile} reload={load} paidSubs={(subRows || []).filter(s => s.razorpay_subscription_id).map(s => ({ room_id: s.room_id, name: (rooms.find(r => r.id === s.room_id) || {}).name || "Room" }))} onCancelSub={cancelSub} />}
    </>
  );

  if (wide) {
    return (
      <>
        {notice && <Notice text={notice} onClose={() => setNotice("")} />}
        {buyTarget && <TicketSheet target={buyTarget} profile={profile} subs={subs} addons={addons[buyTarget.event.id] || []} onConfirm={confirmPurchase} onClose={() => setBuyTarget(null)} />}
        {ticketView && <MyTicket event={ticketView} profile={profile} rows={myTickets[ticketView.id] || []} onClose={() => setTicketView(null)} />}
        {payBusy && <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(8,18,24,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}><style>{`@keyframes gwspin{to{transform:rotate(360deg)}}`}</style><div style={{ background: "#fff", borderRadius: 14, padding: "22px 26px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, boxShadow: "0 12px 40px rgba(0,0,0,.3)" }}><div style={{ width: 30, height: 30, border: `3px solid ${W.line}`, borderTopColor: W.teal, borderRadius: "50%", animation: "gwspin .8s linear infinite" }} /><div style={{ fontSize: 14, fontWeight: 600, color: W.ink }}>Starting secure payment…</div></div></div>}
        {eventPage && (() => {
          const ev = events.find(x => x.id === eventPage);
          if (!ev) return null;
          const tot = (eventStats?.[ev.id]?.male || 0) + (eventStats?.[ev.id]?.female || 0);
          return (
            <div style={{ position: "fixed", inset: 0, zIndex: 50, overflowY: "auto", background: "#fff" }}>
              <PublicEventPage initialCart={resumeCart} e={ev} types={ticketTypes[ev.id] || []} addons={addons[ev.id] || []} popular={tot >= 5} events={events} wide={wide} profile={profile} stats={eventStats} typeSold={typeSold}
                hasTicket={canAccessEvent(ev)}
                onBack={() => setEventPage(null)}
                onBuy={(e2, c, q) => buyTicket(e2, c || null, q || 1)}
                onPick={(s) => setEventPage(s.id)}
                onViewTicket={() => setTicketView(ev)}
                onOpenChat={() => { setEventPage(null); setOpen({ id: ev.id, type: "event" }); }}
              />
            </div>
          );
        })()}
        {roomPage && (() => {
          const rr = rooms.find(x => x.id === roomPage);
          if (!rr) return null;
          return (
            <div style={{ position: "fixed", inset: 0, zIndex: 49, overflowY: "auto", background: W.bg }}>
              <RoomPage room={rr} profile={profile} count={counts[rr.id] || 0} isMember={canAccess(rr)} freeForUser={freeForUser}
                onJoin={(r2) => joinRoom(r2)} events={events}
                onOpenEvent={(id) => setEventPage(id)}
                onOpenChat={() => { setRoomPage(null); setOpen({ id: rr.id, type: "room" }); }}
                onBack={() => setRoomPage(null)} onNotice={setNotice} />
            </div>
          );
        })()}
        <div style={{ display: "flex", minHeight: "100vh", background: W.bg }}>
          <DesktopSidebar tab={open ? "chats" : tab} setTab={(t) => { setOpen(null); setTab(t); }} isAdmin={isStaff} width={SW} />
          <div style={{ marginLeft: SW, flex: 1, minWidth: 0, display: "flex", position: "relative" }}>
            {twoPane ? (
              <>
                <ChatListPane chats={myChats} open={open} onOpen={setOpen} width={listW} />
                <div style={{ flex: 1, minWidth: 0, position: "relative" }}>{chatEl || <EmptyConvo />}</div>
              </>
            ) : (
              <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>{screen}</div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {notice && <Notice text={notice} onClose={() => setNotice("")} />}
      {buyTarget && <TicketSheet target={buyTarget} profile={profile} subs={subs} addons={addons[buyTarget.event.id] || []} onConfirm={confirmPurchase} onClose={() => setBuyTarget(null)} />}
      {ticketView && <MyTicket event={ticketView} profile={profile} rows={myTickets[ticketView.id] || []} onClose={() => setTicketView(null)} />}
        {payBusy && <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(8,18,24,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}><style>{`@keyframes gwspin{to{transform:rotate(360deg)}}`}</style><div style={{ background: "#fff", borderRadius: 14, padding: "22px 26px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, boxShadow: "0 12px 40px rgba(0,0,0,.3)" }}><div style={{ width: 30, height: 30, border: `3px solid ${W.line}`, borderTopColor: W.teal, borderRadius: "50%", animation: "gwspin .8s linear infinite" }} /><div style={{ fontSize: 14, fontWeight: 600, color: W.ink }}>Starting secure payment…</div></div></div>}
        {eventPage && (() => {
          const ev = events.find(x => x.id === eventPage);
          if (!ev) return null;
          const tot = (eventStats?.[ev.id]?.male || 0) + (eventStats?.[ev.id]?.female || 0);
          return (
            <div style={{ position: "fixed", inset: 0, zIndex: 50, overflowY: "auto", background: "#fff" }}>
              <PublicEventPage initialCart={resumeCart} e={ev} types={ticketTypes[ev.id] || []} addons={addons[ev.id] || []} popular={tot >= 5} events={events} wide={wide} profile={profile} stats={eventStats} typeSold={typeSold}
                hasTicket={canAccessEvent(ev)}
                onBack={() => setEventPage(null)}
                onBuy={(e2, c, q) => buyTicket(e2, c || null, q || 1)}
                onPick={(s) => setEventPage(s.id)}
                onViewTicket={() => setTicketView(ev)}
                onOpenChat={() => { setEventPage(null); setOpen({ id: ev.id, type: "event" }); }}
              />
            </div>
          );
        })()}
        {roomPage && (() => {
          const rr = rooms.find(x => x.id === roomPage);
          if (!rr) return null;
          return (
            <div style={{ position: "fixed", inset: 0, zIndex: 49, overflowY: "auto", background: W.bg }}>
              <RoomPage room={rr} profile={profile} count={counts[rr.id] || 0} isMember={canAccess(rr)} freeForUser={freeForUser}
                onJoin={(r2) => joinRoom(r2)} events={events}
                onOpenEvent={(id) => setEventPage(id)}
                onOpenChat={() => { setRoomPage(null); setOpen({ id: rr.id, type: "room" }); }}
                onBack={() => setRoomPage(null)} onNotice={setNotice} />
            </div>
          );
        })()}
      <div style={{ paddingBottom: 64, minHeight: "100vh", background: W.bg }}>
        {screen}
      </div>
      <Nav tab={tab} setTab={setTab} isAdmin={isStaff} />
    </>
  );
}

function Notice({ text, onClose }) {
  return (
    <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", width: "92%", maxWidth: 400, zIndex: 60, background: W.ink, color: "#fff", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start", boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
      <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.45 }}>{text}</div>
      <X size={18} style={{ cursor: "pointer", flexShrink: 0 }} onClick={onClose} />
    </div>
  );
}

/* ---------------- chats ---------------- */
function Chats({ chats, onOpen, onExplore }) {
  return (
    <div>
      <TopBar title="Glasswings" />
      {chats.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 30px", color: W.soft }}>
          <MessageCircle size={42} color={W.teal} style={{ marginBottom: 14 }} />
          <div style={{ fontWeight: 700, color: W.ink, fontSize: 17 }}>No chats yet</div>
          <div style={{ fontSize: 14, marginTop: 6 }}>Join a room or grab an event ticket to start chatting.</div>
          <button onClick={onExplore} style={{ marginTop: 16, padding: "11px 20px", border: "none", borderRadius: 22, background: W.teal, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Explore</button>
        </div>
      ) : chats.map(c => (
        <div key={c.type + c.id} onClick={() => onOpen({ id: c.id, type: c.type })} style={{ display: "flex", gap: 13, alignItems: "center", padding: "12px 16px", background: "#fff", cursor: "pointer", borderBottom: `1px solid ${W.line}` }}>
          <Avatar room={{ emoji: c.emoji, logo_url: c.logo_url }} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 16, color: W.ink }}>{c.name}{c.type === "event" && <Ticket size={13} color={W.soft} style={{ marginLeft: 6, verticalAlign: "middle" }} />}</div>
            <div style={{ color: W.soft, fontSize: 13.5, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.sub} · tap to open</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- events ---------------- */
function Events({ events, categories, cities, profile, ticketTypes, subs, stats, typeSold, addonsMap, canAccessEvent, counts, onJoin, onTicket, onOpenDetail, focus, onFocusDone, dims, optsAll }) {
  const popSet = (() => {
    const tot = events.map(e => [e.id, ((stats?.[e.id]?.male || 0) + (stats?.[e.id]?.female || 0))]);
    return new Set(tot.filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id));
  })();
  const [flt, setFlt] = useState(emptyFlt());
  const [sortBy, setSortBy] = useState("relevance");
  const [fsheet, setFsheet] = useState(false);
  const [ssheet, setSsheet] = useState(false);
  const [citySheet, setCitySheet] = useState(false);
  const [custom, setCustom] = useState([]);
  useEffect(() => { supabase.from("slider_images").select("*").order("position").order("created_at").then(({ data }) => setCustom(data || [])); }, []);
  useEffect(() => { if (focus) { onOpenDetail && onOpenDetail(focus); onFocusDone && onFocusDone(); } }, [focus]);
  const cityNames = (cities && cities.length) ? cities.map(c => c.name) : Array.from(new Set(events.map(e => e.city).filter(Boolean)));
  const catTiles = (categories && categories.length) ? categories : Array.from(new Set(events.map(e => e.category).filter(Boolean))).map(n => ({ name: n }));
  const getMin = e => { const ts = ticketTypes[e.id] || []; const prices = ts.length ? ts.map(t => genderNet(t, null, profile)) : [e.ticket_price || 0]; return Math.min(...prices); };
  const list = sortEvents(events.filter(e => eventMatches(e, flt, getMin)), sortBy, getMin);
  const priceFrom = (e) => {
    const ts = ticketTypes[e.id] || [];
    const prices = ts.length ? ts.map(t => t.price || 0) : [e.ticket_price || 0];
    const m = Math.min(...prices);
    return m === 0 ? "Free" : `From ₹${m}`;
  };
  const evSlide = ({ e, img }) => ({ url: img, title: `${e.emoji || "🎟️"} ${e.title}`, sub: [e.event_date, e.city].filter(Boolean).join(" · "), cta: "Get tickets", id: e.id });
  const promoSlides = events
    .filter(e => Number(e.promo_pct) > 0 && e.approved !== false)
    .map(e => ({ e, img: (e.banner_type !== "video" && e.banner_url) || e.poster_url }))
    .filter(x => x.img)
    .sort((a, b) => Number(b.e.promo_pct) - Number(a.e.promo_pct))
    .map(evSlide);
  const customSlides = custom.map(sl => ({ url: sl.url, id: sl.event_id || undefined }));
  const fallbackSlides = events.map(e => ({ e, img: (e.banner_type !== "video" && e.banner_url) || e.poster_url })).filter(x => x.img && x.e.approved !== false).slice(0, 6).map(evSlide);
  const featured = [...promoSlides, ...customSlides.filter(c => !promoSlides.some(ps => ps.id && ps.id === c.id))].slice(0, 6);
  const heroSlides = featured.length ? featured : fallbackSlides;
  return (
    <div>
      <TopBar title="Events" />
      <div style={{ padding: "14px 16px 4px", background: "#fff" }}>
        <div style={{ fontWeight: 800, fontSize: 21.5, color: W.ink, letterSpacing: -0.3 }}>Your city. Your people. ✨</div>
        <div onClick={() => setCitySheet(true)} style={{ color: W.teal, fontWeight: 800, fontSize: 14, marginTop: 3, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>{flt.city.length === 1 ? flt.city[0] : "All cities"}&nbsp;{"\u203a"}</div>
      </div>
      <CategoryTiles cats={catTiles} val={flt.category.length === 1 ? flt.category[0] : "All"} set={name => setFlt(f => ({ ...f, category: name === "All" ? [] : [name] }))} />
      <div style={{ display: "flex", gap: 10, padding: "10px 14px", overflowX: "auto", borderBottom: `1px solid ${W.line}`, background: "#fff", position: "sticky", top: 0, zIndex: 5 }}>
        <button onClick={() => setFsheet(true)} style={filterPill(fltCount(flt) > 0)}>{"\u2630 Filters"}{fltCount(flt) > 0 ? ` (${fltCount(flt)})` : ""}</button>
        <button onClick={() => setSsheet(true)} style={filterPill(sortBy !== "relevance")}>{"\u2195 Sort By"}</button>
      </div>
      {heroSlides.length > 0 && <HeroSlider slides={heroSlides} wide={false} onSlide={(sl) => sl.id && onOpenDetail && onOpenDetail(sl.id)} />}
      <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 13 }}>
        {list.length === 0 && <div style={{ gridColumn: "1/-1" }}><Center>No events here yet.</Center></div>}
        {list.map(e => <PosterCard key={e.id} e={e} date={e.event_date} price={priceFrom(e)} popular={popSet.has(e.id)} going={canAccessEvent(e)} unpublished={e.approved === false} onOpen={(id) => onOpenDetail && onOpenDetail(id)} />)}
      </div>
      {fsheet && <FilterSheet events={events} dims={dims} opts={optsAll} getMin={getMin} value={flt} onApply={f => { setFlt(f); setFsheet(false); }} onClose={() => setFsheet(false)} />}
      {ssheet && <SortSheet value={sortBy} onPick={k => { setSortBy(k); setSsheet(false); }} onClose={() => setSsheet(false)} />}
      {citySheet && <CitySheet cities={cityNames} value={flt.city.length === 1 ? flt.city[0] : "All cities"} onPick={c => { setFlt(f => ({ ...f, city: c === "All cities" ? [] : [c] })); setCitySheet(false); }} onClose={() => setCitySheet(false)} />}
    </div>
  );
}
function Constellation({ data, me, roomName, onWave }) {
  const [sel, setSel] = useState(null);
  if (!data) return <div style={{ background: "#0b1f1c", borderRadius: 16, height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "#5a8f84", fontSize: 13 }}>Mapping the constellation…</div>;
  const nodes = [...(data.nodes || [])].sort((a, b) => (b.events || 0) - (a.events || 0));
  const edges = data.edges || [];
  if (!nodes.length) return null;
  const CW = 340, CH = 290, cx = CW / 2, cy = CH / 2 - 6;
  const pos = {};
  nodes.forEach((n, i) => {
    if (i === 0 && nodes.length > 1) { pos[n.id] = { x: cx, y: cy }; return; }
    const ang = i * 2.39996; const rad = Math.min(128, 30 + 15.5 * Math.sqrt(i));
    pos[n.id] = { x: cx + rad * Math.cos(ang), y: cy + rad * Math.sin(ang) * 0.8 };
  });
  const myEdges = {}; edges.forEach(e => { if (e.a === me) myEdges[e.b] = e.w; if (e.b === me) myEdges[e.a] = e.w; });
  const crossed = Object.keys(myEdges).length;
  const unmet = Math.max(0, nodes.filter(n => n.id !== me).length - crossed);
  const selNode = sel ? nodes.find(n => n.id === sel) : null;
  const initial = n => (n.name || "?").trim().charAt(0).toUpperCase();
  return (
    <div style={{ background: "radial-gradient(ellipse at 50% 35%, #11332c, #0b1f1c)", borderRadius: 16, overflow: "hidden" }}>
      <style>{`@keyframes gwtw{0%,100%{opacity:.2}50%{opacity:.9}}`}</style>
      <div style={{ padding: "14px 16px 0", color: "#fff" }}>
        <div style={{ fontWeight: 800, fontSize: 15.5 }}>✨ The Constellation</div>
        <div style={{ fontSize: 12, color: "#8fc4b8", marginTop: 2 }}>Every line is a real meetup you shared. Show up — your star moves to the centre.</div>
      </div>
      <svg viewBox={`0 0 ${CW} ${CH}`} style={{ width: "100%", display: "block" }}>
        {[...Array(14)].map((_, i) => <circle key={"bg" + i} cx={(i * 73 + 21) % CW} cy={(i * 47 + 13) % CH} r={1} fill="#7de8cc" style={{ animation: `gwtw ${2 + (i % 4)}s ease-in-out ${i * .4}s infinite` }} />)}
        {edges.map((e, i) => { const a = pos[e.a], b = pos[e.b]; if (!a || !b) return null; const mine = e.a === me || e.b === me; return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={mine ? "#2FD4A8" : "#9EE8D6"} strokeWidth={Math.min(2.6, .6 + e.w * .5)} opacity={mine ? .65 : .22 + Math.min(.4, e.w * .12)} />; })}
        {nodes.map(n => { const pt = pos[n.id]; if (!pt) return null; const isMe = n.id === me; const isSel = n.id === sel; const r = isMe ? 13 : 11;
          return (
            <g key={n.id} onClick={() => setSel(isSel ? null : n.id)} style={{ cursor: "pointer" }}>
              {(isMe || isSel) && <circle cx={pt.x} cy={pt.y} r={r + 4} fill="none" stroke={isMe ? "#2FD4A8" : "#fff"} strokeWidth={1.6} opacity={.9} />}
              {n.avatar ? (
                <>
                  <clipPath id={"cl" + n.id}><circle cx={pt.x} cy={pt.y} r={r} /></clipPath>
                  <image href={n.avatar} x={pt.x - r} y={pt.y - r} width={r * 2} height={r * 2} clipPath={`url(#cl${n.id})`} preserveAspectRatio="xMidYMid slice" />
                </>
              ) : (
                <>
                  <circle cx={pt.x} cy={pt.y} r={r} fill={(n.events || 0) > 0 ? "#15584a" : "#123028"} stroke="#2FD4A8" strokeWidth={.8} />
                  <text x={pt.x} y={pt.y + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#9EE8D6">{initial(n)}</text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ padding: "0 16px 14px", color: "#fff" }}>
        {selNode ? (
          <div style={{ background: "rgba(255,255,255,.07)", borderRadius: 12, padding: "11px 13px", display: "flex", alignItems: "center", gap: 11 }}>
            <PersonAvatar url={selNode.avatar} name={selNode.name} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{selNode.id === me ? "That's you ⭐" : selNode.name || "Member"}</div>
              <div style={{ fontSize: 12, color: "#8fc4b8" }}>
                {selNode.id === me ? `Crossed paths with ${crossed} ${crossed === 1 ? "person" : "people"} · ${unmet} yet to meet`
                  : myEdges[selNode.id] ? `You've crossed paths at ${myEdges[selNode.id]} ${myEdges[selNode.id] === 1 ? "event" : "events"}` : "You haven't met yet — next meetup?"}
              </div>
            </div>
            {selNode.id !== me && <button onClick={() => onWave(selNode)} style={{ ...btn("#2FD4A8", "#0b1f1c"), padding: "8px 13px", fontSize: 12.5, fontWeight: 800 }}>Say hi 👋</button>}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#8fc4b8" }}>You've crossed paths with <b style={{ color: "#2FD4A8" }}>{crossed}</b> {crossed === 1 ? "person" : "people"} here · <b style={{ color: "#fff" }}>{unmet}</b> yet to meet. Tap a star.</div>
        )}
      </div>
    </div>
  );
}
function RoomPage({ room: r, profile, count, isMember, freeForUser, onJoin, events, onOpenEvent, onOpenChat, onBack, onNotice }) {
  const [tab, setTab] = useState("home");
  const [galaxy, setGalaxy] = useState(null);
  useEffect(() => { setGalaxy(null); supabase.rpc("room_constellation", { p_room: r.id }).then(({ data }) => setGalaxy(data || { nodes: [], edges: [] })); }, [r.id]);
  const today = new Date().toISOString().slice(0, 10);
  const roomEvents = events.filter(e => !r.city || !e.city || e.city === r.city);
  const upcoming = roomEvents.filter(e => !e.event_at || e.event_at >= today);
  const past = roomEvents.filter(e => e.event_at && e.event_at < today).slice(0, 12);
  const womenFree = r.price_monthly > 0 && profile?.gender !== "male";
  const wave = async (node) => {
    try {
      const first = (node.name || "").split(" ")[0];
      const { data: tid, error: te } = await supabase.rpc("get_dm_thread", { p_other: node.id });
      if (te) return onNotice("Could not start the chat right now.");
      const { error } = await supabase.from("messages").insert({ group_type: "p2p", group_id: tid, sender_id: profile.id, body: `👋 Hi${first ? " " + first : ""}! We've crossed paths at ${r.name} meetups — I'm ${profile.full_name}. Say hi back!` });
      onNotice(error ? "Couldn't send the wave right now." : `Wave sent to ${node.name} 👋 — your chat is in the Chats tab.`);
    } catch { onNotice("Couldn't send the wave right now."); }
  };
  const tabBtn = (v, l) => <button key={v} onClick={() => v === "chat" ? (isMember ? onOpenChat() : onNotice("Join the room to enter the chat.")) : setTab(v)} style={{ flex: 1, padding: "11px 0", border: "none", background: "transparent", borderBottom: `2.5px solid ${tab === v ? W.teal : "transparent"}`, color: tab === v ? W.teal : W.soft, fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>{l}</button>;
  const joinCta = !isMember && (
    <div style={{ background: "#fff", border: `1px solid ${W.line}`, borderRadius: 14, padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div>
        <div style={{ fontWeight: 800, color: W.ink, fontSize: 14.5 }}>Join {r.name}</div>
        <div style={{ fontSize: 12.5, color: W.soft, marginTop: 2 }}>{r.price_monthly === 0 ? "Free to join" : womenFree ? "Free for women" : `₹${r.price_monthly}/month`}</div>
      </div>
      <button onClick={() => onJoin(r)} style={{ ...btn(W.teal, "#fff"), padding: "10px 18px" }}>{freeForUser(r) ? "Join free" : "Subscribe"}</button>
    </div>
  );
  return (
    <div style={{ minHeight: "100vh", background: W.bg }}>
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(8,18,24,.95)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", border: "none", color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: "pointer", padding: 0 }}><ArrowLeft size={19} />Rooms</button>
      </div>
      <div style={{ position: "relative", height: 170, background: "linear-gradient(135deg,#008069,#04B08F)", overflow: "hidden" }}>
        {r.logo_url && <>
          <img src={r.logo_url} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(24px) brightness(.6)", transform: "scale(1.15)" }} />
          <img src={r.logo_url} alt={r.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
        </>}
        {!r.logo_url && <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56 }}>{r.emoji || "💬"}</div>}
      </div>
      <div style={{ background: "#fff", padding: "14px 16px 0", borderBottom: `1px solid ${W.line}` }}>
        <div style={{ fontWeight: 800, fontSize: 21, color: W.ink }}>{r.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 5, fontSize: 12.5, color: W.soft }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={13} />{count} members</span>
          {r.city && <span>· {r.city}</span>}
          {r.gender_restrict === "female" && <span style={{ background: "#FCE7F1", color: W.pink, fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10 }}>WOMEN ONLY</span>}
          {r.gender_restrict === "couple" && <span style={{ background: "#EFEAFB", color: "#7C3AED", fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10 }}>COUPLES</span>}
        </div>
        <div style={{ display: "flex", marginTop: 10 }}>
          {tabBtn("home", "Home")}{tabBtn("events", "Events")}{tabBtn("members", "Members")}{tabBtn("chat", "Chat")}
        </div>
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14, paddingBottom: 40 }}>
        {tab === "home" && (
          <>
            {joinCta}
            {r.description && <div style={{ background: "#fff", border: `1px solid ${W.line}`, borderRadius: 14, padding: 14, fontSize: 14, color: "#3c4a47", lineHeight: 1.55 }}>{r.description}</div>}
            {r.pinned && <div style={{ background: "#FDF6EC", border: "1px solid #F2E2C4", borderRadius: 14, padding: 13, fontSize: 13.5, color: "#7a5a1e", lineHeight: 1.5 }}><b>📌 Pinned</b><div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{r.pinned}</div></div>}
            <Constellation data={galaxy} me={profile?.id} roomName={r.name} onWave={wave} />
            {upcoming.length > 0 && (
              <div>
                <div style={{ fontWeight: 800, fontSize: 15.5, color: W.ink, margin: "4px 0 10px" }}>Next meetups</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
                  {upcoming.slice(0, 4).map(e => <PosterCard key={e.id} e={e} date={e.event_date} price={(e.ticket_price || 0) === 0 ? "Free" : `From ₹${e.ticket_price}`} popular={false} going={false} unpublished={e.approved === false} onOpen={onOpenEvent} />)}
                </div>
              </div>
            )}
            {isMember && <button onClick={onOpenChat} style={{ ...btn(W.teal, "#fff"), justifyContent: "center", padding: 13, fontSize: 14.5 }}><MessageCircle size={16} />Open room chat</button>}
          </>
        )}
        {tab === "events" && (
          <>
            {upcoming.length === 0 && past.length === 0 && <Center>No meetups yet.</Center>}
            {upcoming.length > 0 && <div style={{ fontWeight: 800, fontSize: 15, color: W.ink }}>Upcoming</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
              {upcoming.map(e => <PosterCard key={e.id} e={e} date={e.event_date} price={(e.ticket_price || 0) === 0 ? "Free" : `From ₹${e.ticket_price}`} popular={false} going={false} unpublished={e.approved === false} onOpen={onOpenEvent} />)}
            </div>
            {past.length > 0 && <div style={{ fontWeight: 800, fontSize: 15, color: W.ink, marginTop: 6 }}>Memories</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
              {past.map(e => <PosterCard key={e.id} e={e} date={e.event_date} price="" popular={false} going={false} unpublished={e.approved === false} onOpen={onOpenEvent} />)}
            </div>
          </>
        )}
        {tab === "members" && (
          galaxy === null ? <Center>loading members…</Center> : (
            <div style={{ background: "#fff", border: `1px solid ${W.line}`, borderRadius: 14 }}>
              {(galaxy.nodes || []).map((n, i) => (
                <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 14px", borderTop: i ? `1px solid ${W.line}` : "none" }}>
                  <PersonAvatar url={n.avatar} name={n.name} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: W.ink, fontSize: 14 }}>{n.name || "Member"}{n.id === profile?.id ? " (you)" : ""}</div>
                    <div style={{ fontSize: 12, color: W.soft }}>{n.events || 0} meetups attended</div>
                  </div>
                  {n.id !== profile?.id && <button onClick={() => wave(n)} style={{ ...btn("#fff", W.teal), border: `1px solid ${W.line}`, padding: "6px 11px", fontSize: 12.5 }}>👋</button>}
                </div>
              ))}
              {(galaxy.nodes || []).length === 0 && <div style={{ padding: 14 }}><Center>No members yet.</Center></div>}
            </div>
          )
        )}
      </div>
    </div>
  );
}
function Explore({ rooms, profile, counts, canAccess, freeForUser, onJoin, onOpenRoom }) {
  const admin = ["admin", "superadmin"].includes(profile?.role);
  const [city, setCity] = useState("all");
  const cityList = Array.from(new Set(rooms.map(r => r.city).filter(Boolean))).sort();
  const list = rooms.filter(r => admin || !r.gender_restrict || r.gender_restrict === "any" || r.gender_restrict === "couple" || r.gender_restrict === profile?.gender)
    .filter(r => city === "all" || (r.city || "") === city);
  const chip = (v, label) => <button key={v} onClick={() => setCity(v)} style={{ padding: "6px 13px", borderRadius: 16, border: `1px solid ${city === v ? W.teal : W.line}`, background: city === v ? W.teal : "#fff", color: city === v ? "#fff" : W.soft, fontWeight: 600, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{label}</button>;
  const badge = (t, bg, c) => <span style={{ background: bg, color: c, fontSize: 10.5, fontWeight: 800, padding: "3px 8px", borderRadius: 10 }}>{t}</span>;
  return (
    <div>
      <TopBar title="Rooms" />
      {cityList.length > 0 && <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "10px 14px", background: "#fff", borderBottom: `1px solid ${W.line}` }}>{chip("all", "All cities")}{cityList.map(c => chip(c, c))}</div>}
      <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
        {list.length === 0 && <div style={{ gridColumn: "1/-1" }}><Center>No rooms here yet.</Center></div>}
        {list.map(r => {
          const has = canAccess(r);
          const womenFree = r.price_monthly > 0 && profile?.gender !== "male";
          return (
            <div key={r.id} onClick={() => onOpenRoom ? onOpenRoom(r.id) : onJoin(r)} style={{ background: "#fff", borderRadius: 16, border: `1px solid ${W.line}`, overflow: "hidden", boxShadow: "0 3px 12px rgba(0,0,0,.07)", cursor: "pointer", display: "flex", flexDirection: "column" }}>
              <div style={{ position: "relative", height: 130, background: "linear-gradient(135deg,#008069,#04B08F)", overflow: "hidden" }}>
                {r.logo_url ? (
                  <>
                    <img src={r.logo_url} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(24px) brightness(.65)", transform: "scale(1.15)" }} />
                    <img src={r.logo_url} alt={r.name} loading="lazy" decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
                  </>
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 46 }}>{r.emoji || "💬"}</div>
                )}
                {has && <span style={{ position: "absolute", top: 10, right: 10, background: "#008069", color: "#fff", fontSize: 10.5, fontWeight: 800, padding: "3px 9px", borderRadius: 10 }}>✓ Member</span>}
              </div>
              <div style={{ padding: "13px 15px 15px", display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: W.ink, lineHeight: 1.25 }}>{r.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  <span style={{ color: W.soft, fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}><Users size={13} />{counts[r.id] || 0} members</span>
                  {r.city && <span style={{ color: W.soft, fontSize: 12.5 }}>· {r.city}</span>}
                  {r.gender_restrict === "female" && badge("WOMEN ONLY", "#FCE7F1", W.pink)}
                  {r.gender_restrict === "male" && badge("MEN ONLY", "#E8F2FB", "#1B6FB8")}
                  {r.gender_restrict === "couple" && badge("COUPLES", "#EFEAFB", "#7C3AED")}
                </div>
                {r.description && <div style={{ color: W.soft, fontSize: 13, marginTop: 7, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.description}</div>}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 12, gap: 8 }}>
                  {r.price_monthly === 0 ? <span style={{ fontWeight: 800, color: W.teal, fontSize: 14.5 }}>Free</span>
                    : womenFree ? <span style={{ background: "#FCE7F1", color: W.pink, fontWeight: 700, fontSize: 11.5, padding: "3px 9px", borderRadius: 20 }}>Free for women</span>
                      : <span style={{ fontWeight: 800, color: W.ink, fontSize: 14.5, display: "flex", alignItems: "center" }}><IndianRupee size={13} />{r.price_monthly}<span style={{ color: W.soft, fontWeight: 500, fontSize: 12.5 }}>/mo</span></span>}
                  {has ? <button onClick={(ev) => { ev.stopPropagation(); onOpenRoom ? onOpenRoom(r.id) : onJoin(r); }} style={{ ...btn(W.teal, "#fff"), padding: "8px 16px" }}><MessageCircle size={14} />Open</button>
                    : freeForUser(r) ? <button onClick={(ev) => { ev.stopPropagation(); onJoin(r); }} style={{ ...btn(W.teal, "#fff"), padding: "8px 16px" }}>Join free</button>
                      : <button onClick={(ev) => { ev.stopPropagation(); onJoin(r); }} style={{ ...btn(W.ink, "#fff"), padding: "8px 16px" }}><Lock size={13} />Subscribe</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function agoStr(ts) {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
function StoryViewer({ list, event, meId, isStaff, onClose, onDeleted }) {
  const [i, setI] = useState(0);
  const [names, setNames] = useState({});
  const cur = list[i];
  useEffect(() => {
    const ids = [...new Set(list.map(x => x.user_id))];
    supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids)
      .then(({ data }) => { const m = {}; (data || []).forEach(pr => { m[pr.id] = pr; }); setNames(m); });
  }, [list]);
  useEffect(() => {
    const t = setTimeout(() => { if (i < list.length - 1) setI(i + 1); else onClose(); }, 5000);
    return () => clearTimeout(t);
  }, [i, list.length]);
  if (!cur) return null;
  const who = names[cur.user_id];
  const del = async () => {
    if (!window.confirm("Delete this story?")) return;
    await supabase.from("stories").delete().eq("id", cur.id);
    onDeleted();
    if (list.length <= 1) onClose(); else setI(Math.max(0, i - 1));
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 4, padding: "10px 10px 0" }}>
        {list.map((x, k) => <div key={x.id} style={{ flex: 1, height: 3, borderRadius: 2, background: k <= i ? "#2FD4A8" : "rgba(255,255,255,.3)" }} />)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", color: "#fff" }}>
        {who?.avatar_url ? <img src={who.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }} />
          : <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#2FD4A8", color: "#0b1f1c", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{(who?.full_name || "?").charAt(0)}</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{who?.full_name || "Member"}</div>
          <div style={{ fontSize: 11.5, opacity: .75 }}>{(event?.emoji || "🎟️")} {event?.title} · {agoStr(cur.created_at)}</div>
        </div>
        {(cur.user_id === meId || isStaff) && <Trash2 size={19} onClick={del} style={{ cursor: "pointer", opacity: .9 }} />}
        <X size={24} onClick={onClose} style={{ cursor: "pointer" }} />
      </div>
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <img src={cur.media_url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        <div onClick={() => (i > 0 ? setI(i - 1) : onClose())} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "35%" }} />
        <div onClick={() => (i < list.length - 1 ? setI(i + 1) : onClose())} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "65%" }} />
      </div>
    </div>
  );
}
function StoriesBar({ stories, events, meId, isStaff, canAccessEvent, onRefresh }) {
  const [viewer, setViewer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pickFor, setPickFor] = useState(null); // file waiting for event choice
  const now = Date.now();
  const evMap = {}; events.forEach(e => { evMap[e.id] = e; });
  const groups = {}; stories.forEach(st => { if (evMap[st.event_id]) (groups[st.event_id] = groups[st.event_id] || []).push(st); });
  const ids = Object.keys(groups);
  const eligible = events.filter(e => canAccessEvent(e) && e.event_at && Math.abs(now - new Date(e.event_at).getTime()) < 36 * 3600000);
  if (!ids.length && !eligible.length) return null;
  const post = async (eventId, file) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadPhoto(meId, file);
      const { error } = await supabase.from("stories").insert({ event_id: eventId, user_id: meId, media_url: url });
      if (error) throw error;
      onRefresh();
    } catch (e2) { alert(e2.message || "Could not post the story."); }
    setBusy(false); setPickFor(null);
  };
  const Bubble = ({ onClick, ring, inner, label }) => (
    <div onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", width: 68, flexShrink: 0 }}>
      <div style={{ width: 58, height: 58, borderRadius: "50%", padding: 3, background: ring, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>{inner}</div>
      </div>
      <div style={{ fontSize: 10.5, color: W.ink, fontWeight: 600, maxWidth: 66, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
    </div>
  );
  return (
    <>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "12px 14px 4px", background: "#fff", borderBottom: `1px solid ${W.line}` }}>
        {eligible.length > 0 && (
          <label style={{ display: "block" }}>
            <Bubble onClick={() => { }} ring={`2px dashed ${W.teal}`} inner={<span style={{ fontSize: 22, color: W.teal, fontWeight: 800 }}>{busy ? "…" : "+"}</span>} label="Add story" />
            <input type="file" accept="image/*" style={{ display: "none" }} disabled={busy}
              onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; if (eligible.length === 1) post(eligible[0].id, f); else setPickFor(f); }} />
          </label>
        )}
        {ids.map(id => {
          const e = evMap[id];
          const thumb = (e.banner_url && e.banner_type !== "video") ? e.banner_url : e.poster_url;
          return <Bubble key={id} onClick={() => setViewer(id)} ring="linear-gradient(135deg,#008069,#2FD4A8)"
            inner={thumb ? <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 24 }}>{e.emoji || "🎟️"}</span>}
            label={e.title} />;
        })}
      </div>
      {pickFor && (
        <div onClick={() => setPickFor(null)} style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "flex-end" }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background: "#fff", width: "100%", borderRadius: "16px 16px 0 0", padding: "16px 16px calc(20px + env(safe-area-inset-bottom))" }}>
            <div style={{ fontWeight: 800, color: W.ink, marginBottom: 10 }}>Add to which event's story?</div>
            {eligible.map(e => <div key={e.id} onClick={() => post(e.id, pickFor)} style={{ padding: "12px 4px", borderBottom: `1px solid ${W.line}`, fontWeight: 600, color: W.ink, cursor: "pointer" }}>{e.emoji || "🎟️"} {e.title}</div>)}
          </div>
        </div>
      )}
      {viewer && groups[viewer] && <StoryViewer list={groups[viewer]} event={evMap[viewer]} meId={meId} isStaff={isStaff} onClose={() => setViewer(null)} onDeleted={onRefresh} />}
    </>
  );
}
function RoomMembersSheet({ room, groupType = "room", onClose, canDM, onOpenDM, viewerId }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [online, setOnline] = useState(() => new Set());
  useEffect(() => {
    const call = groupType === "event" ? supabase.rpc("event_members", { p_event: room.id }) : supabase.rpc("room_members_admin", { p_room: room.id });
    call.then(({ data, error }) => { if (error) setErr(error.message); else setRows(data || []); });
    const loadOnline = () => supabase.from("profiles").select("id").gt("last_seen", new Date(Date.now() - 150000).toISOString())
      .then(({ data }) => setOnline(new Set((data || []).map(r => r.id))));
    loadOnline();
    const iv = setInterval(loadOnline, 45000);
    return () => clearInterval(iv);
  }, [room.id, groupType]);
  const dot = <span style={{ position: "absolute", right: 0, bottom: 0, width: 13, height: 13, borderRadius: "50%", background: "#22C55E", border: "2.5px solid #fff" }} />;
  const [staffSet, setStaffSet] = useState(() => new Set());
  const [connSet, setConnSet] = useState(() => new Set());
  const [seenMap, setSeenMap] = useState({});
  useEffect(() => {
    supabase.rpc("my_connections").then(({ data }) => setConnSet(new Set((data || []).map(r2 => (r2 && typeof r2 === "object") ? Object.values(r2)[0] : r2))));
  }, []);
  useEffect(() => {
    const ids = (rows || []).map(m => m.user_id);
    if (!ids.length) return;
    supabase.from("profiles").select("id, roles, role, last_seen").in("id", ids).then(({ data }) => {
      const sm = {};
      (data || []).forEach(pr => { sm[pr.id] = pr.last_seen || null; });
      setSeenMap(sm);
      const st = new Set();
      (data || []).forEach(pr => {
        if (["superadmin", "admin", "subadmin"].includes(pr.role) || (pr.roles || []).some(r => ["superadmin", "admin", "subadmin"].includes(r))) st.add(pr.id);
      });
      setStaffSet(st);
    });
  }, [rows]);
  const suffix = groupType === "event" ? "at this event" : "in room";
  const Row = m => {
    const isConn = connSet.has(m.user_id);
    const tappable = !!onOpenDM && m.user_id !== viewerId && (canDM || staffSet.has(m.user_id) || isConn);
    return (
    <div key={m.user_id} onClick={tappable ? () => { onOpenDM(m.user_id, m.full_name || "Member"); onClose && onClose(); } : undefined}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", cursor: tappable ? "pointer" : "default" }}>
      <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
        {m.avatar_url
          ? <img src={m.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
          : <div style={{ width: 44, height: 44, borderRadius: "50%", background: W.teal, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 17 }}>{(m.full_name || "?").trim().charAt(0).toUpperCase()}</div>}
        {online.has(m.user_id) && dot}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: W.ink, fontSize: 15 }}>{m.full_name || "Member"} {staffSet.has(m.user_id) && <span style={{ fontSize: 10.5, background: "#E7F6EF", color: W.teal, fontWeight: 800, padding: "2px 7px", borderRadius: 7, verticalAlign: "middle" }}>👑 TEAM</span>}</div>
        <div style={{ fontSize: 11.5, color: online.has(m.user_id) ? "#16A34A" : W.soft, fontWeight: online.has(m.user_id) ? 800 : 500 }}>
          {online.has(m.user_id) ? "online" : (lastSeenStr(seenMap[m.user_id]) || " ")}{tappable && !canDM && !staffSet.has(m.user_id) && isConn ? " · ⭐ crossed paths" : ""}
        </div>
      </div>
      {tappable && <MessageCircle size={18} style={{ color: W.teal, flexShrink: 0 }} />}
    </div>
  ); };
  const guys = (rows || []).filter(m => m.gender === "male");
  const girls = (rows || []).filter(m => m.gender === "female");
  const other = (rows || []).filter(m => m.gender !== "male" && m.gender !== "female");
  const Head = (label, n, color) => <div style={{ fontWeight: 800, color: W.ink, fontSize: 15, marginTop: 22, paddingBottom: 7, borderBottom: `2px solid ${color}` }}>{label} ({n})</div>;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "#fff", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 12px", borderBottom: `1px solid ${W.line}`, background: W.teal, color: "#fff" }}>
        <ArrowLeft size={24} onClick={onClose} style={{ cursor: "pointer", flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 17, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{room.emoji || "💬"} {room.name}</div>
          <div style={{ fontSize: 12.5, opacity: .9 }}>{rows === null ? "loading…" : `${rows.length} member${rows.length === 1 ? "" : "s"} · 👨 ${guys.length} · 👩 ${girls.length}`}</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 18px calc(20px + env(safe-area-inset-bottom))" }}>
        {err ? <div style={{ marginTop: 16, color: "#C0392B", fontSize: 13.5 }}>{err}</div>
          : rows === null ? <Center>loading members…</Center>
          : <>
            {Head(`👨 Guys ${suffix}`, guys.length, W.teal)}
            {guys.length ? guys.map(Row) : <div style={{ color: W.soft, fontSize: 13, padding: "10px 0" }}>None yet.</div>}
            {Head(`👩 Girls ${suffix}`, girls.length, "#D6618F")}
            {girls.length ? girls.map(Row) : <div style={{ color: W.soft, fontSize: 13, padding: "10px 0" }}>None yet.</div>}
            {other.length > 0 && <>{Head("Not specified", other.length, W.line)}{other.map(Row)}</>}
          </>}
      </div>
    </div>
  );
}
function RoomChat({ room, groupType = "room", user, profile, isAdmin, memberCount, onBack, onUpdatePinned, onOpenEvent, onOpenDM, onDeleteThread, readOnly = false, wide = false, sidebar = 0 }) {
  const [showMembers, setShowMembers] = useState(false);
  const bar = wide ? { left: sidebar, right: 0, width: "auto", maxWidth: "none", transform: "none" } : { left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430 };
  const [msgs, setMsgs] = useState(null);
  const [senders, setSenders] = useState({});
  const [text, setText] = useState("");
  const [editPin, setEditPin] = useState(false);
  const [pinText, setPinText] = useState(room.pinned || "");
  const endRef = useRef(null);
  const sRef = useRef({});
  const headRef = useRef(null);
  const [headPad, setHeadPad] = useState(112);
  const camRef = useRef(null);
  const fileRef = useRef(null);
  const [qrs, setQrs] = useState([]);
  const [showQR, setShowQR] = useState(false);
  const [newQR, setNewQR] = useState("");

  useEffect(() => {
    let channel;
    (async () => {
      const { data } = await supabase.from("messages")
        .select("id, body, media_url, media_type, file_name, event_ref, sender_id, created_at, sender:profiles(full_name, avatar_url)")
        .eq("group_type", groupType).eq("group_id", room.id)
        .order("created_at", { ascending: true });
      const sm = {}; (data || []).forEach(m => { if (m.sender) sm[m.sender_id] = { name: m.sender.full_name, avatar: m.sender.avatar_url || sm[m.sender_id]?.avatar }; });
      sm[user.id] = { name: profile.full_name, avatar: profile.avatar_url || sm[user.id]?.avatar }; sRef.current = sm; setSenders(sm);
      setMsgs((data || []).map(m => ({ id: m.id, body: m.body, media_url: m.media_url, media_type: m.media_type, file_name: m.file_name, event_ref: m.event_ref, sender_id: m.sender_id, created_at: m.created_at })));
      channel = supabase.channel(groupType + "-" + room.id)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${room.id}` }, async (payload) => {
          const m = payload.new;
          if (!sRef.current[m.sender_id]) {
            const { data: p } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", m.sender_id).single();
            sRef.current = { ...sRef.current, [m.sender_id]: { name: p?.full_name || "Member", avatar: p?.avatar_url } }; setSenders(sRef.current);
          }
          setMsgs(prev => (prev && prev.some(x => x.id === m.id)) ? prev : [...(prev || []), { id: m.id, body: m.body, media_url: m.media_url, media_type: m.media_type, file_name: m.file_name, event_ref: m.event_ref, sender_id: m.sender_id, created_at: m.created_at }]);
        }).subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [room.id]);
  useEffect(() => { endRef.current?.scrollIntoView(); }, [msgs]);
  useEffect(() => { if (headRef.current) setHeadPad(headRef.current.offsetHeight); }, [room.pinned, isAdmin, editPin, msgs === null]);
  useEffect(() => { supabase.from("quick_replies").select("*").eq("owner_id", user.id).order("created_at", { ascending: true }).then(({ data }) => setQrs(data || [])); }, [user.id]);

  const send = async () => {
    const body = text.trim(); if (!body) return; setText("");
    const { data, error } = await supabase.from("messages").insert({ group_type: groupType, group_id: room.id, sender_id: user.id, body }).select("id, body, media_url, media_type, file_name, sender_id, created_at").single();
    if (error) { setText(body); return; }
    setMsgs(prev => prev.some(x => x.id === data.id) ? prev : [...prev, data]);
  };
  const sendFile = async (file, kind) => {
    if (!file) return;
    try {
      const url = await uploadChatFile(room.id, file);
      const { data, error } = await supabase.from("messages").insert({ group_type: groupType, group_id: room.id, sender_id: user.id, body: "", media_url: url, media_type: kind, file_name: file.name }).select("id, body, media_url, media_type, file_name, sender_id, created_at").single();
      if (error) throw error;
      setMsgs(prev => prev.some(x => x.id === data.id) ? prev : [...prev, data]);
    } catch (x) { alert("Upload failed: " + x.message); }
  };
  const addQR = async () => { const t = newQR.trim(); if (!t) return; const { data, error } = await supabase.from("quick_replies").insert({ owner_id: user.id, text: t }).select().single(); if (!error) { setQrs(p => [...p, data]); setNewQR(""); } };
  const delQR = async (id) => { await supabase.from("quick_replies").delete().eq("id", id); setQrs(p => p.filter(q => q.id !== id)); };
  const savePin = async () => { await onUpdatePinned(room.id, { pinned: pinText.trim() }); room.pinned = pinText.trim(); setEditPin(false); };
  const [otherRead, setOtherRead] = useState(null);
  const [otherSeen, setOtherSeen] = useState(room.otherSeen || null);
  useEffect(() => {
    if (groupType !== "p2p" || !room.otherId) return;
    const loadSeen = () => supabase.from("profiles").select("last_seen").eq("id", room.otherId).maybeSingle()
      .then(({ data }) => setOtherSeen(data?.last_seen || null));
    loadSeen();
    const iv = setInterval(loadSeen, 30000);
    return () => clearInterval(iv);
  }, [groupType, room.otherId]);
  useEffect(() => {
    if (groupType !== "p2p" || msgs === null) return;
    supabase.rpc("mark_dm_read", { p_thread: room.id });
  }, [groupType, room.id, msgs ? msgs.length : 0]);
  useEffect(() => {
    if (groupType !== "p2p") return;
    const loadReads = () => supabase.from("dm_reads").select("user_id, last_read_at").eq("thread_id", room.id)
      .then(({ data }) => { const o = (data || []).find(r2 => r2.user_id !== user.id); setOtherRead(o ? o.last_read_at : null); });
    loadReads();
    const iv = setInterval(loadReads, 10000);
    return () => clearInterval(iv);
  }, [groupType, room.id]);

  return (
    <div style={{ minHeight: "100dvh", background: W.wall, backgroundImage: `url("${WALL}")`, paddingBottom: 72 }}>
      {showMembers && <RoomMembersSheet room={room} groupType={groupType} onClose={() => setShowMembers(false)} canDM={isAdmin} onOpenDM={onOpenDM} viewerId={user.id} />}
      <div ref={headRef} style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, zIndex: 30, ...bar }}>
        <div style={{ background: W.teal, color: "#fff", display: "flex", alignItems: "center", gap: 10, padding: "12px" }}>
          <ArrowLeft size={22} onClick={onBack} style={{ cursor: "pointer", flexShrink: 0 }} />
          <Avatar room={room} size={38} />
          <div onClick={() => { if (groupType !== "dm" && groupType !== "p2p") setShowMembers(true); }} style={{ flex: 1, minWidth: 0, cursor: (groupType !== "dm" && groupType !== "p2p") ? "pointer" : "default" }}>
            <div style={{ fontWeight: 600, fontSize: 16.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{room.name}</div>
            <div style={{ fontSize: 12, opacity: .85, fontWeight: (groupType === "p2p" && lastSeenStr(otherSeen) === "online") ? 700 : 400 }}>{groupType === "dm" ? "Glasswings team · we reply here" : groupType === "p2p" ? (lastSeenStr(otherSeen) || "Direct chat") : `${memberCount} members · tap for list`}</div>
          </div>
          {groupType === "p2p" && onDeleteThread && <Trash2 size={19} onClick={onDeleteThread} style={{ cursor: "pointer", flexShrink: 0, opacity: .9 }} />}
        </div>
        {(room.pinned || isAdmin) && (
          <div style={{ background: "#fff", borderBottom: `1px solid ${W.line}`, padding: "8px 14px", display: "flex", alignItems: "center", gap: 9 }}>
            <Pin size={15} color={W.teal} style={{ flexShrink: 0 }} />
            {editPin ? (<>
              <input value={pinText} onChange={e => setPinText(e.target.value)} placeholder="Pin an announcement…" style={{ flex: 1, minWidth: 0, border: `1px solid ${W.line}`, borderRadius: 8, padding: "6px 10px", fontSize: 13, outline: "none" }} />
              <button onClick={savePin} style={{ ...btn(W.teal, "#fff"), padding: "6px 12px" }}>Save</button>
            </>) : (<>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: room.pinned ? W.ink : W.soft }}>{room.pinned || "No announcement pinned"}</div>
              {isAdmin && <Settings size={16} color={W.soft} style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => { setPinText(room.pinned || ""); setEditPin(true); }} />}
            </>)}
          </div>
        )}
      </div>
      <div style={{ paddingTop: headPad + 8, paddingLeft: 8, paddingRight: 8, paddingBottom: 8 }}>
        <div style={{ textAlign: "center", margin: "0 0 16px" }}><span style={{ background: "#FBF1C7", color: "#54656F", fontSize: 12, padding: "5px 12px", borderRadius: 8 }}>🔒 Only members can see these messages</span></div>
        {msgs === null ? <Center>loading…</Center> : msgs.length === 0 ? <Center>No messages yet — say hello 👋</Center> :
          msgs.map((m, i) => {
            const mine = m.sender_id === user.id;
            const first = (i === 0 || msgs[i - 1].sender_id !== m.sender_id);
            const s = senders[m.sender_id] || {};
            if (m.media_type === "event" || m.media_type === "broadcast") {
              const isEvent = m.media_type === "event";
              return (
                <div key={m.id} style={{ display: "flex", justifyContent: "center", margin: "8px 4px" }}>
                  <div style={{ maxWidth: "90%", width: m.media_url ? "90%" : "auto", background: isEvent ? "#E7F6EF" : "#FFF6E0", border: `1px solid ${isEvent ? "#BFE6D8" : "#F0DDA8"}`, borderRadius: 12, padding: "11px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: .5, color: isEvent ? W.teal : "#B8860B", marginBottom: 6 }}>{isEvent ? "NEW EVENT" : "📢 ANNOUNCEMENT"}</div>
                    {isEvent && m.media_url && <BannerMedia url={m.media_url} type={m.file_name === "video" ? "video" : "image"} style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 8, display: "block", marginBottom: 8 }} />}
                    <div style={{ fontSize: 14.5, color: W.ink, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{m.body}</div>
                    {isEvent && m.event_ref && <button onClick={() => onOpenEvent && onOpenEvent(m.event_ref)} style={{ ...btn(W.teal, "#fff"), marginTop: 10, width: "100%", justifyContent: "center" }}><Ticket size={15} />RSVP / Buy ticket</button>}
                    <div style={{ fontSize: 11, color: W.soft, marginTop: 5 }}>{fmtTime(m.created_at)}</div>
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", alignItems: "flex-start", gap: 6, margin: "2px 4px" }}>
                {!mine && (first ? <PersonAvatar url={s.avatar} name={s.name} size={28} /> : <div style={{ width: 28, flexShrink: 0 }} />)}
                <div style={{ maxWidth: "78%", background: mine ? W.sent : W.recv, padding: "6px 9px 5px", borderRadius: 8, borderTopRightRadius: mine ? 2 : 8, borderTopLeftRadius: mine ? 8 : 2, boxShadow: "0 1px 1px rgba(0,0,0,.12)" }}>
                  {!mine && first && <div style={{ fontSize: 12.5, fontWeight: 700, color: W.teal, marginBottom: 1 }}>{s.name || "Member"}</div>}
                  {m.media_url && m.media_type === "image" && <img src={m.media_url} alt="" style={{ maxWidth: "100%", borderRadius: 6, display: "block", marginBottom: m.body ? 4 : 0 }} />}
                  {m.media_url && m.media_type === "file" && <a href={m.media_url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: W.ink, background: "#F0F2F5", borderRadius: 8, padding: "8px 10px", marginBottom: m.body ? 4 : 0 }}><Paperclip size={16} color={W.teal} /><span style={{ fontSize: 13.5, wordBreak: "break-all" }}>{m.file_name || "file"}</span></a>}
                  {m.body && <div style={{ fontSize: 14.5, color: W.ink, lineHeight: 1.35 }}>{m.body}</div>}
                  <div style={{ fontSize: 11, color: W.soft, textAlign: "right", marginTop: 2, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                    {fmtTime(m.created_at)}
                    {mine && groupType === "p2p" && (
                      <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: -2.5, color: (otherRead && m.created_at <= otherRead) ? "#34B7F1" : "#9aa7a3" }}>{(otherRead && m.created_at <= otherRead) ? "✓✓" : "✓"}</span>
                    )}
                  </div>
                </div>
                {mine && (first ? <PersonAvatar url={s.avatar} name={s.name} size={28} /> : <div style={{ width: 28, flexShrink: 0 }} />)}
              </div>
            );
          })}
        <div ref={endRef} />
      </div>
      {showQR && (
        <div style={{ position: "fixed", bottom: 63, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, zIndex: 25, background: "#fff", borderTop: `1px solid ${W.line}`, boxShadow: "0 -4px 16px rgba(0,0,0,.08)", maxHeight: "45vh", overflowY: "auto", padding: 12, ...bar }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: W.ink, fontSize: 14 }}>Quick replies</span>
            <X size={18} style={{ cursor: "pointer" }} onClick={() => setShowQR(false)} />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input value={newQR} onChange={e => setNewQR(e.target.value)} placeholder="Save a new quick reply…" style={{ flex: 1, minWidth: 0, border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 12px", fontSize: 14, outline: "none" }} />
            <button onClick={addQR} style={btn(W.teal, "#fff")}>Save</button>
          </div>
          {qrs.length === 0 ? <div style={{ color: W.soft, fontSize: 13, padding: "6px 0" }}>No saved replies yet. Type one above and Save.</div> :
            qrs.map(q => (
              <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderTop: `1px solid ${W.line}` }}>
                <div onClick={() => { setText(q.text); setShowQR(false); }} style={{ flex: 1, minWidth: 0, fontSize: 14, color: W.ink, cursor: "pointer" }}>{q.text}</div>
                <Trash2 size={16} color="#C0392B" style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => delQR(q.id)} />
              </div>
            ))}
        </div>
      )}
      {readOnly ? (
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, zIndex: 20, background: W.bg, padding: "12px", textAlign: "center", color: W.soft, fontSize: 12.5, ...bar }}>📣 Announcements from Glasswings</div>
      ) : (
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, zIndex: 20, background: W.bg, padding: "8px 9px", display: "flex", alignItems: "flex-end", gap: 7, ...bar }}>
        <div style={{ flex: 1, minWidth: 0, background: "#fff", borderRadius: 24, display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
          <Zap size={21} color={showQR ? W.teal : W.soft} style={{ flexShrink: 0, cursor: "pointer" }} onClick={() => setShowQR(v => !v)} />
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Message" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", fontSize: 15.5, color: W.ink }} />
          <Paperclip size={20} color={W.soft} style={{ flexShrink: 0, cursor: "pointer" }} onClick={() => fileRef.current?.click()} />
          <Camera size={20} color={W.soft} style={{ flexShrink: 0, cursor: "pointer" }} onClick={() => camRef.current?.click()} />
        </div>
        <button onClick={send} style={{ width: 47, height: 47, borderRadius: "50%", border: "none", background: W.teal, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Send size={20} /></button>
        <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={e => { sendFile(e.target.files?.[0], "image"); e.target.value = ""; }} style={{ display: "none" }} />
        <input ref={fileRef} type="file" onChange={e => { const f = e.target.files?.[0]; sendFile(f, f && f.type.startsWith("image/") ? "image" : "file"); e.target.value = ""; }} style={{ display: "none" }} />
      </div>
      )}
    </div>
  );
}

/* ---------------- admin ---------------- */
function SliderManager() {
  const [uid, setUid] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);
  const [evs, setEvs] = useState([]);
  const load = () => supabase.from("slider_images").select("*").order("position").order("created_at").then(({ data }) => setRows(data || []));
  useEffect(() => {
    load();
    supabase.from("events").select("id, title, emoji").order("created_at", { ascending: false }).limit(60).then(({ data }) => setEvs(data || []));
    supabase.auth.getUser().then(({ data }) => {
      const id = data?.user?.id; if (!id) return;
      supabase.from("profiles").select("roles, role").eq("id", id).single().then(({ data: p }) => {
        const ok = (p?.roles || []).some(r => ["superadmin", "admin"].includes(r)) || ["superadmin", "admin"].includes(p?.role);
        if (ok) setUid(id);
      });
    });
  }, []);
  if (!uid) return null;
  const add = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); setMsg("");
    try {
      const url = await uploadPhoto(uid, f);
      const { error } = await supabase.from("slider_images").insert({ url });
      if (error) setMsg(error.message); else await load();
    } catch (x) { setMsg("Upload failed: " + x.message); }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };
  const del = async (id) => { await supabase.from("slider_images").delete().eq("id", id); load(); };
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: 14, marginBottom: 12 }}>
      <div style={{ fontWeight: 700, color: W.ink }}>Homepage slider</div>
      <div style={{ fontSize: 12.5, color: W.soft, margin: "2px 0 10px" }}>These images rotate at the top of the events page. Link each one to an event so tapping it opens that event. If you add none, the latest event banners are shown automatically.</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {rows.map(r => (
          <div key={r.id} style={{ position: "relative", width: 130 }}>
            <img src={r.url} alt="" style={{ width: 130, height: 74, objectFit: "cover", borderRadius: 9, border: `1px solid ${W.line}`, display: "block" }} />
            <button onClick={() => del(r.id)} title="Remove" style={{ position: "absolute", top: -7, right: -7, width: 21, height: 21, borderRadius: "50%", border: "none", background: "#C0392B", color: "#fff", fontSize: 12, cursor: "pointer", lineHeight: 1 }}>✕</button>
            <select value={r.event_id || ""} onChange={async (e) => { const v = e.target.value || null; await supabase.from("slider_images").update({ event_id: v }).eq("id", r.id); load(); }} style={{ width: "100%", marginTop: 6, padding: "6px 7px", borderRadius: 8, border: `1px solid ${r.event_id ? W.teal : W.line}`, background: "#fff", fontSize: 11.5, color: r.event_id ? W.teal : W.soft, outline: "none", fontWeight: 600 }}>
              <option value="">No link</option>
              {evs.map(ev => <option key={ev.id} value={ev.id}>{(ev.emoji || "🎟️") + " " + ev.title}</option>)}
            </select>
          </div>
        ))}
        <button onClick={() => fileRef.current?.click()} disabled={busy} style={{ width: 110, height: 64, borderRadius: 9, border: `1.5px dashed ${W.teal}`, background: "#fff", color: W.teal, fontWeight: 700, fontSize: 12.5, cursor: "pointer", opacity: busy ? .6 : 1 }}>{busy ? "Uploading…" : "+ Add image"}</button>
        <input ref={fileRef} type="file" accept="image/*" onChange={add} style={{ display: "none" }} />
      </div>
      {msg && <div style={{ fontSize: 12.5, color: "#C0392B", marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
function Dashboard() {
  const [sum, setSum] = useState(null), [staff, setStaff] = useState([]), [evts, setEvts] = useState([]), [promos, setPromos] = useState([]);
  useEffect(() => {
    supabase.rpc("income_summary").then(({ data }) => setSum(data?.[0] || null));
    supabase.rpc("staff_stats").then(({ data }) => setStaff(data || []));
    supabase.rpc("event_analytics").then(({ data }) => setEvts(data || []));
    supabase.rpc("promoter_stats").then(({ data }) => setPromos(data || []));
  }, []);
  const rupees = p => "₹" + Math.round((p || 0) / 100).toLocaleString("en-IN");
  const card = (label, value, accent) => (
    <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: "14px 16px", flex: "1 1 140px" }}>
      <div style={{ fontSize: 12.5, color: W.soft, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent || W.ink }}>{value}</div>
    </div>
  );
  return (
    <div style={{ padding: 14 }}>
      <SliderManager />
      <div style={{ fontWeight: 800, fontSize: 16, color: W.ink, marginBottom: 10 }}>Income</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
        {card("Total revenue", sum ? rupees(sum.total_revenue) : "…", W.teal)}
        {card("This month", sum ? rupees(sum.month_revenue) : "…", W.teal)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        {card("Ticket sales", sum ? rupees(sum.ticket_revenue) : "…")}
        {card("Subscriptions", sum ? rupees(sum.sub_revenue) : "…")}
        {card("Paying members", sum ? sum.paying_members : "…")}
        {card("Active subs", sum ? sum.active_subs : "…")}
      </div>

      <div style={{ fontWeight: 800, fontSize: 16, color: W.ink, marginBottom: 10 }}>Team — hosted vs attended</div>
      <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, overflow: "hidden", marginBottom: 20 }}>
        {staff.length === 0 ? <Center>No staff yet.</Center> : staff.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderTop: i ? `1px solid ${W.line}` : "none" }}>
            <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><span style={{ fontWeight: 700, color: W.ink, fontSize: 14 }}>{s.full_name || "—"}</span><RoleBadges roles={s.roles} /></div>
            <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
              <span style={{ color: W.soft }}>Hosted <b style={{ color: W.ink }}>{s.hosted}</b></span>
              <span style={{ color: W.soft }}>Attended <b style={{ color: W.ink }}>{s.attended}</b></span>
            </div>
          </div>
        ))}
      </div>

      {promos.length > 0 && <>
        <div style={{ fontWeight: 800, fontSize: 16, color: W.ink, marginBottom: 10 }}>Promoters</div>
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, overflow: "hidden", marginBottom: 20 }}>
          {promos.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderTop: i ? `1px solid ${W.line}` : "none", gap: 10 }}>
              <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, color: W.ink, fontSize: 14 }}>{p.full_name || "—"}</div><div style={{ fontSize: 12, color: W.soft }}>{p.code || "—"} · {p.pct || 0}%</div></div>
              <div style={{ display: "flex", gap: 14, fontSize: 13, whiteSpace: "nowrap" }}>
                <span style={{ color: W.soft }}>Tickets <b style={{ color: W.ink }}>{p.tickets}</b></span>
                <span style={{ color: W.soft }}>Rev <b style={{ color: W.ink }}>₹{Math.round((p.revenue || 0) / 100)}</b></span>
                <span style={{ color: W.soft }}>Comm <b style={{ color: W.teal }}>₹{Math.round((p.commission || 0) / 100)}</b></span>
              </div>
            </div>
          ))}
        </div>
      </>}

      <div style={{ fontWeight: 800, fontSize: 16, color: W.ink, marginBottom: 10 }}>Events</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {evts.length === 0 ? <Center>No events yet.</Center> : evts.map(e => (
          <div key={e.id} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <div style={{ fontWeight: 700, color: W.ink, minWidth: 0 }}>{e.title}</div>
              <div style={{ fontWeight: 800, color: W.teal, whiteSpace: "nowrap" }}>{rupees(e.revenue)}</div>
            </div>
            <div style={{ fontSize: 12.5, color: W.soft, marginTop: 2 }}>{[e.city, e.event_date].filter(Boolean).join(" · ")}{e.host_name ? ` · by ${e.host_name}` : ""}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginTop: 8, fontSize: 13 }}>
              <span style={{ color: W.soft }}>Tickets <b style={{ color: W.ink }}>{e.tickets_sold}</b></span>
              <span style={{ color: W.soft }}>Attended <b style={{ color: W.ink }}>{e.attended}</b></span>
              <span style={{ color: W.soft }}>Guys <b style={{ color: W.ink }}>{e.guys}</b></span>
              <span style={{ color: W.soft }}>Girls <b style={{ color: W.ink }}>{e.girls}</b></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function EmailMarketingPanel({ meId }) {
  const [banner, setBanner] = useState(null);
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState("");
  const [msg, setMsg] = useState("");
  const [count, setCount] = useState(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const loadBanner = () => supabase.rpc("get_app_setting", { p_key: "marketing_banner_url" }).then(({ data }) => setBanner((data || "").trim() || null));
  useEffect(() => {
    loadBanner();
    supabase.from("profiles").select("id", { count: "exact", head: true }).then(({ count: c }) => setCount(c ?? null));
  }, []);
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try { const url = await uploadPhoto(meId, file); const { error } = await supabase.rpc("set_app_setting", { p_key: "marketing_banner_url", p_value: url }); if (error) throw error; await loadBanner(); }
    catch (e2) { alert(e2.message || "Upload failed"); }
    setBusy(false);
  };
  const removeBanner = async () => {
    if (!window.confirm("Remove the marketing banner? The banner section will be hidden from all emails.")) return;
    const { error } = await supabase.rpc("set_app_setting", { p_key: "marketing_banner_url", p_value: "" });
    if (error) return alert(error.message);
    loadBanner();
  };
  const send = async () => {
    if (!subject.trim() || !msg.trim()) return alert("Subject and message are required.");
    if (!window.confirm(`Send this email to ALL ${count ?? ""} members? This cannot be undone.`)) return;
    setSending(true); setResult(null);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const r = await fetch("/api/email/ticket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "blast", access_token: token, subject: subject.trim(), message: msg.trim() }) });
      const out = await r.json();
      if (!r.ok) throw new Error(out.error || "Send failed");
      setResult(`✓ Sent to ${out.sent} of ${out.recipients} members${out.failed ? ` (${out.failed} failed)` : ""}.`);
      setSubject(""); setMsg("");
    } catch (e2) { setResult("⚠️ " + (e2.message || "Send failed")); }
    setSending(false);
  };
  const ip3 = { width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 14, outline: "none", boxSizing: "border-box" };
  return (
    <div style={{ padding: "16px 16px 40px", maxWidth: 620, margin: "0 auto" }}>
      <div style={{ fontWeight: 800, fontSize: 17, color: W.ink }}>📧 Email marketing</div>
      <div style={{ fontSize: 12.5, color: W.soft, margin: "4px 0 16px" }}>Bulk emails to all members, and the marketing banner shown inside every ticket email.</div>

      <div style={{ background: "#fff", border: `1px solid ${W.line}`, borderRadius: 14, padding: "15px 16px", marginBottom: 16 }}>
        <div style={{ fontWeight: 800, color: W.ink, fontSize: 14.5, marginBottom: 4 }}>🖼️ Marketing banner</div>
        <div style={{ fontSize: 12, color: W.soft, marginBottom: 12 }}>Appears in every ticket email (between the community section and upcoming events) and on top of bulk emails. Remove it and the section disappears from emails automatically. Ideal size ~800×300px.</div>
        {banner ? (
          <>
            <img src={banner} alt="Marketing banner" style={{ width: "100%", borderRadius: 10, display: "block" }} />
            <div style={{ display: "flex", gap: 12, marginTop: 9, fontSize: 13, fontWeight: 700 }}>
              <label style={{ color: W.teal, cursor: "pointer" }}>{busy ? "Uploading…" : "Replace"}<input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { upload(e.target.files && e.target.files[0]); e.target.value = ""; }} /></label>
              <span onClick={removeBanner} style={{ color: "#C0392B", cursor: "pointer" }}>Remove</span>
            </div>
          </>
        ) : (
          <label style={{ display: "block", cursor: "pointer", padding: "20px 12px", border: `2px dashed ${W.line}`, borderRadius: 12, color: W.soft, fontSize: 13.5, fontWeight: 700, textAlign: "center" }}>
            {busy ? "Uploading…" : "📤 Upload a banner (none set — the section is hidden in emails)"}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { upload(e.target.files && e.target.files[0]); e.target.value = ""; }} />
          </label>
        )}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${W.line}`, borderRadius: 14, padding: "15px 16px" }}>
        <div style={{ fontWeight: 800, color: W.ink, fontSize: 14.5, marginBottom: 4 }}>📨 Send to all members {count != null && <span style={{ color: W.soft, fontWeight: 700, fontSize: 12.5 }}>· {count} members</span>}</div>
        <div style={{ fontSize: 12, color: W.soft, marginBottom: 12 }}>The email is wrapped in the Glasswings design automatically: your banner on top (if set), then your message, the community section and upcoming events.</div>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" style={{ ...ip3, marginBottom: 9 }} />
        <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={6} placeholder={"Your message…\n\nBlank lines become paragraphs."} style={{ ...ip3, resize: "vertical", fontFamily: "inherit", marginBottom: 11 }} />
        <button onClick={send} disabled={sending} style={{ ...btn(W.teal, "#fff"), width: "100%", justifyContent: "center", opacity: sending ? .6 : 1 }}>{sending ? "Sending… (can take a minute)" : "Send to all members"}</button>
        {result && <div style={{ marginTop: 10, fontSize: 13.5, fontWeight: 700, color: result.startsWith("✓") ? W.teal : "#C0392B" }}>{result}</div>}
      </div>
    </div>
  );
}
function AnalyticsPanel({ events, myEventsOnly, meId }) {
  const manageable = (events || []).filter(e => !myEventsOnly || e.host_id === meId);
  const [evId, setEvId] = useState("");
  const [a, setA] = useState(null);
  const [aErr, setAErr] = useState("");
  const [roster, setRoster] = useState(null);
  const ev = manageable.find(e => e.id === evId);
  const loadAll = (eid) => {
    supabase.rpc("event_ticket_analysis", { p_event: eid }).then(({ data, error }) => { setA(error ? null : data); setAErr(error ? (error.message || "Could not load analytics.") : ""); });
    supabase.rpc("event_member_list", { p_event: eid }).then(({ data, error }) => { if (!error) setRoster(data || []); });
  };
  useEffect(() => { if (!evId) { setA(null); setAErr(""); setRoster(null); return; } setA(undefined); setAErr(""); setRoster(null); loadAll(evId); }, [evId]);
  const waLink2 = ph => "https://wa.me/" + (ph || "").replace(/[^\d]/g, "").replace(/^0+/, "");
  const withdraw2 = (m) => {
    if (!window.confirm(`Withdraw ${m.full_name || "this member"}'s ticket${m.qty > 1 ? "s" : ""}?`)) return;
    supabase.rpc("withdraw_ticket", { p_event: evId, p_user: m.user_id }).then(({ error }) => error ? alert(error.message) : loadAll(evId));
  };
  const ip2 = { border: `1px solid ${W.line}`, borderRadius: 9, padding: "10px 12px", fontSize: 13.5, outline: "none", background: "#fff", color: W.ink };
  const money = n => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const Tile = ({ label, val, color }) => <div style={{ background: "#fff", border: `1px solid ${W.line}`, borderRadius: 12, padding: "11px 13px", flex: "1 1 90px", minWidth: 90 }}><div style={{ fontSize: 10, color: W.soft, fontWeight: 800, letterSpacing: .3 }}>{label}</div><div style={{ fontSize: 18, fontWeight: 800, color: color || W.ink, marginTop: 3 }}>{val}</div></div>;
  const total = a ? Number(a.paid_gross || 0) + Number(a.door_cash || 0) + Number(a.door_upi || 0) : 0;
  const ciRate = a && a.tickets ? Math.round((a.checked_in / a.tickets) * 100) : 0;
  const fill = a && a.total_capacity ? Math.round((a.tickets / a.total_capacity) * 100) : null;
  const maxDay = a && (a.sales_by_day || []).length ? Math.max(...a.sales_by_day.map(d => d.q)) : 0;
  return (
    <div style={{ padding: "16px 16px 40px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ fontWeight: 800, fontSize: 17, color: W.ink }}>📊 Analytics</div>
      <div style={{ fontSize: 12.5, color: W.soft, margin: "4px 0 14px" }}>Sales, revenue, check-ins and capacity for any of your events.</div>
      <select value={evId} onChange={e => setEvId(e.target.value)} style={{ ...ip2, width: "100%", marginBottom: 16 }}>
        <option value="">Choose event…</option>
        {manageable.map(e => <option key={e.id} value={e.id}>{e.title}{e.event_date ? ` · ${e.event_date}` : ""}</option>)}
      </select>
      {a === undefined && <Center>crunching numbers…</Center>}
      {a === null && evId && aErr && <div style={{ background: "#FBE9E7", border: "1px solid #F2C4C0", color: "#C0392B", borderRadius: 10, padding: "11px 14px", fontSize: 13 }}>⚠️ {aErr}</div>}
      {a === null && evId && !aErr && <Center>No data yet.</Center>}
      {a && (
        <>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 12 }}>
            <Tile label="MEMBERS" val={a.members} />
            <Tile label="TICKETS" val={a.tickets} />
            <Tile label="CHECKED IN" val={`${a.checked_in} · ${ciRate}%`} color={W.teal} />
            <Tile label="♂ / ♀" val={`${a.male} / ${a.female}`} />
          </div>

          <div style={{ background: "linear-gradient(135deg,#063b32,#0C1A16)", borderRadius: 14, padding: "15px 17px", color: "#fff", marginBottom: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: 1, color: "#2FD4A8", fontWeight: 800 }}>TOTAL COLLECTED</div>
            <div style={{ fontSize: 28, fontWeight: 900, margin: "2px 0 10px" }}>{money(total)}</div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5 }}>
              <span>🟢 Online (Razorpay): <b>{money(a.paid_gross)}</b></span>
              <span>💵 Door cash: <b>{money(a.door_cash)}</b></span>
              <span>📱 Door UPI: <b>{money(a.door_upi)}</b></span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 14 }}>
            <Tile label="ONLINE TICKETS" val={a.online_tickets} />
            <Tile label="DOOR ENTRIES" val={a.door_count} />
            <Tile label="COMP GUESTS" val={a.comp_count} />
            <Tile label="GUESTS IN" val={`${a.guests_in}/${a.guests}`} color="#7C3AED" />
          </div>

          <div style={{ background: "#fff", border: `1px solid ${W.line}`, borderRadius: 12, padding: "13px 15px", marginBottom: 14 }}>
            <div style={{ fontWeight: 800, color: W.ink, fontSize: 14, marginBottom: 10 }}>Audience</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, fontSize: 12.5 }}>
              <span>🆕 New: <b>{Math.max(0, (a.members || 0) - (a.returning || 0))}</b></span>
              <span>🔁 Returning: <b>{a.returning || 0}</b></span>
              <span>🎟️ Avg tickets/buyer: <b>{a.members ? (a.tickets / a.members).toFixed(1) : "—"}</b></span>
              <span>🧾 Paid orders: <b>{a.paid_orders || 0}</b>{a.paid_orders > 0 && <> · avg ₹{Math.round(Number(a.paid_gross || 0) / a.paid_orders).toLocaleString("en-IN")}</>}</span>
              <span>✅ In: ♂ <b>{a.ci_male || 0}</b> / ♀ <b>{a.ci_female || 0}</b></span>
            </div>
            {(a.age_groups || []).length > 0 && (() => { const mx = Math.max(...a.age_groups.map(g => g.c)); return (
              <div style={{ marginBottom: (a.areas || []).length ? 12 : 0 }}>
                <div style={{ fontSize: 11, color: W.soft, fontWeight: 800, marginBottom: 6 }}>AGE GROUPS (BUYERS)</div>
                {a.age_groups.map((g, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 56, fontSize: 12, color: W.ink, fontWeight: 700, flexShrink: 0 }}>{g.g}</span>
                    <div style={{ flex: 1, height: 9, borderRadius: 5, background: "#E2EBE8", overflow: "hidden" }}><div style={{ width: `${mx ? Math.max(4, Math.round((g.c / mx) * 100)) : 4}%`, height: "100%", background: "#7C3AED" }} /></div>
                    <span style={{ width: 22, fontSize: 12, color: W.soft, fontWeight: 700, textAlign: "right" }}>{g.c}</span>
                  </div>
                ))}
              </div>
            ); })()}
            {(a.areas || []).length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: W.soft, fontWeight: 800, marginBottom: 6 }}>TOP AREAS</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {a.areas.map((ar, i) => <span key={i} style={{ background: "#F4FAF8", border: `1px solid ${W.line}`, borderRadius: 14, padding: "4px 11px", fontSize: 12, fontWeight: 700, color: W.ink }}>{ar.name} <span style={{ color: W.soft }}>· {ar.c}</span></span>)}
                </div>
              </div>
            )}
          </div>
          {fill != null && (
            <div style={{ background: "#fff", border: `1px solid ${W.line}`, borderRadius: 12, padding: "13px 15px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}><span style={{ fontWeight: 800, color: W.ink }}>Capacity filled</span><span style={{ fontWeight: 800, color: fill >= 90 ? "#C0392B" : W.teal }}>{a.tickets} / {a.total_capacity} · {fill}%</span></div>
              <div style={{ height: 9, borderRadius: 6, background: "#E2EBE8", overflow: "hidden" }}><div style={{ width: `${Math.min(100, fill)}%`, height: "100%", background: fill >= 90 ? "#C0392B" : W.teal }} /></div>
            </div>
          )}

          {(a.types || []).length > 0 && (
            <div style={{ background: "#fff", border: `1px solid ${W.line}`, borderRadius: 12, padding: "13px 15px", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, color: W.ink, fontSize: 14, marginBottom: 10 }}>By ticket type</div>
              {a.types.map((t, i) => {
                const cap = t.capacity != null && t.capacity !== "" ? Number(t.capacity) : null;
                const pct = cap ? Math.min(100, Math.round((t.sold / cap) * 100)) : null;
                return (
                  <div key={i} style={{ marginBottom: 9 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, color: W.ink }}>{t.name} <span style={{ color: W.soft, fontWeight: 600 }}>· ₹{t.price}</span></span>
                      <span style={{ color: W.soft, fontWeight: 700 }}>{t.sold}{cap ? ` / ${cap}` : " sold"} · {money(t.revenue)}</span>
                    </div>
                    {cap && <div style={{ height: 7, borderRadius: 5, background: "#E2EBE8", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: pct >= 90 ? "#C0392B" : W.teal }} /></div>}
                  </div>
                );
              })}
              {Number(a.base_sold) > 0 && <div style={{ fontSize: 12, color: W.soft }}>+ {a.base_sold} standard (base) ticket{a.base_sold > 1 ? "s" : ""}</div>}
            </div>
          )}

          {(a.sales_by_day || []).length > 0 && (
            <div style={{ background: "#fff", border: `1px solid ${W.line}`, borderRadius: 12, padding: "13px 15px" }}>
              <div style={{ fontWeight: 800, color: W.ink, fontSize: 14, marginBottom: 12 }}>Sales trend (last 3 weeks)</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 110 }}>
                {a.sales_by_day.map((d, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ fontSize: 10.5, color: W.soft, fontWeight: 700, marginBottom: 3 }}>{d.q}</div>
                    <div style={{ height: maxDay ? Math.max(4, Math.round((d.q / maxDay) * 78)) : 4, background: W.teal, borderRadius: 4 }} />
                    <div style={{ fontSize: 9.5, color: W.soft, marginTop: 4, whiteSpace: "nowrap" }}>{d.d}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {evId && roster !== null && (
        <div style={{ background: "#fff", border: `1px solid ${W.line}`, borderRadius: 12, padding: "13px 15px", marginTop: 14 }}>
          <div style={{ fontWeight: 800, color: W.ink, fontSize: 14, marginBottom: 6 }}>👥 Members ({roster.length})</div>
          {roster.length === 0 ? <div style={{ fontSize: 13, color: W.soft }}>No ticket holders yet.</div> : roster.map(m => (
            <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${W.line}` }}>
              <PersonAvatar url={m.avatar_url} name={m.full_name} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: W.ink, fontSize: 13.5 }}>{m.full_name || "—"} {m.checked_in && <span style={{ background: "#E7F6EF", color: W.teal, fontSize: 9.5, fontWeight: 800, padding: "1px 6px", borderRadius: 8 }}>✓ IN</span>}</div>
                <div style={{ fontSize: 11.5, color: W.soft }}>{m.types || "Standard"} ×{m.qty}{m.phone ? ` · ${m.phone}` : ""}</div>
              </div>
              {m.phone && <a href={waLink2(m.phone)} target="_blank" rel="noreferrer" title="WhatsApp" style={{ ...btn("#25D366", "#fff"), padding: "5px 8px", fontSize: 11, textDecoration: "none" }}><MessageCircle size={12} /></a>}
              <button onClick={() => withdraw2(m)} title="Withdraw ticket" style={{ background: "none", border: "none", color: "#C0392B", cursor: "pointer", padding: 4 }}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function QrScanner({ onCode }) {
  const vref = useRef(); const [err, setErr] = useState("");
  useEffect(() => {
    let stream, raf, stop = false;
    (async () => {
      try {
        if (!("BarcodeDetector" in window)) { setErr("This browser can't scan QR — type the code below instead."); return; }
        const det = new window.BarcodeDetector({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!vref.current) { stream.getTracks().forEach(t => t.stop()); return; }
        vref.current.srcObject = stream; await vref.current.play();
        const tick = async () => {
          if (stop) return;
          try { const cs = await det.detect(vref.current); if (cs && cs.length && cs[0].rawValue) onCode(cs[0].rawValue); } catch (e2) {}
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e2) { setErr("Camera unavailable — allow camera permission, or type the code below."); }
    })();
    return () => { stop = true; if (raf) cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, []);
  return err
    ? <div style={{ background: "#FFF6E5", border: "1px solid #F2DFB8", color: "#9A6B00", borderRadius: 10, padding: "10px 13px", fontSize: 13 }}>📷 {err}</div>
    : <div style={{ textAlign: "center" }}><video ref={vref} muted playsInline style={{ width: "100%", maxWidth: 340, borderRadius: 14, background: "#000", aspectRatio: "3/4", objectFit: "cover" }} /><div style={{ fontSize: 12, color: W.soft, marginTop: 6 }}>Point the camera at the ticket QR</div></div>;
}
function DoorCheckin({ events, ticketTypes, myEventsOnly, meId, onUpdateEvent }) {
  const manageable = (events || []).filter(e => !myEventsOnly || e.host_id === meId);
  const [evId, setEvId] = useState("");
  const ev = manageable.find(e => e.id === evId);
  const [scanOn, setScanOn] = useState(false);
  const [manual, setManual] = useState("");
  const [res, setRes] = useState(null);
  const [log, setLog] = useState([]);
  const lastRef = useRef({ code: "", t: 0 });
  const check = async (raw) => {
    const code = (raw || "").trim(); if (!code || !ev) return;
    const now = Date.now();
    if (lastRef.current.code === code.toUpperCase() && now - lastRef.current.t < 4000) return;
    lastRef.current = { code: code.toUpperCase(), t: now };
    const { data, error } = await supabase.rpc("checkin_by_code", { p_event: ev.id, p_code: code });
    const r = error ? { status: "error", name: error.message } : { ...(data || { status: "notfound" }) };
    r.code = code.toUpperCase(); r.time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    setRes(r); setLog(l => [r, ...l].slice(0, 30)); setManual("");
    if (navigator.vibrate) try { navigator.vibrate(r.status === "ok" ? 90 : [60, 60, 60]); } catch (e2) {}
  };
  const [saleOpen, setSaleOpen] = useState(false);
  const [sName, setSName] = useState(""); const [sPhone, setSPhone] = useState(""); const [sQty, setSQty] = useState("1");
  const [sType, setSType] = useState(""); const [sMethod, setSMethod] = useState("cash"); const [sAmt, setSAmt] = useState("0");
  const [sBusy, setSBusy] = useState(false); const [sDone, setSDone] = useState(null);
  const types = ev ? (ticketTypes[ev.id] || []) : [];
  const selType = types.find(t => t.id === sType);
  useEffect(() => { const unit = selType ? (selType.price || 0) : 0; setSAmt(String(unit * (Number(sQty) || 1))); }, [sType, sQty]);
  useEffect(() => {
    if (!sType) return;
    setSMethod("upi");
    const ti = types.findIndex(t => t.id === sType);
    if (ti >= 0 && qrs.length) { const q = qrs[Math.min(ti, qrs.length - 1)]; if (q) setQrSel(q.id); }
  }, [sType]);
  const submitSale = async () => {
    if (!sName.trim()) return alert("Buyer name is required.");
    setSBusy(true);
    const { data, error } = await supabase.rpc("door_sale", { p_event: ev.id, p_name: sName, p_phone: sPhone, p_type: selType ? selType.name : "Door entry", p_qty: Number(sQty) || 1, p_method: sMethod, p_amount: Number(sAmt) || 0 });
    setSBusy(false);
    if (error) return alert(error.message);
    setSDone({ code: data && data.code, name: sName.trim(), qty: Number(sQty) || 1, phone: sPhone });
    setSName(""); setSPhone(""); setSQty("1");
  };
  const [qrs, setQrs] = useState([]); const [qrSel, setQrSel] = useState("");
  const loadQrs = (eid) => supabase.rpc("event_payment_qrs", { p_event: eid }).then(({ data, error }) => { if (!error) { setQrs(data || []); setQrSel(c => (data || []).some(q => q.id === c) ? c : ((data && data[0] && data[0].id) || "")); } });
  useEffect(() => { if (evId) loadQrs(evId); else { setQrs([]); setQrSel(""); } }, [evId]);
  const selQr = qrs.find(q => q.id === qrSel);
  const uploadQr = async (file) => {
    if (!file) return;
    if (qrs.length >= 5) { alert("You can save up to 5 payment QRs."); return; }
    const label = window.prompt("Label for this QR (e.g. GPay / PhonePe / Account 2):", "") || "";
    try {
      const url = await uploadPhoto(meId, file);
      const { data, error } = await supabase.rpc("add_payment_qr", { p_event: ev.id, p_label: label, p_url: url });
      if (error) throw error;
      await loadQrs(ev.id); if (data) setQrSel(data);
    } catch (e2) { alert(e2.message || "Upload failed"); }
  };
  const removeQr = async (q) => {
    if (!window.confirm(`Remove payment QR${q.label ? ` "${q.label}"` : ""}?`)) return;
    const { error } = await supabase.rpc("delete_payment_qr", { p_id: q.id });
    if (error) return alert(error.message);
    loadQrs(ev.id);
  };
  const stStyle = st => st === "ok" ? ["#E7F6EF", W.teal, "✓ ADMITTED"] : st === "already" ? ["#FFF6E5", "#9A6B00", "⚠ ALREADY CHECKED IN"] : ["#FBE9E7", "#C0392B", st === "error" ? "✕ ERROR" : "✕ NOT FOUND"];
  const ip2 = { border: `1px solid ${W.line}`, borderRadius: 9, padding: "10px 12px", fontSize: 13.5, outline: "none", background: "#fff", color: W.ink };
  return (
    <div style={{ padding: "16px 16px 40px", maxWidth: 620, margin: "0 auto" }}>
      <div style={{ fontWeight: 800, fontSize: 17, color: W.ink }}>🎫 Door check-in</div>
      <div style={{ fontSize: 12.5, color: W.soft, margin: "4px 0 14px" }}>Scan ticket QRs to admit, or sell at the door with cash / your UPI QR.</div>
      <select value={evId} onChange={e => { setEvId(e.target.value); setRes(null); setLog([]); setScanOn(false); setSaleOpen(false); setSDone(null); }} style={{ ...ip2, width: "100%", marginBottom: 14 }}>
        <option value="">Choose event…</option>
        {manageable.map(e => <option key={e.id} value={e.id}>{e.title}{e.event_date ? ` · ${e.event_date}` : ""}</option>)}
      </select>
      {ev && (
        <>
          <div style={{ display: "flex", gap: 9, marginBottom: 12 }}>
            <button onClick={() => { setScanOn(v => !v); setSaleOpen(false); }} style={{ ...btn(scanOn ? W.ink : W.teal, "#fff"), flex: 1, justifyContent: "center" }}>📷 {scanOn ? "Stop scanning" : "Scan tickets"}</button>
            <button onClick={() => { setSaleOpen(v => !v); setScanOn(false); setSDone(null); }} style={{ ...btn(saleOpen ? W.ink : "#7C3AED", "#fff"), flex: 1, justifyContent: "center" }}>💵 Door sale</button>
          </div>
          {scanOn && <div style={{ marginBottom: 12 }}><QrScanner onCode={check} /></div>}
          {!saleOpen && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input value={manual} onChange={e => setManual(e.target.value)} placeholder="Or type code (GW-… / guest code)" style={{ ...ip2, flex: 1, minWidth: 0, fontFamily: "ui-monospace,monospace" }} onKeyDown={e => { if (e.key === "Enter") check(manual); }} />
              <button onClick={() => check(manual)} style={{ ...btn(W.teal, "#fff"), padding: "10px 18px" }}>Check</button>
            </div>
          )}
          {res && !saleOpen && (() => { const [bg, c, label] = stStyle(res.status); return (
            <div style={{ background: bg, border: `1.5px solid ${c}`, borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ fontWeight: 900, color: c, fontSize: 15, letterSpacing: .5 }}>{label}</div>
              {res.status !== "notfound" && <div style={{ fontWeight: 800, color: W.ink, fontSize: 17, marginTop: 4 }}>{res.name}</div>}
              {(res.status === "ok" || res.status === "already") && <div style={{ fontSize: 13, color: W.soft, marginTop: 2 }}>{res.kind === "guest" ? "Guest" : "Member"} · {res.info || ""} · {res.qty} entr{res.qty === 1 ? "y" : "ies"} · {res.code}</div>}
              {res.status === "notfound" && <div style={{ fontSize: 13, color: W.soft, marginTop: 4 }}>Code {res.code} isn't valid for this event.</div>}
            </div>
          ); })()}
          {saleOpen && (
            <div style={{ background: "#F7F4FD", border: "1px solid #E2D9F6", borderRadius: 14, padding: "14px 15px", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, color: "#5B21B6", fontSize: 14.5, marginBottom: 10 }}>💵 Sell at the door</div>
              {sDone ? (
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <div style={{ fontWeight: 800, color: W.teal, fontSize: 16 }}>✓ Sold & checked in</div>
                  <div style={{ fontSize: 14, color: W.ink, marginTop: 4 }}>{sDone.name} · {sDone.qty} entr{sDone.qty === 1 ? "y" : "ies"} · code <b style={{ fontFamily: "ui-monospace,monospace" }}>{sDone.code}</b></div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
                    <button onClick={async () => {
                      const text = `🎟️ ${ev.title}\nYour ticket — show the QR at the door.\nCode: ${sDone.code}\nTicket: https://glass-wings.com/?gt=${sDone.code}\n— Glasswings Events`;
                      try {
                        const blob = await makeTicketBlob({ emoji: "🎟️", title: ev.title, dateStr: ev.event_date, place: [ev.venue, ev.city].filter(Boolean).join(", "), name: sDone.name, qty: sDone.qty, code: sDone.code });
                        const file = new File([blob], "glasswings-ticket.png", { type: "image/png" });
                        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: ev.title, text }); return; }
                      } catch (e2) {}
                      window.open(`https://wa.me/${(sDone.phone || "").replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}`, "_blank");
                    }} style={{ ...btn("#25D366", "#fff"), fontSize: 13 }}>Send ticket on WhatsApp</button>
                    <button onClick={() => setSDone(null)} style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, fontSize: 13 }}>+ Next sale</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 7 }}>
                    <input value={sName} onChange={e => setSName(e.target.value)} placeholder="Buyer name *" style={{ ...ip2, flex: "1 1 130px" }} />
                    <input value={sPhone} onChange={e => setSPhone(e.target.value)} placeholder="Phone (for WhatsApp ticket)" inputMode="tel" style={{ ...ip2, flex: "1 1 130px" }} />
                  </div>
                  <div style={{ display: "flex", gap: 7, marginBottom: 7 }}>
                    <select value={sType} onChange={e => setSType(e.target.value)} style={{ ...ip2, flex: 1, minWidth: 0 }}>
                      <option value="">{types.length ? "Ticket type…" : "Door entry"}</option>
                      {types.map(t => <option key={t.id} value={t.id}>{t.name} — ₹{t.price}</option>)}
                    </select>
                    <input value={sQty} onChange={e => setSQty(e.target.value.replace(/\D/g, ""))} placeholder="Qty" inputMode="numeric" style={{ ...ip2, width: 56, textAlign: "center" }} />
                  </div>
                  <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", borderRadius: 9, overflow: "hidden", border: `1px solid ${W.line}` }}>
                      <button onClick={() => setSMethod("cash")} style={{ border: "none", padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: sMethod === "cash" ? W.teal : "#fff", color: sMethod === "cash" ? "#fff" : W.soft }}>💵 Cash</button>
                      <button onClick={() => setSMethod("upi")} style={{ border: "none", padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: sMethod === "upi" ? W.teal : "#fff", color: sMethod === "upi" ? "#fff" : W.soft }}>📱 UPI QR</button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                      <span style={{ color: W.soft, fontWeight: 700 }}>₹</span>
                      <input value={sAmt} onChange={e => setSAmt(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" style={{ ...ip2, width: "100%", fontWeight: 800 }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: W.soft, marginTop: -4, marginBottom: 10 }}>Amount includes processing fee.</div>
                  {sMethod === "upi" && (
                    <div style={{ textAlign: "center", background: "#fff", border: `1px solid ${W.line}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                      {qrs.length > 1 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 10 }}>
                          {qrs.map((q, i) => (
                            <button key={q.id} onClick={() => setQrSel(q.id)} style={{ border: `1.5px solid ${q.id === qrSel ? W.teal : W.line}`, background: q.id === qrSel ? "#E7F6EF" : "#fff", color: q.id === qrSel ? W.teal : W.soft, fontWeight: 800, fontSize: 12, padding: "6px 12px", borderRadius: 18, cursor: "pointer" }}>{q.label || `QR ${i + 1}`}</button>
                          ))}
                        </div>
                      )}
                      {selQr ? (
                        <>
                          <img src={selQr.url} alt="Payment QR" style={{ width: 210, maxWidth: "100%", borderRadius: 8 }} />
                          <div style={{ fontSize: 12.5, color: W.ink, fontWeight: 700, marginTop: 6 }}>{selQr.label || "UPI"} — buyer scans this to pay ₹{sAmt || 0}</div>
                          <div style={{ fontSize: 12, color: W.soft, marginTop: 5 }}>
                            <label style={{ color: W.teal, fontWeight: 700, cursor: "pointer" }}>+ Add another QR<input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { uploadQr(e.target.files && e.target.files[0]); e.target.value = ""; }} /></label>
                            {" · "}
                            <span onClick={() => removeQr(selQr)} style={{ color: "#C0392B", fontWeight: 700, cursor: "pointer" }}>Remove this QR</span>
                          </div>
                        </>
                      ) : (
                        <label style={{ display: "block", cursor: "pointer", padding: "16px 10px", border: `2px dashed ${W.line}`, borderRadius: 10, color: W.soft, fontSize: 13.5, fontWeight: 700 }}>
                          📤 Upload the organiser's UPI payment QR
                          <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { uploadQr(e.target.files && e.target.files[0]); e.target.value = ""; }} />
                        </label>
                      )}
                    </div>
                  )}
                  <button onClick={submitSale} disabled={sBusy} style={{ ...btn("#7C3AED", "#fff"), width: "100%", justifyContent: "center", opacity: sBusy ? .6 : 1 }}>{sBusy ? "Saving…" : `Mark ${sMethod === "upi" ? "UPI" : "cash"} received — admit`}</button>
                </>
              )}
            </div>
          )}
          {log.length > 0 && !saleOpen && (
            <div>
              <div style={{ fontSize: 12, color: W.soft, fontWeight: 800, marginBottom: 6 }}>RECENT SCANS</div>
              {log.map((r, i) => { const [, c, label] = stStyle(r.status); return (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, padding: "6px 0", borderTop: `1px solid ${W.line}` }}>
                  <span style={{ color: c, fontWeight: 800, width: 84, flexShrink: 0 }}>{label.replace(/[✓⚠✕] /, "")}</span>
                  <span style={{ flex: 1, minWidth: 0, color: W.ink, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name || r.code}</span>
                  <span style={{ color: W.soft }}>{r.time}</span>
                </div>
              ); })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
function Admin({ caps, isSuper, myCity, perms, onSavePerm, onSetRoles, rooms, events, categories, cities, ticketTypes, counts, onCreateRoom, onUpdateRoom, onDeleteRoom, onCreateEvent, onUpdateEvent, onDeleteEvent, onAddOption, onDelOption, perksList, onAddPerk, onDelPerk, addonsMap, onAddAddon, onDelAddon, onAddTicketType, onDelTicketType, onBroadcast, onBroadcastEvent, onSendDM, onSendEventDM, onGrantRoom, onRemoveRoom, onOpenThread, onSetOptionImage , myEventsOnly, meId, canApprove, dims, optsAll, onReload }) {
  const tabs = [
    ...((isSuper || caps.analytics) ? [["dash", "Dashboard"]] : []),
    ...(caps.rooms ? [["rooms", "Rooms"]] : []),
    ...(caps.host ? [["events", "Events"]] : []),
    ...(caps.broadcast ? [["broadcast", "Send"]] : []),
    ...(caps.members ? [["inbox", "Inbox"], ["members", "Members"]] : []),
    ...(isSuper ? [["team", "Team"]] : []),
    ...((canApprove || caps.host) ? [["door", "Door"]] : []),
    ...((canApprove || caps.host) ? [["analytics", "Analytics"]] : []),
    ...(isSuper ? [["emailmkt", "Email"]] : []),
    ...((canApprove || caps.host) ? [["settle", "Payouts"]] : []),
    ...(canApprove ? [["filters", "Filters"]] : []),
  ];
  const [seg, setSeg] = useState(tabs[0]?.[0] || "none");
  if (!tabs.length) return <div><TopBar title="Staff" /><Center>You don't have any staff tools enabled yet.</Center></div>;
  return (
    <div>
      <TopBar title={isSuper ? "Superadmin Panel" : "Staff Panel"} />
      {myCity && !isSuper && <div style={{ background: "#FEF3C7", color: "#92400E", fontSize: 12.5, fontWeight: 600, padding: "7px 14px", textAlign: "center" }}>Scoped to {myCity}</div>}
      <div style={{ display: "flex", background: "#fff", borderBottom: `1px solid ${W.line}`, position: "sticky", top: 53, zIndex: 9, overflowX: "auto" }}>
        {tabs.map(([v, l]) => (
          <button key={v} onClick={() => setSeg(v)} style={{ flex: "1 0 auto", padding: "13px 14px", border: "none", background: "none", cursor: "pointer", fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap", color: seg === v ? W.teal : W.soft, borderBottom: `3px solid ${seg === v ? W.teal : "transparent"}` }}>{l}</button>
        ))}
      </div>
      {seg === "rooms" ? <AdminRooms rooms={(isSuper || !myCity) ? rooms : rooms.filter(r => r.city === myCity)} cities={cities} lockCity={!isSuper ? myCity : null} onCreate={onCreateRoom} onUpdate={onUpdateRoom} onDelete={onDeleteRoom} isSuper={isSuper} />
        : seg === "dash" ? <Dashboard />
        : seg === "filters" ? <FiltersPanel categories={categories} cities={cities} dims={dims} optsAll={optsAll} onAddOption={onAddOption} onDelOption={onDelOption} onSetOptionImage={onSetOptionImage} onChanged={onReload} />
        : seg === "door" ? <DoorCheckin events={events} ticketTypes={ticketTypes} myEventsOnly={myEventsOnly} meId={meId} onUpdateEvent={onUpdateEvent} />
        : seg === "analytics" ? <AnalyticsPanel events={events} myEventsOnly={myEventsOnly} meId={meId} />
        : seg === "emailmkt" ? <EmailMarketingPanel meId={meId} />
        : seg === "settle" ? <SettlementsPanel isSuper={isSuper} />
        : seg === "events" ? <AdminEvents canApprove={canApprove} dims={dims} optsAll={optsAll} events={myEventsOnly ? events.filter(ev => ev.host_id === meId) : events} categories={categories} cities={cities} ticketTypes={ticketTypes} rooms={rooms} lockCity={!isSuper ? myCity : null} perksList={perksList} onAddPerk={onAddPerk} onDelPerk={onDelPerk} addonsMap={addonsMap} onAddAddon={onAddAddon} onDelAddon={onDelAddon} onCreate={onCreateEvent} onUpdate={onUpdateEvent} onDelete={onDeleteEvent} onAddOption={onAddOption} onDelOption={onDelOption} onSetOptionImage={onSetOptionImage} onAddTicketType={onAddTicketType} onDelTicketType={onDelTicketType} onBroadcastEvent={onBroadcastEvent} onSendEventDM={onSendEventDM} />
          : seg === "broadcast" ? <AdminBroadcast events={events} onBroadcast={onBroadcast} onBroadcastEvent={onBroadcastEvent} onSendDM={onSendDM} onSendEventDM={onSendEventDM} />
            : seg === "inbox" ? <AdminInbox onOpenThread={onOpenThread} />
              : seg === "team" ? <TeamPanel perms={perms} onSavePerm={onSavePerm} onSetRoles={onSetRoles} cities={cities} />
                : <AdminMembers onSendDM={onSendDM} rooms={rooms} events={events} onGrantRoom={onGrantRoom} onRemoveRoom={onRemoveRoom} canAdd={caps.add} canRemove={caps.remove} canEdit={caps.editMembers} canStamps={caps.stamps} isSuper={isSuper} cities={cities} onSetRoles={onSetRoles} />}
    </div>
  );
}
const ROLE_BADGE = { superadmin: { t: "Super Admin", c: "#7C3AED", bg: "#EFEAFB" }, admin: { t: "Admin", c: W.teal, bg: "#E7F6EF" }, subadmin: { t: "Sub-admin", c: "#0369A1", bg: "#E0F2FE" }, organiser: { t: "Organiser", c: "#B45309", bg: "#FEF3C7" }, promoter: { t: "Promoter", c: "#BE185D", bg: "#FCE7F3" }, member: null };
function RoleBadges({ roles }) {
  const rs = (roles || []).filter(r => ROLE_BADGE[r]);
  if (!rs.length) return null;
  return <>{rs.map(r => { const b = ROLE_BADGE[r]; return <span key={r} style={{ background: b.bg, color: b.c, fontSize: 10.5, fontWeight: 800, padding: "2px 7px", borderRadius: 10 }}>{b.t}</span>; })}</>;
}
const CAP_LIST = [["can_rooms", "Manage rooms"], ["can_host", "Host events"], ["can_analytics", "See their event analytics"], ["can_broadcast", "Send broadcasts"], ["can_view_members", "View members"], ["can_edit_members", "Edit member profiles"], ["can_stamps", "Award stamps"], ["can_add", "Add members to rooms"], ["can_remove", "Remove members from rooms"], ["show_age", "See age"], ["show_area", "See area"], ["show_city", "See city"], ["show_profession", "See profession"]];
function StampBadge({ count, size = "sm" }) {
  const n = count || 0; const tier = Math.floor(n / 5);
  const big = size === "lg";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#FEF6E0", color: "#B45309", fontWeight: 800, fontSize: big ? 15 : 11.5, padding: big ? "5px 11px" : "2px 8px", borderRadius: 12 }}>★ {n}</span>
      {tier > 0 && <span style={{ background: "#EFEAFB", color: "#7C3AED", fontWeight: 800, fontSize: big ? 13 : 10.5, padding: big ? "5px 10px" : "2px 7px", borderRadius: 12 }}>Tier {tier}</span>}
    </span>
  );
}
const STAFF_ROLES = ["admin", "subadmin", "organiser", "promoter"];
function TeamPanel({ perms, onSavePerm, onSetRoles, cities }) {
  const [list, setList] = useState(null);
  const [view, setView] = useState("roles"); // roles | stats | matrix
  const [tstats, setTstats] = useState([]);
  useEffect(() => { supabase.rpc("staff_stats").then(({ data }) => setTstats(data || [])); }, []);
  const [draft, setDraft] = useState({}); // memberId -> {roles:Set, city}
  const reload = () => supabase.rpc("staff_directory").then(({ data }) => setList(data || []));
  useEffect(() => { reload(); }, []);
  const permOf = r => perms.find(p => p.role === r) || {};
  const sel = { padding: "8px 10px", borderRadius: 9, border: `1px solid ${W.line}`, background: "#fff", fontSize: 13, color: W.ink, outline: "none" };
  const getDraft = m => draft[m.id] || { roles: new Set((m.roles || []).filter(r => STAFF_ROLES.includes(r))), city: m.staff_city || "", comm: m.commission_pct ?? "" };
  const setD = (id, patch) => setDraft(d => ({ ...d, [id]: { ...getDraftFor(id), ...patch } }));
  const getDraftFor = id => { const m = (list || []).find(x => x.id === id) || {}; return draft[id] || { roles: new Set((m.roles || []).filter(r => STAFF_ROLES.includes(r))), city: m.staff_city || "", comm: m.commission_pct ?? "" }; };
  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["roles", "Team"], ["stats", "Analytics"], ["matrix", "Permissions"]].map(([v, l]) => <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${view === v ? W.teal : W.line}`, background: view === v ? W.teal : "#fff", color: view === v ? "#fff" : W.soft, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>{l}</button>)}
      </div>

      {view === "matrix" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12.5, color: W.soft }}>Set what each role can do. Phone numbers stay private to you, always.</div>
          {STAFF_ROLES.map(r => {
            const p = permOf(r); const b = ROLE_BADGE[r];
            return (
              <div key={r} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: 14 }}>
                <div style={{ marginBottom: 8 }}><span style={{ background: b.bg, color: b.c, fontSize: 12, fontWeight: 800, padding: "3px 9px", borderRadius: 10 }}>{b.t}</span></div>
                {CAP_LIST.map(([k, label]) => (
                  <label key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderTop: `1px solid ${W.line}`, cursor: "pointer" }}>
                    <span style={{ fontSize: 13.5, color: W.ink }}>{label}</span>
                    <input type="checkbox" checked={!!p[k]} onChange={e => onSavePerm(r, { [k]: e.target.checked })} />
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      ) : view === "stats" ? (
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}` }}>
          <div style={{ padding: "13px 14px 4px", fontWeight: 700, color: W.ink }}>Team analytics</div>
          <div style={{ padding: "0 14px 8px", fontSize: 12.5, color: W.soft }}>Events hosted and total attendance brought in by each team member.</div>
          {tstats.length === 0 ? <div style={{ padding: 14 }}><Center>No team activity yet.</Center></div> : tstats.map((st, i) => (
            <div key={st.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderTop: `1px solid ${W.line}` }}>
              <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><span style={{ fontWeight: 700, color: W.ink, fontSize: 14 }}>{st.full_name || "—"}</span><RoleBadges roles={st.roles} /></div>
              <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                <span style={{ color: W.soft }}>Hosted <b style={{ color: W.ink }}>{st.hosted}</b></span>
                <span style={{ color: W.soft }}>Attended <b style={{ color: W.ink }}>{st.attended}</b></span>
              </div>
            </div>
          ))}
        </div>
      ) : list === null ? <Center>loading…</Center> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12.5, color: W.soft }}>Your team. To promote a member to a role, use the Members tab.</div>
          {list.filter(m => (m.roles || []).some(r => r === "superadmin" || STAFF_ROLES.includes(r))).map(m => {
            const d = getDraft(m);
            const isSuperM = (m.roles || []).includes("superadmin");
            return (
              <div key={m.id} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <PersonAvatar url={m.avatar_url} name={m.full_name} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: W.ink, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>{m.full_name || "—"} <RoleBadges roles={m.roles} /></div>
                  </div>
                </div>
                {isSuperM ? <div style={{ fontSize: 12.5, color: W.soft, marginTop: 8 }}>That's you — the superadmin.</div> : (
                  <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
                      {STAFF_ROLES.map(r => { const on = d.roles.has(r); return (
                        <button key={r} onClick={() => { const ns = new Set(d.roles); on ? ns.delete(r) : ns.add(r); setD(m.id, { roles: ns }); }} style={{ padding: "6px 12px", borderRadius: 16, border: `1px solid ${on ? W.teal : W.line}`, background: on ? W.teal : "#fff", color: on ? "#fff" : W.soft, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>{ROLE_BADGE[r].t}</button>
                      ); })}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <select value={d.city} onChange={e => setD(m.id, { city: e.target.value })} style={{ ...sel, flex: "1 1 120px" }}>
                        <option value="">All cities</option>
                        {(cities || []).map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
                      </select>
                      {d.roles.has("promoter") && <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input value={d.comm} onChange={e => setD(m.id, { comm: e.target.value.replace(/[^\d.]/g, "") })} placeholder="0" inputMode="decimal" style={{ ...sel, width: 56 }} /><span style={{ fontSize: 13, color: W.soft }}>% comm</span>
                      </div>}
                      <button onClick={async () => { await onSetRoles(m.id, Array.from(d.roles), d.city); if (d.roles.has("promoter")) await supabase.rpc("set_commission", { p_user: m.id, p_pct: Number(d.comm) || 0 }); reload(); }} style={btn(W.teal, "#fff")}>Save</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
function AdminInbox({ onOpenThread }) {
  const [threads, setThreads] = useState(null);
  useEffect(() => {
    (async () => {
      const { data: msgs } = await supabase.from("messages").select("group_id, body, created_at, sender_id, media_type").eq("group_type", "dm").order("created_at", { ascending: false });
      const seen = {}; const order = [];
      (msgs || []).forEach(m => { if (!seen[m.group_id]) { seen[m.group_id] = m; order.push(m.group_id); } });
      const ids = order;
      let profById = {};
      if (ids.length) { const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids); (profs || []).forEach(p => { profById[p.id] = p; }); }
      setThreads(order.map(id => ({ id, last: seen[id], p: profById[id] || {} })));
    })();
  }, []);
  if (threads === null) return <Center>loading inbox…</Center>;
  if (!threads.length) return <Center>No member messages yet. Send one from Send or Members.</Center>;
  return (
    <div>
      {threads.map(t => {
        const preview = t.last.media_type === "event" ? "🎟️ Event card" : (t.last.body || "");
        return (
          <div key={t.id} onClick={() => onOpenThread(t.id, t.p.full_name || "Member")} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 16px", background: "#fff", cursor: "pointer", borderBottom: `1px solid ${W.line}` }}>
            <PersonAvatar url={t.p.avatar_url} name={t.p.full_name} size={46} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: W.ink }}>{t.p.full_name || "Member"}</div>
              <div style={{ fontSize: 13.5, color: W.soft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</div>
            </div>
            <span style={{ fontSize: 11, color: W.soft, flexShrink: 0 }}>{fmtTime(t.last.created_at)}</span>
          </div>
        );
      })}
    </div>
  );
}
function AdminBroadcast({ events, onBroadcast, onBroadcastEvent, onSendDM, onSendEventDM }) {
  const [t, setT] = useState(""); const [sending, setSending] = useState(false);
  const [evId, setEvId] = useState(""); const [members, setMembers] = useState(null);
  const [g, setG] = useState("all"); const [age, setAge] = useState("all"); const [prof, setProf] = useState("all"); const [city, setCity] = useState("all");
  useEffect(() => {
    supabase.from("profiles").select("id, gender, member_details(age, profession, city)").then(({ data }) => setMembers(data || []));
  }, []);
  const send = async () => { if (!t.trim()) return; setSending(true); await onBroadcast(t); setT(""); setSending(false); };
  const sendEvent = async () => { const e = (events || []).find(x => x.id === evId); if (e) await onBroadcastEvent(e); };

  const det = m => m.member_details || {};
  const ageBand = a => { a = Number(a); if (!a) return null; if (a < 25) return "18-24"; if (a < 35) return "25-34"; if (a < 45) return "35-44"; return "45+"; };
  const ms = members || [];
  const profs = Array.from(new Set(ms.map(m => det(m).profession).filter(Boolean))).sort();
  const cities = Array.from(new Set(ms.map(m => det(m).city).filter(Boolean))).sort();
  const seg = ms.filter(m => {
    const d = det(m);
    if (g !== "all" && m.gender !== g) return false;
    if (age !== "all" && ageBand(d.age) !== age) return false;
    if (prof !== "all" && d.profession !== prof) return false;
    if (city !== "all" && d.city !== city) return false;
    return true;
  });
  const sendSegment = async () => { if (!t.trim() || !seg.length) return; setSending(true); await onSendDM(seg.map(m => m.id), t); setT(""); setSending(false); };
  const sel = { padding: "8px 10px", borderRadius: 9, border: `1px solid ${W.line}`, background: "#fff", fontSize: 13, color: W.ink, outline: "none" };
  const chip = (v, label) => <button key={v} onClick={() => setG(v)} style={{ padding: "7px 13px", borderRadius: 18, border: `1px solid ${g === v ? W.teal : W.line}`, background: g === v ? W.teal : "#fff", color: g === v ? "#fff" : W.soft, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{label}</button>;
  const card = { background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: 16, marginBottom: 12 };

  return (
    <div style={{ padding: 14 }}>
      <div style={card}>
        <div style={{ fontWeight: 700, color: W.ink, marginBottom: 6 }}>Send an event to all groups</div>
        <div style={{ fontSize: 13, color: W.soft, marginBottom: 12, lineHeight: 1.45 }}>Posts the event's card (with its banner/video) into every room chat.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={evId} onChange={e => setEvId(e.target.value)} style={{ ...sel, flex: 1, minWidth: 0 }}>
            <option value="">Choose an event…</option>
            {(events || []).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          <button onClick={sendEvent} disabled={!evId} style={{ ...btn(W.teal, "#fff"), opacity: evId ? 1 : .5 }}><Zap size={15} />Groups</button>
        </div>
        <button onClick={() => { const e = (events || []).find(x => x.id === evId); if (e) onSendEventDM(e, seg.map(m => m.id)); }} disabled={!evId || !seg.length} style={{ ...btn(W.ink, "#fff"), marginTop: 8, width: "100%", justifyContent: "center", opacity: (!evId || !seg.length) ? .5 : 1 }}><Send size={15} />Send privately to {seg.length} member{seg.length === 1 ? "" : "s"} (uses filters below)</button>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, color: W.ink, marginBottom: 6 }}>Message your members</div>
        <div style={{ fontSize: 13, color: W.soft, marginBottom: 12, lineHeight: 1.45 }}>Type your message, then either post it to every group chat or send it as a private in-app message to a filtered set of members.</div>
        <textarea value={t} onChange={e => setT(e.target.value)} rows={4} placeholder="Type your message…" style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
        <button onClick={send} disabled={sending || !t.trim()} style={{ ...btn(W.teal, "#fff"), marginTop: 10, width: "100%", justifyContent: "center", opacity: (sending || !t.trim()) ? .6 : 1 }}><Zap size={16} />{sending ? "Working…" : "Post to all group chats"}</button>

        <div style={{ borderTop: `1px solid ${W.line}`, margin: "14px 0" }} />
        <div style={{ fontWeight: 700, color: W.ink, marginBottom: 8, fontSize: 14 }}>Or send privately to a segment</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>{chip("all", "Everyone")}{chip("male", "Men")}{chip("female", "Women")}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <select value={age} onChange={e => setAge(e.target.value)} style={sel}><option value="all">All ages</option><option>18-24</option><option>25-34</option><option>35-44</option><option>45+</option></select>
          <select value={prof} onChange={e => setProf(e.target.value)} style={sel}><option value="all">All work</option>{profs.map(p => <option key={p} value={p}>{p}</option>)}</select>
          <select value={city} onChange={e => setCity(e.target.value)} style={sel}><option value="all">All cities</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}</select>
        </div>
        <button onClick={sendSegment} disabled={sending || !t.trim() || !seg.length} style={{ ...btn(W.ink, "#fff"), width: "100%", justifyContent: "center", opacity: (sending || !t.trim() || !seg.length) ? .5 : 1 }}><Send size={15} />Send in-app to {seg.length} member{seg.length === 1 ? "" : "s"}</button>
      </div>
    </div>
  );
}
function RoomPriceEditor({ room, onUpdate }) {
  const [v, setV] = useState(String(room.price_monthly ?? 0));
  const [saving, setSaving] = useState(false);
  const dirty = String(room.price_monthly ?? 0) !== v;
  const save = async () => {
    setSaving(true);
    await onUpdate(room.id, { price_monthly: Math.max(0, Number(v) || 0) });
    setSaving(false);
  };
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: W.soft }}>Monthly subscription (₹) — superadmin</label>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <input value={v} onChange={e => setV(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0 = free"
          style={{ width: 110, border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 11px", fontSize: 14, outline: "none", fontWeight: 800 }} />
        <button onClick={save} disabled={!dirty || saving} style={{ ...btn(dirty ? W.teal : "#ccd9d5", "#fff"), padding: "9px 16px", opacity: saving ? .6 : 1 }}>{saving ? "…" : "Save"}</button>
      </div>
      <div style={{ fontSize: 11.5, color: W.soft, marginTop: 5 }}>
        {Number(v) === 0 ? "₹0 makes the room free to join for everyone." : "Applies to NEW subscribers (a fresh Razorpay plan is created automatically). Existing members keep billing at the price they signed up with until they cancel."}
      </div>
    </div>
  );
}
function AdminRooms({ rooms, cities, lockCity, onCreate, onUpdate, onDelete, isSuper }) {
  const [creating, setCreating] = useState(false), [manage, setManage] = useState(null);
  const [f, setF] = useState({ emoji: "💬", name: "", price: "", desc: "", gender: "any", city: lockCity || "" });
  const reset = () => setF({ emoji: "💬", name: "", price: "", desc: "", gender: "any", city: lockCity || "" });
  const create = async () => { if (!f.name) return; await onCreate({ name: f.name, emoji: f.emoji || "💬", price_monthly: Number(f.price) || 0, description: f.desc, gender_restrict: f.gender || "any", city: lockCity || f.city || null }); reset(); setCreating(false); };
  return (
    <div style={{ padding: 14 }}>
      {creating ? (
        <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${W.line}`, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: W.ink }}>New subscription room</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <input value={f.emoji} onChange={e => setF({ ...f, emoji: e.target.value })} maxLength={2} style={{ width: 56, textAlign: "center", fontSize: 22, border: `1px solid ${W.line}`, borderRadius: 10, padding: 8 }} />
            <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Room name" style={{ flex: 1, minWidth: 0, border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none" }} />
          </div>
          <input value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} placeholder="Short description" style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none", marginBottom: 10 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ color: W.soft, fontSize: 14 }}>₹</span>
            <input value={f.price} onChange={e => setF({ ...f, price: e.target.value.replace(/\D/g, "") })} placeholder="0 (free)" inputMode="numeric" style={{ flex: 1, minWidth: 0, border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none" }} />
            <span style={{ color: W.soft, fontSize: 14 }}>per month</span>
          </div>
          <select value={f.gender} onChange={e => setF({ ...f, gender: e.target.value })} style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none", background: "#fff", color: W.ink, marginBottom: 14 }}>
            <option value="any">Open to everyone</option>
            <option value="female">Women only</option>
            <option value="male">Men only</option>
            <option value="couple">Couples</option>
          </select>
          {lockCity ? <div style={{ fontSize: 13, color: W.soft, marginBottom: 14 }}>City: <b style={{ color: W.ink }}>{lockCity}</b></div> : (
            <select value={f.city} onChange={e => setF({ ...f, city: e.target.value })} style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none", background: "#fff", color: W.ink, marginBottom: 14 }}>
              <option value="">All cities (no city)</option>
              {(cities || []).map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
            </select>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setCreating(false); reset(); }} style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, flex: 1, justifyContent: "center" }}>Cancel</button>
            <button onClick={create} style={{ ...btn(W.teal, "#fff"), flex: 1, justifyContent: "center" }}>Create</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} style={{ width: "100%", padding: 14, border: `1.5px dashed ${W.teal}`, borderRadius: 14, background: "#fff", color: W.teal, fontWeight: 700, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}><Plus size={18} />Create subscription room</button>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rooms.map(r => (
          <div key={r.id} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar room={r} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, color: W.ink, display: "flex", alignItems: "center", gap: 7 }}>{r.name}{r.auto_join && <span style={{ background: "#E7F6EF", color: W.teal, fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 10 }}>FREE ROOM</span>}</div><div style={{ fontSize: 13, color: W.soft }}>{r.price_monthly === 0 ? "Free" : `₹${r.price_monthly}/mo`}{r.city ? ` · ${r.city}` : ""}</div></div>
              <Settings size={19} color={W.soft} style={{ cursor: "pointer" }} onClick={() => setManage(manage === r.id ? null : r.id)} />
            </div>
            {manage === r.id && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${W.line}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                <RoomName room={r} onUpdate={onUpdate} />
                {isSuper && <RoomPriceEditor room={r} onUpdate={onUpdate} />}
                <RoomPhoto room={r} onUpdate={onUpdate} />
                <PinEditor room={r} onUpdate={onUpdate} />
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: W.soft }}>City</label>
                  <select value={r.city || ""} onChange={e => onUpdate(r.id, { city: e.target.value || null })} disabled={!!lockCity} style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 9, padding: "10px 12px", fontSize: 14, outline: "none", background: "#fff", color: W.ink, marginTop: 6, opacity: lockCity ? .6 : 1 }}>
                    <option value="">All cities (no city)</option>
                    {(cities || []).map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: W.soft }}>Who can join</label>
                  <select value={r.gender_restrict || "any"} onChange={e => onUpdate(r.id, { gender_restrict: e.target.value })} style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 9, padding: "10px 12px", fontSize: 14, outline: "none", background: "#fff", color: W.ink, marginTop: 6 }}>
                    <option value="any">Everyone</option>
                    <option value="female">Women only</option>
                    <option value="male">Men only</option>
                    <option value="couple">Couples</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: W.soft }}>Free Room</label>
                  <button onClick={() => onUpdate(r.id, { auto_join: !r.auto_join })} style={{ ...btn(r.auto_join ? W.teal : "#fff", r.auto_join ? "#fff" : W.ink), border: r.auto_join ? "none" : `1px solid ${W.line}`, width: "100%", justifyContent: "center", marginTop: 6 }}>
                    {r.auto_join ? "✓ New members auto-join this room" : "Make this the Free Room (auto-join on signup)"}
                  </button>
                </div>
                <button onClick={() => { if (confirm("Delete this room and all its messages?")) onDelete(r.id); }} style={{ ...btn("#fff", "#C0392B"), border: "1px solid #F2C4C0", justifyContent: "center" }}><Trash2 size={15} />Delete room</button>
              </div>
            )}
          </div>
        ))}
        {rooms.length === 0 && <Center>No rooms yet.</Center>}
      </div>
    </div>
  );
}
function PinEditor({ room, onUpdate }) {
  const [pin, setPin] = useState(room.pinned || "");
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: W.soft }}>Pinned announcement</label>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <input value={pin} onChange={e => setPin(e.target.value)} placeholder="e.g. Next meetup Friday 7PM" style={{ flex: 1, minWidth: 0, border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 12px", fontSize: 14, outline: "none" }} />
        <button onClick={() => onUpdate(room.id, { pinned: pin.trim() })} style={btn(W.teal, "#fff")}>Pin</button>
      </div>
    </div>
  );
}
function BannerMedia({ url, type, style }) {
  if (!url) return null;
  if (type === "video") return <video src={url} style={style} autoPlay loop muted playsInline />;
  return <img src={url} alt="" style={style} />;
}
function Sheet({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 480, borderRadius: "18px 18px 0 0", padding: 18, maxHeight: "88vh", overflowY: "auto" }}>{children}</div>
    </div>
  );
}
function TicketSheet({ target, profile, subs, addons = [], onConfirm, onClose }) {
  const { event: e } = target;
  const [cart, setCart] = useState((target.cart || [{ type: target.type || null, qty: target.qty || 1 }]).map(c => ({ ...c })));
  const [agree, setAgree] = useState(false);
  const [addQ, setAddQ] = useState({});
  const MAX_TIX = 10;
  const needAgree = !!(e.terms && e.terms.trim());
  const sel = addons.map(a => ({ ...a, qty: addQ[a.id] || 0 }));
  const addonTotal = sel.reduce((s, a) => s + (a.price || 0) * a.qty, 0);
  const unitOf = c => c.type ? genderNet(c.type, subs, profile) : (e.ticket_price || 0);
  const grossOf = c => c.type ? (c.type.price || 0) : (e.ticket_price || 0);
  const totalQty = cart.reduce((a, c) => a + c.qty, 0);
  const ticketTotal = cart.reduce((a, c) => a + unitOf(c) * c.qty, 0);
  const total = ticketTotal + addonTotal;
  const live = cart.filter(c => c.qty > 0);
  const canConfirm = (!needAgree || agree) && live.length > 0;
  const setLine = (idx, q) => setCart(cs => cs.map((c, k) => k === idx ? { ...c, qty: Math.max(0, q) } : c));
  const miniBtn = { width: 30, height: 30, borderRadius: "50%", border: `1px solid ${W.line}`, background: "#fff", fontSize: 18, color: W.ink, cursor: "pointer", lineHeight: 1 };
  return (
    <Sheet onClose={onClose}>
      <div style={{ fontWeight: 800, fontSize: 18, color: W.ink, marginBottom: 4 }}>{e.emoji} {e.title}</div>
      <div style={{ color: W.soft, fontSize: 13, marginBottom: 14 }}>Review your tickets · up to {MAX_TIX} per order</div>
      {cart.map((c, idx) => {
        const unit = unitOf(c), gross = grossOf(c);
        return (
          <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: `1px solid ${W.line}` }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: W.ink, fontSize: 14.5 }}>{c.type ? c.type.name : "Standard ticket"}</div>
              <div style={{ fontSize: 12.5, color: W.teal, fontWeight: 700 }}>{unit === 0 ? "Free" : `₹${unit} each`}{unit < gross ? <span style={{ color: W.soft, fontWeight: 500 }}> (room offer — was ₹{gross})</span> : null}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 11, flexShrink: 0 }}>
              <button onClick={() => setLine(idx, c.qty - 1)} style={miniBtn}>−</button>
              <span style={{ fontWeight: 800, minWidth: 20, textAlign: "center" }}>{c.qty}</span>
              <button onClick={() => totalQty < MAX_TIX ? setLine(idx, c.qty + 1) : null} disabled={totalQty >= MAX_TIX} style={{ ...miniBtn, color: totalQty >= MAX_TIX ? "#bbb" : W.ink, cursor: totalQty >= MAX_TIX ? "default" : "pointer" }}>+</button>
            </div>
          </div>
        );
      })}
      {addons.length > 0 && (
        <div style={{ margin: "14px 0 2px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: W.soft, marginBottom: 8 }}>Add-ons</div>
          {addons.map(a => {
            const q = addQ[a.id] || 0;
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${W.line}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: W.ink, fontSize: 14.5 }}>{a.name}</div>
                  <div style={{ fontSize: 12.5, color: a.price > 0 ? W.teal : W.soft }}>{a.price > 0 ? `₹${a.price}` : "Free"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <button onClick={() => setAddQ(s2 => ({ ...s2, [a.id]: Math.max(0, q - 1) }))} style={miniBtn}>−</button>
                  <span style={{ fontWeight: 700, minWidth: 18, textAlign: "center" }}>{q}</span>
                  <button onClick={() => setAddQ(s2 => ({ ...s2, [a.id]: q + 1 }))} style={miniBtn}>+</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {needAgree && (
        <div style={{ margin: "14px 0 2px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: W.soft, marginBottom: 6 }}>Terms &amp; conditions</div>
          <div style={{ background: W.bg, borderRadius: 10, padding: 12, fontSize: 13, color: W.ink, maxHeight: 150, overflowY: "auto", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{e.terms}</div>
          <label style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={agree} onChange={ev => setAgree(ev.target.checked)} style={{ marginTop: 3 }} />
            <span style={{ fontSize: 13.5, color: W.ink }}>I have read and agree to the terms &amp; conditions.</span>
          </label>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "14px 0" }}>
        <span style={{ color: W.soft, fontSize: 14 }}>Total · {totalQty} ticket{totalQty !== 1 ? "s" : ""}</span>
        <span style={{ fontWeight: 800, fontSize: 18, color: W.ink }}>{total === 0 ? "Free" : `₹${total}`}</span>
      </div>
      {total > 0 && <div style={{ fontSize: 12.5, color: W.soft, marginBottom: 10 }}>You'll pay securely via Razorpay (UPI, cards, netbanking). Your tickets are issued the moment payment succeeds.</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, flex: 1, justifyContent: "center" }}>Cancel</button>
        <button disabled={!canConfirm} onClick={() => onConfirm(live, sel)} style={{ ...btn(W.teal, "#fff"), flex: 2, justifyContent: "center", opacity: canConfirm ? 1 : .5 }}>{total > 0 ? `Pay ₹${total}` : `Get ${totalQty} ticket${totalQty !== 1 ? "s" : ""}`}</button>
      </div>
    </Sheet>
  );
}
function MyTicket({ event: e, profile, rows, onClose }) {
  const [busy, setBusy] = useState(false);
  const name = profile?.full_name || profile?.name || "Member";
  const qty = rows.reduce((s, r) => s + (r.quantity || 1), 0) || 1;
  const base = (rows[0]?.id || ((profile?.id || "") + (e.id || ""))).replace(/-/g, "");
  const code = "GW-" + (base.slice(0, 8).toUpperCase() || "TICKET");
  const place = [e.venue, e.city].filter(Boolean).join(", ");
  const qr = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=" + encodeURIComponent(code);
  const summary = `🎟️ Glasswings Ticket\n${e.title}\n${e.event_date || ""}${place ? `\n${place}` : ""}\nName: ${name}\nTickets: ${qty}\nCode: ${code}`;
  const wa = "https://wa.me/?text=" + encodeURIComponent(summary);
  const print = () => {
    const w = window.open("", "_blank", "width=460,height=720"); if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Glasswings Ticket</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      *{box-sizing:border-box} body{font-family:system-ui,Arial,sans-serif;margin:0;padding:24px;background:#eef2f1;color:#fff}
      .t{max-width:420px;margin:0 auto;background:#0C1A16;border-radius:20px;overflow:hidden;box-shadow:0 12px 34px rgba(0,0,0,.25)}
      .hd{padding:22px 22px 20px;border-left:6px solid #2FD4A8}
      .br{font-size:11px;letter-spacing:4px;font-weight:800;color:#2FD4A8}
      .ti{font-size:26px;font-weight:900;margin-top:8px;line-height:1.15;color:#fff}
      .mt{font-size:13.5px;color:rgba(255,255,255,.9);margin-top:8px}
      .bd{padding:0 22px 22px;position:relative}
      .tear{border-top:2px dashed rgba(255,255,255,.22);margin:0 -22px 18px}
      .row{display:flex;justify-content:space-between;align-items:flex-end;gap:16px}
      .lbl{font-size:10px;letter-spacing:1.5px;color:#2FD4A8;text-transform:uppercase;margin-top:12px;font-weight:800}
      .val{font-size:18px;font-weight:800;color:#fff}
      .code{font-size:20px;font-weight:800;letter-spacing:2px;color:#2FD4A8;font-family:ui-monospace,monospace}
      .qr{width:128px;height:128px;border-radius:12px;background:#fff;padding:7px}
      .ft{text-align:center;font-size:12px;color:rgba(255,255,255,.55);margin-top:18px}
    </style></head><body><div class="t">
      <div class="hd"><div class="br">G L A S S W I N G S</div><div class="ti">${escapeHtml((e.emoji || "🎟️") + " " + e.title)}</div>${e.event_date ? `<div class="mt">📅 ${escapeHtml(e.event_date)}</div>` : ""}${place ? `<div class="mt">📍 ${escapeHtml(place)}</div>` : ""}</div>
      <div class="bd"><div class="tear"></div>
        <div class="row"><div>
          <div class="lbl">Attendee</div><div class="val">${escapeHtml(name)}</div>
          <div class="lbl">Tickets</div><div class="val">${qty}</div>
          <div class="lbl">Ticket code</div><div class="code">${code}</div>
        </div></div>
        <div class="ft">Show this ticket at entry · Glasswings community</div>
      </div></div>
      <script>window.onload=function(){setTimeout(function(){window.print()},350)}</script></body></html>`);
    w.document.close();
  };
  const rideRow = (e.venue_lat || e.venue) ? (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, color: "#9fb3b0", fontWeight: 800, letterSpacing: 1.2, marginBottom: 7 }}>🚕 NEED A RIDE TO THE VENUE?</div>
      <RideButtons e={e} compact />
    </div>
  ) : null;
  const shareWhatsApp = async () => {
    setBusy(true);
    try {
      const blob = await makeTicketBlob({ emoji: e.emoji, title: e.title, dateStr: e.event_date, place, name, qty, code });
      const file = new File([blob], "glasswings-ticket.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: e.title, text: summary });
      } else {
        const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "glasswings-ticket.png"; a.click(); URL.revokeObjectURL(url);
        window.open(wa, "_blank");
      }
    } catch (err) { window.open(wa, "_blank"); }
    setBusy(false);
  };
  return (
    <Sheet onClose={onClose}>
      <div style={{ borderRadius: 20, overflow: "hidden", boxShadow: "0 16px 40px rgba(0,0,0,.3)", marginBottom: 16, background: "#0C1A16" }}>
        <div style={{ position: "relative" }}>
          {e.banner_url
            ? <div style={{ position: "relative", height: 150 }}><BannerMedia url={e.banner_url} type={e.banner_type} style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }} /><div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(12,26,22,.15),rgba(12,26,22,.92))" }} /></div>
            : <div style={{ height: 110, background: "linear-gradient(135deg,#063b32,#0C1A16)" }} />}
          <div style={{ position: "absolute", left: 20, right: 20, bottom: 14 }}>
            <div style={{ fontSize: 10.5, letterSpacing: 4, fontWeight: 800, color: "#2FD4A8" }}>G L A S S W I N G S</div>
            <div style={{ fontSize: 25, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginTop: 4, textShadow: "0 2px 8px rgba(0,0,0,.5)" }}>{e.emoji} {e.title}</div>
          </div>
        </div>
        <div style={{ padding: "16px 20px 4px", color: "#fff" }}>
          {e.event_date && <div style={{ fontSize: 13.5, marginBottom: 6, display: "flex", gap: 9, alignItems: "center" }}><Calendar size={15} color="#2FD4A8" />{e.event_date}</div>}
          {place && <div style={{ fontSize: 13.5, marginBottom: 6, display: "flex", gap: 9, alignItems: "flex-start", color: "rgba(255,255,255,.92)" }}><MapPin size={15} color="#2FD4A8" style={{ marginTop: 1, flexShrink: 0 }} />{place}</div>}
        </div>
        <div style={{ position: "relative", height: 24 }}>
          <div style={{ position: "absolute", top: "50%", left: -12, width: 24, height: 24, borderRadius: "50%", background: W.bg, transform: "translateY(-50%)" }} />
          <div style={{ position: "absolute", top: "50%", right: -12, width: 24, height: 24, borderRadius: "50%", background: W.bg, transform: "translateY(-50%)" }} />
          <div style={{ position: "absolute", top: "50%", left: 18, right: 18, borderTop: "2px dashed rgba(255,255,255,.22)", transform: "translateY(-50%)" }} />
        </div>
        <div style={{ padding: "6px 20px 20px" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#2FD4A8", textTransform: "uppercase", fontWeight: 800 }}>Attendee</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#fff", marginTop: 2, marginBottom: 14 }}>{name}</div>
            <div style={{ display: "flex", gap: 32 }}>
              <div><div style={{ fontSize: 10, letterSpacing: 1.5, color: "rgba(255,255,255,.55)", textTransform: "uppercase", fontWeight: 700 }}>Tickets</div><div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{qty}</div></div>
              <div style={{ minWidth: 0 }}><div style={{ fontSize: 10, letterSpacing: 1.5, color: "rgba(255,255,255,.55)", textTransform: "uppercase", fontWeight: 700 }}>Code</div><div style={{ display: "inline-block", marginTop: 4, fontSize: 17, fontWeight: 800, color: "#08130F", background: "#2FD4A8", fontFamily: "ui-monospace,monospace", letterSpacing: 1, padding: "5px 12px", borderRadius: 8 }}>{code}</div></div>
            </div>
          </div>
        </div>
        <div style={{ background: "#08130F", color: "rgba(255,255,255,.6)", fontSize: 11.5, textAlign: "center", padding: "11px 0", letterSpacing: .5 }}>Show this ticket at entry</div>
      </div>
      {rideRow}
        <div style={{ display: "flex", gap: 10 }}>
        <button onClick={print} style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, flex: 1, justifyContent: "center" }}><Printer size={16} />Print</button>
        <button onClick={shareWhatsApp} disabled={busy} style={{ ...btn(W.teal, "#fff"), flex: 1, justifyContent: "center", opacity: busy ? .6 : 1 }}><Share2 size={16} />{busy ? "Preparing…" : "WhatsApp"}</button>
        <button onClick={async () => {
          try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const r = await fetch("/api/email/ticket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: token, event_id: e.id }) });
            const out = await r.json();
            alert(r.ok ? (out.skipped ? "Email not sent: " + out.skipped : "Ticket email sent ✅ — check your inbox (and spam).") : (out.error || "Could not send."));
          } catch (e2) { alert("Could not send the email."); }
        }} style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, flex: 1, justifyContent: "center" }}>📧 Email me</button>
      </div>
      <button onClick={onClose} style={{ ...btn("#fff", W.soft), border: `1px solid ${W.line}`, width: "100%", justifyContent: "center", marginTop: 10 }}>Close</button>
    </Sheet>
  );
}
function TicketTypes({ eventId, types, rooms, onAdd, onDel }) {
  const [name, setName] = useState(""); const [price, setPrice] = useState(""); const [cap, setCap] = useState("");
  const [wf, setWf] = useState(""); const [wm, setWm] = useState("");
  const [dRoom, setDRoom] = useState(""); const [dKind, setDKind] = useState("percent"); const [dVal, setDVal] = useState("");
  const gl = { any: "Anyone", male: "Men", female: "Women" };
  const roomName = id => ((rooms || []).find(r => r.id === id) || {}).name || "room";
  const add = async () => {
    if (!name.trim()) return;
    await onAdd(eventId, { name: name.trim(), price: Number(price) || 0, gender_restrict: "any", capacity: cap === "" ? null : Number(cap), disc_female_pct: wf === "" ? null : Number(wf), disc_male_pct: wm === "" ? null : Number(wm), discount_room_id: dRoom || null, discount_kind: dKind, discount_value: Number(dVal) || 0 });
    setName(""); setPrice(""); setCap(""); setWf(""); setWm(""); setDRoom(""); setDKind("percent"); setDVal("");
  };
  const ip = { border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 11px", fontSize: 14, outline: "none", background: "#fff", color: W.ink };
  const audBadge = (gr) => {
    const map = { male: ["Men only", "#E8F2FB", "#1B6FB8"], female: ["Women only", "#FBE9F2", "#C0246E"], any: ["Anyone", "#ECEFEE", W.soft] };
    const [label, bg, col] = map[gr] || map.any;
    return <span style={{ background: bg, color: col, fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>{label}</span>;
  };
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: W.soft }}>Ticket types</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "8px 0" }}>
        {types.map(t => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, background: W.bg, borderRadius: 9, padding: "7px 10px" }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: W.ink, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <b>{t.name}</b>
              <span style={{ color: W.soft }}>{t.price === 0 ? "Free" : `₹${t.price}`}</span>
              {audBadge(t.gender_restrict)}
              {t.capacity != null && <span style={{ color: W.soft }}>· cap {t.capacity}</span>}
              {t.discount_room_id && <span style={{ color: W.teal }}>· {t.discount_kind === "flat" ? `₹${t.discount_value}` : `${t.discount_value}%`} off for {roomName(t.discount_room_id)}</span>}
            </div>
            <X size={15} color="#C0392B" style={{ cursor: "pointer" }} onClick={() => onDel(t.id)} />
          </div>
        ))}
        {types.length === 0 && <span style={{ fontSize: 12.5, color: W.soft }}>No types yet — the event uses its single ticket price above.</span>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. Men)" style={{ ...ip, flex: "1 1 110px", minWidth: 0 }} />
        <input value={price} onChange={e => setPrice(e.target.value.replace(/\D/g, ""))} placeholder="₹ 0" inputMode="numeric" style={{ ...ip, width: 64 }} />
        <input value={wf} onChange={e => setWf(e.target.value.replace(/[^\d.]/g, ""))} placeholder="♀ % off" title="Optional discount for women, e.g. 20" inputMode="decimal" style={{ ...ip, width: 76 }} />
        <input value={wm} onChange={e => setWm(e.target.value.replace(/[^\d.]/g, ""))} placeholder="♂ % off" title="Optional discount for men" inputMode="decimal" style={{ ...ip, width: 76 }} />
        <input value={cap} onChange={e => setCap(e.target.value.replace(/\D/g, ""))} placeholder="Qty (∞)" title="How many of this ticket to sell (blank = unlimited)" inputMode="numeric" style={{ ...ip, width: 72 }} />
      </div>
      <div style={{ marginTop: 8, background: W.bg, borderRadius: 10, padding: 10 }}>
        <div style={{ fontSize: 12, color: W.soft, fontWeight: 700, marginBottom: 6 }}>Discount for room members (optional)</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <select value={dRoom} onChange={e => setDRoom(e.target.value)} style={{ ...ip, flex: "1 1 120px", minWidth: 0 }}>
            <option value="">No discount</option>
            {(rooms || []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select value={dKind} onChange={e => setDKind(e.target.value)} style={ip}>
            <option value="percent">% off</option>
            <option value="flat">₹ off</option>
          </select>
          <input value={dVal} onChange={e => setDVal(e.target.value.replace(/\D/g, ""))} placeholder={dKind === "percent" ? "30" : "100"} inputMode="numeric" style={{ ...ip, width: 70 }} />
        </div>
        <div style={{ fontSize: 11.5, color: W.soft, marginTop: 6 }}>Members of that room get this off. 100% (or ₹ ≥ price) makes it free for them.</div>
      </div>
      <button onClick={add} style={{ ...btn(W.teal, "#fff"), width: "100%", justifyContent: "center", marginTop: 8 }}><Plus size={15} />Add ticket type</button>
    </div>
  );
}
function GenderBalance({ ev, onUpdate }) {
  const on = ev.balance_on !== false;
  const [ratio, setRatio] = useState(ev.men_per_woman == null ? "2" : String(ev.men_per_woman));
  const [start, setStart] = useState(String(ev.men_open_start || 0));
  const [saved, setSaved] = useState(false);
  const ip = { border: `1px solid ${W.line}`, borderRadius: 9, padding: "8px 10px", fontSize: 14, outline: "none", background: "#fff", color: W.ink };
  return (
    <div style={{ background: W.bg, borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: W.ink }}>Men : Women balance</div>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: W.soft, cursor: "pointer" }}>
          <input type="checkbox" checked={on} onChange={e => onUpdate(ev.id, { balance_on: e.target.checked })} /> On
        </label>
      </div>
      <div style={{ fontSize: 11.5, color: W.soft, margin: "4px 0 8px", lineHeight: 1.5 }}>Men's tickets open as women join — e.g. 2 per woman means 4 women joining opens 8 men's tickets. Women's tickets are never limited by this.</div>
      {on && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12.5, color: W.soft }}>Men per woman</span>
          <input value={ratio} onChange={e => { setRatio(e.target.value.replace(/[^\d.]/g, "")); setSaved(false); }} inputMode="decimal" style={{ ...ip, width: 54 }} />
          <span style={{ fontSize: 12.5, color: W.soft }}>Men open at start</span>
          <input value={start} onChange={e => { setStart(e.target.value.replace(/\D/g, "")); setSaved(false); }} inputMode="numeric" style={{ ...ip, width: 54 }} />
          <button onClick={async () => { await onUpdate(ev.id, { men_per_woman: Number(ratio) || 0, men_open_start: Number(start) || 0 }); setSaved(true); }} style={btn(W.teal, "#fff")}>{saved ? "Saved ✓" : "Save"}</button>
        </div>
      )}
    </div>
  );
}
function EventTerms({ ev, onUpdate }) {
  const [t, setT] = useState(ev.terms || ""); const [saved, setSaved] = useState(false);
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: W.soft }}>Terms &amp; conditions</label>
      <textarea value={t} onChange={e => { setT(e.target.value); setSaved(false); }} rows={3} placeholder="e.g. No refunds. Carry a valid photo ID. Entry subject to availability." style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", marginTop: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
      <button onClick={async () => { await onUpdate(ev.id, { terms: t }); setSaved(true); }} style={{ ...btn(W.teal, "#fff"), marginTop: 6 }}>{saved ? "Saved ✓" : "Save terms"}</button>
    </div>
  );
}
function EventBanner({ ev, onUpdate }) {
  const ref = useRef(null); const [busy, setBusy] = useState(false);
  const pick = async (e) => { const f = e.target.files?.[0]; if (!f) return; setBusy(true); try { const url = await uploadChatFile("banners", f); const banner_type = f.type.startsWith("video") ? "video" : "image"; await onUpdate(ev.id, { banner_url: url, banner_type }); } catch (x) { alert("Upload failed: " + x.message); } setBusy(false); };
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: W.soft }}>Event banner (image or video)</label>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
        {ev.banner_url ? <BannerMedia url={ev.banner_url} type={ev.banner_type} style={{ width: 84, height: 50, borderRadius: 8, objectFit: "cover" }} /> : <div style={{ width: 84, height: 50, borderRadius: 8, background: W.bg }} />}
        <button onClick={() => ref.current?.click()} style={btn(W.teal, "#fff")}><Camera size={15} />{busy ? "Uploading…" : "Change banner"}</button>
        <input ref={ref} type="file" accept="image/*,video/*" onChange={pick} style={{ display: "none" }} />
      </div>
    </div>
  );
}
function OptionList({ label, kind, items, onAdd, onDel, onSetImage }) {
  const [val, setVal] = useState("");
  const fileRef = useRef(null);
  const [picking, setPicking] = useState(null);
  const onFile = async (e) => {
    const f = e.target.files?.[0]; const id = picking;
    setPicking(null); if (fileRef.current) fileRef.current.value = "";
    if (!f || !id || !onSetImage) return;
    try { const { data } = await supabase.auth.getUser(); const url = await uploadPhoto(data?.user?.id || "opt", f); await onSetImage(id, url); } catch {}
  };
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: W.soft, marginBottom: 6 }}>{label}</div>
      {kind === "category" && <div style={{ fontSize: 11.5, color: W.soft, marginBottom: 8 }}>Tap a category's icon to give it an image (shown as tiles on the events page).</div>}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input value={val} onChange={e => setVal(e.target.value)} placeholder={`Add a ${kind}…`} style={{ flex: 1, minWidth: 0, border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 12px", fontSize: 14, outline: "none" }} />
        <button onClick={async () => { await onAdd(kind, val); setVal(""); }} style={btn(W.teal, "#fff")}>Add</button>
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {items.map(it => (
          <span key={it.id} style={{ display: "flex", alignItems: "center", gap: 7, background: W.bg, borderRadius: 16, padding: "5px 7px 5px 7px", fontSize: 13, color: W.ink }}>
            {kind === "category" && onSetImage && (
              <span onClick={() => { setPicking(it.id); fileRef.current?.click(); }} title="Set image" style={{ width: 26, height: 26, borderRadius: 9, overflow: "hidden", cursor: "pointer", flexShrink: 0, background: "linear-gradient(135deg,#008069,#04B08F)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {it.image_url ? <img src={it.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <Camera size={13} color="#fff" />}
              </span>
            )}
            {it.name}<X size={14} color="#C0392B" style={{ cursor: "pointer" }} onClick={() => onDel(it.id)} />
          </span>
        ))}
        {items.length === 0 && <span style={{ fontSize: 12.5, color: W.soft }}>None yet.</span>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
    </div>
  );
}
function EventSendSheet({ event, members, onSend, onClose }) {
  const [g, setG] = useState("all"); const [age, setAge] = useState("all"); const [prof, setProf] = useState("all"); const [city, setCity] = useState("all"); const [busy, setBusy] = useState(false);
  const det = m => m.member_details || {};
  const ageBand = a => { a = Number(a); if (!a) return null; if (a < 25) return "18-24"; if (a < 35) return "25-34"; if (a < 45) return "35-44"; return "45+"; };
  const profs = Array.from(new Set(members.map(m => det(m).profession).filter(Boolean))).sort();
  const cities = Array.from(new Set(members.map(m => det(m).city).filter(Boolean))).sort();
  const seg = members.filter(m => {
    const d = det(m);
    if (g !== "all" && m.gender !== g) return false;
    if (age !== "all" && ageBand(d.age) !== age) return false;
    if (prof !== "all" && d.profession !== prof) return false;
    if (city !== "all" && d.city !== city) return false;
    return true;
  });
  const sel = { padding: "8px 10px", borderRadius: 9, border: `1px solid ${W.line}`, background: "#fff", fontSize: 13, color: W.ink, outline: "none" };
  const chip = (v, label) => <button key={v} onClick={() => setG(v)} style={{ padding: "7px 13px", borderRadius: 18, border: `1px solid ${g === v ? W.teal : W.line}`, background: g === v ? W.teal : "#fff", color: g === v ? "#fff" : W.soft, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{label}</button>;
  const go = async () => { setBusy(true); await onSend(seg.map(m => m.id)); setBusy(false); };
  return (
    <Sheet onClose={onClose}>
      <div style={{ fontWeight: 800, fontSize: 17, color: W.ink, marginBottom: 4 }}>Send event to members</div>
      <div style={{ color: W.soft, fontSize: 13.5, marginBottom: 14 }}>{event.emoji} {event.title} — sent privately to each member's inbox.</div>
      <div style={{ fontSize: 12, color: W.soft, fontWeight: 700, marginBottom: 6 }}>Who</div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>{chip("all", "Everyone")}{chip("male", "Men")}{chip("female", "Women")}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <select value={age} onChange={e => setAge(e.target.value)} style={sel}><option value="all">All ages</option><option>18-24</option><option>25-34</option><option>35-44</option><option>45+</option></select>
        <select value={prof} onChange={e => setProf(e.target.value)} style={sel}><option value="all">All work</option>{profs.map(p => <option key={p} value={p}>{p}</option>)}</select>
        <select value={city} onChange={e => setCity(e.target.value)} style={sel}><option value="all">All cities</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}</select>
      </div>
      <button onClick={go} disabled={busy || !seg.length} style={{ ...btn(W.teal, "#fff"), width: "100%", justifyContent: "center", opacity: (busy || !seg.length) ? .5 : 1 }}><Send size={16} />{busy ? "Sending…" : `Send to ${seg.length} member${seg.length === 1 ? "" : "s"}`}</button>
      <button onClick={onClose} style={{ ...btn("#fff", W.soft), border: `1px solid ${W.line}`, width: "100%", justifyContent: "center", marginTop: 10 }}>Cancel</button>
    </Sheet>
  );
}
function Introductions({ eventId, refreshKey }) {
  const [data, setData] = useState(null);
  useEffect(() => { supabase.rpc("event_introductions", { p_event: eventId }).then(({ data }) => setData(data || null)); }, [eventId, refreshKey]);
  if (!data) return null;
  const pairs = data.pairs || [], newbies = data.newcomers || [];
  if (!pairs.length && !newbies.length) return null;
  const face = (p, size = 30) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <PersonAvatar url={p.avatar} name={p.name} size={size} />
      <span style={{ fontWeight: 700, color: W.ink, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(p.name || "—").split(" ")[0]}</span>
    </span>
  );
  return (
    <div style={{ background: "linear-gradient(135deg,#FFF8EC,#FDF1F7)", border: "1px solid #F2E2C4", borderRadius: 14, padding: "13px 14px", marginBottom: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 14.5, color: W.ink }}>🤝 Make introductions tonight</div>
      {pairs.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: W.soft, margin: "3px 0 9px" }}>These people have crossed paths before but never connected — walk them over to each other.</div>
          {pairs.map((pr, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: i ? "1px solid #F2E2C4" : "none" }}>
              {face(pr.a)}
              <span style={{ color: "#B45309", fontWeight: 800, fontSize: 13 }}>×</span>
              {face(pr.b)}
              <span style={{ marginLeft: "auto", background: "#fff", border: "1px solid #F2E2C4", color: "#B45309", fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 12, whiteSpace: "nowrap" }}>met {pr.shared}× · never talked</span>
            </div>
          ))}
        </>
      )}
      {newbies.length > 0 && (
        <div style={{ marginTop: pairs.length ? 10 : 6 }}>
          <div style={{ fontSize: 12, color: W.soft, marginBottom: 7 }}>👋 First-timers tonight — give them a warm welcome:</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{newbies.map((n, i) => <span key={i}>{face(n, 26)}</span>)}</div>
        </div>
      )}
    </div>
  );
}
function TimeCapsule({ event: e, profile }) {
  const [cap, setCap] = useState(null);
  const [txt, setTxt] = useState("");
  const [img, setImg] = useState("");
  const [busy, setBusy] = useState(false);
  const fref = useRef(null);
  const load = () => supabase.rpc("capsule_read", { p_event: e.id }).then(({ data }) => setCap(data || null));
  useEffect(() => { setCap(null); load(); }, [e.id]);
  if (!cap || !cap.eligible) return null;
  const drop = async () => {
    if (!txt.trim() && !img) return;
    setBusy(true);
    const { error } = await supabase.rpc("capsule_drop", { p_event: e.id, p_body: txt, p_image: img || null });
    setBusy(false);
    if (!error) { setTxt(""); setImg(""); load(); }
  };
  const pick = async (ev) => {
    const f = ev.target.files?.[0]; if (fref.current) fref.current.value = "";
    if (!f) return;
    try { setBusy(true); const url = await uploadPhoto(profile.id, f); setImg(url); } catch {} finally { setBusy(false); }
  };
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ background: "linear-gradient(140deg,#141031,#0E2231)", borderRadius: 16, padding: "16px 16px 14px", color: "#fff" }}>
        <div style={{ fontWeight: 800, fontSize: 15.5 }}>{cap.open ? "🔓 The Time Capsule — opened" : "⏳ Time Capsule"}</div>
        {cap.open ? (
          <>
            <div style={{ fontSize: 12, color: "#9fb3d9", marginTop: 3 }}>Memories dropped on this night, sealed until now.</div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {(cap.notes || []).map((n, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,.07)", borderRadius: 12, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <PersonAvatar url={n.avatar} name={n.name} size={26} />
                    <span style={{ fontWeight: 700, fontSize: 12.5 }}>{n.name || "Someone"}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#9fb3d9" }}>{n.at}</span>
                  </div>
                  {n.body && <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 7, whiteSpace: "pre-wrap" }}>{n.body}</div>}
                  {n.image && <img src={n.image} alt="" loading="lazy" style={{ width: "100%", borderRadius: 10, marginTop: 8, display: "block" }} />}
                </div>
              ))}
              {(cap.notes || []).length === 0 && <div style={{ fontSize: 12.5, color: "#9fb3d9" }}>The capsule was empty this time — drop something at the next event!</div>}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "#9fb3d9", marginTop: 3 }}>Drop a memory from this night — a thought, a moment, a photo. The capsule stays sealed until the next meetup happens.</div>
            <div style={{ fontSize: 12.5, marginTop: 9, color: "#cdd9f2" }}>✉️ <b style={{ color: "#fff" }}>{cap.count}</b> {cap.count === 1 ? "memory" : "memories"} sealed inside{cap.mine > 0 ? ` · ${cap.mine} from you` : ""}</div>
            <textarea value={txt} onChange={ev => setTxt(ev.target.value)} placeholder="Tonight I…" rows={2} style={{ width: "100%", marginTop: 10, border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "#fff", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, outline: "none", fontFamily: "inherit", resize: "vertical" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
              <button onClick={() => fref.current?.click()} style={{ ...btn("transparent", img ? "#2FD4A8" : "#cdd9f2"), border: `1px solid ${img ? "#2FD4A8" : "rgba(255,255,255,.25)"}`, padding: "9px 13px", fontSize: 12.5 }}><Camera size={14} />{img ? "Photo added ✓" : "Photo"}</button>
              <button onClick={drop} disabled={busy || (!txt.trim() && !img)} style={{ ...btn("#2FD4A8", "#0b1f1c"), flex: 1, justifyContent: "center", fontWeight: 800, opacity: busy || (!txt.trim() && !img) ? .55 : 1 }}>{busy ? "Sealing…" : "Drop into the capsule"}</button>
            </div>
            <input ref={fref} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
          </>
        )}
      </div>
    </div>
  );
}
function EventMembersSheet({ event, onClose }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const load = () => supabase.rpc("event_member_list", { p_event: event.id }).then(({ data, error }) => { if (error) setErr(error.message); else setRows(data || []); });
  useEffect(() => { load(); }, [event.id]);
  const waLink = ph => "https://wa.me/" + (ph || "").replace(/[^\d]/g, "").replace(/^0+/, "");
  const withdraw = (m) => {
    if (!window.confirm(`Withdraw ${m.full_name || "this member"}'s ticket${m.qty > 1 ? "s" : ""}? They'll be removed from this event.`)) return;
    supabase.rpc("withdraw_ticket", { p_event: event.id, p_user: m.user_id }).then(({ error }) => error ? alert(error.message) : load());
  };
  const totQty = (rows || []).reduce((a, r) => a + (r.qty || 0), 0);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "flex-start", overflowY: "auto", padding: "24px 12px" }}>
      <div onClick={e2 => e2.stopPropagation()} style={{ background: "#fff", borderRadius: 16, maxWidth: 560, width: "100%", padding: "20px 20px 26px", margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: W.ink, minWidth: 0 }}>👥 Members · {event.title}</div>
          <X size={22} color={W.soft} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <div style={{ fontSize: 13, color: W.soft, marginBottom: 14 }}>{rows === null ? "Loading…" : `${rows.length} member${rows.length === 1 ? "" : "s"} · ${totQty} ticket${totQty === 1 ? "" : "s"} · ${rows.filter(r => r.checked_in).length} checked in`}</div>
        {err && <div style={{ background: "#FBE9E7", border: "1px solid #F2C4C0", color: "#C0392B", borderRadius: 10, padding: "10px 13px", fontSize: 13, marginBottom: 12 }}>⚠️ {err}</div>}
                {rows === null ? <Center>loading…</Center> : rows.length === 0 ? <Center>No ticket holders yet.</Center> : rows.map(m => (
          <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 0", borderTop: `1px solid ${W.line}` }}>
            <PersonAvatar url={m.avatar_url} name={m.full_name} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: W.ink, fontSize: 14.5 }}>{m.full_name || "—"} {m.checked_in && <span style={{ background: "#E7F6EF", color: W.teal, fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 8 }}>✓ IN</span>}</div>
              <div style={{ fontSize: 12, color: W.soft }}>{m.types || "Standard"} ×{m.qty}{m.phone ? ` · ${m.phone}` : ""}</div>
            </div>
            {m.phone && <a href={waLink(m.phone)} target="_blank" rel="noreferrer" title="WhatsApp" style={{ ...btn("#25D366", "#fff"), padding: "6px 9px", fontSize: 12, textDecoration: "none" }}><MessageCircle size={13} /></a>}
            <button onClick={async () => {
              try {
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                const r = await fetch("/api/email/ticket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: token, event_id: event.id, for_user: m.user_id }) });
                const out = await r.json();
                alert(r.ok ? (out.skipped ? "Not sent: " + out.skipped : `Ticket email sent to ${m.full_name || "member"} ✅`) : (out.error || "Could not send."));
              } catch (e2) { alert("Could not send the email."); }
            }} title="Resend ticket email" style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, padding: "6px 9px", fontSize: 12 }}>✉️</button>
            <button onClick={() => withdraw(m)} title="Withdraw ticket" style={{ background: "none", border: "none", color: "#C0392B", cursor: "pointer", padding: 4 }}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
function CheckInSheet({ event, onClose }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [guests, setGuests] = useState([]);
  const [gName, setGName] = useState(""); const [gPhone, setGPhone] = useState(""); const [gEmail, setGEmail] = useState(""); const [gQty, setGQty] = useState("1");
  const [gAge, setGAge] = useState(""); const [gLoc, setGLoc] = useState("");
  const [gBusy, setGBusy] = useState(false);
  const loadGuests = () => supabase.rpc("guest_list", { p_event: event.id }).then(({ data, error }) => { if (!error) setGuests(data || []); });
  const load = () => { supabase.rpc("event_attendees", { p_event: event.id }).then(({ data, error }) => { setErr(error ? (error.message || "Could not load attendees.") : ""); setList(data || []); }); loadGuests(); };
  useEffect(() => { load(); }, [event.id]);
  const addGuest = async () => {
    if (!gName.trim()) return alert("Guest name is required.");
    setGBusy(true);
    const { data: gNew, error } = await supabase.rpc("add_guest_ticket", { p_event: event.id, p_name: gName, p_phone: gPhone, p_email: gEmail, p_qty: Number(gQty) || 1, p_age: gAge === "" ? null : Number(gAge), p_location: gLoc });
    setGBusy(false);
    if (error) return alert(error.message);
    if (gEmail.trim() && gNew?.id) {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        fetch("/api/email/ticket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "guest", access_token: token, guest_id: gNew.id }) });
      } catch (e2) {}
    }
    setGName(""); setGPhone(""); setGEmail(""); setGQty("1"); setGAge(""); setGLoc("");
    loadGuests();
  };
  const guestWa = (g) => {
    const text = `🎟️ ${event.title}\nGuest ticket for ${g.name}${(g.quantity || 1) > 1 ? ` (${g.quantity} entries)` : ""}\nYour ticket — open & show the QR at the door:\nhttps://glass-wings.com/?gt=${g.code}\n— Glasswings Events`;
    const num = (g.phone || "").replace(/[^\d]/g, "").replace(/^0+/, "");
    return num ? `https://wa.me/${num}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  };
  const shareGuest = async (g) => {
    const text = `🎟️ ${event.title}\nGuest ticket for ${g.name}${(g.quantity || 1) > 1 ? ` (${g.quantity} entries)` : ""}\nCode: ${g.code}\nTicket: https://glass-wings.com/?gt=${g.code}\n— Glasswings Events`;
    try {
      const blob = await makeTicketBlob({ emoji: "🎟️", title: event.title, dateStr: event.event_date, place: [event.venue, event.city].filter(Boolean).join(", "), name: g.name, qty: g.quantity || 1, code: g.code });
      const file = new File([blob], "glasswings-ticket.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: event.title, text }); return; }
    } catch (e2) {}
    window.open(guestWa(g), "_blank");
  };
  const toggle = async (uid, present) => {
    setList(l => l.map(x => x.user_id === uid ? { ...x, present } : x));
    await supabase.rpc("set_attendance", { p_event: event.id, p_user: uid, p_present: present });
  };
  const seg = (label, rows) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: W.soft, margin: "4px 0 8px" }}>{label} ({rows.length})</div>
      {rows.length === 0 ? <div style={{ fontSize: 13, color: W.soft }}>None</div> : rows.map(m => (
        <div key={m.user_id} onClick={() => toggle(m.user_id, !m.present)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderTop: `1px solid ${W.line}`, cursor: "pointer" }}>
          <PersonAvatar url={m.avatar_url} name={m.full_name} size={38} />
          <span style={{ flex: 1, minWidth: 0, fontWeight: 600, color: W.ink, fontSize: 14.5 }}>{m.full_name || "—"}</span>
          <button onClick={(ev) => { ev.stopPropagation(); if (window.confirm(`Withdraw ${m.full_name || "this member"}'s ticket? They'll be removed from this event.`)) supabase.rpc("withdraw_ticket", { p_event: event.id, p_user: m.user_id }).then(({ error }) => error ? alert(error.message) : load()); }} title="Withdraw ticket" style={{ background: "none", border: "none", color: "#C0392B", cursor: "pointer", padding: 4, flexShrink: 0 }}><Trash2 size={15} /></button>
          <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${m.present ? W.teal : W.line}`, background: m.present ? W.teal : "#fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{m.present && <Check size={15} />}</div>
        </div>
      ))}
    </div>
  );
  const guys = (list || []).filter(m => m.gender === "male");
  const girls = (list || []).filter(m => m.gender === "female");
  const others = (list || []).filter(m => m.gender !== "male" && m.gender !== "female");
  const present = (list || []).filter(m => m.present).length;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "flex-start", overflowY: "auto", padding: "24px 12px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, maxWidth: 560, width: "100%", padding: "20px 20px 28px", margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: W.ink, minWidth: 0 }}>Check-in · {event.title}</div>
          <X size={22} color={W.soft} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <div style={{ fontSize: 13, color: W.soft, marginBottom: 16 }}>{list === null ? "Loading…" : `${present} of ${list.length} checked in`}</div>
        {err && <div style={{ background: "#FBE9E7", border: "1px solid #F2C4C0", color: "#C0392B", borderRadius: 10, padding: "10px 13px", fontSize: 13, marginBottom: 12 }}>⚠️ {err}</div>}
        {list !== null && present > 1 && <Introductions eventId={event.id} refreshKey={present} />}
        {list === null ? <Center>loading…</Center> : list.length === 0 ? <Center>No ticket holders yet.</Center> : (
          <>{seg("Guys", guys)}{seg("Girls", girls)}{others.length > 0 && seg("Other", others)}</>
        )}
        <div style={{ marginTop: 18, borderTop: `2px solid ${W.line}`, paddingTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontWeight: 800, color: W.ink, fontSize: 15 }}>📋 Guest list (manual) {guests.length > 0 && <span style={{ color: W.soft, fontWeight: 700, fontSize: 13 }}>· {guests.filter(g => g.checked_in).length}/{guests.length} in</span>}</div>
            {guests.length > 0 && <button onClick={() => {
              const w = window.open("", "_blank", "width=800,height=940"); if (!w) return;
              const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
              const rowsH = guests.map((g, i) => `<tr><td class="c">${i + 1}</td><td class="bx">☐</td><td><b>${escapeHtml(g.name)}</b></td><td class="c">${g.quantity || 1}</td><td>${escapeHtml(g.phone || "—")}</td><td>${escapeHtml(g.email || "—")}</td><td class="c">${g.age || "—"}</td><td>${escapeHtml(g.location || "—")}</td><td class="code">${escapeHtml(g.code)}</td><td class="sig"></td></tr>`).join("");
              w.document.write(`<!doctype html><html><head><title>Guest checklist — ${escapeHtml(event.title)}</title><style>
                body{font-family:system-ui,Arial,sans-serif;color:#1b2a27;margin:0;padding:30px}
                .br{font-size:11px;letter-spacing:4px;font-weight:800;color:#008069}
                h1{font-size:20px;margin:6px 0 2px}.sub{color:#5d6f6b;font-size:12.5px;margin-bottom:18px}
                table{width:100%;border-collapse:collapse;font-size:13px}
                th{background:#008069;color:#fff;font-size:10.5px;letter-spacing:.5px;text-transform:uppercase;text-align:left;padding:8px}
                td{padding:9px 8px;border-bottom:1px solid #d8e4e0;vertical-align:middle}
                .c{text-align:center}.bx{font-size:18px;text-align:center}.code{font-family:ui-monospace,monospace;font-weight:800}
                .sig{border-bottom:1px solid #d8e4e0;min-width:110px}
                .ft{margin-top:18px;font-size:11px;color:#8a9b97}
                @media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
              </style></head><body>
                <div class="br">G L A S S W I N G S &nbsp; E V E N T S</div>
                <h1>Guest checklist — ${escapeHtml(event.title)}</h1>
                <div class="sub">${escapeHtml(event.event_date || "")} · Printed ${today} · ${guests.length} guest${guests.length === 1 ? "" : "s"} · ${guests.reduce((a, g) => a + (g.quantity || 1), 0)} entries</div>
                <table><thead><tr><th>#</th><th>In</th><th>Guest name</th><th>Qty</th><th>Phone</th><th>Email</th><th>Age</th><th>Location</th><th>Code</th><th>Time in</th></tr></thead><tbody>${rowsH}</tbody></table>
                <div class="ft">Tick "In" on arrival and note the time. Codes must match the WhatsApp ticket. — Glasswings Events · glass-wings.com</div>
                <script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script></body></html>`);
              w.document.close();
            }} style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, padding: "6px 11px", fontSize: 12 }}>🖨️ Print checklist</button>}
          </div>
          <div style={{ fontSize: 12, color: W.soft, marginBottom: 10 }}>Free entry for non-members — add them here. If you enter an email, the ticket is emailed automatically; WhatsApp works too. Tick them in at the door.</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 6 }}>
            <input value={gName} onChange={e => setGName(e.target.value)} placeholder="Guest name *" style={{ flex: "1 1 140px", border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 11px", fontSize: 13.5, outline: "none" }} />
            <input value={gPhone} onChange={e => setGPhone(e.target.value)} placeholder="Phone" inputMode="tel" style={{ flex: "1 1 120px", border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 11px", fontSize: 13.5, outline: "none" }} />
          </div>
          <div style={{ display: "flex", gap: 7, marginBottom: 7 }}>
            <input value={gEmail} onChange={e => setGEmail(e.target.value)} placeholder="Email (optional)" type="email" style={{ flex: 1, minWidth: 0, border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 11px", fontSize: 13.5, outline: "none" }} />
            <input value={gAge} onChange={e => setGAge(e.target.value.replace(/\D/g, ""))} placeholder="Age" inputMode="numeric" style={{ width: 56, border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 11px", fontSize: 13.5, outline: "none", textAlign: "center" }} />
          </div>
          <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
            <input value={gLoc} onChange={e => setGLoc(e.target.value)} placeholder="Location / area (optional)" style={{ flex: 1, minWidth: 0, border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 11px", fontSize: 13.5, outline: "none" }} />
            <input value={gQty} onChange={e => setGQty(e.target.value.replace(/\D/g, ""))} placeholder="Qty" inputMode="numeric" style={{ width: 58, border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 11px", fontSize: 13.5, outline: "none", textAlign: "center" }} />
            <button onClick={addGuest} disabled={gBusy} style={{ ...btn(W.teal, "#fff"), padding: "9px 16px", fontSize: 13.5, opacity: gBusy ? .6 : 1 }}>{gBusy ? "…" : "+ Add"}</button>
          </div>
          {guests.map(g => (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderTop: `1px solid ${W.line}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: W.ink, fontSize: 14 }}>{g.name}{(g.quantity || 1) > 1 ? ` ×${g.quantity}` : ""}</div>
                <div style={{ fontSize: 12, color: W.soft, wordBreak: "break-all" }}>{[g.phone, g.email, g.age ? `${g.age}y` : null, g.location].filter(Boolean).join(" · ") || "no contact"} · <span style={{ fontFamily: "ui-monospace,monospace", fontWeight: 800, color: W.ink, background: "#E7F6EF", padding: "1px 7px", borderRadius: 6 }}>{g.code}</span></div>
              </div>
              {g.email && <button onClick={async () => {
                try {
                  const token = (await supabase.auth.getSession()).data.session?.access_token;
                  const r = await fetch("/api/email/ticket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "guest", access_token: token, guest_id: g.id }) });
                  const out = await r.json();
                  alert(r.ok ? (out.skipped ? "Not sent: " + out.skipped : `Ticket emailed to ${g.email} ✅`) : (out.error || "Could not send."));
                } catch (e2) { alert("Could not send the email."); }
              }} title="Email the ticket" style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, padding: "6px 9px", fontSize: 12 }}>✉️</button>}
              <button onClick={() => shareGuest(g)} title="Send ticket with QR on WhatsApp" style={{ ...btn("#25D366", "#fff"), padding: "6px 9px", fontSize: 12 }}><MessageCircle size={13} /></button>
              <button onClick={() => { if (window.confirm(`Remove ${g.name} from the guest list?`)) supabase.rpc("delete_guest", { p_id: g.id }).then(({ error }) => error ? alert(error.message) : loadGuests()); }} title="Remove guest" style={{ background: "none", border: "none", color: "#C0392B", cursor: "pointer", padding: 4 }}><Trash2 size={14} /></button>
              <div onClick={() => { setGuests(gs => gs.map(x => x.id === g.id ? { ...x, checked_in: !g.checked_in } : x)); supabase.rpc("set_guest_checkin", { p_id: g.id, p_in: !g.checked_in }); }} style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${g.checked_in ? W.teal : W.line}`, background: g.checked_in ? W.teal : "#fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>{g.checked_in && <Check size={15} />}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function VenueAutocomplete({ value, onChange }) {
  const [q, setQ] = useState(value || "");
  const [sug, setSug] = useState([]);
  const [open, setOpen] = useState(false);
  const tref = useRef();
  const run = (text) => {
    setQ(text);
    onChange({ venue: text, lat: null, lng: null });
    clearTimeout(tref.current);
    if (text.trim().length < 3) { setSug([]); return; }
    tref.current = setTimeout(async () => {
      try {
        const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=5`);
        const j = await r.json();
        setSug(j.features || []); setOpen(true);
      } catch { setSug([]); }
    }, 350);
  };
  const label = (p) => [p.name, p.street && !p.name?.includes(p.street) ? p.street : null, p.city, p.state].filter(Boolean).join(", ");
  const pick = (f) => {
    const p = f.properties; const lbl = label(p); const [lng, lat] = f.geometry.coordinates;
    setQ(lbl); onChange({ venue: lbl, lat, lng }); setSug([]); setOpen(false);
  };
  return (
    <div style={{ position: "relative", marginBottom: 10 }}>
      <input value={q} onChange={e => run(e.target.value)} onFocus={() => sug.length && setOpen(true)} placeholder="Venue / address — start typing to search" style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none", boxSizing: "border-box" }} />
      {open && sug.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: `1px solid ${W.line}`, borderRadius: 10, marginTop: 4, zIndex: 20, boxShadow: "0 6px 20px rgba(0,0,0,.12)", overflow: "hidden" }}>
          {sug.map((f, i) => (
            <div key={i} onClick={() => pick(f)} style={{ padding: "10px 12px", fontSize: 13.5, color: W.ink, cursor: "pointer", borderTop: i ? `1px solid ${W.line}` : "none", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <MapPin size={14} style={{ marginTop: 2, flexShrink: 0, color: W.soft }} />{label(f.properties)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function AddonDraft({ value, onChange }) {
  const [name, setName] = useState(""); const [price, setPrice] = useState("");
  const inp = { border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 11px", fontSize: 14, outline: "none", color: W.ink };
  const add = () => { const n = name.trim(); if (!n) return; onChange([...value, { name: n, price: Number(price) || 0 }]); setName(""); setPrice(""); };
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: W.ink, marginBottom: 2 }}>What's included (add-ons)</div>
      <div style={{ fontSize: 12, color: W.soft, marginBottom: 8 }}>Each is priced separately (₹0 = free). Buyers pick these at checkout.</div>
      {value.map((a, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${W.line}` }}>
          <span style={{ fontSize: 14, color: W.ink }}>{a.name} · <b style={{ color: a.price > 0 ? W.teal : W.soft }}>{a.price > 0 ? `₹${a.price}` : "Free"}</b></span>
          <X size={15} color="#C0392B" style={{ cursor: "pointer" }} onClick={() => onChange(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welcome drink" style={{ ...inp, flex: 1, minWidth: 0 }} />
        <input value={price} onChange={e => setPrice(e.target.value.replace(/\D/g, ""))} placeholder="₹" inputMode="numeric" style={{ ...inp, width: 64 }} />
        <button onClick={add} style={btn(W.ink, "#fff")}><Plus size={14} />Add</button>
      </div>
    </div>
  );
}
function PerkPicker({ kind, label, color, value, onChange, library, onAddPerk, onDelPerk }) {
  const [txt, setTxt] = useState("");
  const add = (lbl) => { const n = (lbl || "").trim(); if (!n) return; if (!value.includes(n)) onChange([...value, n]); if (!library.some(p => p.label === n)) onAddPerk(kind, n); setTxt(""); };
  const unused = library.filter(p => !value.includes(p.label));
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: W.ink, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: value.length ? 8 : 0 }}>
        {value.map(v => <span key={v} style={{ background: color, color: "#fff", fontSize: 12.5, fontWeight: 600, padding: "4px 9px", borderRadius: 12, display: "flex", alignItems: "center", gap: 5 }}>{v}<X size={12} style={{ cursor: "pointer" }} onClick={() => onChange(value.filter(x => x !== v))} /></span>)}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: unused.length ? 8 : 0 }}>
        <input value={txt} onChange={e => setTxt(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(txt); } }} placeholder={kind === "inclusion" ? "e.g. Welcome drink" : "e.g. Parking"} style={{ flex: 1, minWidth: 0, border: `1px solid ${W.line}`, borderRadius: 10, padding: "9px 12px", fontSize: 14, outline: "none" }} />
        <button onClick={() => add(txt)} style={{ ...btn("#fff", color), border: `1px solid ${W.line}`, fontSize: 13 }}><Plus size={14} />Add</button>
      </div>
      {unused.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {unused.map(p => <span key={p.id} style={{ border: `1px dashed ${W.line}`, color: W.soft, fontSize: 12, padding: "3px 8px", borderRadius: 12, cursor: "pointer" }} onClick={() => add(p.label)}>+ {p.label}</span>)}
      </div>}
    </div>
  );
}
function parseTimeStr(t) {
  t = (t || "").trim().toUpperCase(); if (!t) return "20:00";
  const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/); if (!m) return "20:00";
  let h = +m[1]; const mn = m[2] ? +m[2] : 0; const ap = m[3];
  if (ap === "PM" && h < 12) h += 12; if (ap === "AM" && h === 12) h = 0;
  return String(h).padStart(2, "0") + ":" + String(mn).padStart(2, "0");
}
function EventDetailsEditor({ event, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(null);
  const [saving, setSaving] = useState(false);
  const ta = { width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", marginBottom: 9, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" };
  const ip = { ...ta, resize: "none" };
  const start = () => {
    setD({
      emoji: event.emoji || "", title: event.title || "", description: event.description || "",
      schedule: event.schedule || "", food_dining: event.food_dining || "", facilities: event.facilities || "",
      dress_code: event.dress_code || "", venue: event.venue || "", venue_lat: event.venue_lat || null, venue_lng: event.venue_lng || null,
      date: event.event_at ? new Date(event.event_at).toISOString().slice(0, 10) : "", time: ""
    });
    setOpen(true);
  };
  const save = async () => {
    setSaving(true);
    const patch = {
      emoji: d.emoji || "🎟️", title: d.title, description: d.description, schedule: d.schedule,
      food_dining: d.food_dining, facilities: d.facilities, dress_code: d.dress_code,
      venue: d.venue, venue_lat: d.venue_lat, venue_lng: d.venue_lng
    };
    if (d.date) {
      const iso = new Date(d.date + "T" + parseTimeStr(d.time) + ":00").toISOString();
      patch.event_at = iso;
      const dt = new Date(iso);
      patch.event_date = dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) + (d.time ? " · " + d.time.trim() : "");
    }
    await onUpdate(event.id, patch);
    setSaving(false); setOpen(false);
  };
  if (!open) return (
    <button onClick={start} style={{ ...btn("#fff", W.teal), border: `1px solid ${W.teal}`, padding: "9px 14px", fontSize: 13, alignSelf: "flex-start" }}>✏️ Edit event details</button>
  );
  return (
    <div style={{ border: `1px solid ${W.line}`, borderRadius: 12, padding: 13 }}>
      <div style={{ fontWeight: 800, color: W.ink, fontSize: 14, marginBottom: 10 }}>✏️ Edit event details</div>
      <div style={{ display: "flex", gap: 9, marginBottom: 9 }}>
        <input value={d.emoji} onChange={e => setD({ ...d, emoji: e.target.value })} maxLength={2} style={{ width: 50, textAlign: "center", fontSize: 20, border: `1px solid ${W.line}`, borderRadius: 10, padding: 8 }} />
        <input value={d.title} onChange={e => setD({ ...d, title: e.target.value })} placeholder="Event title" style={{ ...ip, marginBottom: 0, flex: 1 }} />
      </div>
      <input value={d.description} onChange={e => setD({ ...d, description: e.target.value })} placeholder="Short description" style={ip} />
      <textarea value={d.schedule} onChange={e => setD({ ...d, schedule: e.target.value })} rows={3} placeholder={"Schedule — one item per line"} style={ta} />
      <textarea value={d.food_dining} onChange={e => setD({ ...d, food_dining: e.target.value })} rows={2} placeholder={"Food & dining — one item per line"} style={ta} />
      <textarea value={d.facilities} onChange={e => setD({ ...d, facilities: e.target.value })} rows={2} placeholder="Facilities — comma separated" style={ta} />
      <input value={d.dress_code} onChange={e => setD({ ...d, dress_code: e.target.value })} placeholder="Dress code" style={ip} />
      <div style={{ display: "flex", gap: 8, marginBottom: 9, flexWrap: "wrap" }}>
        <label style={{ flex: "1 1 150px", fontSize: 12, color: W.soft }}>Date<input type="date" value={d.date} onChange={e => setD({ ...d, date: e.target.value })} style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "9px 11px", fontSize: 14, outline: "none", color: W.ink }} /></label>
        <label style={{ flex: "1 1 110px", fontSize: 12, color: W.soft }}>Time<input value={d.time} onChange={e => setD({ ...d, time: e.target.value })} placeholder={event.event_date || "8PM"} style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "9px 11px", fontSize: 14, outline: "none" }} /></label>
      </div>
      <div style={{ fontSize: 11, color: W.soft, marginBottom: 9 }}>Leave date blank to keep the current date{event.event_date ? ` (${event.event_date})` : ""}. Set both date and time to change it.</div>
      <VenueAutocomplete value={d.venue} onChange={({ venue, lat, lng }) => setD({ ...d, venue, venue_lat: lat, venue_lng: lng })} />
      <div style={{ display: "flex", gap: 9, marginTop: 10 }}>
        <button onClick={() => setOpen(false)} style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, flex: 1, justifyContent: "center" }}>Cancel</button>
        <button onClick={save} disabled={saving || !d.title} style={{ ...btn(W.teal, "#fff"), flex: 1, justifyContent: "center", opacity: (saving || !d.title) ? .6 : 1 }}>{saving ? "Saving…" : "Save details"}</button>
      </div>
    </div>
  );
}
function AdminEvents({ events, categories, cities, ticketTypes, rooms, lockCity, perksList, onAddPerk, onDelPerk, addonsMap, onAddAddon, onDelAddon, onCreate, onUpdate, onDelete, onAddOption, onDelOption, onAddTicketType, onDelTicketType, onBroadcastEvent, onSendEventDM, onSetOptionImage, canApprove, dims, optsAll }) {
  const [creating, setCreating] = useState(false), [manage, setManage] = useState(null);
  const [view, setView] = useState("upcoming");
  const [membersFor, setMembersFor] = useState(null);
  const todayISO = new Date().toISOString().slice(0, 10);
  const visEvents = events.filter(e => view === "past" ? (e.event_at && e.event_at < todayISO) : (!e.event_at || e.event_at >= todayISO));
  const blankF = { emoji: "🎟️", title: "", price: "", desc: "", schedule: "", food: "", facilities: "", dress: "", date: "", venue: "", venueLat: null, venueLng: null, category: "", city: lockCity || "", banner: "", bannerType: "image", poster: "", tags: {}, terms: "", repeat: "none", startDate: "", endDate: "", time: "", customDates: [], addons: [], exclusions: [] };
  const [f, setF] = useState(blankF);
  const [up, setUp] = useState(false);
  const bRef = useRef(null);
  const [members, setMembers] = useState([]); const [sendFor, setSendFor] = useState(null); const [checkIn, setCheckIn] = useState(null);
  useEffect(() => { supabase.from("profiles").select("id, gender, member_details(age, profession, city)").then(({ data }) => setMembers(data || [])); }, []);
  const reset = () => setF(blankF);
  const pickBanner = async (e) => { const file = e.target.files?.[0]; if (!file) return; setUp(true); try { const url = await uploadChatFile("banners", file); setF(s => ({ ...s, banner: url, bannerType: file.type.startsWith("video") ? "video" : "image" })); } catch (x) { alert("Upload failed: " + x.message); } setUp(false); };
  const pRef = useRef(null);
  const pickPoster = async (e) => { const file = e.target.files?.[0]; if (!file) return; setUp(true); try { const url = await uploadChatFile("banners", file); setF(s => ({ ...s, poster: url })); } catch (x) { alert("Upload failed: " + x.message); } setUp(false); };
  const fmtDay = iso => { const d = new Date(iso + "T00:00:00"); return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }); };
  const withTime = lbl => lbl + (f.time ? ` · ${f.time}` : "");
  const occ = iso => ({ label: withTime(fmtDay(iso)), iso });
  const buildDates = () => {
    if (f.repeat === "none") return f.startDate ? [occ(f.startDate)] : [];
    if (f.repeat === "custom") return f.customDates.filter(Boolean).map(occ);
    if (!f.startDate || !f.endDate) return [];
    const out = []; const d = new Date(f.startDate + "T00:00:00"); const end = new Date(f.endDate + "T00:00:00");
    let n = 0;
    while (n < 60 && d <= end) {
      out.push(occ(d.toISOString().slice(0, 10)));
      if (f.repeat === "weekly") d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + 1);
      n++;
    }
    return out;
  };
  const create = async () => {
    if (!f.title) return;
    const dates = buildDates();
    await onCreate({ title: f.title, emoji: f.emoji || "🎟️", ticket_price: Number(f.price) || 0, description: f.desc, schedule: f.schedule, food_dining: f.food, facilities: f.facilities, dress_code: f.dress, event_date: dates[0]?.label || "", event_at: dates[0]?.iso || null, venue: f.venue, venue_lat: f.venueLat, venue_lng: f.venueLng, category: f.category, city: lockCity || f.city, tags: f.tags, banner_url: f.banner, banner_type: f.bannerType, poster_url: f.poster, terms: f.terms, exclusions: f.exclusions }, dates, f.addons);
    reset(); setCreating(false);
  };
  const chip = (name, sel, onClick) => <button key={name} onClick={onClick} style={{ padding: "6px 12px", borderRadius: 16, border: `1px solid ${sel ? W.teal : W.line}`, background: sel ? "#E7F6EF" : "#fff", color: W.ink, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{name}</button>;
  return (
    <div style={{ padding: 14 }}>
      {sendFor && <EventSendSheet event={sendFor} members={members} onSend={async (ids) => { await onSendEventDM(sendFor, ids); setSendFor(null); }} onClose={() => setSendFor(null)} />}
      {checkIn && <CheckInSheet event={checkIn} onClose={() => setCheckIn(null)} />}
      {membersFor && <EventMembersSheet event={membersFor} onClose={() => setMembersFor(null)} />}
      {creating ? (
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: W.ink }}>New ticketed event</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div onClick={() => pRef.current?.click()} style={{ width: 108, flexShrink: 0, aspectRatio: "3/4", borderRadius: 12, overflow: "hidden", border: f.poster ? `1px solid ${W.line}` : `1.5px dashed ${W.line}`, background: W.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", textAlign: "center", color: W.soft, fontSize: 11.5, fontWeight: 600, padding: f.poster ? 0 : 8 }}>
              {f.poster ? <img src={f.poster} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : (up ? "Uploading…" : "+ Poster\u00A0· portrait 3:4 (event cards)")}
            </div>
            <div onClick={() => bRef.current?.click()} style={{ flex: 1, minWidth: 0, borderRadius: 12, overflow: "hidden", border: f.banner ? `1px solid ${W.line}` : `1.5px dashed ${W.line}`, background: W.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", textAlign: "center", color: W.soft, fontSize: 12, fontWeight: 600, padding: f.banner ? 0 : 8 }}>
              {f.banner ? <BannerMedia url={f.banner} type={f.bannerType} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : (up ? "Uploading…" : "+ Banner · landscape (slider & event page) — or a video")}
            </div>
          </div>
          <input ref={bRef} type="file" accept="image/*,video/*" onChange={pickBanner} style={{ display: "none" }} />
          <input ref={pRef} type="file" accept="image/*" onChange={pickPoster} style={{ display: "none" }} />
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <input value={f.emoji} onChange={e => setF({ ...f, emoji: e.target.value })} maxLength={2} style={{ width: 56, textAlign: "center", fontSize: 22, border: `1px solid ${W.line}`, borderRadius: 10, padding: 8 }} />
            <input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Event title" style={{ flex: 1, minWidth: 0, border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none" }} />
          </div>
          <div style={{ fontSize: 12, color: W.soft, fontWeight: 700, marginBottom: 6 }}>Category</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
            {categories.length === 0 ? <span style={{ fontSize: 12.5, color: W.soft }}>Add categories with "Manage" above first.</span> : categories.map(c => chip(c.name, f.category === c.name, () => setF({ ...f, category: f.category === c.name ? "" : c.name })))}
          </div>
          {(dims || []).map(d => {
            const dopts = (optsAll || []).filter(o => o.kind === d.name);
            if (!dopts.length) return null;
            return (
              <div key={d.id}>
                <div style={{ fontSize: 12, color: W.soft, fontWeight: 700, marginBottom: 6 }}>{d.name}</div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
                  {dopts.map(o => chip(o.name, f.tags[d.name] === o.name, () => setF({ ...f, tags: { ...f.tags, [d.name]: f.tags[d.name] === o.name ? undefined : o.name } })))}
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 12, color: W.soft, fontWeight: 700, marginBottom: 6 }}>City</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
            {cities.length === 0 ? <span style={{ fontSize: 12.5, color: W.soft }}>Add cities with "Manage" above first.</span> : cities.map(c => chip(c.name, f.city === c.name, () => setF({ ...f, city: f.city === c.name ? "" : c.name })))}
          </div>
          <input value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} placeholder="Short description" style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none", marginBottom: 10 }} />
          <textarea value={f.schedule} onChange={e => setF({ ...f, schedule: e.target.value })} placeholder={"Schedule (optional) — one item per line, e.g.\n7:00 PM — Doors open\n8:00 PM — Live music"} rows={3} style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 14, outline: "none", marginBottom: 10, fontFamily: "inherit", resize: "vertical" }} />
          <textarea value={f.food} onChange={e => setF({ ...f, food: e.target.value })} placeholder={"Food & dining (optional) — one item per line, e.g.\nUnlimited starters\nDinner buffet included"} rows={2} style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 14, outline: "none", marginBottom: 10, fontFamily: "inherit", resize: "vertical" }} />
          <textarea value={f.facilities} onChange={e => setF({ ...f, facilities: e.target.value })} placeholder="Facilities (optional) — comma separated, e.g. Parking, Washrooms, DJ, Photo booth" rows={2} style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 14, outline: "none", marginBottom: 10, fontFamily: "inherit", resize: "vertical" }} />
          <input value={f.dress} onChange={e => setF({ ...f, dress: e.target.value })} placeholder="Dress code (optional) — e.g. Smart casuals / Bollywood theme" style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none", marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
            {[["none", "One-time"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["custom", "Custom dates"]].map(([v, l]) => (
              <button key={v} onClick={() => setF({ ...f, repeat: v })} style={{ padding: "7px 13px", borderRadius: 16, border: `1px solid ${f.repeat === v ? W.teal : W.line}`, background: f.repeat === v ? W.teal : "#fff", color: f.repeat === v ? "#fff" : W.soft, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>{l}</button>
            ))}
          </div>
          {f.repeat === "none" ? (
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <label style={{ flex: "1 1 150px", fontSize: 12, color: W.soft }}>Date<input type="date" value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", color: W.ink }} /></label>
              <label style={{ flex: "1 1 110px", fontSize: 12, color: W.soft }}>Time<input value={f.time} onChange={e => setF({ ...f, time: e.target.value })} placeholder="8PM" style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none" }} /></label>
            </div>
          ) : f.repeat === "custom" ? (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input type="date" onChange={e => { const v = e.target.value; if (v && !f.customDates.includes(v)) setF({ ...f, customDates: [...f.customDates, v].sort() }); }} style={{ flex: 1, border: `1px solid ${W.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", color: W.ink }} />
                <input value={f.time} onChange={e => setF({ ...f, time: e.target.value })} placeholder="Time (e.g. 8PM)" style={{ width: 120, border: `1px solid ${W.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none" }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {f.customDates.map(d => <span key={d} style={{ background: "#E7F6EF", color: W.ink, fontSize: 12.5, fontWeight: 600, padding: "4px 9px", borderRadius: 12, display: "flex", alignItems: "center", gap: 5 }}>{fmtDay(d)}<X size={12} style={{ cursor: "pointer" }} onClick={() => setF({ ...f, customDates: f.customDates.filter(x => x !== d) })} /></span>)}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <label style={{ flex: "1 1 120px", fontSize: 12, color: W.soft }}>Starts<input type="date" value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", color: W.ink }} /></label>
                <label style={{ flex: "1 1 120px", fontSize: 12, color: W.soft }}>Ends<input type="date" value={f.endDate} onChange={e => setF({ ...f, endDate: e.target.value })} style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", color: W.ink }} /></label>
                <label style={{ flex: "1 1 90px", fontSize: 12, color: W.soft }}>Time<input value={f.time} onChange={e => setF({ ...f, time: e.target.value })} placeholder="8PM" style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none" }} /></label>
              </div>
              <div style={{ fontSize: 12.5, color: W.soft }}>{buildDates().length ? `Creates ${buildDates().length} ${f.repeat} event${buildDates().length === 1 ? "" : "s"}.` : "Pick a start and end date."}</div>
            </div>
          )}
          <VenueAutocomplete value={f.venue} onChange={({ venue, lat, lng }) => setF({ ...f, venue, venueLat: lat, venueLng: lng })} />
          <textarea value={f.terms} onChange={e => setF({ ...f, terms: e.target.value })} rows={2} placeholder="Terms & conditions (optional)" style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none", marginBottom: 10, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
          <PerkPicker kind="exclusion" label="Not included" color="#C0392B" value={f.exclusions} onChange={v => setF({ ...f, exclusions: v })} library={(perksList || []).filter(p => p.kind === "exclusion")} onAddPerk={onAddPerk} onDelPerk={onDelPerk} />
          <AddonDraft value={f.addons} onChange={v => setF({ ...f, addons: v })} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ color: W.soft, fontSize: 14 }}>₹</span>
            <input value={f.price} onChange={e => setF({ ...f, price: e.target.value.replace(/\D/g, "") })} placeholder="0 (free)" inputMode="numeric" style={{ flex: 1, minWidth: 0, border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none" }} />
            <span style={{ color: W.soft, fontSize: 14 }}>per ticket</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setCreating(false); reset(); }} style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, flex: 1, justifyContent: "center" }}>Cancel</button>
            <button onClick={create} disabled={up} style={{ ...btn(W.teal, "#fff"), flex: 1, justifyContent: "center", opacity: up ? .6 : 1 }}>Create</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} style={{ width: "100%", padding: 14, border: `1.5px dashed ${W.teal}`, borderRadius: 14, background: "#fff", color: W.teal, fontWeight: 700, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}><Plus size={18} />Create ticketed event</button>
      )}
      {!creating && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[["upcoming", "Upcoming"], ["past", "Past"]].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${view === v ? W.teal : W.line}`, background: view === v ? W.teal : "#fff", color: view === v ? "#fff" : W.soft, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      )}
      {!creating && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visEvents.map(e => (
          <div key={e.id} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar room={{ emoji: e.emoji }} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: W.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</div>
                <div style={{ fontSize: 13, color: W.soft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(() => { const tt = (ticketTypes && ticketTypes[e.id]) || []; if (tt.length) { const min = Math.min(...tt.map(t => t.price || 0)); return min === 0 ? "Free" : `From ₹${min}`; } return (e.ticket_price || 0) === 0 ? "Free" : `₹${e.ticket_price}/ticket`; })()}{e.category ? ` · ${e.category}` : ""}{e.city ? ` · ${e.city}` : ""}</div>
                <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>{e.promo_pct != null && <span style={{ background: "#EFEAFB", color: "#7C3AED", fontSize: 10.5, fontWeight: 800, padding: "2px 9px", borderRadius: 10 }}>📣 Promo {e.promo_pct}%</span>}{e.approved
                  ? <span style={{ background: "#E7F6EF", color: W.teal, fontSize: 10.5, fontWeight: 800, padding: "2px 9px", borderRadius: 10 }}>● Live</span>
                  : <span style={{ background: "#FDF6EC", color: "#B45309", fontSize: 10.5, fontWeight: 800, padding: "2px 9px", borderRadius: 10 }}>⏳ Pending approval{canApprove ? "" : " — visible only to you"}</span>}</div>
              </div>
              <button onClick={() => setManage(manage === e.id ? null : e.id)} style={{ ...btn("#fff", manage === e.id ? W.teal : W.soft), border: `1px solid ${W.line}`, padding: "7px 9px", flexShrink: 0 }}><Settings size={17} /></button>
            </div>
            {canApprove && (
              <div style={{ marginTop: 10 }}>
                {e.approved
                  ? <button onClick={() => window.confirm("Unpublish this event? It will disappear from the app until re-approved.") && onUpdate(e.id, { approved: false })} style={{ ...btn("#fff", "#B45309"), border: "1px solid #F0D9A8", padding: "7px 13px", fontSize: 12.5 }}>Unpublish</button>
                  : <button onClick={() => onUpdate(e.id, { approved: true })} style={{ ...btn(W.teal, "#fff"), padding: "8px 16px", fontSize: 13 }}>✓ Approve &amp; publish</button>}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => onBroadcastEvent(e)} title="Post to all group chats" style={{ ...btn(W.teal, "#fff"), flex: 1, justifyContent: "center", padding: "9px 6px", fontSize: 12.5 }}><Zap size={14} />Post</button>
              <button onClick={() => setMembersFor(e)} title="Who's coming — list, contact, withdraw" style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, flex: 1, justifyContent: "center", padding: "9px 6px", fontSize: 12.5 }}><Users size={14} />Members</button>
              <button onClick={() => setCheckIn(e)} title="Check in attendees" style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, flex: 1, justifyContent: "center", padding: "9px 6px", fontSize: 12.5 }}><Users size={14} />Check-in</button>
              <button onClick={() => setSendFor(e)} title="Message members" style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, flex: 1, justifyContent: "center", padding: "9px 6px", fontSize: 12.5 }}><Send size={14} />Notify</button>
            </div>
            {manage === e.id && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${W.line}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                <EventBanner ev={e} onUpdate={onUpdate} />
                <EventShare event={e} />
                <GuestTickets event={e} />
                <EventMediaEditor event={e} onUpdate={onUpdate} />
                <EventDetailsEditor event={e} onUpdate={onUpdate} />
                <PromoPctEditor event={e} onUpdate={onUpdate} canApprove={canApprove} />
                <div style={{ marginTop: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: W.ink }}>Category &amp; city</label>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <select value={e.category || ""} onChange={ev => onUpdate(e.id, { category: ev.target.value || null })} style={{ flex: "1 1 140px", padding: "9px 10px", borderRadius: 9, border: `1px solid ${W.line}`, background: "#fff", fontSize: 13.5, color: W.ink, outline: "none" }}>
                      <option value="">No category</option>
                      {categories.map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <select value={e.city || ""} onChange={ev => onUpdate(e.id, { city: ev.target.value || null })} disabled={!!lockCity} style={{ flex: "1 1 140px", padding: "9px 10px", borderRadius: 9, border: `1px solid ${W.line}`, background: "#fff", fontSize: 13.5, color: W.ink, outline: "none", opacity: lockCity ? .6 : 1 }}>
                      <option value="">All cities</option>
                      {cities.map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  {(dims || []).map(d => {
                    const dopts = (optsAll || []).filter(o => o.kind === d.name);
                    if (!dopts.length) return null;
                    return (
                      <select key={d.id} value={(e.tags || {})[d.name] || ""} onChange={ev => { const t = { ...(e.tags || {}) }; if (ev.target.value) t[d.name] = ev.target.value; else delete t[d.name]; onUpdate(e.id, { tags: t }); }} style={{ width: "100%", marginTop: 8, padding: "9px 10px", borderRadius: 9, border: `1px solid ${W.line}`, background: "#fff", fontSize: 13.5, color: W.ink, outline: "none" }}>
                        <option value="">{d.name}: any</option>
                        {dopts.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                      </select>
                    );
                  })}
                  <div style={{ fontSize: 11.5, color: W.soft, marginTop: 6 }}>Changes save instantly — works on already-posted events.</div>
                </div>
                <TicketTypes eventId={e.id} types={ticketTypes[e.id] || []} rooms={rooms} onAdd={onAddTicketType} onDel={onDelTicketType} />
                <AddonEditor eventId={e.id} list={addonsMap?.[e.id] || []} onAdd={onAddAddon} onDel={onDelAddon} />
                <GenderBalance ev={e} onUpdate={onUpdate} />
                <EventTerms ev={e} onUpdate={onUpdate} />
                <PinEditor room={e} onUpdate={onUpdate} />
                <button onClick={() => { if (confirm("Delete this event and all its messages?")) onDelete(e.id); }} style={{ ...btn("#fff", "#C0392B"), border: "1px solid #F2C4C0", justifyContent: "center" }}><Trash2 size={15} />Delete event</button>
              </div>
            )}
          </div>
        ))}
        {visEvents.length === 0 && <Center>{view === "past" ? "No past events." : "No upcoming events — create one!"}</Center>}
      </div>}
    </div>
  );
}
function GuestTickets({ event }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [given, setGiven] = useState({});
  const [msg, setMsg] = useState("");
  useEffect(() => { supabase.rpc("staff_directory").then(({ data }) => setList(data || [])); }, []);
  const matches = q.trim().length < 2 ? [] : list.filter(m => (m.full_name || "").toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6);
  const give = async (m) => {
    setMsg("");
    const { error } = await supabase.rpc("issue_ticket", { p_event: event.id, p_user: m.id, p_qty: 1 });
    if (error) return setMsg(error.message);
    setGiven(g => ({ ...g, [m.id]: (g[m.id] || 0) + 1 }));
    setMsg(`✓ Free ticket issued to ${m.full_name} — they'll see it in their app and get it by email.`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      fetch("/api/email/ticket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: session?.access_token, event_id: event.id, for_user: m.id }) });
    } catch {}
  };
  return (
    <div style={{ marginTop: 16 }}>
      <label style={{ fontSize: 13, fontWeight: 700, color: W.ink }}>Guest list — free tickets</label>
      <div style={{ fontSize: 12, color: W.soft, margin: "2px 0 8px" }}>Quietly give free tickets to friends and special guests. Nothing is shown or sold on the portal — the guest just receives the ticket. (They need a free account first.)</div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search member by name…" style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 11px", fontSize: 13.5, outline: "none", boxSizing: "border-box", color: W.ink }} />
      {matches.map(m => (
        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", borderBottom: `1px solid ${W.line}` }}>
          <PersonAvatar url={m.avatar_url} name={m.full_name} size={30} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: W.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.full_name}</span>
          <button onClick={() => give(m)} style={{ ...btn(W.teal, "#fff"), padding: "6px 11px", fontSize: 12.5 }}>{given[m.id] ? `Give again (${given[m.id]})` : "Give ticket"}</button>
        </div>
      ))}
      {msg && <div style={{ fontSize: 12.5, color: msg.startsWith("✓") ? W.teal : "#C0392B", marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
function EventShare({ event }) {
  const link = `${window.location.origin}/e/${event.id}`;
  const [copied, setCopied] = useState(false);
  const [poster, setPoster] = useState(false);
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(link)}`;
  const copy = () => { try { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };
  const share = async () => { try { if (navigator.share) await navigator.share({ title: event.title, text: `Check out ${event.title} on Glasswings`, url: link }); else copy(); } catch {} };
  const makePoster = async () => {
    setPoster(true);
    try {
      const place = [event.venue, event.city].filter(Boolean).join(", ");
      const blob = await makePosterBlob({ emoji: event.emoji, title: event.title, dateStr: event.event_date, place, bannerUrl: event.poster_url || event.banner_url, bannerType: event.poster_url ? "image" : event.banner_type, link });
      const file = new File([blob], "event-poster.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: event.title });
      else { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${(event.title || "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-poster.png`; a.click(); URL.revokeObjectURL(url); }
    } catch (e) { }
    setPoster(false);
  };
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 700, color: W.ink }}>Share &amp; sell tickets</label>
      <div style={{ fontSize: 12, color: W.soft, margin: "2px 0 8px" }}>Anyone who opens this link or scans the code lands on this event and can buy a ticket.</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input readOnly value={link} onFocus={e => e.target.select()} style={{ flex: 1, minWidth: 0, border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 11px", fontSize: 12.5, color: W.ink, background: W.bg }} />
        <button onClick={copy} style={btn(W.teal, "#fff")}>{copied ? "Copied ✓" : "Copy"}</button>
        <button onClick={share} title="Share" style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}` }}><Share2 size={15} /></button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <img src={qr} alt="Event QR code" width={120} height={120} style={{ borderRadius: 10, border: `1px solid ${W.line}` }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: W.ink, fontWeight: 700, marginBottom: 2 }}>Scan to buy tickets</div>
          <div style={{ fontSize: 12, color: W.soft, marginBottom: 8 }}>Print it on flyers or show it at your stall.</div>
          <a href={qr} target="_blank" rel="noreferrer" style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, textDecoration: "none", fontSize: 13 }}>Open / save QR</a>
        </div>
      </div>
      <button onClick={makePoster} disabled={poster} style={{ ...btn(W.teal, "#fff"), width: "100%", justifyContent: "center", marginTop: 12, opacity: poster ? .6 : 1 }}><ImageIcon size={16} />{poster ? "Building poster…" : "Download event poster"}</button>
    </div>
  );
}
function AddonEditor({ eventId, list, onAdd, onDel }) {
  const [name, setName] = useState(""); const [price, setPrice] = useState("");
  const inp = { border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 11px", fontSize: 14, outline: "none", color: W.ink };
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 700, color: W.ink }}>Add-ons</label>
      <div style={{ fontSize: 12, color: W.soft, margin: "2px 0 8px" }}>Extras buyers can add at checkout (₹0 = free perk). E.g. Welcome drink ₹50, Table ₹500.</div>
      {(list || []).map(a => (
        <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderTop: `1px solid ${W.line}` }}>
          <span style={{ fontSize: 14, color: W.ink }}>{a.name} · <b style={{ color: a.price > 0 ? W.teal : W.soft }}>{a.price > 0 ? `₹${a.price}` : "Free"}</b></span>
          <Trash2 size={16} color="#C0392B" style={{ cursor: "pointer" }} onClick={() => onDel(a.id)} />
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Add-on name" style={{ ...inp, flex: 1, minWidth: 0 }} />
        <input value={price} onChange={e => setPrice(e.target.value.replace(/\D/g, ""))} placeholder="₹" inputMode="numeric" style={{ ...inp, width: 70 }} />
        <button onClick={async () => { if (!name.trim()) return; await onAdd(eventId, { name, price }); setName(""); setPrice(""); }} style={btn(W.ink, "#fff")}><Plus size={14} />Add</button>
      </div>
    </div>
  );
}
function RoomName({ room, onUpdate }) {
  const [n, setN] = useState(room.name || "");
  const [saved, setSaved] = useState(false);
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: W.soft }}>Room name</label>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input value={n} onChange={e => { setN(e.target.value); setSaved(false); }} placeholder="Room name" style={{ flex: 1, minWidth: 0, border: `1px solid ${W.line}`, borderRadius: 9, padding: "10px 12px", fontSize: 14, outline: "none", color: W.ink }} />
        <button onClick={async () => { const t = n.trim(); if (!t) return; await onUpdate(room.id, { name: t }); room.name = t; setSaved(true); }} style={btn(W.teal, "#fff")}>{saved ? "Saved ✓" : "Save"}</button>
      </div>
    </div>
  );
}
function RoomPhoto({ room, onUpdate }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true);
    try { const url = await uploadPhoto(room.id, f); await onUpdate(room.id, { logo_url: url }); }
    catch (x) { alert("Upload failed: " + x.message); }
    setBusy(false);
  };
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: W.soft }}>Room photo / icon</label>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
        <Avatar room={room} size={48} />
        <button onClick={() => ref.current?.click()} style={btn(W.teal, "#fff")}><Camera size={15} />{busy ? "Uploading…" : "Change photo"}</button>
        <input ref={ref} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
      </div>
    </div>
  );
}
function EditMemberSheet({ member, isSuper, cities, onClose, onSaved }) {
  const [name, setName] = useState(member.full_name || "");
  const [age, setAge] = useState(member.age || "");
  const [area, setArea] = useState(member.area || "");
  const [city, setCity] = useState(member.city || "");
  const [prof, setProf] = useState(member.profession || "");
  const [gender, setGender] = useState(member.gender || "");
  const [phone, setPhone] = useState(member.phone || "");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const inp = { width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none", color: W.ink, marginBottom: 10, boxSizing: "border-box" };
  const save = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("staff_update_member", { p_user: member.id, p_full_name: name, p_age: String(age || ""), p_area: area, p_city: city, p_profession: prof, p_phone: isSuper ? phone : null, p_gender: gender || null });
    setBusy(false);
    if (error) return setErr(error.message);
    onSaved();
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "flex-start", overflowY: "auto", padding: "24px 12px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, maxWidth: 460, width: "100%", padding: "20px 20px 24px", margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: W.ink }}>Edit member</div>
          <X size={22} color={W.soft} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <label style={{ fontSize: 12, color: W.soft }}>Full name</label>
        <input value={name} onChange={e => setName(e.target.value)} style={inp} />
        <label style={{ fontSize: 12, color: W.soft }}>Age</label>
        <input value={age} onChange={e => setAge(e.target.value.replace(/\D/g, ""))} inputMode="numeric" style={inp} />
        <label style={{ fontSize: 12, color: W.soft }}>Sex</label>
        <select value={gender} onChange={e => setGender(e.target.value)} style={{ ...inp, background: "#fff" }}>
          <option value="">—</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        <label style={{ fontSize: 12, color: W.soft }}>Area / locality</label>
        <input value={area} onChange={e => setArea(e.target.value)} style={inp} />
        <label style={{ fontSize: 12, color: W.soft }}>City</label>
        <input value={city} onChange={e => setCity(e.target.value)} list="gw-cities" style={inp} />
        <datalist id="gw-cities">{(cities || []).map(c => <option key={c.id || c.name} value={c.name} />)}</datalist>
        <label style={{ fontSize: 12, color: W.soft }}>Profession</label>
        <input value={prof} onChange={e => setProf(e.target.value)} style={inp} />
        {isSuper && <>
          <label style={{ fontSize: 12, color: W.soft }}>Phone (private to you)</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" style={inp} />
        </>}
        {err && <div style={{ color: "#C0392B", fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, flex: 1, justifyContent: "center" }}>Cancel</button>
          <button onClick={save} disabled={busy} style={{ ...btn(W.teal, "#fff"), flex: 1, justifyContent: "center", opacity: busy ? .6 : 1 }}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
function MemberRolesSheet({ member: m, cities, onSetRoles, onClose, onSaved }) {
  const [roles, setRoles] = useState(new Set((m.roles || []).filter(r => STAFF_ROLES.includes(r))));
  const [city, setCity] = useState(m.staff_city || "");
  const [comm, setComm] = useState(m.commission_pct ?? "");
  const [busy, setBusy] = useState(false);
  const sel = { padding: "9px 11px", borderRadius: 9, border: `1px solid ${W.line}`, background: "#fff", fontSize: 13.5, color: W.ink, outline: "none" };
  const save = async () => {
    setBusy(true);
    await onSetRoles(m.id, Array.from(roles), city);
    if (roles.has("promoter")) await supabase.rpc("set_commission", { p_user: m.id, p_pct: Number(comm) || 0 });
    setBusy(false); onSaved();
  };
  return (
    <Sheet onClose={onClose}>
      <div style={{ fontWeight: 800, fontSize: 18, color: W.ink, marginBottom: 4 }}>Roles — {m.full_name || "Member"}</div>
      <div style={{ fontSize: 12.5, color: W.soft, marginBottom: 14 }}>Promote this member to your team, or remove all roles to make them a regular member.</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {STAFF_ROLES.map(r => { const on = roles.has(r); return (
          <button key={r} onClick={() => { const ns = new Set(roles); on ? ns.delete(r) : ns.add(r); setRoles(ns); }} style={{ padding: "8px 14px", borderRadius: 16, border: `1px solid ${on ? W.teal : W.line}`, background: on ? W.teal : "#fff", color: on ? "#fff" : W.soft, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{ROLE_BADGE[r].t}</button>
        ); })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
        <select value={city} onChange={e => setCity(e.target.value)} style={{ ...sel, flex: "1 1 130px" }}>
          <option value="">All cities</option>
          {(cities || []).map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
        </select>
        {roles.has("promoter") && <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <input value={comm} onChange={e => setComm(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" inputMode="decimal" style={{ ...sel, width: 60 }} /><span style={{ fontSize: 13, color: W.soft }}>% commission</span>
        </div>}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button onClick={onClose} style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, flex: 1, justifyContent: "center" }}>Cancel</button>
        <button onClick={save} disabled={busy} style={{ ...btn(W.teal, "#fff"), flex: 1, justifyContent: "center", opacity: busy ? .6 : 1 }}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </Sheet>
  );
}
function AdminMembers({ onSendDM, rooms, events, onGrantRoom, onRemoveRoom, canAdd, canRemove, canEdit, canStamps, isSuper, cities, onSetRoles }) {
  const [list, setList] = useState(null);
  const [pick, setPick] = useState({});
  const [editing, setEditing] = useState(null);
  const [rolesFor, setRolesFor] = useState(null);
  const [blockedMap, setBlockedMap] = useState({});
  const [g, setG] = useState("all"); const [age, setAge] = useState("all"); const [prof, setProf] = useState("all"); const [area, setArea] = useState("all"); const [city, setCity] = useState("all"); const [q, setQ] = useState("");
  const [evFlt, setEvFlt] = useState("all");
  const [evHolders, setEvHolders] = useState(null);
  useEffect(() => {
    if (evFlt === "all") { setEvHolders(null); return; }
    setEvHolders(new Set());
    supabase.rpc("event_attendees", { p_event: evFlt }).then(({ data, error }) => {
      if (error) { alert(error.message); setEvFlt("all"); setEvHolders(null); return; }
      setEvHolders(new Set((data || []).map(r => r.user_id)));
    });
  }, [evFlt]);
  const [pending, setPending] = useState(null);
  const [pendOpen, setPendOpen] = useState(false);
  const reload = () => {
    supabase.rpc("staff_directory").then(({ data }) => setList(data || []));
    supabase.rpc("pending_signups").then(({ data, error }) => setPending(error ? null : (data || [])));
    if (isSuper) supabase.from("profiles").select("id, blocked").then(({ data }) => { const m = {}; (data || []).forEach(r => { m[r.id] = !!r.blocked; }); setBlockedMap(m); });
  };
  useEffect(() => { reload(); }, []);
  const toggleBlock = async (m) => {
    const nb = !blockedMap[m.id];
    if (!window.confirm(nb ? `Block ${m.full_name || "this member"}? They won't be able to use the app.` : `Unblock ${m.full_name || "this member"}?`)) return;
    const { error } = await supabase.rpc("set_member_blocked", { p_user: m.id, p_blocked: nb });
    if (error) return alert(error.message);
    setBlockedMap(b => ({ ...b, [m.id]: nb }));
  };
  const deleteMember = async (m) => {
    if (!window.confirm(`Permanently DELETE ${m.full_name || "this member"}? Their account, tickets and messages are removed. This cannot be undone.`)) return;
    if (!window.confirm("Are you absolutely sure? This is permanent.")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/admin/delete-member", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: session?.access_token, user_id: m.id }) });
      const d = await r.json();
      if (!r.ok) return alert(d.error || "Could not delete.");
      setList(l => (l || []).filter(x => x.id !== m.id));
    } catch { alert("Could not delete. Try again."); }
  };
  const award = async (uid, amount, note) => {
    setList(l => l.map(m => m.id === uid ? { ...m, stamps: (Number(m.stamps) || 0) + amount } : m));
    await supabase.rpc("award_stamp", { p_user: uid, p_amount: amount, p_note: note || null });
  };
  if (list === null) return <Center>loading members…</Center>;
  const ageBand = a => { a = Number(a); if (!a) return null; if (a < 25) return "18-24"; if (a < 35) return "25-34"; if (a < 45) return "35-44"; return "45+"; };
  const profs = Array.from(new Set(list.map(m => m.profession).filter(Boolean))).sort();
  const areas = Array.from(new Set(list.map(m => m.area).filter(Boolean))).sort();
  const cityVals = Array.from(new Set(list.map(m => m.city).filter(Boolean))).sort();
  const hasField = k => list.some(m => m[k] != null && m[k] !== "");
  const filtered = list.filter(m => {
    if (g !== "all" && m.gender !== g) return false;
    if (age !== "all" && ageBand(m.age) !== age) return false;
    if (prof !== "all" && m.profession !== prof) return false;
    if (area !== "all" && m.area !== area) return false;
    if (city !== "all" && m.city !== city) return false;
    if (evHolders && !evHolders.has(m.id)) return false;
    if (q.trim()) { const s = q.trim().toLowerCase(); if (!((m.full_name || "").toLowerCase().includes(s) || (m.phone || "").toLowerCase().includes(s))) return false; }
    return true;
  });
  const messageAll = () => { if (!filtered.length) return; const text = window.prompt(`Send an in-app message to ${filtered.length} member${filtered.length === 1 ? "" : "s"}:`); if (text && text.trim()) onSendDM(filtered.map(m => m.id), text); };
  const sel = { padding: "8px 10px", borderRadius: 9, border: `1px solid ${W.line}`, background: "#fff", fontSize: 13, color: W.ink, outline: "none" };
  const chip = (v, label) => <button key={v} onClick={() => setG(v)} style={{ padding: "7px 13px", borderRadius: 18, border: `1px solid ${g === v ? W.teal : W.line}`, background: g === v ? W.teal : "#fff", color: g === v ? "#fff" : W.soft, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{label}</button>;
  const waLink = ph => "https://wa.me/" + (ph || "").replace(/[^\d]/g, "").replace(/^0+/, "");
  return (
    <div style={{ padding: 14 }}>
      {editing && <EditMemberSheet member={editing} isSuper={isSuper} cities={cities} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {rolesFor && <MemberRolesSheet member={rolesFor} cities={cities} onSetRoles={onSetRoles} onClose={() => setRolesFor(null)} onSaved={() => { setRolesFor(null); reload(); }} />}
      <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: 12, marginBottom: 12 }}>
        {pending && pending.length > 0 && (
          <div style={{ background: "#FDF6EC", border: "1px solid #F2E2C4", borderRadius: 12, padding: "11px 13px", marginBottom: 12 }}>
            <div onClick={() => setPendOpen(o => !o)} style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", fontWeight: 800, color: "#B45309", fontSize: 13.5 }}>
              <span>⏳ Pending signups ({pending.length})</span><span>{pendOpen ? "Hide ▴" : "View ▾"}</span>
            </div>
            {pendOpen && pending.map(r => (
              <div key={r.user_id} style={{ borderTop: "1px solid #F2E2C4", marginTop: 9, paddingTop: 9 }}>
                <div style={{ fontWeight: 700, color: W.ink, fontSize: 14 }}>{r.full_name || "No name yet"}</div>
                <div style={{ fontSize: 12.5, color: W.soft, wordBreak: "break-all" }}>{r.email}{r.phone ? ` · ${r.phone}` : ""} · signed up {r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}</div>
              </div>
            ))}
            {pendOpen && <div style={{ fontSize: 11.5, color: "#7a5a1e", marginTop: 9 }}>These people created an account but haven't finished their profile yet — a quick WhatsApp or email nudge usually gets them in.</div>}
          </div>
        )}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={isSuper ? "Search by name or phone…" : "Search by name…"} style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", color: W.ink, marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
          {chip("all", "Everyone")}{chip("male", "Men")}{chip("female", "Women")}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {hasField("age") && <select value={age} onChange={e => setAge(e.target.value)} style={sel}><option value="all">All ages</option><option>18-24</option><option>25-34</option><option>35-44</option><option>45+</option></select>}
          {hasField("profession") && <select value={prof} onChange={e => setProf(e.target.value)} style={sel}><option value="all">All work</option>{profs.map(p => <option key={p} value={p}>{p}</option>)}</select>}
          {hasField("area") && <select value={area} onChange={e => setArea(e.target.value)} style={sel}><option value="all">All areas</option>{areas.map(a => <option key={a} value={a}>{a}</option>)}</select>}
          {hasField("city") && <select value={city} onChange={e => setCity(e.target.value)} style={sel}><option value="all">All cities</option>{cityVals.map(c => <option key={c} value={c}>{c}</option>)}</select>}
          <select value={evFlt} onChange={e => setEvFlt(e.target.value)} style={{ ...sel, maxWidth: 190 }}><option value="all">🎟️ All events</option>{(events || []).map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}</select>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
        <span style={{ fontSize: 13.5, color: W.soft }}><b style={{ color: W.ink }}>{filtered.length}</b> member{filtered.length === 1 ? "" : "s"}</span>
        <button onClick={messageAll} disabled={!filtered.length} style={{ ...btn(W.teal, "#fff"), opacity: filtered.length ? 1 : .5 }}><Send size={15} />Message {filtered.length}</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(m => (
          <div key={m.id} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <PersonAvatar url={m.avatar_url} name={m.full_name} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: W.ink, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>{m.full_name || "—"} <RoleBadges roles={m.roles} />{blockedMap[m.id] && <span style={{ background: "#FBE9E7", color: "#C0392B", fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10 }}>Blocked</span>}</div>
                {m.phone
                  ? <div style={{ fontSize: 13, color: W.soft, display: "flex", alignItems: "center", gap: 5 }}><Phone size={12} />{m.phone}</div>
                  : <div style={{ fontSize: 12.5, color: W.soft }}>{{ male: "Man", female: "Woman", other: "—" }[m.gender] || "—"}</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>
              {m.phone && <a href={waLink(m.phone)} target="_blank" rel="noreferrer" style={{ ...btn("#25D366", "#fff"), padding: "7px 12px", fontSize: 12.5, textDecoration: "none" }}><MessageCircle size={14} />WhatsApp</a>}
              {canEdit && <button onClick={() => setEditing(m)} title="Edit profile" style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, padding: "7px 10px", fontSize: 12.5 }}><Settings size={14} /></button>}
              {isSuper && !(m.roles || []).includes("superadmin") && <button onClick={() => setRolesFor(m)} title="Roles & promotion" style={{ ...btn("#fff", "#7C3AED"), border: "1px solid #E4D5FB", padding: "7px 10px", fontSize: 12.5 }}><Crown size={14} /></button>}
              <button onClick={() => { const text = window.prompt(`Send an in-app message to ${m.full_name || "this member"}:`); if (text && text.trim()) onSendDM([m.id], text); }} style={{ ...btn(W.teal, "#fff"), padding: "7px 10px", fontSize: 12.5 }}><Send size={14} /></button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 10, fontSize: 13, color: W.soft }}>
              <span>Sex: {{ male: "M", female: "F", other: "—" }[m.gender] || "—"}</span>
              {m.age != null && <span>Age: {m.age}</span>}
              {m.area && <span>Area: {m.area}</span>}
              {m.city && <span>City: {m.city}</span>}
              {m.profession && <span>Work: {m.profession}</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 6, fontSize: 13 }}>
              <span style={{ color: W.soft }}>Events attended: <b style={{ color: W.ink }}>{m.events_attended || 0}</b></span>
              {m.last_event && <span style={{ color: W.soft }}>Last: <b style={{ color: W.ink }}>{m.last_event}</b></span>}
              {m.income != null && <span style={{ color: W.soft }}>Income: <b style={{ color: W.teal }}>₹{Math.round((m.income || 0) / 100)}</b></span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8, flexWrap: "wrap" }}>
              <StampBadge count={m.stamps} />
              {canStamps && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => award(m.id, -1, "manual")} title="Remove a stamp" style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, padding: "5px 11px", fontSize: 16, lineHeight: 1 }}>−</button>
                  <button onClick={() => award(m.id, 1, "manual")} title="Give a stamp" style={{ ...btn("#fff", "#B45309"), border: "1px solid #F0D9A8", padding: "5px 10px", fontSize: 12.5 }}>★ +1</button>
                  <button onClick={() => { const a = window.prompt("Give how many stamps? (use a negative number to deduct)"); const n = parseInt(a); if (!n) return; const note = window.prompt("Note (optional, e.g. great host energy):") || "manual"; award(m.id, n, note); }} title="Award a custom amount" style={{ ...btn(W.ink, "#fff"), padding: "5px 10px", fontSize: 12.5 }}>Award…</button>
                </div>
              )}
            </div>
            {isSuper && !(m.roles || []).includes("superadmin") && (
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button onClick={() => toggleBlock(m)} style={{ ...btn("#fff", blockedMap[m.id] ? W.teal : "#B45309"), border: `1px solid ${blockedMap[m.id] ? W.line : "#F0D9A8"}`, padding: "6px 12px", fontSize: 12.5 }}>{blockedMap[m.id] ? "Unblock" : "Block"}</button>
                <button onClick={() => deleteMember(m)} style={{ ...btn("#fff", "#C0392B"), border: "1px solid #F2C4C0", padding: "6px 12px", fontSize: 12.5 }}><Trash2 size={13} />Delete</button>
              </div>
            )}
            {rooms && rooms.length > 0 && (canAdd || canRemove) && (
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <select value={pick[m.id] || ""} onChange={e => setPick(p => ({ ...p, [m.id]: e.target.value }))} style={{ ...sel, flex: 1, minWidth: 0 }}>
                  <option value="">Pick a room…</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}{r.price_monthly ? ` · ₹${r.price_monthly}/mo` : ""}</option>)}
                </select>
                {canAdd && <button disabled={!pick[m.id]} onClick={async () => { const rid = pick[m.id]; if (!rid) return; await onGrantRoom(m.id, rid); setPick(p => ({ ...p, [m.id]: "" })); }} style={{ ...btn(W.ink, "#fff"), opacity: pick[m.id] ? 1 : .5 }}><Plus size={14} />Add</button>}
                {canRemove && <button disabled={!pick[m.id]} onClick={async () => { const rid = pick[m.id]; if (!rid) return; await onRemoveRoom(m.id, rid); setPick(p => ({ ...p, [m.id]: "" })); }} style={{ ...btn("#fff", "#C0392B"), border: "1px solid #F2C4C0", opacity: pick[m.id] ? 1 : .5 }}>Remove</button>}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <Center>No members match these filters.</Center>}
      </div>
    </div>
  );
}

/* ---------------- profile ---------------- */
function Gallery({ isAdmin }) {
  const [albums, setAlbums] = useState([]);
  const [photos, setPhotos] = useState({});
  const [open, setOpen] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const load = async () => {
    const [{ data: al }, { data: ph }] = await Promise.all([
      supabase.from("gallery_albums").select("*").order("created_at", { ascending: false }),
      supabase.from("gallery_photos").select("*").order("created_at", { ascending: false }),
    ]);
    const m = {}; (ph || []).forEach(p => { (m[p.album_id] = m[p.album_id] || []).push(p); });
    setAlbums(al || []); setPhotos(m);
  };
  useEffect(() => { load(); }, []);
  const newAlbum = async () => { const title = prompt("Album name (e.g. Pub Social — May 2026)"); if (!title || !title.trim()) return; await supabase.from("gallery_albums").insert({ title: title.trim() }); load(); };
  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length || !open) return;
    setBusy(true);
    for (const f of files) { try { const url = await uploadChatFile("gallery", f); await supabase.from("gallery_photos").insert({ album_id: open.id, url }); } catch (x) {} }
    setBusy(false); if (fileRef.current) fileRef.current.value = ""; load();
  };
  const delAlbum = async (a) => { if (!confirm("Delete this album and its photos?")) return; await supabase.from("gallery_albums").delete().eq("id", a.id); setOpen(null); load(); };
  if (lightbox) return <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.93)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}><img src={lightbox} alt="" style={{ maxWidth: "96%", maxHeight: "90%", borderRadius: 8 }} /></div>;
  if (open) {
    const ph = photos[open.id] || [];
    return (
      <div>
        <div style={{ background: W.teal, color: "#fff", padding: "14px 16px", position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setOpen(null)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", display: "flex" }}><ArrowLeft size={22} /></button>
          <div style={{ fontWeight: 700, fontSize: 18, flex: 1, minWidth: 0 }}>{open.title}</div>
          {isAdmin && <button onClick={() => fileRef.current?.click()} style={{ ...btn("#fff", W.teal), padding: "6px 11px" }}><Plus size={15} />Add</button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={addPhotos} />
        {busy && <div style={{ padding: 12, textAlign: "center", color: W.soft, fontSize: 13 }}>Uploading…</div>}
        <div style={{ padding: 10, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
          {ph.map(p => <img key={p.id} src={p.url} alt="" onClick={() => setLightbox(p.url)} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, cursor: "pointer" }} />)}
        </div>
        {ph.length === 0 && <Center>No photos yet{isAdmin ? " — tap Add to upload." : "."}</Center>}
        {isAdmin && <div style={{ padding: 16 }}><button onClick={() => delAlbum(open)} style={{ ...btn("#fff", "#C0392B"), border: "1px solid #F2C4C0", width: "100%", justifyContent: "center" }}><Trash2 size={15} />Delete album</button></div>}
      </div>
    );
  }
  return (
    <div>
      <TopBar title="Gallery" />
      <div style={{ padding: 14 }}>
        {isAdmin && <button onClick={newAlbum} style={{ width: "100%", padding: 14, border: `1.5px dashed ${W.teal}`, borderRadius: 14, background: "#fff", color: W.teal, fontWeight: 700, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 }}><Plus size={18} />New album</button>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
          {albums.map(a => { const cover = (photos[a.id] || [])[0]; const n = (photos[a.id] || []).length; return (
            <div key={a.id} onClick={() => setOpen(a)} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, overflow: "hidden", cursor: "pointer" }}>
              <div style={{ width: "100%", aspectRatio: "4/3", background: W.bg }}>{cover ? <img src={cover.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: W.soft }}><ImageIcon size={28} /></div>}</div>
              <div style={{ padding: "10px 12px" }}><div style={{ fontWeight: 700, color: W.ink, fontSize: 14 }}>{a.title}</div><div style={{ fontSize: 12, color: W.soft, marginTop: 2 }}>{n} photo{n === 1 ? "" : "s"}</div></div>
            </div>
          ); })}
        </div>
        {albums.length === 0 && <Center>No galleries yet.{isAdmin ? " Create your first album above." : ""}</Center>}
      </div>
    </div>
  );
}
function EditProfileSheet({ user, profile, onClose, reload }) {
  const [name, setName] = useState(profile.full_name || "");
  const [gender, setGender] = useState(profile.gender || "male");
  const [phone, setPhone] = useState(""), [age, setAge] = useState(""), [area, setArea] = useState(""), [prof, setProf] = useState(""), [city, setCity] = useState("");
  const [avatar, setAvatar] = useState(profile.avatar_url || "");
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [err, setErr] = useState("");
  const fileRef = useRef(null);
  useEffect(() => {
    supabase.from("member_details").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => { if (data) { setAge(data.age || ""); setArea(data.area || ""); setProf(data.profession || ""); setCity(data.city || ""); } });
    supabase.from("member_phone").select("phone").eq("user_id", user.id).maybeSingle().then(({ data }) => { if (data?.phone) setPhone(data.phone); });
  }, [user.id]);
  const pick = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setErr(""); setUploading(true);
    try { setAvatar(await uploadPhoto(user.id, file)); } catch (x) { setErr("Photo upload failed: " + x.message); }
    setUploading(false);
  };
  const save = async () => {
    setErr(""); if (!name.trim()) return setErr("Please enter your name.");
    setBusy(true);
    const { error: e1 } = await supabase.from("member_details").upsert({ user_id: user.id, age: Number(age) || null, area, profession: prof, city });
    if (phone) await supabase.from("member_phone").upsert({ user_id: user.id, phone });
    const { error: e2 } = await supabase.from("profiles").update({ full_name: name.trim(), gender, avatar_url: avatar, profile_completed: true }).eq("id", user.id);
    try { localStorage.setItem("gw_open_explore", "1"); } catch {}
    setBusy(false);
    if (e1 || e2) return setErr((e1 || e2).message);
    reload(); onClose();
  };
  const inp = (ph, v, s, t = "text") => <input value={v} onChange={e => s(e.target.value)} placeholder={ph} type={t} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${W.line}`, fontSize: 15, outline: "none", color: W.ink, boxSizing: "border-box" }} />;
  return (
    <Sheet onClose={onClose}>
      <div style={{ fontWeight: 800, fontSize: 18, color: W.ink, marginBottom: 14 }}>Edit profile</div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <div onClick={() => fileRef.current?.click()} style={{ position: "relative", cursor: "pointer" }}>
          <PersonAvatar url={avatar} name={name} size={84} />
          <div style={{ position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: "50%", background: W.teal, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>{uploading ? "…" : <Camera size={14} />}</div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {inp("Full name", name, setName)}
        <div>
          <div style={{ fontSize: 12.5, color: W.soft, marginBottom: 6, fontWeight: 600 }}>I am</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["male", "Man"], ["female", "Woman"], ["other", "Other"]].map(([v, l]) => <button key={v} onClick={() => setGender(v)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${gender === v ? W.teal : W.line}`, background: gender === v ? "#E7F6EF" : "#fff", color: W.ink, fontWeight: 600, fontSize: 14 }}>{l}</button>)}
          </div>
        </div>
        {inp("Phone number (private — staff only)", phone, setPhone, "tel")}
        {inp("Age", age, setAge, "number")}
        {inp("Area / locality", area, setArea)}
        {inp("City", city, setCity)}
        {inp("Profession", prof, setProf)}
        {err && <div style={{ color: "#C0392B", fontSize: 13 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, flex: 1, justifyContent: "center" }}>Cancel</button>
          <button onClick={save} disabled={busy || uploading} style={{ ...btn(W.teal, "#fff"), flex: 1, justifyContent: "center", opacity: (busy || uploading) ? .6 : 1 }}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </Sheet>
  );
}
function Profile({ user, profile, reload, paidSubs = [], onCancelSub }) {
  const roleLabel = { admin: "Admin (Owner)", subadmin: "Sub-admin", member: "Member" }[profile?.role] || "Member";
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [stamps, setStamps] = useState(null);
  const [ref, setRef] = useState(null); const [copied, setCopied] = useState(false);
  const [edit, setEdit] = useState(false);
  const isPromoter = (profile?.roles || []).includes("promoter");
  useEffect(() => {
    supabase.rpc("my_stamps").then(({ data }) => setStamps(data ?? 0));
    if (isPromoter) supabase.rpc("my_referral").then(({ data }) => setRef(data?.[0] || null));
  }, []);
  const change = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true);
    try { const url = await uploadPhoto(user.id, file); await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id); reload(); } catch (x) { alert("Upload failed: " + x.message); }
    setBusy(false);
  };
  return (
    <div>
      <TopBar title="Profile" />
      <div style={{ padding: 16 }}>
        <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${W.line}`, padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
          <div onClick={() => fileRef.current?.click()} style={{ position: "relative", cursor: "pointer", flexShrink: 0 }}>
            <PersonAvatar url={profile?.avatar_url} name={profile?.full_name} size={64} />
            <div style={{ position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderRadius: "50%", background: W.teal, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>{busy ? "…" : <Camera size={12} />}</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={change} style={{ display: "none" }} />
          <div>
            <div style={{ fontSize: 21, fontWeight: 700, color: W.ink }}>{profile?.full_name || "—"}</div>
            <div style={{ color: W.soft, fontSize: 14 }}>{user.email}</div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 7, background: "#E7F6EF", color: W.teal, fontSize: 12.5, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{profile?.role !== "member" && <Crown size={13} />}{roleLabel}</span>
          </div>
        </div>
        <button onClick={() => setEdit(true)} style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, width: "100%", justifyContent: "center", marginTop: 12 }}><Pencil size={15} />Edit profile</button>
        {edit && <EditProfileSheet user={user} profile={profile} onClose={() => setEdit(false)} reload={reload} />}
        {stamps !== null && (
          <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${W.line}`, padding: 16, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, color: W.ink }}>Your stamps</div>
              <div style={{ fontSize: 12.5, color: W.soft, marginTop: 2 }}>Earned from attending meetups and from the team. Every 5 = a new tier.</div>
            </div>
            <StampBadge count={stamps} size="lg" />
          </div>
        )}
        {ref && (() => {
          const link = `${window.location.origin}/?ref=${ref.code}`;
          return (
            <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${W.line}`, padding: 16, marginTop: 16 }}>
              <div style={{ fontWeight: 700, color: W.ink }}>Your promoter link</div>
              <div style={{ fontSize: 12.5, color: W.soft, marginTop: 2, marginBottom: 10 }}>Share this link. Tickets bought through it are credited to you{Number(ref.pct) > 0 ? ` (${ref.pct}% commission)` : ""}.</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input readOnly value={link} style={{ flex: 1, minWidth: 0, border: `1px solid ${W.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: W.ink, background: W.bg }} />
                <button onClick={() => { try { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }} style={btn(W.teal, "#fff")}>{copied ? "Copied ✓" : "Copy"}</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <div style={{ flex: "1 1 90px", background: W.bg, borderRadius: 10, padding: "10px 12px" }}><div style={{ fontSize: 11.5, color: W.soft }}>Tickets</div><div style={{ fontSize: 18, fontWeight: 800, color: W.ink }}>{ref.tickets}</div></div>
                <div style={{ flex: "1 1 90px", background: W.bg, borderRadius: 10, padding: "10px 12px" }}><div style={{ fontSize: 11.5, color: W.soft }}>Revenue</div><div style={{ fontSize: 18, fontWeight: 800, color: W.ink }}>₹{Math.round((ref.revenue || 0) / 100)}</div></div>
                <div style={{ flex: "1 1 90px", background: W.bg, borderRadius: 10, padding: "10px 12px" }}><div style={{ fontSize: 11.5, color: W.soft }}>Commission</div><div style={{ fontSize: 18, fontWeight: 800, color: W.teal }}>₹{Math.round((ref.commission || 0) / 100)}</div></div>
              </div>
            </div>
          );
        })()}
        {paidSubs.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${W.line}`, padding: 16, marginTop: 16 }}>
            <div style={{ fontWeight: 700, color: W.ink, marginBottom: 4 }}>Your subscriptions</div>
            <div style={{ fontSize: 12.5, color: W.soft, marginBottom: 12 }}>Cancel anytime — billing stops and you'll leave the room.</div>
            {paidSubs.map(s => (
              <div key={s.room_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 0", borderTop: `1px solid ${W.line}` }}>
                <span style={{ fontSize: 14.5, color: W.ink, fontWeight: 600, minWidth: 0 }}>{s.name}</span>
                <button onClick={() => onCancelSub && onCancelSub(s.room_id)} style={{ ...btn("#fff", "#C0392B"), border: `1px solid #F2C4C0` }}>Cancel</button>
              </div>
            ))}
          </div>
        )}
        <PushToggle user={user} />
        <button onClick={() => supabase.auth.signOut()} style={{ marginTop: 16, width: "100%", padding: 14, borderRadius: 12, border: `1px solid ${W.line}`, background: "#fff", color: "#C0392B", fontWeight: 700, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><LogOut size={18} />Log out</button>
        <div style={{ marginTop: 20 }}><LegalLinks /></div>
        <div style={{ textAlign: "center", color: W.soft, fontSize: 11, marginTop: 14 }}>Glasswings build • stories ✅</div>
      </div>
    </div>
  );
}

/* ---------------- shared ---------------- */
function TopBar({ title }) { return <div style={{ background: W.teal, color: "#fff", padding: "16px 18px", fontSize: 21, fontWeight: 700, position: "sticky", top: 0, zIndex: 10 }}>{title}</div>; }
function Avatar({ room, size }) {
  if (room?.logo_url) return <img src={room.logo_url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, fontSize: size * .5, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#7AD6C0,#008069)" }}>{room?.emoji || "💬"}</div>;
}
function PersonAvatar({ url, name, size }) {
  if (url) return <img src={url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return <div style={{ width: size, height: size, borderRadius: "50%", background: "#9DB2AC", color: "#fff", fontWeight: 700, fontSize: size * .42, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{(name || "?")[0].toUpperCase()}</div>;
}
const Center = ({ children }) => <div style={{ textAlign: "center", color: W.soft, fontSize: 14, padding: "26px 0" }}>{children}</div>;
const btn = (bg, fg) => ({ background: bg, color: fg, border: "none", borderRadius: 9, padding: "9px 16px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 });
function fmtTime(t) { return new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
function lastSeenStr(ts) {
  if (!ts) return "";
  const d = Date.now() - new Date(ts).getTime();
  if (d < 150000) return "online";
  const m = Math.floor(d / 60000);
  if (m < 60) return `last seen ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `last seen ${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return "last seen yesterday";
  if (days < 7) return `last seen ${days}d ago`;
  return "last seen " + new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function Nav({ tab, setTab, isAdmin }) {
  const items = [{ id: "chats", icon: MessageCircle, label: "Chats" }, { id: "explore", icon: Compass, label: "Explore" }, { id: "events", icon: Calendar, label: "Events" }, { id: "gallery", icon: ImageIcon, label: "Gallery" }, ...(isAdmin ? [{ id: "admin", icon: Shield, label: "Admin" }] : []), { id: "profile", icon: User, label: "Profile" }];
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#fff", borderTop: `1px solid ${W.line}`, display: "flex", padding: "8px 0 11px" }}>
      {items.map(it => { const on = tab === it.id; const I = it.icon; return <button key={it.id} onClick={() => setTab(it.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: on ? W.teal : W.soft }}><I size={23} strokeWidth={on ? 2.4 : 2} /><span style={{ fontSize: 11, fontWeight: on ? 700 : 500 }}>{it.label}</span></button>; })}
    </div>
  );
}
