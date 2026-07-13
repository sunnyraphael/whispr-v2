// WHISPR v2 — Anonymous Messaging Platform
// Built with React + Firebase (Firestore + Auth)
// This file is now just the app's root: authentication state, ban checks,
// and maintenance mode. Everything else lives under src/components and src/pages.

import { useState, useEffect } from "react";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import Spinner from "./components/shared/Spinner";
import AuthPage from "./components/auth/AuthPage";
import StyleTag from "./components/layout/StyleTag";
import Feed from "./components/layout/Feed";
import { auth, db, registerForPushNotifications } from "./firebase";
import { getTheme, setThemeStorage } from "./utils/theme";

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [authUser, setAuthUser] = useState(null); const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true); const [banMessage, setBanMessage] = useState(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [theme, setTheme] = useState(getTheme());

  const toggleTheme = () => { const t = theme === "dark" ? "light" : "dark"; setTheme(t); setThemeStorage(t); };

  useEffect(() => {
    // Listen for maintenance mode changes in real time — always update so live toggle works instantly
    const unsubMaintenance = onSnapshot(doc(db, "settings", "maintenance"), snap => {
      setMaintenanceMode(snap.exists() ? (snap.data().enabled || false) : false);
    });
    return unsubMaintenance;
  }, []);

  useEffect(() => {
    let unsubProfile = () => {};

    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      // Clean up any previous profile listener
      unsubProfile();

      if (user) {
        // Live listener on user's own doc — ban/unban takes effect instantly
        unsubProfile = onSnapshot(doc(db, "users", user.uid), async (snap) => {
          if (!snap.exists()) { setProfile(null); setLoading(false); return; }
          const data = snap.data();

          if (data.banned) {
            if (data.banUntil) {
              const expiry = data.banUntil.toDate ? data.banUntil.toDate() : new Date(data.banUntil);
              if (Date.now() > expiry.getTime()) {
                // Ban expired — lift it automatically
                await updateDoc(snap.ref, { banned: false, banUntil: null, banReason: null });
                setProfile({ ...data, banned: false });
                setBanMessage(null);
              } else {
                setBanMessage(`Your account has been temporarily banned.\n\nReason: ${data.banReason || "Violation of guidelines"}\n\nExpires: ${expiry.toLocaleDateString()} at ${expiry.toLocaleTimeString()}`);
                setProfile(null);
              }
            } else {
              setBanMessage(`Your account has been permanently banned.\n\nReason: ${data.banReason || "Violation of guidelines"}\n\nContact support if you believe this is a mistake.`);
              setProfile(null);
            }
          } else {
            // Patch old accounts missing new fields
            const needsPatch = data.bookmarks === undefined || data.firstPostDone === undefined || data.postCount === undefined;
            if (needsPatch) {
              const patch = {};
              if (data.bookmarks === undefined) patch.bookmarks = [];
              if (data.firstPostDone === undefined) patch.firstPostDone = false;
              if (data.postCount === undefined) patch.postCount = 0;
              if (data.lastPostAt === undefined) patch.lastPostAt = null;
              await updateDoc(snap.ref, patch);
              setProfile({ ...data, ...patch });
            } else {
              setProfile(data);
            }
            setBanMessage(null); // Instantly lets them back in if admin unbans while active
            registerForPushNotifications(); // request push permission silently after login
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }

      // Await maintenance so correct screen shows immediately on login — no flash
      try {
        const mSnap = await getDoc(doc(db, "settings", "maintenance"));
        setMaintenanceMode(mSnap.exists() ? (mSnap.data().enabled || false) : false);
      } catch (_) {}
    });

    return () => { unsub(); unsubProfile(); };
  }, []);

  if (loading) return <><StyleTag theme={theme} /><div className="loading-screen"><div className="loading-logo">wh<span style={{ color: "var(--accent)" }}>i</span>spr</div><Spinner /></div></>;

  if (banMessage) return (
    <>
      <StyleTag theme={theme} />
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card card-pad" style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, marginBottom: 8, color: "var(--danger)" }}>Account Banned</div>
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: 20, marginBottom: 20, textAlign: "left" }}>
            {banMessage.split("\n").map((line, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.7, color: line.startsWith("Reason:") || line.startsWith("Expires:") ? "var(--text)" : "var(--muted)" }}>{line}</div>)}
          </div>
          <button className="btn btn-ghost" style={{ width: "100%" }} onClick={() => setBanMessage(null)}>← Back to Login</button>
        </div>
      </div>
    </>
  );

  // Show maintenance screen to non-admin users when maintenance is on
  if (maintenanceMode && authUser && profile && profile.role !== "admin") return (
    <>
      <StyleTag theme={theme} />
      <div className="maintenance-screen" style={{ background: "var(--bg)" }}>
        <div className="maintenance-icon">🔧</div>
        <div className="maintenance-title">Under Maintenance</div>
        <div className="maintenance-sub">Whispr is currently undergoing scheduled maintenance. We'll be back shortly — hang tight!</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>— The Whispr Team</div>
        <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => signOut(auth)}>Sign Out</button>
      </div>
    </>
  );

  if (!authUser || !profile) return (
    <>
      <StyleTag theme={theme} />
      {maintenanceMode ? (
        <div className="maintenance-screen" style={{ background: "var(--bg)" }}>
          <div className="maintenance-icon">🔧</div>
          <div className="maintenance-title">Under Maintenance</div>
          <div className="maintenance-sub">Whispr is currently undergoing scheduled maintenance. We'll be back shortly!</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>— The Whispr Team</div>
        </div>
      ) : (
        <AuthPage theme={theme} toggleTheme={toggleTheme} onSignupSuccess={(p) => { setAuthUser(auth.currentUser); setProfile(p); }} />
      )}
    </>
  );
  return <Feed currentUser={profile} isAdmin={profile.role === "admin"} theme={theme} toggleTheme={toggleTheme} maintenanceMode={maintenanceMode} />;
}
