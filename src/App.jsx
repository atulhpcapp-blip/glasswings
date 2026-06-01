import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient.js";
import {
  MessageCircle, Compass, Shield, User, ArrowLeft, Send, Plus, LogOut, Lock,
  Pin, Trash2, Settings, IndianRupee, Crown, Smile, Paperclip, Camera, X, Users, Phone, Zap, Calendar, MapPin, Ticket, Printer, Share2
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
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
function fitText(x, t, max) { let s = String(t || ""); if (x.measureText(s).width <= max) return s; while (s.length > 1 && x.measureText(s + "X").width > max) s = s.slice(0, -1); return s + "…"; }
async function makeTicketBlob(d) {
  const Wd = 1000, Ht = 600, s = 2;
  const c = document.createElement("canvas"); c.width = Wd * s; c.height = Ht * s;
  const x = c.getContext("2d"); x.scale(s, s);
  x.fillStyle = "#ffffff"; rr(x, 0, 0, Wd, Ht, 30); x.fill();
  const g = x.createLinearGradient(0, 0, Wd, 200); g.addColorStop(0, "#0E8C7F"); g.addColorStop(1, "#13B3A0");
  x.save(); rr(x, 0, 0, Wd, 200, 30); x.clip(); x.fillStyle = g; x.fillRect(0, 0, Wd, 200); x.restore();
  x.fillStyle = "rgba(255,255,255,.85)"; x.font = "700 20px system-ui,Arial"; x.fillText("G L A S S W I N G S", 44, 54);
  x.fillStyle = "#fff"; x.font = "800 42px system-ui,Arial"; x.fillText(fitText(x, ((d.emoji ? d.emoji + " " : "") + d.title), Wd - 88), 44, 120);
  x.fillStyle = "rgba(255,255,255,.95)"; x.font = "500 24px system-ui,Arial";
  const meta = [d.dateStr, d.place].filter(Boolean).join("   -   "); if (meta) x.fillText(fitText(x, meta, Wd - 88), 44, 165);
  x.fillStyle = "#5a6b67"; x.font = "600 22px system-ui,Arial"; x.fillText("ATTENDEE", 44, 282);
  x.fillStyle = "#0b1f1c"; x.font = "800 34px system-ui,Arial"; x.fillText(fitText(x, d.name || "", 600), 44, 324);
  x.fillStyle = "#5a6b67"; x.font = "600 22px system-ui,Arial"; x.fillText("TICKETS", 44, 388);
  x.fillStyle = "#0b1f1c"; x.font = "800 34px system-ui,Arial"; x.fillText(String(d.qty), 44, 430);
  x.fillStyle = "#5a6b67"; x.font = "600 22px system-ui,Arial"; x.fillText("TICKET CODE", 44, 494);
  x.fillStyle = "#0E8C7F"; x.font = "800 40px ui-monospace,monospace"; x.fillText(d.code, 44, 538);
  x.strokeStyle = "#d9e2df"; x.setLineDash([12, 10]); x.beginPath(); x.moveTo(Wd - 300, 240); x.lineTo(Wd - 300, Ht - 40); x.stroke(); x.setLineDash([]);
  try { const qr = await loadImg("https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=" + encodeURIComponent(d.code)); x.drawImage(qr, Wd - 258, 300, 200, 200); } catch (e) { }
  x.fillStyle = "#5a6b67"; x.font = "500 18px system-ui,Arial"; x.fillText("Show at entry", Wd - 244, 528);
  return await new Promise(res => c.toBlob(res, "image/png"));
}

async function uploadPhoto(userId, file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

async function uploadChatFile(roomId, file) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${roomId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage.from("chat").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("chat").getPublicUrl(path).data.publicUrl;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return <Shell>{loading ? <Splash /> : session ? <Main user={session.user} /> : <Auth />}</Shell>;
}

function Shell({ children }) {
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", background: "#d9d9d9", display: "flex", justifyContent: "center", minHeight: "100vh", width: "100%", overflowX: "hidden" }}>
      <style>{`html,body,#root{margin:0;padding:0;width:100%;max-width:100%;overflow-x:hidden;}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}input,button{font-family:inherit;}::-webkit-scrollbar{width:0;}.chatscreen{height:100vh;height:100dvh;}`}</style>
      <div style={{ width: "100%", maxWidth: 430, minHeight: "100vh", background: W.bg, boxShadow: "0 0 60px rgba(0,0,0,.15)", position: "relative", overflowX: "hidden" }}>{children}</div>
    </div>
  );
}
function Splash() { return <div style={{ height: "100vh", background: W.teal, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 700 }}>Glasswings</div>; }

/* ---------------- auth ---------------- */
function Auth() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [pass, setPass] = useState(""), [gender, setGender] = useState("male");
  const [err, setErr] = useState(""), [note, setNote] = useState(""), [busy, setBusy] = useState(false);
  const go = async () => {
    setErr(""); setNote("");
    if (!email || !pass || (mode === "signup" && !name)) return setErr("Please fill in all fields.");
    setBusy(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password: pass, options: { data: { full_name: name, gender } } });
      if (error) setErr(error.message); else setNote("Account created! If login doesn't happen automatically, just log in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) setErr(error.message);
    }
    setBusy(false);
  };
  const inp = (ph, v, s, t = "text") => <input value={v} onChange={e => s(e.target.value)} placeholder={ph} type={t} style={{ width: "100%", padding: "13px 15px", borderRadius: 10, border: `1px solid ${W.line}`, fontSize: 15, outline: "none", color: W.ink }} />;
  return (
    <div style={{ minHeight: "100vh", background: W.bg, padding: "0 22px", display: "flex", flexDirection: "column" }}>
      <div style={{ textAlign: "center", paddingTop: 64 }}>
        <div style={{ width: 74, height: 74, borderRadius: "50%", background: W.teal, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}><MessageCircle size={36} color="#fff" /></div>
        <div style={{ fontSize: 28, fontWeight: 700, color: W.ink, marginTop: 14 }}>Glasswings</div>
        <div style={{ color: W.soft, marginTop: 5, fontSize: 14 }}>Your events. Your community. Your chat.</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 18, padding: 20, marginTop: 34, border: `1px solid ${W.line}` }}>
        <div style={{ display: "flex", background: W.bg, borderRadius: 10, padding: 4, marginBottom: 16 }}>
          {["login", "signup"].map(m => <button key={m} onClick={() => { setMode(m); setErr(""); setNote(""); }} style={{ flex: 1, padding: 9, border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14, background: mode === m ? W.teal : "transparent", color: mode === m ? "#fff" : W.soft }}>{m === "login" ? "Log in" : "Sign up"}</button>)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {mode === "signup" && inp("Full name", name, setName)}
          {inp("Email", email, setEmail, "email")}
          {inp("Password (min 6 characters)", pass, setPass, "password")}
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
          <button onClick={go} disabled={busy} style={{ padding: 14, borderRadius: 10, border: "none", cursor: "pointer", background: W.teal, color: "#fff", fontWeight: 700, fontSize: 15, opacity: busy ? .6 : 1 }}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- profile completion (with photo) ---------------- */
function ProfileGate({ user, profile, reload }) {
  const [name, setName] = useState(profile.full_name || "");
  const [phone, setPhone] = useState(""), [age, setAge] = useState(""), [area, setArea] = useState(""), [prof, setProf] = useState(""), [city, setCity] = useState("");
  const [avatar, setAvatar] = useState(profile.avatar_url || "");
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [err, setErr] = useState("");
  const fileRef = useRef(null);
  useEffect(() => {
    supabase.from("member_details").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) { setPhone(data.phone || ""); setAge(data.age || ""); setArea(data.area || ""); setProf(data.profession || ""); setCity(data.city || ""); } });
  }, [user.id]);
  const pick = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setErr(""); setUploading(true);
    try { setAvatar(await uploadPhoto(user.id, file)); } catch (x) { setErr("Photo upload failed: " + x.message); }
    setUploading(false);
  };
  const save = async () => {
    setErr(""); if (!name || !phone || !age || !area || !prof || !city) return setErr("Please complete every field.");
    if (!avatar) return setErr("Please add a profile photo.");
    setBusy(true);
    const { error: e1 } = await supabase.from("member_details").upsert({ user_id: user.id, phone, age: Number(age) || null, area, profession: prof, city });
    const { error: e2 } = await supabase.from("profiles").update({ full_name: name, avatar_url: avatar, profile_completed: true }).eq("id", user.id);
    setBusy(false);
    if (e1 || e2) return setErr((e1 || e2).message);
    reload();
  };
  const inp = (ph, v, s, t = "text") => <input value={v} onChange={e => s(e.target.value)} placeholder={ph} type={t} style={{ width: "100%", padding: "13px 15px", borderRadius: 10, border: `1px solid ${W.line}`, fontSize: 15, outline: "none", color: W.ink }} />;
  return (
    <div style={{ minHeight: "100vh", background: W.bg }}>
      <TopBar title="Complete your profile" />
      <div style={{ padding: 18 }}>
        <div style={{ color: W.soft, fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>Welcome to Glasswings! Add your photo and details to join rooms and events. Your phone number stays private — only the organiser can see it.</div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <div onClick={() => fileRef.current?.click()} style={{ position: "relative", cursor: "pointer" }}>
            <PersonAvatar url={avatar} name={name} size={96} />
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderRadius: "50%", background: W.teal, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}><Camera size={16} /></div>
            {uploading && <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,.4)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>…</div>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {inp("Full name", name, setName)}
          {inp("Phone number", phone, setPhone, "tel")}
          {inp("Age", age, setAge, "number")}
          {inp("Area / locality", area, setArea)}
          {inp("City", city, setCity)}
          {inp("Profession", prof, setProf)}
          {err && <div style={{ color: "#C0392B", fontSize: 13 }}>{err}</div>}
          <button onClick={save} disabled={busy || uploading} style={{ padding: 14, borderRadius: 10, border: "none", cursor: "pointer", background: W.teal, color: "#fff", fontWeight: 700, fontSize: 15, opacity: (busy || uploading) ? .6 : 1 }}>{busy ? "Saving…" : "Save & continue"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- main ---------------- */
function Main({ user }) {
  const [profile, setProfile] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [events, setEvents] = useState([]);
  const [subs, setSubs] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [mods, setMods] = useState([]);
  const [eventMods, setEventMods] = useState([]);
  const [counts, setCounts] = useState({});
  const [eventCounts, setEventCounts] = useState({});
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [ticketTypes, setTicketTypes] = useState({});
  const [myTickets, setMyTickets] = useState({});
  const [buyTarget, setBuyTarget] = useState(null);
  const [ticketView, setTicketView] = useState(null);
  const [hasDM, setHasDM] = useState(false);
  const [focusEvent, setFocusEvent] = useState(null);
  const openEvent = (id) => { setOpen(null); setTab("events"); setFocusEvent(id); };
  const [tab, setTab] = useState("chats");
  const [open, setOpen] = useState(null); // { id, type }
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [{ data: prof }, { data: rm }, { data: ev }, { data: sb }, { data: tk }, { data: md }, { data: emd }, { data: cnt }, { data: ecnt }, { data: opts }, { data: tt }, { data: dm }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("rooms").select("*").order("created_at", { ascending: true }),
      supabase.from("events").select("*").order("created_at", { ascending: true }),
      supabase.from("room_subscriptions").select("room_id").eq("user_id", user.id),
      supabase.from("event_tickets").select("id, event_id, quantity, ticket_type_id, purchased_at").eq("user_id", user.id),
      supabase.from("room_moderators").select("room_id").eq("user_id", user.id),
      supabase.from("event_moderators").select("event_id").eq("user_id", user.id),
      supabase.rpc("room_member_counts"),
      supabase.rpc("event_ticket_counts"),
      supabase.from("event_options").select("*").order("name", { ascending: true }),
      supabase.from("event_ticket_types").select("*").order("sort", { ascending: true }),
      supabase.from("messages").select("id").eq("group_type", "dm").eq("group_id", user.id).limit(1),
    ]);
    setProfile(prof); setRooms(rm || []); setEvents(ev || []);
    setSubs((sb || []).map(x => x.room_id)); setTickets([...new Set((tk || []).map(x => x.event_id))]);
    const mt = {}; (tk || []).forEach(r => { if (!mt[r.event_id]) mt[r.event_id] = []; mt[r.event_id].push(r); }); setMyTickets(mt);
    setMods((md || []).map(x => x.room_id)); setEventMods((emd || []).map(x => x.event_id));
    const cm = {}; (cnt || []).forEach(x => { cm[x.room_id] = Number(x.members); }); setCounts(cm);
    const ec = {}; (ecnt || []).forEach(x => { ec[x.event_id] = Number(x.going); }); setEventCounts(ec);
    setCategories((opts || []).filter(o => o.kind === "category"));
    setCities((opts || []).filter(o => o.kind === "city"));
    const tm = {}; (tt || []).forEach(t => { if (!tm[t.event_id]) tm[t.event_id] = []; tm[t.event_id].push(t); }); setTicketTypes(tm);
    setHasDM((dm || []).length > 0);
    setReady(true);
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  const isAdmin = profile?.role === "admin";
  const canAccess = (r) => isAdmin || subs.includes(r.id) || mods.includes(r.id);
  const canAccessEvent = (e) => isAdmin || tickets.includes(e.id) || eventMods.includes(e.id);
  const freeForUser = (r) => r.price_monthly === 0 || profile?.gender !== "male" || profile?.founding_member;

  const joinRoom = async (r) => {
    if (canAccess(r)) return setOpen({ id: r.id, type: "room" });
    if (!freeForUser(r)) return setNotice("Online payments are being set up — paid subscriptions for men are coming next.");
    const { error } = await supabase.from("room_subscriptions").insert({ room_id: r.id, user_id: user.id });
    if (error) return setNotice(error.message);
    setSubs(p => [...p, r.id]); setCounts(c => ({ ...c, [r.id]: (c[r.id] || 0) + 1 })); setOpen({ id: r.id, type: "room" });
  };
  const joinEvent = (e, type = null) => {
    if (canAccessEvent(e)) return setOpen({ id: e.id, type: "event" });
    setBuyTarget({ event: e, type });
  };
  const confirmPurchase = async (qty) => {
    const { event: e, type } = buyTarget;
    const unit = type ? netPrice(type, subs) : e.ticket_price;
    if (unit > 0) { setBuyTarget(null); return setNotice("Online payments are being set up — paid tickets go live with the payments step."); }
    const { error } = await supabase.from("event_tickets").insert({ event_id: e.id, user_id: user.id, ticket_type_id: type ? type.id : null, quantity: qty });
    setBuyTarget(null);
    if (error) return setNotice(error.message);
    await load();
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
  const createEvent = async (d) => {
    const { data: ins, error } = await supabase.from("events").insert(d).select("id").single();
    if (error) return setNotice(error.message);
    const line = [d.event_date, [d.venue, d.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
    await announceToRooms(`${d.emoji || "🎟️"} ${d.title}${line ? "\n" + line : ""}`, "event", { media_url: d.banner_url || null, file_name: d.banner_type || "image", event_ref: ins?.id || null });
    await load();
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
  const addTicketType = async (eventId, d) => { const { error } = await supabase.from("event_ticket_types").insert({ event_id: eventId, ...d }); if (error) return setNotice(error.message); await load(); };
  const delTicketType = async (id) => { const { error } = await supabase.from("event_ticket_types").delete().eq("id", id); if (error) return setNotice(error.message); await load(); };

  if (!ready) return <Splash />;
  if (profile && !profile.profile_completed) return <ProfileGate user={user} profile={profile} reload={load} />;

  if (open) {
    if (open.type === "dm") {
      const isOwn = open.id === user.id;
      return <RoomChat room={{ id: open.id, name: open.title || (isOwn ? "Glasswings" : "Member"), emoji: isOwn ? "📣" : "👤", logo_url: null, pinned: "" }} groupType="dm" user={user} profile={profile} isAdmin={false} memberCount={0} onBack={() => setOpen(null)} onUpdatePinned={() => { }} onOpenEvent={openEvent} />;
    }
    if (open.type === "room") {
      const r = rooms.find(x => x.id === open.id); if (!r) { setOpen(null); return null; }
      return <RoomChat room={{ id: r.id, name: r.name, emoji: r.emoji, logo_url: r.logo_url, pinned: r.pinned }} groupType="room" user={user} profile={profile} isAdmin={isAdmin} memberCount={counts[r.id] || 0} onBack={() => setOpen(null)} onUpdatePinned={updateRoom} onOpenEvent={openEvent} />;
    }
    const e = events.find(x => x.id === open.id); if (!e) { setOpen(null); return null; }
    return <RoomChat room={{ id: e.id, name: e.title, emoji: e.emoji, logo_url: null, pinned: e.pinned }} groupType="event" user={user} profile={profile} isAdmin={isAdmin} memberCount={eventCounts[e.id] || 0} onBack={() => setOpen(null)} onUpdatePinned={updateEvent} onOpenEvent={openEvent} />;
  }

  const myChats = [
    ...(hasDM ? [{ id: user.id, type: "dm", name: "Glasswings", emoji: "📣", logo_url: null, sub: "Messages from the organiser" }] : []),
    ...rooms.filter(canAccess).map(r => ({ id: r.id, type: "room", name: r.name, emoji: r.emoji, logo_url: r.logo_url, sub: (counts[r.id] || 0) + " members" })),
    ...events.filter(canAccessEvent).map(e => ({ id: e.id, type: "event", name: e.title, emoji: e.emoji, logo_url: null, sub: e.event_date || ((eventCounts[e.id] || 0) + " going") })),
  ];

  return (
    <>
      {notice && <Notice text={notice} onClose={() => setNotice("")} />}
      {buyTarget && <TicketSheet target={buyTarget} profile={profile} subs={subs} onConfirm={confirmPurchase} onClose={() => setBuyTarget(null)} />}
      {ticketView && <MyTicket event={ticketView} profile={profile} rows={myTickets[ticketView.id] || []} onClose={() => setTicketView(null)} />}
      <div style={{ paddingBottom: 64, minHeight: "100vh", background: W.bg }}>
        {tab === "chats" && <Chats chats={myChats} onOpen={setOpen} onExplore={() => setTab("explore")} />}
        {tab === "explore" && <Explore rooms={rooms} profile={profile} counts={counts} canAccess={canAccess} freeForUser={freeForUser} onJoin={joinRoom} />}
        {tab === "events" && <Events events={events} categories={categories} cities={cities} profile={profile} ticketTypes={ticketTypes} subs={subs} canAccessEvent={canAccessEvent} counts={eventCounts} onJoin={joinEvent} onTicket={setTicketView} focus={focusEvent} onFocusDone={() => setFocusEvent(null)} />}
        {tab === "admin" && isAdmin && <Admin rooms={rooms} events={events} categories={categories} cities={cities} ticketTypes={ticketTypes} counts={counts} onCreateRoom={createRoom} onUpdateRoom={updateRoom} onDeleteRoom={deleteRoom} onCreateEvent={createEvent} onUpdateEvent={updateEvent} onDeleteEvent={deleteEvent} onAddOption={addOption} onDelOption={delOption} onAddTicketType={addTicketType} onDelTicketType={delTicketType} onBroadcast={broadcast} onBroadcastEvent={broadcastEvent} onSendDM={sendDM} onSendEventDM={sendEventDM} onOpenThread={(id, title) => setOpen({ id, type: "dm", title })} />}
        {tab === "profile" && <Profile user={user} profile={profile} reload={load} />}
      </div>
      <Nav tab={tab} setTab={setTab} isAdmin={isAdmin} />
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
function Events({ events, categories, cities, profile, ticketTypes, subs, canAccessEvent, counts, onJoin, onTicket, focus, onFocusDone }) {
  const [cat, setCat] = useState("All");
  const [city, setCity] = useState("All");
  const [hl, setHl] = useState(null);
  useEffect(() => {
    if (!focus) return;
    setCat("All"); setCity("All"); setHl(focus);
    const el = document.getElementById("ev-" + focus);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    const t1 = setTimeout(() => setHl(null), 2600);
    const t2 = setTimeout(() => onFocusDone && onFocusDone(), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [focus]);
  const catNames = (categories && categories.length) ? categories.map(c => c.name) : Array.from(new Set(events.map(e => e.category).filter(Boolean)));
  const cityNames = (cities && cities.length) ? cities.map(c => c.name) : Array.from(new Set(events.map(e => e.city).filter(Boolean)));
  const list = events.filter(e => (cat === "All" || e.category === cat) && (city === "All" || e.city === city));
  const Chips = ({ label, opts, val, set }) => opts.length ? (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "10px 14px", background: "#fff", borderBottom: `1px solid ${W.line}`, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: W.soft, fontWeight: 700, flexShrink: 0 }}>{label}</span>
      {["All", ...opts].map(o => (
        <button key={o} onClick={() => set(o)} style={{ flexShrink: 0, padding: "6px 13px", borderRadius: 20, border: `1px solid ${val === o ? W.teal : W.line}`, background: val === o ? W.teal : "#fff", color: val === o ? "#fff" : W.soft, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{o}</button>
      ))}
    </div>
  ) : null;
  return (
    <div>
      <TopBar title="Events" />
      <Chips label="Type" opts={catNames} val={cat} set={setCat} />
      <Chips label="City" opts={cityNames} val={city} set={setCity} />
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {list.length === 0 && <Center>No events here yet.</Center>}
        {list.map(e => {
          const has = canAccessEvent(e);
          const types = ticketTypes[e.id] || [];
          const avail = types.filter(t => t.gender_restrict === "any" || t.gender_restrict === profile?.gender);
          return (
            <div key={e.id} id={"ev-" + e.id} style={{ background: "#fff", borderRadius: 16, border: `1px solid ${hl === e.id ? W.teal : W.line}`, overflow: "hidden", boxShadow: hl === e.id ? `0 0 0 3px ${W.teal}33` : "none", transition: "box-shadow .3s, border-color .3s" }}>
              {e.banner_url && <BannerMedia url={e.banner_url} type={e.banner_type} style={{ width: "100%", height: "auto", display: "block" }} />}
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", gap: 13 }}>
                  <Avatar room={{ emoji: e.emoji }} size={46} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 16, color: W.ink }}>{e.title}</span>
                      {e.category && <span style={{ background: "#E7F6EF", color: W.teal, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12 }}>{e.category}</span>}
                    </div>
                    <div style={{ color: W.soft, fontSize: 13.5, marginTop: 3, lineHeight: 1.4 }}>{e.description}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, fontSize: 13, color: W.soft }}>
                  {e.event_date && <span style={{ display: "flex", gap: 5, alignItems: "center" }}><Calendar size={14} />{e.event_date}</span>}
                  {(e.venue || e.city) && <span style={{ display: "flex", gap: 5, alignItems: "center" }}><MapPin size={14} />{[e.venue, e.city].filter(Boolean).join(", ")}</span>}
                  <span style={{ display: "flex", gap: 5, alignItems: "center" }}><Users size={13} />{counts[e.id] || 0} going</span>
                </div>
                {has ? (
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
                    <button onClick={() => onTicket(e)} style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}` }}><Ticket size={15} />My ticket</button>
                    <button onClick={() => onJoin(e)} style={btn(W.teal, "#fff")}><MessageCircle size={15} />Open chat</button>
                  </div>
                ) : avail.length ? (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: W.soft, fontWeight: 700, marginBottom: 6 }}>Tickets</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {avail.map(t => {
                        const net = netPrice(t, subs);
                        const disc = net < t.price;
                        return (
                          <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${disc ? W.teal : W.line}`, borderRadius: 10, padding: "8px 12px" }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, color: W.ink, fontSize: 14 }}>{t.name}</div>
                              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                                {net === 0 ? <span style={{ color: W.teal }}>Free</span>
                                  : <span style={{ color: W.ink }}>₹{net}</span>}
                                {disc && t.price > 0 && <span style={{ color: W.soft, fontWeight: 500, textDecoration: "line-through" }}>₹{t.price}</span>}
                                {disc && <span style={{ background: "#E7F6EF", color: W.teal, fontSize: 10.5, fontWeight: 800, padding: "1px 6px", borderRadius: 10 }}>ROOM OFFER</span>}
                              </div>
                            </div>
                            <button onClick={() => onJoin(e, t)} style={btn(net === 0 ? W.teal : W.ink, "#fff")}><Ticket size={14} />{net === 0 ? "Get" : "Buy"}</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                    {e.ticket_price === 0 ? <span style={{ fontWeight: 700, color: W.teal, fontSize: 15 }}>Free</span>
                      : <span style={{ fontWeight: 700, color: W.ink, fontSize: 15, display: "flex", alignItems: "center" }}><IndianRupee size={14} />{e.ticket_price}<span style={{ color: W.soft, fontWeight: 500, fontSize: 13 }}> / ticket</span></span>}
                    <button onClick={() => onJoin(e)} style={btn(W.ink, "#fff")}><Ticket size={15} />{e.ticket_price === 0 ? "Get ticket" : "Buy ticket"}</button>
                  </div>
                )}
                {has && <div style={{ fontSize: 12, color: W.teal, marginTop: 8 }}>✓ You're in — chat unlocked</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- explore ---------------- */
function Explore({ rooms, profile, counts, canAccess, freeForUser, onJoin }) {
  return (
    <div>
      <TopBar title="Explore Rooms" />
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {rooms.length === 0 && <Center>No rooms yet. Create one from the Admin tab.</Center>}
        {rooms.map(r => {
          const has = canAccess(r);
          const womenFree = r.price_monthly > 0 && profile?.gender !== "male";
          return (
            <div key={r.id} style={{ background: "#fff", borderRadius: 16, border: `1px solid ${W.line}`, padding: 16 }}>
              <div style={{ display: "flex", gap: 13 }}>
                <Avatar room={r} size={50} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: W.ink }}>{r.name}</div>
                  <div style={{ color: W.soft, fontSize: 13.5, marginTop: 3, lineHeight: 1.4 }}>{r.description}</div>
                  <div style={{ color: W.soft, fontSize: 12.5, marginTop: 5, display: "flex", alignItems: "center", gap: 5 }}><Users size={13} />{counts[r.id] || 0} members</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {r.price_monthly === 0 ? <span style={{ fontWeight: 700, color: W.teal, fontSize: 15 }}>Free</span>
                    : womenFree ? <><span style={{ textDecoration: "line-through", color: W.soft, fontSize: 14, display: "flex", alignItems: "center" }}><IndianRupee size={13} />{r.price_monthly}</span><span style={{ background: "#FCE7F1", color: W.pink, fontWeight: 700, fontSize: 12, padding: "3px 9px", borderRadius: 20 }}>Free for women</span></>
                      : <span style={{ fontWeight: 700, color: W.ink, fontSize: 15, display: "flex", alignItems: "center" }}><IndianRupee size={14} />{r.price_monthly}<span style={{ color: W.soft, fontWeight: 500, fontSize: 13 }}>/mo</span></span>}
                </div>
                {has ? <button onClick={() => onJoin(r)} style={btn(W.teal, "#fff")}><MessageCircle size={15} />Open</button>
                  : freeForUser(r) ? <button onClick={() => onJoin(r)} style={btn(W.teal, "#fff")}>Join free</button>
                    : <button onClick={() => onJoin(r)} style={btn(W.ink, "#fff")}><Lock size={14} />Subscribe</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- chat room ---------------- */
function RoomChat({ room, groupType = "room", user, profile, isAdmin, memberCount, onBack, onUpdatePinned, onOpenEvent, readOnly = false }) {
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

  return (
    <div style={{ minHeight: "100dvh", background: W.wall, backgroundImage: `url("${WALL}")`, paddingBottom: 72 }}>
      <div ref={headRef} style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, zIndex: 30 }}>
        <div style={{ background: W.teal, color: "#fff", display: "flex", alignItems: "center", gap: 10, padding: "12px" }}>
          <ArrowLeft size={22} onClick={onBack} style={{ cursor: "pointer", flexShrink: 0 }} />
          <Avatar room={room} size={38} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 16.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{room.name}</div>
            <div style={{ fontSize: 12, opacity: .85 }}>{groupType === "dm" ? "Messages from the organiser" : `${memberCount} members`}</div>
          </div>
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
                  <div style={{ fontSize: 11, color: W.soft, textAlign: "right", marginTop: 2 }}>{fmtTime(m.created_at)}</div>
                </div>
                {mine && (first ? <PersonAvatar url={s.avatar} name={s.name} size={28} /> : <div style={{ width: 28, flexShrink: 0 }} />)}
              </div>
            );
          })}
        <div ref={endRef} />
      </div>
      {showQR && (
        <div style={{ position: "fixed", bottom: 63, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, zIndex: 25, background: "#fff", borderTop: `1px solid ${W.line}`, boxShadow: "0 -4px 16px rgba(0,0,0,.08)", maxHeight: "45vh", overflowY: "auto", padding: 12 }}>
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
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, zIndex: 20, background: W.bg, padding: "12px", textAlign: "center", color: W.soft, fontSize: 12.5 }}>📣 Announcements from Glasswings</div>
      ) : (
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, zIndex: 20, background: W.bg, padding: "8px 9px", display: "flex", alignItems: "flex-end", gap: 7 }}>
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
function Admin({ rooms, events, categories, cities, ticketTypes, counts, onCreateRoom, onUpdateRoom, onDeleteRoom, onCreateEvent, onUpdateEvent, onDeleteEvent, onAddOption, onDelOption, onAddTicketType, onDelTicketType, onBroadcast, onBroadcastEvent, onSendDM, onSendEventDM, onOpenThread }) {
  const [seg, setSeg] = useState("rooms");
  return (
    <div>
      <TopBar title="Admin Panel" />
      <div style={{ display: "flex", background: "#fff", borderBottom: `1px solid ${W.line}`, position: "sticky", top: 53, zIndex: 9, overflowX: "auto" }}>
        {[["rooms", "Rooms"], ["events", "Events"], ["broadcast", "Send"], ["inbox", "Inbox"], ["members", "Members"]].map(([v, l]) => (
          <button key={v} onClick={() => setSeg(v)} style={{ flex: "1 0 auto", padding: "13px 14px", border: "none", background: "none", cursor: "pointer", fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap", color: seg === v ? W.teal : W.soft, borderBottom: `3px solid ${seg === v ? W.teal : "transparent"}` }}>{l}</button>
        ))}
      </div>
      {seg === "rooms" ? <AdminRooms rooms={rooms} onCreate={onCreateRoom} onUpdate={onUpdateRoom} onDelete={onDeleteRoom} />
        : seg === "events" ? <AdminEvents events={events} categories={categories} cities={cities} ticketTypes={ticketTypes} rooms={rooms} onCreate={onCreateEvent} onUpdate={onUpdateEvent} onDelete={onDeleteEvent} onAddOption={onAddOption} onDelOption={onDelOption} onAddTicketType={onAddTicketType} onDelTicketType={onDelTicketType} onBroadcastEvent={onBroadcastEvent} onSendEventDM={onSendEventDM} />
          : seg === "broadcast" ? <AdminBroadcast events={events} onBroadcast={onBroadcast} onBroadcastEvent={onBroadcastEvent} onSendDM={onSendDM} onSendEventDM={onSendEventDM} />
            : seg === "inbox" ? <AdminInbox onOpenThread={onOpenThread} />
              : <AdminMembers onSendDM={onSendDM} />}
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
function AdminRooms({ rooms, onCreate, onUpdate, onDelete }) {
  const [creating, setCreating] = useState(false), [manage, setManage] = useState(null);
  const [f, setF] = useState({ emoji: "💬", name: "", price: "", desc: "" });
  const reset = () => setF({ emoji: "💬", name: "", price: "", desc: "" });
  const create = async () => { if (!f.name) return; await onCreate({ name: f.name, emoji: f.emoji || "💬", price_monthly: Number(f.price) || 0, description: f.desc }); reset(); setCreating(false); };
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
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, color: W.ink }}>{r.name}</div><div style={{ fontSize: 13, color: W.soft }}>{r.price_monthly === 0 ? "Free" : `₹${r.price_monthly}/mo`}</div></div>
              <Settings size={19} color={W.soft} style={{ cursor: "pointer" }} onClick={() => setManage(manage === r.id ? null : r.id)} />
            </div>
            {manage === r.id && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${W.line}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                <RoomPhoto room={r} onUpdate={onUpdate} />
                <PinEditor room={r} onUpdate={onUpdate} />
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
function TicketSheet({ target, profile, subs, onConfirm, onClose }) {
  const { event: e, type } = target;
  const orig = type ? type.price : e.ticket_price;
  const unit = type ? netPrice(type, subs) : e.ticket_price;
  const [qty, setQty] = useState(1);
  const [agree, setAgree] = useState(false);
  const needAgree = !!(e.terms && e.terms.trim());
  const total = unit * qty;
  const canConfirm = !needAgree || agree;
  const stepBtn = { width: 34, height: 34, borderRadius: "50%", border: `1px solid ${W.line}`, background: "#fff", fontSize: 20, color: W.ink, cursor: "pointer", lineHeight: 1 };
  return (
    <Sheet onClose={onClose}>
      <div style={{ fontWeight: 800, fontSize: 18, color: W.ink, marginBottom: 4 }}>{e.emoji} {e.title}</div>
      <div style={{ color: W.soft, fontSize: 13.5, marginBottom: 16 }}>{type ? type.name : "Ticket"} · {unit === 0 ? "Free" : `₹${unit} each`}{unit < orig ? ` (room offer — was ₹${orig})` : ""}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontWeight: 600, color: W.ink }}>Number of tickets</span>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => setQty(q => Math.max(1, q - 1))} style={stepBtn}>−</button>
          <span style={{ fontWeight: 700, fontSize: 17, minWidth: 24, textAlign: "center" }}>{qty}</span>
          <button onClick={() => setQty(q => q + 1)} style={stepBtn}>+</button>
        </div>
      </div>
      {needAgree && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: W.soft, marginBottom: 6 }}>Terms &amp; conditions</div>
          <div style={{ background: W.bg, borderRadius: 10, padding: 12, fontSize: 13, color: W.ink, maxHeight: 150, overflowY: "auto", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{e.terms}</div>
          <label style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={agree} onChange={ev => setAgree(ev.target.checked)} style={{ marginTop: 3 }} />
            <span style={{ fontSize: 13.5, color: W.ink }}>I have read and agree to the terms &amp; conditions.</span>
          </label>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ color: W.soft, fontSize: 14 }}>Total</span>
        <span style={{ fontWeight: 800, fontSize: 18, color: W.ink }}>{total === 0 ? "Free" : `₹${total}`}</span>
      </div>
      {unit > 0 && <div style={{ fontSize: 12.5, color: W.soft, marginBottom: 10 }}>Online payment is being set up — paid tickets go live with the payments step.</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, flex: 1, justifyContent: "center" }}>Cancel</button>
        <button disabled={!canConfirm} onClick={() => onConfirm(qty)} style={{ ...btn(W.teal, "#fff"), flex: 2, justifyContent: "center", opacity: canConfirm ? 1 : .5 }}>{unit > 0 ? "Continue" : `Get ${qty} ticket${qty > 1 ? "s" : ""}`}</button>
      </div>
    </Sheet>
  );
}
function MyTicket({ event: e, profile, rows, onClose }) {
  const [busy, setBusy] = useState(false);
  const qty = rows.reduce((s, r) => s + (r.quantity || 1), 0);
  const code = "GW-" + ((rows[0]?.id || "").replace(/-/g, "").slice(0, 8).toUpperCase());
  const place = [e.venue, e.city].filter(Boolean).join(", ");
  const qr = "https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=0&data=" + encodeURIComponent(code);
  const summary = `🎟️ Glasswings Ticket\n${e.title}\n${e.event_date || ""}${place ? `\n${place}` : ""}\nName: ${profile?.name || ""}\nTickets: ${qty}\nCode: ${code}`;
  const wa = "https://wa.me/?text=" + encodeURIComponent(summary);
  const print = () => {
    const w = window.open("", "_blank", "width=460,height=720"); if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Glasswings Ticket</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      *{box-sizing:border-box} body{font-family:system-ui,Arial,sans-serif;margin:0;padding:24px;background:#eef2f1;color:#0b1f1c}
      .t{max-width:420px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.12)}
      .hd{background:linear-gradient(135deg,#0E8C7F,#13B3A0);color:#fff;padding:22px 22px 26px}
      .br{font-size:11px;letter-spacing:3px;font-weight:700;opacity:.85}
      .ti{font-size:24px;font-weight:800;margin-top:8px;line-height:1.2}
      .mt{font-size:13.5px;opacity:.95;margin-top:8px}
      .bd{padding:22px;position:relative}
      .tear{border-top:2px dashed #d9e2df;margin:0 -22px 18px}
      .row{display:flex;justify-content:space-between;align-items:flex-end;gap:16px}
      .lbl{font-size:11px;letter-spacing:1px;color:#5a6b67;text-transform:uppercase;margin-top:12px}
      .val{font-size:18px;font-weight:800;color:#0b1f1c}
      .code{font-size:24px;font-weight:800;letter-spacing:3px;color:#0E8C7F;font-family:ui-monospace,monospace}
      .qr{width:120px;height:120px;border:1px solid #e6ebe9;border-radius:12px}
      .ft{text-align:center;font-size:12px;color:#5a6b67;margin-top:16px}
    </style></head><body><div class="t">
      <div class="hd"><div class="br">G L A S S W I N G S</div><div class="ti">${escapeHtml((e.emoji || "🎟️") + " " + e.title)}</div>${e.event_date ? `<div class="mt">📅 ${escapeHtml(e.event_date)}</div>` : ""}${place ? `<div class="mt">📍 ${escapeHtml(place)}</div>` : ""}</div>
      <div class="bd"><div class="tear"></div>
        <div class="row"><div>
          <div class="lbl">Attendee</div><div class="val">${escapeHtml(profile?.name || "")}</div>
          <div class="lbl">Tickets</div><div class="val">${qty}</div>
          <div class="lbl">Ticket code</div><div class="code">${code}</div>
        </div><img class="qr" src="${qr}" alt="QR"/></div>
        <div class="ft">Show this ticket at entry · Glasswings community</div>
      </div></div>
      <script>window.onload=function(){setTimeout(function(){window.print()},350)}</script></body></html>`);
    w.document.close();
  };
  const shareWhatsApp = async () => {
    setBusy(true);
    try {
      const blob = await makeTicketBlob({ emoji: e.emoji, title: e.title, dateStr: e.event_date, place, name: profile?.name, qty, code });
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
      <div style={{ borderRadius: 18, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,.14)", marginBottom: 16, background: "#fff" }}>
        <div style={{ background: "linear-gradient(135deg,#0E8C7F,#13B3A0)", color: "#fff", padding: "18px 18px 22px" }}>
          <div style={{ fontSize: 10.5, letterSpacing: 3, fontWeight: 700, opacity: .85 }}>G L A S S W I N G S</div>
          <div style={{ fontSize: 21, fontWeight: 800, marginTop: 7, lineHeight: 1.2 }}>{e.emoji} {e.title}</div>
          {e.event_date && <div style={{ fontSize: 13, marginTop: 8, opacity: .96, display: "flex", gap: 6, alignItems: "center" }}><Calendar size={14} />{e.event_date}</div>}
          {place && <div style={{ fontSize: 13, marginTop: 4, opacity: .96, display: "flex", gap: 6, alignItems: "center" }}><MapPin size={14} />{place}</div>}
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ borderTop: `2px dashed ${W.line}`, margin: "0 -18px 16px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 1, color: W.soft, textTransform: "uppercase" }}>Attendee</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: W.ink }}>{profile?.name}</div>
              <div style={{ fontSize: 10.5, letterSpacing: 1, color: W.soft, textTransform: "uppercase", marginTop: 10 }}>Tickets</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: W.ink }}>{qty}</div>
              <div style={{ fontSize: 10.5, letterSpacing: 1, color: W.soft, textTransform: "uppercase", marginTop: 10 }}>Ticket code</div>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: 2, color: W.teal, fontFamily: "ui-monospace,monospace" }}>{code}</div>
            </div>
            <img src={qr} alt="QR" width={112} height={112} style={{ borderRadius: 10, border: `1px solid ${W.line}`, flexShrink: 0 }} />
          </div>
          <div style={{ fontSize: 11.5, color: W.soft, marginTop: 14, textAlign: "center" }}>Show this ticket at entry</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={print} style={{ ...btn("#fff", W.ink), border: `1px solid ${W.line}`, flex: 1, justifyContent: "center" }}><Printer size={16} />Print</button>
        <button onClick={shareWhatsApp} disabled={busy} style={{ ...btn(W.teal, "#fff"), flex: 1, justifyContent: "center", opacity: busy ? .6 : 1 }}><Share2 size={16} />{busy ? "Preparing…" : "WhatsApp"}</button>
      </div>
      <button onClick={onClose} style={{ ...btn("#fff", W.soft), border: `1px solid ${W.line}`, width: "100%", justifyContent: "center", marginTop: 10 }}>Close</button>
    </Sheet>
  );
}
function TicketTypes({ eventId, types, rooms, onAdd, onDel }) {
  const [name, setName] = useState(""); const [price, setPrice] = useState(""); const [g, setG] = useState("any");
  const [dRoom, setDRoom] = useState(""); const [dKind, setDKind] = useState("percent"); const [dVal, setDVal] = useState("");
  const gl = { any: "Anyone", male: "Men", female: "Women" };
  const roomName = id => ((rooms || []).find(r => r.id === id) || {}).name || "room";
  const add = async () => {
    if (!name.trim()) return;
    await onAdd(eventId, { name: name.trim(), price: Number(price) || 0, gender_restrict: g, discount_room_id: dRoom || null, discount_kind: dKind, discount_value: Number(dVal) || 0 });
    setName(""); setPrice(""); setG("any"); setDRoom(""); setDKind("percent"); setDVal("");
  };
  const ip = { border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 11px", fontSize: 14, outline: "none", background: "#fff", color: W.ink };
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: W.soft }}>Ticket types</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "8px 0" }}>
        {types.map(t => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, background: W.bg, borderRadius: 9, padding: "7px 10px" }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: W.ink }}><b>{t.name}</b> · {t.price === 0 ? "Free" : `₹${t.price}`} · {gl[t.gender_restrict]}{t.discount_room_id ? <span style={{ color: W.teal }}> · {t.discount_kind === "flat" ? `₹${t.discount_value}` : `${t.discount_value}%`} off for {roomName(t.discount_room_id)}</span> : ""}</span>
            <X size={15} color="#C0392B" style={{ cursor: "pointer" }} onClick={() => onDel(t.id)} />
          </div>
        ))}
        {types.length === 0 && <span style={{ fontSize: 12.5, color: W.soft }}>No types yet — the event uses its single ticket price above.</span>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. Men)" style={{ ...ip, flex: "1 1 110px", minWidth: 0 }} />
        <input value={price} onChange={e => setPrice(e.target.value.replace(/\D/g, ""))} placeholder="₹ 0" inputMode="numeric" style={{ ...ip, width: 64 }} />
        <select value={g} onChange={e => setG(e.target.value)} style={ip}>
          <option value="any">Anyone</option>
          <option value="male">Men</option>
          <option value="female">Women</option>
        </select>
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
function OptionList({ label, kind, items, onAdd, onDel }) {
  const [val, setVal] = useState("");
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: W.soft, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input value={val} onChange={e => setVal(e.target.value)} placeholder={`Add a ${kind}…`} style={{ flex: 1, minWidth: 0, border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 12px", fontSize: 14, outline: "none" }} />
        <button onClick={async () => { await onAdd(kind, val); setVal(""); }} style={btn(W.teal, "#fff")}>Add</button>
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {items.map(it => (
          <span key={it.id} style={{ display: "flex", alignItems: "center", gap: 6, background: W.bg, borderRadius: 16, padding: "5px 7px 5px 12px", fontSize: 13, color: W.ink }}>
            {it.name}<X size={14} color="#C0392B" style={{ cursor: "pointer" }} onClick={() => onDel(it.id)} />
          </span>
        ))}
        {items.length === 0 && <span style={{ fontSize: 12.5, color: W.soft }}>None yet.</span>}
      </div>
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
function AdminEvents({ events, categories, cities, ticketTypes, rooms, onCreate, onUpdate, onDelete, onAddOption, onDelOption, onAddTicketType, onDelTicketType, onBroadcastEvent, onSendEventDM }) {
  const [creating, setCreating] = useState(false), [manage, setManage] = useState(null), [taxOpen, setTaxOpen] = useState(false);
  const [f, setF] = useState({ emoji: "🎟️", title: "", price: "", desc: "", date: "", venue: "", category: "", city: "", banner: "", bannerType: "image", terms: "" });
  const [up, setUp] = useState(false);
  const bRef = useRef(null);
  const [members, setMembers] = useState([]); const [sendFor, setSendFor] = useState(null);
  useEffect(() => { supabase.from("profiles").select("id, gender, member_details(age, profession, city)").then(({ data }) => setMembers(data || [])); }, []);
  const reset = () => setF({ emoji: "🎟️", title: "", price: "", desc: "", date: "", venue: "", category: "", city: "", banner: "", bannerType: "image", terms: "" });
  const pickBanner = async (e) => { const file = e.target.files?.[0]; if (!file) return; setUp(true); try { const url = await uploadChatFile("banners", file); setF(s => ({ ...s, banner: url, bannerType: file.type.startsWith("video") ? "video" : "image" })); } catch (x) { alert("Upload failed: " + x.message); } setUp(false); };
  const create = async () => { if (!f.title) return; await onCreate({ title: f.title, emoji: f.emoji || "🎟️", ticket_price: Number(f.price) || 0, description: f.desc, event_date: f.date, venue: f.venue, category: f.category, city: f.city, banner_url: f.banner, banner_type: f.bannerType, terms: f.terms }); reset(); setCreating(false); };
  const chip = (name, sel, onClick) => <button key={name} onClick={onClick} style={{ padding: "6px 12px", borderRadius: 16, border: `1px solid ${sel ? W.teal : W.line}`, background: sel ? "#E7F6EF" : "#fff", color: W.ink, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{name}</button>;
  return (
    <div style={{ padding: 14 }}>
      {sendFor && <EventSendSheet event={sendFor} members={members} onSend={async (ids) => { await onSendEventDM(sendFor, ids); setSendFor(null); }} onClose={() => setSendFor(null)} />}
      <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: 14, marginBottom: 12 }}>
        <div onClick={() => setTaxOpen(o => !o)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
          <span style={{ fontWeight: 700, color: W.ink }}>Categories &amp; cities</span>
          <span style={{ color: W.soft, fontSize: 13 }}>{taxOpen ? "Hide ▲" : "Manage ▼"}</span>
        </div>
        {taxOpen && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 16 }}>
            <OptionList label="Categories" kind="category" items={categories} onAdd={onAddOption} onDel={onDelOption} />
            <OptionList label="Cities" kind="city" items={cities} onAdd={onAddOption} onDel={onDelOption} />
          </div>
        )}
      </div>
      {creating ? (
        <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${W.line}`, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: W.ink }}>New ticketed event</div>
          {f.banner ? (
            <div onClick={() => bRef.current?.click()} style={{ borderRadius: 12, overflow: "hidden", marginBottom: 12, cursor: "pointer", border: `1px solid ${W.line}` }}>
              <BannerMedia url={f.banner} type={f.bannerType} style={{ width: "100%", height: "auto", display: "block" }} />
            </div>
          ) : (
            <div onClick={() => bRef.current?.click()} style={{ height: 120, borderRadius: 12, border: `1.5px dashed ${W.line}`, background: W.bg, display: "flex", alignItems: "center", justifyContent: "center", color: W.soft, cursor: "pointer", marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
              {up ? "Uploading…" : "+ Add banner image or video"}
            </div>
          )}
          <input ref={bRef} type="file" accept="image/*,video/*" onChange={pickBanner} style={{ display: "none" }} />
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <input value={f.emoji} onChange={e => setF({ ...f, emoji: e.target.value })} maxLength={2} style={{ width: 56, textAlign: "center", fontSize: 22, border: `1px solid ${W.line}`, borderRadius: 10, padding: 8 }} />
            <input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Event title" style={{ flex: 1, minWidth: 0, border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none" }} />
          </div>
          <div style={{ fontSize: 12, color: W.soft, fontWeight: 700, marginBottom: 6 }}>Category</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
            {categories.length === 0 ? <span style={{ fontSize: 12.5, color: W.soft }}>Add categories with "Manage" above first.</span> : categories.map(c => chip(c.name, f.category === c.name, () => setF({ ...f, category: f.category === c.name ? "" : c.name })))}
          </div>
          <div style={{ fontSize: 12, color: W.soft, fontWeight: 700, marginBottom: 6 }}>City</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
            {cities.length === 0 ? <span style={{ fontSize: 12.5, color: W.soft }}>Add cities with "Manage" above first.</span> : cities.map(c => chip(c.name, f.city === c.name, () => setF({ ...f, city: f.city === c.name ? "" : c.name })))}
          </div>
          <input value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} placeholder="Short description" style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none", marginBottom: 10 }} />
          <input value={f.date} onChange={e => setF({ ...f, date: e.target.value })} placeholder="Date & time (e.g. Sat 14 Jun · 8PM)" style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none", marginBottom: 10 }} />
          <input value={f.venue} onChange={e => setF({ ...f, venue: e.target.value })} placeholder="Venue / address" style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none", marginBottom: 10 }} />
          <textarea value={f.terms} onChange={e => setF({ ...f, terms: e.target.value })} rows={2} placeholder="Terms & conditions (optional)" style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none", marginBottom: 10, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
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
        <button onClick={() => setCreating(true)} style={{ width: "100%", padding: 14, border: `1.5px dashed ${W.teal}`, borderRadius: 14, background: "#fff", color: W.teal, fontWeight: 700, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}><Plus size={18} />Create ticketed event</button>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {events.map(e => (
          <div key={e.id} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar room={{ emoji: e.emoji }} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, color: W.ink }}>{e.title}</div><div style={{ fontSize: 13, color: W.soft }}>{e.ticket_price === 0 ? "Free" : `₹${e.ticket_price}/ticket`}{e.category ? ` · ${e.category}` : ""}{e.city ? ` · ${e.city}` : ""}</div></div>
              <button onClick={() => onBroadcastEvent(e)} title="Post to all group chats" style={{ ...btn(W.teal, "#fff"), padding: "6px 9px", fontSize: 11.5 }}><Zap size={13} />Groups</button>
              <button onClick={() => setSendFor(e)} title="Send privately to members (with filters)" style={{ ...btn(W.ink, "#fff"), padding: "6px 9px", fontSize: 11.5 }}><Send size={13} />Members</button>
              <Settings size={19} color={W.soft} style={{ cursor: "pointer" }} onClick={() => setManage(manage === e.id ? null : e.id)} />
            </div>
            {manage === e.id && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${W.line}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                <EventBanner ev={e} onUpdate={onUpdate} />
                <TicketTypes eventId={e.id} types={ticketTypes[e.id] || []} rooms={rooms} onAdd={onAddTicketType} onDel={onDelTicketType} />
                <EventTerms ev={e} onUpdate={onUpdate} />
                <PinEditor room={e} onUpdate={onUpdate} />
                <button onClick={() => { if (confirm("Delete this event and all its messages?")) onDelete(e.id); }} style={{ ...btn("#fff", "#C0392B"), border: "1px solid #F2C4C0", justifyContent: "center" }}><Trash2 size={15} />Delete event</button>
              </div>
            )}
          </div>
        ))}
        {events.length === 0 && <Center>No events yet.</Center>}
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
function AdminMembers({ onSendDM }) {
  const [list, setList] = useState(null);
  const [g, setG] = useState("all"); const [age, setAge] = useState("all"); const [prof, setProf] = useState("all"); const [area, setArea] = useState("all"); const [city, setCity] = useState("all");
  useEffect(() => {
    supabase.from("profiles").select("id, full_name, gender, role, avatar_url, member_details(phone, age, area, profession, city)").order("created_at", { ascending: false })
      .then(({ data }) => setList(data || []));
  }, []);
  if (list === null) return <Center>loading members…</Center>;
  const det = m => m.member_details || {};
  const ageBand = a => { a = Number(a); if (!a) return null; if (a < 25) return "18-24"; if (a < 35) return "25-34"; if (a < 45) return "35-44"; return "45+"; };
  const profs = Array.from(new Set(list.map(m => det(m).profession).filter(Boolean))).sort();
  const areas = Array.from(new Set(list.map(m => det(m).area).filter(Boolean))).sort();
  const cities = Array.from(new Set(list.map(m => det(m).city).filter(Boolean))).sort();
  const filtered = list.filter(m => {
    const d = det(m);
    if (g !== "all" && m.gender !== g) return false;
    if (age !== "all" && ageBand(d.age) !== age) return false;
    if (prof !== "all" && d.profession !== prof) return false;
    if (area !== "all" && d.area !== area) return false;
    if (city !== "all" && d.city !== city) return false;
    return true;
  });
  const phones = filtered.map(m => det(m).phone).filter(Boolean);
  const messageAll = () => { if (!filtered.length) return; const text = window.prompt(`Send an in-app message to ${filtered.length} member${filtered.length === 1 ? "" : "s"}:`); if (text && text.trim()) onSendDM(filtered.map(m => m.id), text); };
  const sel = { padding: "8px 10px", borderRadius: 9, border: `1px solid ${W.line}`, background: "#fff", fontSize: 13, color: W.ink, outline: "none" };
  const chip = (v, label) => <button key={v} onClick={() => setG(v)} style={{ padding: "7px 13px", borderRadius: 18, border: `1px solid ${g === v ? W.teal : W.line}`, background: g === v ? W.teal : "#fff", color: g === v ? "#fff" : W.soft, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{label}</button>;
  return (
    <div style={{ padding: 14 }}>
      <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
          {chip("all", "Everyone")}{chip("male", "Men")}{chip("female", "Women")}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={age} onChange={e => setAge(e.target.value)} style={sel}><option value="all">All ages</option><option>18-24</option><option>25-34</option><option>35-44</option><option>45+</option></select>
          <select value={prof} onChange={e => setProf(e.target.value)} style={sel}><option value="all">All work</option>{profs.map(p => <option key={p} value={p}>{p}</option>)}</select>
          <select value={area} onChange={e => setArea(e.target.value)} style={sel}><option value="all">All areas</option>{areas.map(a => <option key={a} value={a}>{a}</option>)}</select>
          <select value={city} onChange={e => setCity(e.target.value)} style={sel}><option value="all">All cities</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}</select>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
        <span style={{ fontSize: 13.5, color: W.soft }}><b style={{ color: W.ink }}>{filtered.length}</b> member{filtered.length === 1 ? "" : "s"} match</span>
        <button onClick={messageAll} disabled={!filtered.length} style={{ ...btn(W.teal, "#fff"), opacity: filtered.length ? 1 : .5 }}><Send size={15} />Message {filtered.length}</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(m => {
          const d = det(m);
          return (
            <div key={m.id} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${W.line}`, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <PersonAvatar url={m.avatar_url} name={m.full_name} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: W.ink }}>{m.full_name || "—"} {m.role !== "member" && <span style={{ fontSize: 11, color: W.teal }}>· {m.role}</span>}</div>
                  <div style={{ fontSize: 13, color: W.soft, display: "flex", alignItems: "center", gap: 5 }}><Phone size={12} />{d.phone || "no phone"}</div>
                </div>
                <button onClick={() => { const text = window.prompt(`Send an in-app message to ${m.full_name || "this member"}:`); if (text && text.trim()) onSendDM([m.id], text); }} style={{ ...btn(W.teal, "#fff"), padding: "7px 11px", fontSize: 12.5 }}><Send size={14} />Message</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 10, fontSize: 13, color: W.soft }}>
                <span>Sex: {{ male: "M", female: "F", other: "—" }[m.gender] || "—"}</span>
                <span>Age: {d.age || "—"}</span>
                <span>Area: {d.area || "—"}</span>
                <span>City: {d.city || "—"}</span>
                <span>Work: {d.profession || "—"}</span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <Center>No members match these filters.</Center>}
      </div>
    </div>
  );
}

/* ---------------- profile ---------------- */
function Profile({ user, profile, reload }) {
  const roleLabel = { admin: "Admin (Owner)", subadmin: "Sub-admin", member: "Member" }[profile?.role] || "Member";
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
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
        <button onClick={() => supabase.auth.signOut()} style={{ marginTop: 16, width: "100%", padding: 14, borderRadius: 12, border: `1px solid ${W.line}`, background: "#fff", color: "#C0392B", fontWeight: 700, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><LogOut size={18} />Log out</button>
        <div style={{ textAlign: "center", color: W.soft, fontSize: 11, marginTop: 18 }}>Glasswings build • ticket-discounts ✅</div>
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
function Nav({ tab, setTab, isAdmin }) {
  const items = [{ id: "chats", icon: MessageCircle, label: "Chats" }, { id: "explore", icon: Compass, label: "Explore" }, { id: "events", icon: Calendar, label: "Events" }, ...(isAdmin ? [{ id: "admin", icon: Shield, label: "Admin" }] : []), { id: "profile", icon: User, label: "Profile" }];
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#fff", borderTop: `1px solid ${W.line}`, display: "flex", padding: "8px 0 11px" }}>
      {items.map(it => { const on = tab === it.id; const I = it.icon; return <button key={it.id} onClick={() => setTab(it.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: on ? W.teal : W.soft }}><I size={23} strokeWidth={on ? 2.4 : 2} /><span style={{ fontSize: 11, fontWeight: on ? 700 : 500 }}>{it.label}</span></button>; })}
    </div>
  );
}
