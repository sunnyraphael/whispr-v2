import { useState, useEffect, useRef, useCallback } from "react";
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  deleteDoc, query, where, orderBy, limit, serverTimestamp,
  Timestamp, setDoc,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import { timeAgo } from "../../utils/time";
import { DEFAULT_CATEGORIES, DEFAULT_BANNED_KEYWORDS } from "../../constants";
import Avatar from "../shared/Avatar";
import Spinner from "../shared/Spinner";
import { Icon } from "../shared/Icons";

const ADMIN_TABS = [
  { id: "dashboard", label: "Dashboard", Icon: Icon.BarChart },
  { id: "reports", label: "Reports", Icon: Icon.AlertTriangle },
  { id: "posts", label: "Posts", Icon: Icon.Edit },
  { id: "users", label: "Users", Icon: Icon.Users },
  { id: "duplicates", label: "Duplicate Devices", Icon: Icon.Search },
  { id: "keywords", label: "Keywords", Icon: Icon.Trash },
  { id: "categories", label: "Categories", Icon: Icon.Bookmark },
  { id: "announcements", label: "Announcements", Icon: Icon.Chat },
  { id: "support", label: "Support", Icon: Icon.Message },
  { id: "devices", label: "Device Bans", Icon: Icon.Monitor },
  { id: "whitelist", label: "Whitelist", Icon: Icon.Unlock },
  { id: "ads", label: "Ads", Icon: Icon.DollarSign },
];

export default function AdminPanel({ currentUser, allCategories, setAllCategories }) {
  const [tab, setTab] = useState("dashboard");
  const [reports, setReports] = useState([]); const [posts, setPosts] = useState([]); const [users, setUsers] = useState([]);
  const [bannedWords, setBannedWords] = useState([...DEFAULT_BANNED_KEYWORDS]); const [newWord, setNewWord] = useState("");
  const [banModal, setBanModal] = useState(null); const [banDuration, setBanDuration] = useState("1"); const [banUnit, setBanUnit] = useState("days"); const [banReason, setBanReason] = useState("");
  const [newAnnouncement, setNewAnnouncement] = useState(""); const [announcements, setAnnouncements] = useState([]);
  const [newCatLabel, setNewCatLabel] = useState(""); const [newCatColor, setNewCatColor] = useState("#74b9ff");
  const [supportMsgs, setSupportMsgs] = useState([]);
  const [maintenance, setMaintenance] = useState(false);
  const [ads, setAds] = useState([]);
  const [deviceBans, setDeviceBans] = useState([]);
  const [deviceWhitelist, setDeviceWhitelist] = useState([]);
  const [newWhitelistFp, setNewWhitelistFp] = useState("");
  const [newWhitelistNote, setNewWhitelistNote] = useState("");
  const [userSearch, setUserSearch] = useState("");

  // ── Lazy-load admin data per tab — massive read saving ──────────────────────
  // Previously: 7 live listeners open simultaneously = hundreds of reads/minute
  // Now: each tab fetches its own data once when opened, with a manual refresh
  const [adminLoading, setAdminLoading] = useState(false);
  const loadedTabs = useRef(new Set()); // track which tabs have been loaded

  const loadTabData = useCallback(async (tabName, force = false) => {
    if (!force && loadedTabs.current.has(tabName)) return; // already loaded
    setAdminLoading(true);
    try {
      if (tabName === "dashboard" || tabName === "reports") {
        const snap = await getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc")));
        setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      if (tabName === "dashboard" || tabName === "posts") {
        const snap = await getDocs(query(collection(db, "posts"), where("deleted", "==", false), orderBy("createdAt", "desc"), limit(50)));
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      if (tabName === "dashboard" || tabName === "users" || tabName === "duplicates") {
        const snap = await getDocs(collection(db, "users"));
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      if (tabName === "announcements") {
        const snap = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc")));
        setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      if (tabName === "support") {
        const snap = await getDocs(query(collection(db, "support"), orderBy("createdAt", "desc")));
        setSupportMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      if (tabName === "devices") {
        const snap = await getDocs(collection(db, "deviceBans"));
        setDeviceBans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      if (tabName === "whitelist") {
        const snap = await getDocs(collection(db, "deviceWhitelist"));
        setDeviceWhitelist(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      if (tabName === "ads") {
        const snap = await getDocs(query(collection(db, "ads"), orderBy("submittedAt", "desc")));
        setAds(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      if (tabName === "keywords") {
        const snap = await getDoc(doc(db, "settings", "keywords"));
        if (snap.exists() && snap.data().words) setBannedWords(snap.data().words);
      }
      if (tabName === "categories") {
        // categories already loaded from Feed — nothing extra needed
      }
      if (tabName === "dashboard") {
        const snap = await getDoc(doc(db, "settings", "maintenance"));
        if (snap.exists()) setMaintenance(snap.data().enabled || false);
        // Also load announcements for dashboard
        const aSnap = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc")));
        setAnnouncements(aSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      loadedTabs.current.add(tabName);
    } finally { setAdminLoading(false); }
  }, []);

  // Load dashboard on mount, then load each tab when switched to
  useEffect(() => { loadTabData("dashboard"); }, [loadTabData]);
  useEffect(() => { loadTabData(tab); }, [tab, loadTabData]);

  const saveKeywords = async (words) => { await setDoc(doc(db, "settings", "keywords"), { words }); };
  const toggleMaintenance = async () => {
    const next = !maintenance;
    setMaintenance(next);
    await setDoc(doc(db, "settings", "maintenance"), { enabled: next, updatedAt: serverTimestamp() });
  };
  const addBannedWord = async () => { const w = newWord.toLowerCase().trim(); if (w && !bannedWords.includes(w)) { const u = [...bannedWords, w]; setBannedWords(u); setNewWord(""); await saveKeywords(u); } };
  const removeBannedWord = async (w) => { const u = bannedWords.filter(k => k !== w); setBannedWords(u); await saveKeywords(u); };

  const confirmBan = async () => {
    if (!banModal) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const ms = parseInt(banDuration) * (banUnit === "hours" ? 3600000 : banUnit === "days" ? 86400000 : 604800000);
      const durationDays = ms / 86400000;
      const response = await fetch("https://whispr-v2-backend.onrender.com/admin/ban", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUid: banModal.uid,
          reason: banReason || "Violation of guidelines",
          durationDays,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        alert(result.detail || "Failed to ban user.");
        return;
      }
    } catch (e) {
      alert("Failed to ban user. Please check your connection.");
      return;
    }
    setBanModal(null);
  };

  const unbanUser = async (u) => {
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("https://whispr-v2-backend.onrender.com/admin/unban", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUid: u.uid }),
      });
      if (!response.ok) {
        const result = await response.json();
        alert(result.detail || "Failed to unban user.");
      }
    } catch (e) {
      alert("Failed to unban user. Please check your connection.");
    }
  };

  const deleteAccount = async (u) => {
    if (!window.confirm(`PERMANENTLY DELETE account "${u.username}"?\n\nThis will remove ALL their posts, comments, and account data. This cannot be undone.`)) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("https://whispr-v2-backend.onrender.com/admin/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ targetUid: u.uid }),
      });
      const result = await response.json();
      if (!response.ok) { alert(result.detail || "Failed to delete account."); return; }
      alert(`Account "${u.username}" and all their data has been deleted.`);
    } catch (e) {
      alert("Failed to delete account. Please check your connection.");
    }
  };

  const deletePost = async (id) => { if (!window.confirm("Delete post?")) return; await updateDoc(doc(db, "posts", id), { deleted: true }); };
  const resolveReport = async (id) => { await updateDoc(doc(db, "reports", id), { status: "resolved" }); };
  const dismissReport = async (id) => { await updateDoc(doc(db, "reports", id), { status: "dismissed" }); };
  const postAnnouncement = async () => { if (!newAnnouncement.trim()) return; await addDoc(collection(db, "announcements"), { content: newAnnouncement.trim(), createdAt: serverTimestamp(), active: true }); setNewAnnouncement(""); };
  const deleteAnnouncement = async (id) => { await deleteDoc(doc(db, "announcements", id)); };
  const addCategory = async () => {
    const id = newCatLabel.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
    if (!id || allCategories.find(c => c.id === id)) return;
    const newCat = { id, label: `#${id}`, color: newCatColor };
    const updated = [...allCategories, newCat];
    setAllCategories(updated);
    await setDoc(doc(db, "settings", "categories"), { list: updated });
    setNewCatLabel("");
  };
  const removeCategory = async (id) => {
    const updated = allCategories.filter(c => c.id !== id);
    setAllCategories(updated);
    await setDoc(doc(db, "settings", "categories"), { list: updated });
  };

  const pending = reports.filter(r => r.status === "pending");
  const banned = users.filter(u => u.banned);

  // Chart data — posts per day last 7 days
  const chartData = (() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en", { weekday: "short" });
      const count = posts.filter(p => {
        const pd = p.createdAt?.toDate?.();
        if (!pd) return false;
        return pd.toDateString() === d.toDateString();
      }).length;
      days.push({ label, count });
    }
    return days;
  })();
  const maxVal = Math.max(...chartData.map(d => d.count), 1);

  return (
    <div className="admin-page fade-in">
      <div className="admin-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="admin-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon.Settings size={17} /> Admin Panel</div>
          <div className="admin-subtitle">Logged in as {currentUser.username}</div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { loadedTabs.current.delete(tab); loadTabData(tab, true); }}
          disabled={adminLoading}
          style={{ alignSelf: "center", display: "flex", alignItems: "center", gap: 6 }}
        >
          {adminLoading ? <Spinner /> : <><Icon.RefreshCw size={13} /> Refresh</>}
        </button>
      </div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--accent)" }}>{posts.length}</div><div className="stat-label">Total Posts</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--warn)" }}>{pending.length}</div><div className="stat-label">Pending Reports</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--danger)" }}>{banned.length}</div><div className="stat-label">Banned Users</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--success)" }}>{users.length}</div><div className="stat-label">Total Users</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--accent2)" }}>{bannedWords.length}</div><div className="stat-label">Blocked Keywords</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--warn)" }}>{announcements.filter(a => a.active).length}</div><div className="stat-label">Announcements</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--accent)" }}>{supportMsgs.filter(m => m.status === "open").length}</div><div className="stat-label">Support Msgs</div></div>
      </div>
      <div className="tabs admin-tabs-desktop" style={{ marginBottom: 24 }}>
        {ADMIN_TABS.map(({ id, label, Icon: TabIcon }) =>
          <button key={id} className={`tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 6 }}><TabIcon size={13} /> {label}</button>
        )}
      </div>
      {/* Mobile: dropdown instead of tabs */}
      <select className="admin-tabs-mobile" value={tab} onChange={e => setTab(e.target.value)}>
        {ADMIN_TABS.map(({ id, label }) =>
          <option key={id} value={id}>{label}</option>
        )}
      </select>

      {tab === "dashboard" && (
        <div>
          <div className="chart-wrap">
            <div className="chart-title">Posts Per Day (Last 7 Days)</div>
            <div className="bar-chart">
              {chartData.map((d, i) => (
                <div key={i} className="bar-item">
                  <div className="bar-val">{d.count}</div>
                  <div className="bar" style={{ height: `${Math.max(4, (d.count / maxVal) * 100)}px` }} />
                  <div className="bar-label">{d.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="card card-pad">
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}><Icon.Flag size={14} /> Most Reported Posts</div>
              {reports.filter(r => r.type === "post" && r.status === "pending").slice(0, 5).map(r => (
                <div key={r.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--muted)" }}>
                  <span className="badge badge-danger">Post</span> {r.reason} — <span style={{ fontSize: 11, fontFamily: "monospace" }}>{r.targetId?.slice(0, 8)}</span>
                </div>
              ))}
              {reports.filter(r => r.type === "post" && r.status === "pending").length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No pending post reports</div>}
            </div>
            <div className="card card-pad">
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}><Icon.AlertTriangle size={14} /> Recently Banned</div>
              {banned.slice(0, 5).map(u => (
                <div key={u.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar username={u.username} /><div><div>{u.username}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{u.banReason}</div></div>
                </div>
              ))}
              {banned.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No banned users</div>}
            </div>
          </div>
          {/* Maintenance Mode Toggle */}
          <div className="card card-pad" style={{ marginTop: 20, border: maintenance ? "1px solid rgba(239,68,68,0.4)" : "1px solid var(--border)", background: maintenance ? "rgba(239,68,68,0.04)" : undefined }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}>
                  <Icon.Lock size={14} /> Maintenance Mode {maintenance && <span className="badge badge-danger" style={{ marginLeft: 8 }}>ACTIVE</span>}
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
                  When ON, the site shows a maintenance screen to all regular users. You (admin) can still access everything normally.
                </div>
              </div>
              <button
                onClick={toggleMaintenance}
                className={maintenance ? "btn btn-danger" : "btn btn-ghost"}
                style={{ minWidth: 140, justifyContent: "center", display: "flex", alignItems: "center", gap: 6 }}
              >
                {maintenance ? <><Icon.Unlock size={13} /> Turn Off</> : <><Icon.Lock size={13} /> Enable Maintenance</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "reports" && (
        <div className="card"><div className="table-wrap admin-table-wrap"><table>
          <thead><tr><th>Type</th><th>Reason</th><th>Post Content</th><th>Status</th><th>Time</th><th>Actions</th></tr></thead>
          <tbody>
            {reports.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>No reports yet</td></tr>}
            {reports.map(r => {
              const reportedPost = posts.find(p => p.id === r.targetId);
              return (
                <tr key={r.id}>
                  <td><span className="badge badge-purple">{r.type}</span></td>
                  <td>{r.reason}</td>
                  <td style={{ maxWidth: 200 }}>
                    {reportedPost
                      ? <div style={{ fontSize: 12, color: "var(--text)", background: "var(--surface2)", padding: "6px 8px", borderRadius: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span style={{ color: "var(--muted)", fontSize: 11 }}>@{reportedPost.username}: </span>
                          {reportedPost.content}
                        </div>
                      : <span style={{ fontSize: 11, color: "var(--muted)" }}>{r.targetId?.slice(0, 8) || "—"}</span>
                    }
                  </td>
                  <td><span className={`badge ${r.status === "pending" ? "badge-warn" : r.status === "resolved" ? "badge-success" : "badge-danger"}`}>{r.status}</span></td>
                  <td style={{ color: "var(--muted)" }}>{timeAgo(r.createdAt)}</td>
                  <td>{r.status === "pending" && <div style={{ display: "flex", gap: 6 }}><button className="btn btn-primary btn-sm" onClick={() => resolveReport(r.id)}>Resolve</button><button className="btn btn-ghost btn-sm" onClick={() => dismissReport(r.id)}>Dismiss</button></div>}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div></div>
      )}

      {tab === "posts" && (
        <div className="card"><div className="table-wrap admin-table-wrap"><table>
          <thead><tr><th>ID</th><th>User</th><th>Content</th><th>Likes</th><th>Comments</th><th>Actions</th></tr></thead>
          <tbody>
            {posts.map(p => (
              <tr key={p.id}>
                <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>{p.postId}</td>
                <td>{p.username}</td>
                <td style={{ maxWidth: 200 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.content}</div></td>
                <td>{p.likes}</td><td>{p.commentCount}</td>
                <td><div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-danger btn-sm" onClick={() => deletePost(p.id)}>Delete</button>
                  <button className="btn btn-warn btn-sm" onClick={() => updateDoc(doc(db, "posts", p.id), { pinned: !p.pinned })}>{p.pinned ? "Unpin" : "Pin"}</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}

      {tab === "users" && (
        <div>
          <div style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center" }}>
            <input
              className="inline-input"
              placeholder="Search by username or email..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              style={{ flex: 1, maxWidth: 360 }}
            />
            {userSearch && (
              <button className="btn btn-ghost btn-sm" onClick={() => setUserSearch("")} style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon.X size={11} /> Clear</button>
            )}
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {users.filter(u => {
                const s = userSearch.toLowerCase();
                return !s || u.username?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s);
              }).length} of {users.length} users
            </span>
          </div>
        <div className="card"><div className="table-wrap admin-table-wrap"><table>
          <thead><tr><th>Display Name</th><th>Role</th><th>Status</th><th>Last Seen</th><th>Device FP</th><th>Actions</th></tr></thead>
          <tbody>
            {users.filter(u => {
              const s = userSearch.toLowerCase();
              return !s || u.username?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s);
            }).map(u => {
              const lastSeen = u.lastSeen?.toDate?.();
              const minsAgo = lastSeen ? (Date.now() - lastSeen.getTime()) / 60000 : null;
              const isOnline = minsAgo !== null && minsAgo < 3; // online if seen within last 3 mins
              const status = u.banned
                ? { label: "Banned", cls: "badge-danger", dot: null }
                : isOnline
                  ? { label: "Online", cls: "badge-success", dot: "#10b981" }
                  : { label: "Offline", cls: "badge-ghost", dot: "#5f5e6a" };
              const lastSeenText = minsAgo === null
                ? "Never"
                : isOnline
                  ? "Now"
                  : timeAgo(u.lastSeen);
              const fpCount = u.deviceFingerprint ? users.filter(x => x.deviceFingerprint === u.deviceFingerprint).length : 0;
              return (
                <tr key={u.id}>
                  <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar username={u.username} />{u.username}</div></td>
                  <td><span className={`badge ${u.role === "admin" ? "badge-purple" : "badge-success"}`}>{u.role || "user"}</span></td>
                  <td>
                    <span className={`badge ${status.cls}`} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{status.dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: status.dot, flexShrink: 0 }} />}{status.label}</span>
                    {u.banned && u.banUntil && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Until: {u.banUntil.toDate?.().toLocaleDateString()}</div>}
                    {u.banned && u.banReason && <div style={{ fontSize: 11, color: "var(--muted)" }}>{u.banReason}</div>}
                  </td>
                  <td style={{ color: isOnline ? "var(--accent2)" : "var(--muted)", fontSize: 12, fontWeight: isOnline ? 600 : 400 }}>{lastSeenText}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 10, color: fpCount > 1 ? "#fca5a5" : "var(--muted)" }}>{u.deviceFingerprint || "—"}</span>
                      {fpCount > 1 && <span className="badge badge-danger" style={{ fontSize: 10 }}>{fpCount} accts</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {u.uid !== currentUser.uid && (u.banned
                        ? <button className="btn btn-ghost btn-sm" onClick={() => unbanUser(u)}>Unban</button>
                        : <button className="btn btn-danger btn-sm" onClick={() => { setBanModal(u); setBanDuration("1"); setBanUnit("days"); setBanReason(""); }}>Ban</button>
                      )}
                      {fpCount > 1 && <button className="btn btn-warn btn-sm" onClick={() => setTab("duplicates")}>View Dupes</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div></div>
        </div>
      )}

      {tab === "duplicates" && (() => {
        const fpGroups = {};
        users.forEach(u => {
          if (!u.deviceFingerprint) return;
          if (!fpGroups[u.deviceFingerprint]) fpGroups[u.deviceFingerprint] = [];
          fpGroups[u.deviceFingerprint].push(u);
        });
        const duplicateGroups = Object.entries(fpGroups)
          .filter(([, group]) => group.length > 1)
          .map(([fp, group]) => ({
            fp,
            accounts: [...group].sort((a, b) => {
              const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
              const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
              return aTime - bTime;
            }),
          }));

        const banDuplicates = async (group) => {
          const toBan = group.accounts.slice(1).filter(u => u.uid !== currentUser.uid && !u.banned);
          if (toBan.length === 0) { alert("No unbanned duplicate accounts to ban in this group."); return; }
          if (!window.confirm(`Ban ${toBan.length} duplicate account(s) from this device? The original (oldest) account will be kept.`)) return;
          for (const u of toBan) {
            const banUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            await updateDoc(doc(db, "users", u.id), { banned: true, banUntil: Timestamp.fromDate(banUntil), banReason: "Duplicate account — only one account per device is allowed." });
            await addDoc(collection(db, "notifications"), { toUid: u.uid, type: "ban", message: "Your account has been banned: multiple accounts from the same device are not allowed.", createdAt: serverTimestamp(), read: false });
          }
          const alreadyBanned = await getDocs(query(collection(db, "deviceBans"), where("fingerprint", "==", group.fp)));
          if (alreadyBanned.empty) {
            await addDoc(collection(db, "deviceBans"), { fingerprint: group.fp, reason: "Duplicate account creation", createdAt: serverTimestamp() });
          }
          alert(`Done. ${toBan.length} duplicate account(s) banned.`);
        };

        return (
          <div>
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}><Icon.Search size={16} /> Duplicate Devices</div>
              <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>
                Devices that have created more than one account. The <strong style={{ color: "var(--accent2)" }}>oldest account</strong> is treated as the original.
                "Ban Duplicates" bans all newer accounts and blocks that device fingerprint from signing up again.
              </div>
            </div>
            {duplicateGroups.length === 0 ? (
              <div className="empty"><div className="empty-icon"><Icon.Check size={28} /></div><div className="empty-text">No duplicate devices found. All clear.</div></div>
            ) : (
              duplicateGroups.map(group => (
                <div key={group.fp} className="card card-pad" style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)", marginBottom: 6 }}>Device: {group.fp}</div>
                      <span className="badge badge-danger">{group.accounts.length} accounts from this device</span>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => banDuplicates(group)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon.Hammer size={12} /> Ban Duplicates (keep oldest)
                    </button>
                  </div>
                  <div className="table-wrap admin-table-wrap"><table>
                    <thead><tr><th>Display Name</th><th>Email</th><th>Joined</th><th>Status</th><th>Note</th><th>Action</th></tr></thead>
                    <tbody>
                      {group.accounts.map((u, i) => (
                        <tr key={u.id} style={{ background: i === 0 ? "rgba(6,182,212,0.05)" : "rgba(239,68,68,0.05)" }}>
                          <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar username={u.username} />{u.username}</div></td>
                          <td style={{ fontSize: 11, color: "var(--muted)" }}>{u.email || "—"}</td>
                          <td style={{ fontSize: 12, color: "var(--muted)" }}>{timeAgo(u.createdAt)}</td>
                          <td><span className={`badge ${u.banned ? "badge-danger" : "badge-success"}`}>{u.banned ? "Banned" : "Active"}</span></td>
                          <td>{i === 0
                            ? <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent2)", fontWeight: 700 }}><Icon.Star size={10} filled /> Original</span>
                            : <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#fca5a5", fontWeight: 700 }}><Icon.AlertTriangle size={10} /> Duplicate</span>}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {u.uid !== currentUser.uid && !u.banned && i !== 0 && (
                                <button className="btn btn-danger btn-sm" onClick={() => { setBanModal(u); setBanDuration("30"); setBanUnit("days"); setBanReason("Duplicate account — only one account per device is allowed."); }} style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon.Hammer size={11} /> Ban</button>
                              )}
                              {u.uid !== currentUser.uid && u.banned && (
                                <button className="btn btn-ghost btn-sm" onClick={() => unbanUser(u)}>Unban</button>
                              )}
                              {u.uid !== currentUser.uid && (
                                <button className="btn btn-sm" style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", gap: 5 }} onClick={() => deleteAccount(u)}><Icon.Trash size={11} /> Delete</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </div>
              ))
            )}
          </div>
        );
      })()}

      {tab === "keywords" && (
        <div className="card card-pad">
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 12 }}>Blocked Keywords</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input className="inline-input" placeholder="Add keyword..." value={newWord} onChange={e => setNewWord(e.target.value)} onKeyDown={e => e.key === "Enter" && addBannedWord()} style={{ maxWidth: 300 }} />
            <button className="btn btn-primary" onClick={addBannedWord}>Add</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {bannedWords.map(w => (
              <span key={w} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", padding: "4px 12px", borderRadius: 20, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                {w}<button onClick={() => removeBannedWord(w)} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", display: "flex" }}><Icon.X size={11} /></button>
              </span>
            ))}
          </div>
          <div className="alert alert-success" style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}><Icon.Check size={13} /> Keywords are saved permanently to Firebase.</div>
        </div>
      )}

      {tab === "categories" && (
        <div className="card card-pad">
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 16 }}>Custom Categories</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <input className="inline-input" placeholder="Category name (e.g. gaming)" value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} style={{ maxWidth: 200 }} />
            <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} style={{ width: 44, height: 40, border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", background: "none" }} />
            <button className="btn btn-primary" onClick={addCategory}>Add Category</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {allCategories.map(c => (
              <span key={c.id} style={{ background: c.color + "22", border: `1px solid ${c.color}44`, color: c.color, padding: "6px 14px", borderRadius: 20, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                {c.label}
                {!DEFAULT_CATEGORIES.find(d => d.id === c.id) && <button onClick={() => removeCategory(c.id)} style={{ background: "none", border: "none", color: c.color, cursor: "pointer", display: "flex" }}><Icon.X size={11} /></button>}
              </span>
            ))}
          </div>
        </div>
      )}

      {tab === "announcements" && (
        <div>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 12 }}>Post Announcement</div>
            <textarea className="compose-area" placeholder="Write a site-wide announcement..." value={newAnnouncement} onChange={e => setNewAnnouncement(e.target.value)} style={{ minHeight: 80, marginBottom: 12 }} />
            <button className="btn btn-primary" onClick={postAnnouncement} disabled={!newAnnouncement.trim()} style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon.Chat size={13} /> Post Announcement</button>
          </div>
          <div>
            {announcements.map(a => (
              <div key={a.id} className="card card-pad" style={{ marginBottom: 12, border: "1px solid rgba(245,158,11,0.3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div><div style={{ fontSize: 14, marginBottom: 6 }}>{a.content}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{timeAgo(a.createdAt)}</div></div>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteAnnouncement(a.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {tab === "devices" && (
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Banned Devices ({deviceBans.length})</div>
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            Device fingerprints are stored when a user is banned. New signups from matching devices are blocked automatically. This covers ~90% of casual ban evasion attempts.
          </div>
          {deviceBans.length === 0 ? (
            <div className="empty"><div className="empty-icon"><Icon.Monitor size={28} /></div><div className="empty-text">No device bans yet. Banning a user also bans their device.</div></div>
          ) : (
            <div className="card"><div className="table-wrap admin-table-wrap"><table>
              <thead><tr><th>Username</th><th>Fingerprint</th><th>Reason</th><th>Expires</th><th>Actions</th></tr></thead>
              <tbody>
                {deviceBans.map(b => (
                  <tr key={b.id}>
                    <td><strong>{b.bannedUsername}</strong></td>
                    <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>{b.fingerprint}</td>
                    <td>{b.reason}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{b.banUntil?.toDate?.().toLocaleDateString() || "Permanent"}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => deleteDoc(doc(db, "deviceBans", b.id))}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table></div></div>
          )}
        </div>
      )}

      {tab === "whitelist" && (
        <div>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}><Icon.Check size={16} /> Device Whitelist</div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 16 }}>
              Whitelisted devices are allowed to create a new account even if they were previously flagged as a duplicate or banned device.
              Use this when a genuine new user is wrongly blocked — ask them to share their device fingerprint from the signup error screen, then add it here.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <input
                className="inline-input"
                placeholder="Device fingerprint (e.g. fp_abc123)"
                value={newWhitelistFp}
                onChange={e => setNewWhitelistFp(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <input
                className="inline-input"
                placeholder="Note (e.g. new student, shared device)"
                value={newWhitelistNote}
                onChange={e => setNewWhitelistNote(e.target.value)}
                style={{ flex: 1, minWidth: 160 }}
              />
              <button
                className="btn btn-primary"
                disabled={!newWhitelistFp.trim()}
                onClick={async () => {
                  const fp = newWhitelistFp.trim();
                  if (!fp) return;
                  const already = deviceWhitelist.find(w => w.fingerprint === fp);
                  if (already) { alert("This fingerprint is already whitelisted."); return; }
                  await addDoc(collection(db, "deviceWhitelist"), {
                    fingerprint: fp,
                    note: newWhitelistNote.trim() || "—",
                    addedBy: currentUser.username,
                    createdAt: serverTimestamp(),
                  });
                  setNewWhitelistFp(""); setNewWhitelistNote("");
                  alert("✅ Device whitelisted. That user can now sign up.");
                }}
              >
                Add to Whitelist
              </button>
            </div>
          </div>
          {deviceWhitelist.length === 0 ? (
            <div className="empty"><div className="empty-icon"><Icon.Check size={28} /></div><div className="empty-text">No whitelisted devices yet. Add one above when a genuine user is blocked.</div></div>
          ) : (
            <div className="card"><div className="table-wrap admin-table-wrap"><table>
              <thead><tr><th>Fingerprint</th><th>Note</th><th>Added By</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {deviceWhitelist.map(w => (
                  <tr key={w.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--accent2)" }}>{w.fingerprint}</td>
                    <td style={{ fontSize: 13, color: "var(--muted)" }}>{w.note}</td>
                    <td style={{ fontSize: 12 }}>{w.addedBy}</td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>{timeAgo(w.createdAt)}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => deleteDoc(doc(db, "deviceWhitelist", w.id))}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table></div></div>
          )}
        </div>
      )}

      {tab === "support" && (
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, marginBottom: 16 }}>
            User Support Messages ({supportMsgs.filter(m => m.status === "open").length} open)
          </div>
          {supportMsgs.length === 0 ? (
            <div className="empty"><div className="empty-icon"><Icon.Message size={28} /></div><div className="empty-text">No support messages yet</div></div>
          ) : supportMsgs.map(m => (
            <div key={m.id} className="card card-pad" style={{ marginBottom: 12, border: m.status === "open" ? "1px solid rgba(232,115,74,0.3)" : "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                    <Avatar username={m.username} />
                    <strong>{m.username}</strong>
                    <span className={`badge ${m.status === "open" ? "badge-purple" : "badge-success"}`}>{m.status}</span>
                    <span className="badge badge-cyan">{m.subject}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{timeAgo(m.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, paddingLeft: 44 }}>{m.message}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {m.status === "open" && (
                    <button className="btn btn-primary btn-sm" onClick={() => updateDoc(doc(db, "support", m.id), { status: "resolved" })}>Mark Resolved</button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={() => deleteDoc(doc(db, "support", m.id))}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "ads" && (
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon.DollarSign size={16} /> Sponsored Ads
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
            Review ad submissions from businesses. Approved ads appear at the top of the student feed.
            Share this link with businesses: <span style={{ color: "var(--accent)", fontFamily: "monospace", fontSize: 12 }}>whispr-app.netlify.app/ad-submit.html</span>
          </div>

          {ads.length === 0 ? (
            <div className="empty"><div className="empty-icon"><Icon.DollarSign size={28} /></div><div className="empty-text">No ad submissions yet.</div></div>
          ) : ads.map(ad => (
            <div key={ad.id} className="card card-pad" style={{
              marginBottom: 12,
              border: ad.status === "approved" ? "1px solid rgba(16,185,129,0.35)"
                    : ad.status === "rejected" ? "1px solid rgba(239,68,68,0.2)"
                    : "1px solid rgba(232,115,74,0.3)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 15 }}>{ad.businessName}</strong>
                    <span style={{
                      fontSize: 11, padding: "2px 10px", borderRadius: 99, fontWeight: 700,
                      background: ad.status === "approved" ? "rgba(16,185,129,0.15)"
                                : ad.status === "rejected" ? "rgba(239,68,68,0.12)" : "rgba(232,115,74,0.15)",
                      color: ad.status === "approved" ? "var(--success)"
                           : ad.status === "rejected" ? "var(--danger)" : "var(--accent)",
                    }}>
                      {ad.status.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{timeAgo(ad.submittedAt)}</span>
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 8, color: "var(--text)" }}>{ad.adText}</p>
                  <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon.Mail size={12} /> {ad.contactEmail}</span>
                    {ad.link && <a href={ad.link} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>{ad.link}</a>}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                {ad.status !== "approved" && (
                  <button className="btn btn-sm" style={{ background: "rgba(16,185,129,0.15)", color: "var(--success)", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", gap: 6 }}
                    onClick={async () => {
                      await updateDoc(doc(db, "ads", ad.id), { status: "approved" });
                      setAds(prev => prev.map(a => a.id === ad.id ? { ...a, status: "approved" } : a));
                    }}>
                    <Icon.Check size={12} /> Approve
                  </button>
                )}
                {ad.status !== "rejected" && (
                  <button className="btn btn-danger btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}
                    onClick={async () => {
                      await updateDoc(doc(db, "ads", ad.id), { status: "rejected" });
                      setAds(prev => prev.map(a => a.id === ad.id ? { ...a, status: "rejected" } : a));
                    }}>
                    <Icon.X size={12} /> Reject
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}
                  onClick={async () => {
                    if (!window.confirm("Permanently delete this ad submission?")) return;
                    await deleteDoc(doc(db, "ads", ad.id));
                    setAds(prev => prev.filter(a => a.id !== ad.id));
                  }}>
                  <Icon.Trash size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ban Modal */}
      {banModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card card-pad" style={{ width: 420, maxWidth: "90vw" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><Icon.Hammer size={16} /> Ban User</div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>Banning <strong style={{ color: "var(--text)" }}>{banModal.username}</strong></div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6, fontWeight: 600 }}>Duration</label>
              <div style={{ display: "flex", gap: 10 }}>
                <input type="number" min="1" value={banDuration} onChange={e => setBanDuration(e.target.value)} className="inline-input" style={{ width: 80 }} />
                <select value={banUnit} onChange={e => setBanUnit(e.target.value)} className="category-select" style={{ flex: 1 }}>
                  <option value="hours">Hours</option><option value="days">Days</option><option value="weeks">Weeks</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6, fontWeight: 600 }}>Reason (shown to user)</label>
              <input className="inline-input" placeholder="e.g. Spam, harassment..." value={banReason} onChange={e => setBanReason(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmBan}>Confirm Ban</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setBanModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BOOKMARKS PAGE ───────────────────────────────────────────────────────────
// --- PROFILE PAGE -------------------------------------------------------------
