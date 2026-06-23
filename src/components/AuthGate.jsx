// AuthGate.jsx — sign-in screen. Self-contained colors so it's readable
// even before the main app's CSS variables load.
import { useState } from "react";
import { supabase } from "../lib/supabase";

const C = {
  bg: "#0e1320", card1: "#151b2e", card2: "#1c2438", line: "#283149",
  ink: "#eef1f8", inkSoft: "#aab3cc", teal: "#5ee0c0", tealDeep: "#1f9e87",
  field: "#0e1320",
};

export default function AuthGate() {
  const [mode, setMode] = useState("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const sendMagicLink = async () => {
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    setMsg(error ? error.message : "Check your email for a sign-in link!");
  };
  const passwordAuth = async (kind) => {
    setBusy(true); setMsg("");
    const { error } = kind === "signup"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMsg(error.message);
    else if (kind === "signup") setMsg("Account made! If email confirmation is on, check your inbox.");
  };

  const field = { width: "100%", boxSizing: "border-box", padding: "13px 14px", borderRadius: 11, background: C.field, border: `1px solid ${C.line}`, color: C.ink, fontSize: 15, fontFamily: "inherit", outline: "none" };
  const primaryBtn = { width: "100%", marginTop: 12, padding: "13px 18px", borderRadius: 11, border: "none", cursor: busy ? "default" : "pointer", fontWeight: 700, fontSize: 15, fontFamily: "inherit", color: "#06281f", background: `linear-gradient(135deg, ${C.teal}, ${C.tealDeep})`, opacity: busy ? 0.6 : 1 };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: C.bg, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ background: `linear-gradient(180deg, ${C.card2}, ${C.card1})`, border: `1px solid ${C.line}`, borderRadius: 22, padding: 34, maxWidth: 420, width: "100%", boxShadow: "0 18px 40px -24px rgba(0,0,0,.7)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span style={{ fontFamily: "monospace", fontWeight: 600, color: C.bg, background: `linear-gradient(135deg, ${C.teal}, ${C.tealDeep})`, padding: "5px 10px", borderRadius: 9, fontSize: 15 }}>{"</>"}</span>
          <span style={{ fontWeight: 700, fontSize: 20, color: C.ink }}>CodeQuest</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px", color: C.ink }}>Sign in to save your progress</h1>
        <p style={{ color: C.inkSoft, fontSize: 14, lineHeight: 1.6, margin: "0 0 22px" }}>Your lessons, AI sets, and projects will be saved to your account and waiting next time.</p>

        <input style={field} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode === "password" && (
          <input style={{ ...field, marginTop: 10 }} type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        )}

        {mode === "magic" ? (
          <button style={primaryBtn} disabled={!email || busy} onClick={sendMagicLink}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
        ) : (
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button style={{ ...primaryBtn, width: "auto", flex: 1, marginTop: 0 }} disabled={!email || !password || busy} onClick={() => passwordAuth("signin")}>{busy ? "…" : "Sign in"}</button>
            <button style={{ flex: 1, padding: "13px 18px", borderRadius: 11, border: `1px solid ${C.line}`, background: "none", color: C.inkSoft, cursor: "pointer", fontFamily: "inherit", fontSize: 14 }} disabled={!email || !password || busy} onClick={() => passwordAuth("signup")}>Create account</button>
          </div>
        )}

        <button style={{ background: "none", border: "none", color: C.teal, fontSize: 13, cursor: "pointer", marginTop: 14, fontFamily: "inherit", padding: 0 }} onClick={() => { setMode(mode === "magic" ? "password" : "magic"); setMsg(""); }}>
          {mode === "magic" ? "Use a password instead" : "Use a magic link instead"}
        </button>

        {msg && <p style={{ marginTop: 14, fontSize: 13, color: C.inkSoft, lineHeight: 1.5 }}>{msg}</p>}
      </div>
    </div>
  );
}
