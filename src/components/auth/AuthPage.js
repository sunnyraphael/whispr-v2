import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import { getDeviceFingerprint } from "../../utils/fingerprint";
import Spinner from "../shared/Spinner";
import TermsModal from "./TermsModal";
import { Icon } from "../shared/Icons";

export default function AuthPage({ theme, toggleTheme, onSignupSuccess }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [blockedFp, setBlockedFp] = useState(null); // stores fp when blocked so user can share it with admin

  const doSignup = async () => {
    setError(""); setBlockedFp(null); setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { setError("Please enter an email address."); setLoading(false); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); setLoading(false); return; }

    try {
      const fp = getDeviceFingerprint();

      // Send signup request to backend — all validation happens server-side
      const response = await fetch("https://whispr-v2-backend.onrender.com/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          fingerprint: fp,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // If blocked due to device, show fingerprint so user can contact admin to whitelist
        const msg = result.detail || "Something went wrong. Please try again.";
        if (msg.toLowerCase().includes("device") || msg.toLowerCase().includes("account already")) {
          setBlockedFp(fp);
        }
        setError(msg);
        setLoading(false); return;
      }

      // Backend created the account — now sign in with Firebase Auth
      await signInWithEmailAndPassword(auth, normalizedEmail, password);

    } catch (e) {
      if (e.code === "auth/too-many-requests") setError("Too many attempts. Please wait a moment.");
      else if (e.code === "auth/network-request-failed") setError("Network error. Check your connection.");
      else setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const handleAuth = async () => {
    if (mode === "signup") {
      if (!termsAccepted) { setShowTerms(true); return; }
      await doSignup();
    } else {
      setError(""); setLoading(true);
      if (!email.trim()) { setError("Enter your email."); setLoading(false); return; }
      try {
        await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      } catch (e) {
        if (e.code === "auth/too-many-requests") setError("Too many failed attempts. Please wait a few minutes.");
        else if (e.code === "auth/network-request-failed") setError("Network error. Check your connection.");
        else setError("Incorrect email or password. Please try again.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      {showTerms && (
        <TermsModal
          onAccept={() => { setTermsAccepted(true); setShowTerms(false); doSignup(); }}
          onDecline={() => setShowTerms(false)}
        />
      )}
      <div className="auth-card fade-in">
        <button className="theme-btn" style={{ marginLeft: "auto", display: "flex", marginBottom: 12 }} onClick={toggleTheme}>{theme === "dark" ? <Icon.Sun /> : <Icon.Moon />}</button>
        <div className="auth-logo">wh<span style={{ color: "var(--accent)" }}>i</span>spr</div>
        <div className="auth-sub">{mode === "signup" ? "Create your anonymous account." : "Welcome back. Your secret is safe."}</div>
        {error && (
          <div className="alert alert-error">
            {error}
            {blockedFp && (
              <div className="device-code-box">
                <div className="device-code-label"><Icon.Smartphone size={12} /> Your device code</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10, lineHeight: 1.5 }}>Email this to an admin to get unblocked.</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div className="device-code-value">{blockedFp}</div>
                  <button className="device-code-copy" onClick={() => { navigator.clipboard?.writeText(blockedFp); alert("Copied!"); }}>
                    <Icon.Copy size={12} /> Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {mode === "signup" && <div className="alert alert-info" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><Icon.Info size={14} /><span>Use any email and a password of your choice. You'll get a random anonymous display name — no one will know it's you.</span></div>}
        <div className="auth-field">
          <label className="auth-label">Email</label>
          <input className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="any email you want" onKeyDown={e => e.key === "Enter" && handleAuth()} autoCapitalize="none" />
        </div>
        <div className="auth-field">
          <label className="auth-label">Password</label>
          <input className="auth-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleAuth()} />
          {mode === "signup" && <div style={{ display: "flex", gap: 5, alignItems: "flex-start", fontSize: 11, color: "var(--muted)", marginTop: 4 }}><Icon.AlertTriangle size={12} /><span>Remember your email and password — if you forget them, contact support via the chat button.</span></div>}
        </div>
        {mode === "signup" && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.6 }}>
            By signing up you agree to our{" "}
            <button onClick={() => setShowTerms(true)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>Terms & Conditions</button>.
          </div>
        )}
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={handleAuth} disabled={loading}>
          {loading ? <Spinner /> : mode === "signup" ? "Create Anonymous Account" : "Sign In"}
        </button>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setTermsAccepted(false); setEmail(""); setPassword(""); }} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>
            {mode === "login" ? "Sign Up" : "Log In"}
          </button>
        </div>
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 20, paddingTop: 16, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Need help or having trouble logging in?</div>
          <a href="mailto:ifeoluwaraphael0@gmail.com" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}><Icon.Chat size={13} /> Contact Support</a>
        </div>
      </div>
    </div>
  );
}
