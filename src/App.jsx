import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";
import { MessageCircle, LogOut, ShieldCheck } from "lucide-react";

const W = { teal: "#008069", ink: "#111B21", soft: "#667781", line: "#E9EDEF", bg: "#F0F2F5", panel: "#fff" };

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  // Watch the login session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load the logged-in user's profile (name, role, gender)
  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase.from("profiles").select("*").eq("id", session.user.id).single()
      .then(({ data }) => setProfile(data));
  }, [session]);

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", background: "#d9d9d9", display: "flex", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ width: "100%", maxWidth: 430, minHeight: "100vh", background: W.bg, boxShadow: "0 0 60px rgba(0,0,0,.15)" }}>
        {loading ? <Splash /> : session ? <Home user={session.user} profile={profile} /> : <Auth />}
      </div>
    </div>
  );
}

function Splash() {
  return <div style={{ height: "100vh", background: W.teal, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 700 }}>Glasswings</div>;
}

function Auth() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [pass, setPass] = useState(""), [gender, setGender] = useState("male");
  const [err, setErr] = useState(""), [note, setNote] = useState(""), [busy, setBusy] = useState(false);

  const go = async () => {
    setErr(""); setNote("");
    if (!email || !pass || (mode === "signup" && !name)) return setErr("Please fill in all fields.");
    setBusy(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email, password: pass,
        options: { data: { full_name: name, gender } },
      });
      if (error) setErr(error.message);
      else setNote("Account created! If email confirmation is on, check your inbox, then log in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) setErr(error.message);
    }
    setBusy(false);
  };

  const inp = (ph, v, s, t = "text") => <input value={v} onChange={e => s(e.target.value)} placeholder={ph} type={t}
    style={{ width: "100%", padding: "13px 15px", borderRadius: 10, border: `1px solid ${W.line}`, fontSize: 15, outline: "none", color: W.ink }} />;

  return (
    <div style={{ minHeight: "100vh", background: W.bg, padding: "0 22px", display: "flex", flexDirection: "column" }}>
      <div style={{ textAlign: "center", paddingTop: 64 }}>
        <div style={{ width: 74, height: 74, borderRadius: "50%", background: W.teal, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}><MessageCircle size={36} color="#fff" /></div>
        <div style={{ fontSize: 28, fontWeight: 700, color: W.ink, marginTop: 14 }}>Glasswings</div>
        <div style={{ color: W.soft, marginTop: 5, fontSize: 14 }}>Your events. Your community. Your chat.</div>
      </div>
      <div style={{ background: W.panel, borderRadius: 18, padding: 20, marginTop: 34, border: `1px solid ${W.line}` }}>
        <div style={{ display: "flex", background: W.bg, borderRadius: 10, padding: 4, marginBottom: 16 }}>
          {["login", "signup"].map(m => <button key={m} onClick={() => { setMode(m); setErr(""); setNote(""); }}
            style={{ flex: 1, padding: 9, border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14, background: mode === m ? W.teal : "transparent", color: mode === m ? "#fff" : W.soft }}>
            {m === "login" ? "Log in" : "Sign up"}</button>)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {mode === "signup" && inp("Full name", name, setName)}
          {inp("Email", email, setEmail, "email")}
          {inp("Password (min 6 characters)", pass, setPass, "password")}
          {mode === "signup" && (
            <div>
              <div style={{ fontSize: 13, color: W.soft, marginBottom: 7, fontWeight: 600 }}>I am</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[["male", "Man"], ["female", "Woman"], ["other", "Other"]].map(([v, l]) => (
                  <button key={v} onClick={() => setGender(v)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${gender === v ? W.teal : W.line}`, background: gender === v ? "#E7F6EF" : "#fff", color: W.ink, fontWeight: 600, fontSize: 14 }}>{l}</button>
                ))}
              </div>
            </div>
          )}
          {err && <div style={{ color: "#C0392B", fontSize: 13 }}>{err}</div>}
          {note && <div style={{ color: W.teal, fontSize: 13 }}>{note}</div>}
          <button onClick={go} disabled={busy} style={{ padding: 14, borderRadius: 10, border: "none", cursor: "pointer", background: W.teal, color: "#fff", fontWeight: 700, fontSize: 15, opacity: busy ? .6 : 1 }}>
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</button>
        </div>
      </div>
    </div>
  );
}

function Home({ user, profile }) {
  const roleLabel = { admin: "Admin (Owner)", subadmin: "Sub-admin", member: "Member" }[profile?.role] || "Member";
  return (
    <div>
      <div style={{ background: W.teal, color: "#fff", padding: "16px 18px", fontSize: 21, fontWeight: 700 }}>Glasswings</div>
      <div style={{ padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${W.line}`, padding: 22, textAlign: "center" }}>
          <ShieldCheck size={40} color={W.teal} />
          <div style={{ fontSize: 20, fontWeight: 700, color: W.ink, marginTop: 10 }}>You're logged in for real 🎉</div>
          <div style={{ color: W.soft, fontSize: 14.5, marginTop: 8, lineHeight: 1.5 }}>
            This account lives in your real Glasswings database — not a demo.
          </div>
          <div style={{ background: W.bg, borderRadius: 12, padding: 16, marginTop: 18, textAlign: "left", fontSize: 14.5 }}>
            <Row label="Name" val={profile?.full_name || "—"} />
            <Row label="Email" val={user.email} />
            <Row label="Gender" val={{ male: "Man", female: "Woman", other: "Other" }[profile?.gender] || "—"} />
            <Row label="Role" val={roleLabel} last />
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut()} style={{ marginTop: 16, width: "100%", padding: 14, borderRadius: 12, border: `1px solid ${W.line}`, background: "#fff", color: "#C0392B", fontWeight: 700, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <LogOut size={18} />Log out</button>
        <div style={{ color: W.soft, fontSize: 12.5, textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
          Next up: rooms, ticketed events, and live chat — all connected to this same login.
        </div>
      </div>
    </div>
  );
}

const Row = ({ label, val, last }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: last ? "none" : `1px solid ${W.line}` }}>
    <span style={{ color: W.soft }}>{label}</span><span style={{ color: W.ink, fontWeight: 600 }}>{val}</span></div>
);
