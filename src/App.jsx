import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient.js";
import {
  MessageCircle, Compass, Shield, User, ArrowLeft, Send, Plus, LogOut, Lock,
  Pin, Trash2, Settings, IndianRupee, Crown, Smile, Paperclip, Camera, X
} from "lucide-react";

const W = { teal: "#008069", sent: "#D9FDD3", recv: "#fff", wall: "#EAE2D8", ink: "#111B21", soft: "#667781", line: "#E9EDEF", bg: "#F0F2F5", blue: "#53BDEB", pink: "#D81B7A" };
const WALL = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><g fill='none' stroke='%23000' stroke-opacity='0.03' stroke-width='2'><circle cx='20' cy='20' r='6'/><path d='M50 14 l8 8 M58 14 l-8 8'/><rect x='48' y='48' width='14' height='14' rx='3'/><path d='M14 54 q8 -10 16 0'/></g></svg>`);

/* ---------------- root ---------------- */
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
    <div style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", background: "#d9d9d9", display: "flex", justifyContent: "center", minHeight: "100vh" }}>
      <style>{`*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}input,button{font-family:inherit;}::-webkit-scrollbar{width:0;}`}</style>
      <div style={{ width: "100%", maxWidth: 430, minHeight: "100vh", background: W.bg, boxShadow: "0 0 60px rgba(0,0,0,.15)", position: "relative" }}>{children}</div>
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

/* ---------------- main (logged in) ---------------- */
function Main({ user }) {
  const [profile, setProfile] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [subs, setSubs] = useState([]);
  const [mods, setMods] = useState([]);
  const [tab, setTab] = useState("chats");
  const [openId, setOpenId] = useState(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [{ data: prof }, { data: rm }, { data: sb }, { data: md }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("rooms").select("*").order("created_at", { ascending: true }),
      supabase.from("room_subscriptions").select("room_id").eq("user_id", user.id),
      supabase.from("room_moderators").select("room_id").eq("user_id", user.id),
    ]);
    setProfile(prof); setRooms(rm || []); setSubs((sb || []).map(x => x.room_id)); setMods((md || []).map(x => x.room_id)); setReady(true);
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  const isAdmin = profile?.role === "admin";
  const canAccess = (r) => isAdmin || subs.includes(r.id) || mods.includes(r.id);
  const freeForUser = (r) => r.price_monthly === 0 || profile?.gender !== "male" || profile?.founding_member;

  const joinRoom = async (r) => {
    if (canAccess(r)) return setOpenId(r.id);
    if (!freeForUser(r)) return setNotice("Online payments are being set up — paid subscriptions for men are coming in the next step.");
    const { error } = await supabase.from("room_subscriptions").insert({ room_id: r.id, user_id: user.id });
    if (error) return setNotice(error.message);
    setSubs(p => [...p, r.id]); setOpenId(r.id);
  };
  const createRoom = async (d) => { const { error } = await supabase.from("rooms").insert(d); if (error) return setNotice(error.message); await load(); };
  const updateRoom = async (id, p) => { const { error } = await supabase.from("rooms").update(p).eq("id", id); if (error) return setNotice(error.message); setRooms(prev => prev.map(r => r.id === id ? { ...r, ...p } : r)); };
  const deleteRoom = async (id) => { const { error } = await supabase.from("rooms").delete().eq("id", id); if (error) return setNotice(error.message); setRooms(prev => prev.filter(r => r.id !== id)); setOpenId(null); };

  if (!ready) return <Splash />;
  const open = openId ? rooms.find(r => r.id === openId) : null;
  if (open) return <RoomChat room={open} user={user} profile={profile} isAdmin={isAdmin} onBack={() => setOpenId(null)} onUpdateRoom={updateRoom} />;
  const myChats = rooms.filter(canAccess);

  return (
    <>
      {notice && <Notice text={notice} onClose={() => setNotice("")} />}
      <div style={{ paddingBottom: 64, minHeight: "100vh", background: W.bg }}>
        {tab === "chats" && <Chats rooms={myChats} onOpen={setOpenId} onExplore={() => setTab("explore")} />}
        {tab === "explore" && <Explore rooms={rooms} profile={profile} canAccess={canAccess} freeForUser={freeForUser} onJoin={joinRoom} />}
        {tab === "admin" && isAdmin && <Admin rooms={rooms} onCreate={createRoom} onUpdate={updateRoom} onDelete={deleteRoom} />}
        {tab === "profile" && <Profile user={user} profile={profile} />}
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
function Chats({ rooms, onOpen, onExplore }) {
  return (
    <div>
      <TopBar title="Glasswings" />
      {rooms.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 30px", color: W.soft }}>
          <MessageCircle size={42} color={W.teal} style={{ marginBottom: 14 }} />
          <div style={{ fontWeight: 700, color: W.ink, fontSize: 17 }}>No chats yet</div>
          <div style={{ fontSize: 14, marginTop: 6 }}>Join a room to start chatting.</div>
          <button onClick={onExplore} style={{ marginTop: 16, padding: "11px 20px", border: "none", borderRadius: 22, background: W.teal, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Explore rooms</button>
        </div>
      ) : rooms.map(r => (
        <div key={r.id} onClick={() => onOpen(r.id)} style={{ display: "flex", gap: 13, alignItems: "center", padding: "12px 16px", background: "#fff", cursor: "pointer", borderBottom: `1px solid ${W.line}` }}>
          <Avatar emoji={r.emoji} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 16, color: W.ink }}>{r.name}</div>
            <div style={{ color: W.soft, fontSize: 13.5, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description || "Tap to open chat"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- explore ---------------- */
function Explore({ rooms, profile, canAccess, freeForUser, onJoin }) {
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
                <Avatar emoji={r.emoji} size={50} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: W.ink }}>{r.name}</div>
                  <div style={{ color: W.soft, fontSize: 13.5, marginTop: 3, lineHeight: 1.4 }}>{r.description}</div>
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

/* ---------------- chat room (realtime) ---------------- */
function RoomChat({ room, user, profile, isAdmin, onBack, onUpdateRoom }) {
  const [msgs, setMsgs] = useState(null);
  const [names, setNames] = useState({});
  const [text, setText] = useState("");
  const [editPin, setEditPin] = useState(false);
  const [pinText, setPinText] = useState(room.pinned || "");
  const endRef = useRef(null);
  const namesRef = useRef({});

  useEffect(() => {
    let channel;
    (async () => {
      const { data } = await supabase.from("messages")
        .select("id, body, sender_id, created_at, sender:profiles(full_name)")
        .eq("group_type", "room").eq("group_id", room.id)
        .order("created_at", { ascending: true });
      const nm = {}; (data || []).forEach(m => { if (m.sender) nm[m.sender_id] = m.sender.full_name; });
      nm[user.id] = profile.full_name; namesRef.current = nm; setNames(nm);
      setMsgs((data || []).map(m => ({ id: m.id, body: m.body, sender_id: m.sender_id, created_at: m.created_at })));
      channel = supabase.channel("room-" + room.id)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${room.id}` }, async (payload) => {
          const m = payload.new;
          if (!namesRef.current[m.sender_id]) {
            const { data: p } = await supabase.from("profiles").select("full_name").eq("id", m.sender_id).single();
            namesRef.current = { ...namesRef.current, [m.sender_id]: p?.full_name || "Member" }; setNames(namesRef.current);
          }
          setMsgs(prev => (prev && prev.some(x => x.id === m.id)) ? prev : [...(prev || []), { id: m.id, body: m.body, sender_id: m.sender_id, created_at: m.created_at }]);
        }).subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [room.id]);

  useEffect(() => { endRef.current?.scrollIntoView(); }, [msgs]);

  const send = async () => {
    const body = text.trim(); if (!body) return; setText("");
    const { data, error } = await supabase.from("messages").insert({ group_type: "room", group_id: room.id, sender_id: user.id, body }).select("id, body, sender_id, created_at").single();
    if (error) { setText(body); return; }
    setMsgs(prev => prev.some(x => x.id === data.id) ? prev : [...prev, data]);
  };
  const savePin = async () => { await onUpdateRoom(room.id, { pinned: pinText.trim() }); room.pinned = pinText.trim(); setEditPin(false); };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ background: W.teal, color: "#fff", display: "flex", alignItems: "center", gap: 10, padding: "12px" }}>
        <ArrowLeft size={22} onClick={onBack} style={{ cursor: "pointer", flexShrink: 0 }} />
        <Avatar emoji={room.emoji} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 16.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{room.name}</div>
          <div style={{ fontSize: 12, opacity: .85 }}>group chat</div>
        </div>
      </div>
      {(room.pinned || isAdmin) && (
        <div style={{ background: "#fff", borderBottom: `1px solid ${W.line}`, padding: "8px 14px", display: "flex", alignItems: "center", gap: 9 }}>
          <Pin size={15} color={W.teal} style={{ flexShrink: 0 }} />
          {editPin ? (<>
            <input value={pinText} onChange={e => setPinText(e.target.value)} placeholder="Pin an announcement…" style={{ flex: 1, border: `1px solid ${W.line}`, borderRadius: 8, padding: "6px 10px", fontSize: 13, outline: "none" }} />
            <button onClick={savePin} style={{ ...btn(W.teal, "#fff"), padding: "6px 12px" }}>Save</button>
          </>) : (<>
            <div style={{ flex: 1, fontSize: 13.5, color: room.pinned ? W.ink : W.soft }}>{room.pinned || "No announcement pinned"}</div>
            {isAdmin && <Settings size={16} color={W.soft} style={{ cursor: "pointer" }} onClick={() => { setPinText(room.pinned || ""); setEditPin(true); }} />}
          </>)}
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 10px", background: W.wall, backgroundImage: `url("${WALL}")` }}>
        <div style={{ textAlign: "center", margin: "6px 0 16px" }}><span style={{ background: "#FBF1C7", color: "#54656F", fontSize: 12, padding: "5px 12px", borderRadius: 8 }}>🔒 Only members can see these messages</span></div>
        {msgs === null ? <Center>loading…</Center> : msgs.length === 0 ? <Center>No messages yet — say hello 👋</Center> :
          msgs.map((m, i) => {
            const mine = m.sender_id === user.id;
            const showName = !mine && (i === 0 || msgs[i - 1].sender_id !== m.sender_id);
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", margin: "2px 4px" }}>
                <div style={{ maxWidth: "80%", background: mine ? W.sent : W.recv, padding: "6px 9px 5px", borderRadius: 8, borderTopRightRadius: mine ? 2 : 8, borderTopLeftRadius: mine ? 8 : 2, boxShadow: "0 1px 1px rgba(0,0,0,.12)" }}>
                  {showName && <div style={{ fontSize: 12.5, fontWeight: 700, color: W.teal, marginBottom: 1 }}>{names[m.sender_id] || "Member"}</div>}
                  <div style={{ fontSize: 14.5, color: W.ink, lineHeight: 1.35 }}>{m.body}</div>
                  <div style={{ fontSize: 11, color: W.soft, textAlign: "right", marginTop: 2 }}>{fmtTime(m.created_at)}</div>
                </div>
              </div>
            );
          })}
        <div ref={endRef} />
      </div>
      <div style={{ background: W.bg, padding: "8px 9px", display: "flex", alignItems: "flex-end", gap: 7 }}>
        <div style={{ flex: 1, background: "#fff", borderRadius: 24, display: "flex", alignItems: "center", gap: 8, padding: "9px 14px" }}>
          <Smile size={21} color={W.soft} />
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Message" style={{ flex: 1, border: "none", outline: "none", fontSize: 15.5, color: W.ink }} />
          <Paperclip size={20} color={W.soft} /><Camera size={20} color={W.soft} />
        </div>
        <button onClick={send} style={{ width: 47, height: 47, borderRadius: "50%", border: "none", background: W.teal, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Send size={20} /></button>
      </div>
    </div>
  );
}

/* ---------------- admin ---------------- */
function Admin({ rooms, onCreate, onUpdate, onDelete }) {
  const [creating, setCreating] = useState(false);
  const [manage, setManage] = useState(null);
  const [f, setF] = useState({ emoji: "💬", name: "", price: "", desc: "" });
  const reset = () => setF({ emoji: "💬", name: "", price: "", desc: "" });
  const create = async () => { if (!f.name) return; await onCreate({ name: f.name, emoji: f.emoji || "💬", price_monthly: Number(f.price) || 0, description: f.desc }); reset(); setCreating(false); };
  return (
    <div>
      <TopBar title="Admin Panel" />
      <div style={{ padding: 14 }}>
        {creating ? (
          <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${W.line}`, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, color: W.ink }}>New subscription room</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <input value={f.emoji} onChange={e => setF({ ...f, emoji: e.target.value })} maxLength={2} style={{ width: 56, textAlign: "center", fontSize: 22, border: `1px solid ${W.line}`, borderRadius: 10, padding: 8 }} />
              <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Room name" style={{ flex: 1, border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none" }} />
            </div>
            <input value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} placeholder="Short description" style={{ width: "100%", border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none", marginBottom: 10 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ color: W.soft, fontSize: 14 }}>₹</span>
              <input value={f.price} onChange={e => setF({ ...f, price: e.target.value.replace(/\D/g, "") })} placeholder="0 (free)" inputMode="numeric" style={{ flex: 1, border: `1px solid ${W.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, outline: "none" }} />
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
                <Avatar emoji={r.emoji} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, color: W.ink }}>{r.name}</div><div style={{ fontSize: 13, color: W.soft }}>{r.price_monthly === 0 ? "Free room" : `₹${r.price_monthly}/mo`}</div></div>
                <Settings size={19} color={W.soft} style={{ cursor: "pointer" }} onClick={() => setManage(manage === r.id ? null : r.id)} />
              </div>
              {manage === r.id && <ManageRoom room={r} onUpdate={onUpdate} onDelete={onDelete} />}
            </div>
          ))}
          {rooms.length === 0 && <Center>No rooms yet.</Center>}
        </div>
      </div>
    </div>
  );
}
function ManageRoom({ room, onUpdate, onDelete }) {
  const [pin, setPin] = useState(room.pinned || "");
  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${W.line}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: W.soft }}>Pinned announcement</label>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input value={pin} onChange={e => setPin(e.target.value)} placeholder="e.g. Next meetup Friday 7PM" style={{ flex: 1, border: `1px solid ${W.line}`, borderRadius: 9, padding: "9px 12px", fontSize: 14, outline: "none" }} />
          <button onClick={() => onUpdate(room.id, { pinned: pin.trim() })} style={btn(W.teal, "#fff")}>Pin</button>
        </div>
      </div>
      <button onClick={() => { if (confirm("Delete this room and all its messages?")) onDelete(room.id); }} style={{ ...btn("#fff", "#C0392B"), border: "1px solid #F2C4C0", justifyContent: "center" }}><Trash2 size={15} />Delete room</button>
    </div>
  );
}

/* ---------------- profile ---------------- */
function Profile({ user, profile }) {
  const roleLabel = { admin: "Admin (Owner)", subadmin: "Sub-admin", member: "Member" }[profile?.role] || "Member";
  return (
    <div>
      <TopBar title="Profile" />
      <div style={{ padding: 16 }}>
        <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${W.line}`, padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: W.teal, color: "#fff", fontSize: 27, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{(profile?.full_name || "?")[0].toUpperCase()}</div>
          <div>
            <div style={{ fontSize: 21, fontWeight: 700, color: W.ink }}>{profile?.full_name || "—"}</div>
            <div style={{ color: W.soft, fontSize: 14 }}>{user.email}</div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 7, background: "#E7F6EF", color: W.teal, fontSize: 12.5, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{profile?.role !== "member" && <Crown size={13} />}{roleLabel}</span>
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut()} style={{ marginTop: 16, width: "100%", padding: 14, borderRadius: 12, border: `1px solid ${W.line}`, background: "#fff", color: "#C0392B", fontWeight: 700, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><LogOut size={18} />Log out</button>
      </div>
    </div>
  );
}

/* ---------------- shared ---------------- */
function TopBar({ title }) { return <div style={{ background: W.teal, color: "#fff", padding: "16px 18px", fontSize: 21, fontWeight: 700, position: "sticky", top: 0, zIndex: 10 }}>{title}</div>; }
function Avatar({ emoji, size }) { return <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, fontSize: size * .5, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#7AD6C0,#008069)" }}>{emoji}</div>; }
const Center = ({ children }) => <div style={{ textAlign: "center", color: W.soft, fontSize: 14, padding: "26px 0" }}>{children}</div>;
const btn = (bg, fg) => ({ background: bg, color: fg, border: "none", borderRadius: 9, padding: "9px 16px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 });
function fmtTime(t) { return new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
function Nav({ tab, setTab, isAdmin }) {
  const items = [{ id: "chats", icon: MessageCircle, label: "Chats" }, { id: "explore", icon: Compass, label: "Explore" }, ...(isAdmin ? [{ id: "admin", icon: Shield, label: "Admin" }] : []), { id: "profile", icon: User, label: "Profile" }];
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#fff", borderTop: `1px solid ${W.line}`, display: "flex", padding: "8px 0 11px" }}>
      {items.map(it => { const on = tab === it.id; const I = it.icon; return <button key={it.id} onClick={() => setTab(it.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: on ? W.teal : W.soft }}><I size={23} strokeWidth={on ? 2.4 : 2} /><span style={{ fontSize: 11, fontWeight: on ? 700 : 500 }}>{it.label}</span></button>; })}
    </div>
  );
}
