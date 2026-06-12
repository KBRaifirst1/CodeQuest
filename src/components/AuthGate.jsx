// src/components/AuthGate.jsx
// A simple sign-in screen. Shown when nobody is logged in. Supports BOTH:
//   - Magic link (passwordless): user gets an email, clicks it, they're in.
//   - Email + password: classic sign up / sign in.
// Pick whichever you prefer — both work with the same Supabase project.
//
// Styling uses the same CSS variable names as your app, so it matches the theme.

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function AuthGate() {
  const [mode, setMode] = useState("magic"); // "magic" | "password"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const sendMagicLink = async () => {
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    setMsg(error ? error.message : "Check your email for a sign-in link!");
  };

  const passwordAuth = async (kind) => {
    setBusy(true); setMsg("");
    const fn = kind === "signup"
      ? supabase.auth.signUp({ email, password })
      : supabase.auth.signInWithPassword({ email, password });
    const { error } = await fn;
    setBusy(false);
    if (error) setMsg(error.message);
    else if (kind === "signup") setMsg("Account made! If email confirmation is on, check your inbox.");
  };

  return (
    <div className="cq-auth">
      <div className="cq-auth-card">
        <div className="cq-auth-logo"><span className="cq-logo">{"</>"}</span><span className="cq-name">CodeQuest</span></div>
        <h1 className="cq-auth-title">Sign in to save your progress</h1>
        <p className="cq-auth-sub">Your lessons, AI sets, and projects will be saved to your account and waiting next time.</p>

        <input className="cq-search" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />

        {mode === "password" && (
          <input className="cq-search" type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginTop: 10 }} />
        )}

        {mode === "magic" ? (
          <button className="cq-run" style={{ width: "100%", marginTop: 12 }} disabled={!email || busy} onClick={sendMagicLink}>
            {busy ? "Sending…" : "Email me a sign-in link"}
          </button>
        ) : (
          <div className="cq-buildrow" style={{ marginTop: 12 }}>
            <button className="cq-run" disabled={!email || !password || busy} onClick={() => passwordAuth("signin")}>{busy ? "…" : "Sign in"}</button>
            <button className="cq-clearbtn" disabled={!email || !password || busy} onClick={() => passwordAuth("signup")}>Create account</button>
          </div>
        )}

        <button className="cq-auth-toggle" onClick={() => { setMode(mode === "magic" ? "password" : "magic"); setMsg(""); }}>
          {mode === "magic" ? "Use a password instead" : "Use a magic link instead"}
        </button>

        {msg && <p className="cq-auth-msg">{msg}</p>}
      </div>

      <style>{`
        .cq-auth{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
        .cq-auth-card{background:linear-gradient(180deg,var(--bg-2,#1c2438),var(--bg-1,#151b2e));border:1px solid var(--line,#283149);border-radius:22px;padding:34px;max-width:420px;width:100%;box-shadow:0 18px 40px -24px rgba(0,0,0,.7)}
        .cq-auth-logo{display:flex;align-items:center;gap:10px;margin-bottom:18px}
        .cq-auth-title{font-family:var(--display,Georgia),serif;font-size:24px;font-weight:600;margin:0 0 8px}
        .cq-auth-sub{color:var(--ink-soft,#aab3cc);font-size:14px;line-height:1.6;margin:0 0 22px}
        .cq-auth-toggle{background:none;border:none;color:var(--teal,#5ee0c0);font-size:13px;cursor:pointer;margin-top:14px;font-family:inherit}
        .cq-auth-msg{margin-top:14px;font-size:13px;color:var(--ink-soft,#aab3cc);line-height:1.5}
      `}</style>
    </div>
  );
}
