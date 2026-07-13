import { useState, useRef, useEffect, useCallback } from "react";
import {
  collection, doc, query, where, orderBy, limit, getDocs,
  deleteDoc, writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import { timeAgo } from "../../utils/time";

export default function NotificationBell({ currentUser }) {
  const [notifs, setNotifs] = useState([]); const [open, setOpen] = useState(false); const ref = useRef();

  const fetchNotifs = useCallback(async () => {
    if (!currentUser?.uid) return;
    try {
      const q = query(collection(db, "notifications"), where("toUid", "==", currentUser.uid), orderBy("createdAt", "desc"), limit(30));
      const snap = await getDocs(q);
      setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (_) {}
  }, [currentUser?.uid]);

  // Fetch on mount, then every 2 minutes — much cheaper than onSnapshot
  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const markRead = async () => {
    const unread = notifs.filter(n => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, "notifications", n.id), { read: true }));
    await batch.commit();
  };
  const dismissNotif = async (e, id) => {
    e.stopPropagation();
    await deleteDoc(doc(db, "notifications", id));
  };
  const unread = notifs.filter(n => !n.read).length;
  const text = (n) => {
    if (n.type === "like") return `${n.fromUsername} liked your post`;
    if (n.type === "comment") return `${n.fromUsername} commented on your post`;
    if (n.type === "reply_comment") return `${n.fromUsername} replied to your comment`;
    if (n.type === "react") return `${n.fromUsername} reacted ${n.emoji} to your post`;
    if (n.type === "ban") return `⚠️ ${n.message}`;
    return "New notification";
  };
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="notif-btn" onClick={() => { setOpen(o => !o); if (!open) { markRead(); fetchNotifs(); } }}>🔔{unread > 0 && <span className="notif-dot" />}</button>
      {open && (
        <div className="notif-panel fade-in">
          <div className="notif-header">Notifications {unread > 0 && `(${unread})`}</div>
          {notifs.length === 0
            ? <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No notifications</div>
            : notifs.map(n => (
              <div key={n.id} className={`notif-item ${!n.read ? "unread" : ""}`}
                onClick={(e) => dismissNotif(e, n.id)}
                style={{ cursor: "pointer" }}
                title="Tap to dismiss">
                <div className="notif-text">{text(n)}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div className="notif-time">{timeAgo(n.createdAt)}</div>
                  <span style={{ fontSize: 10, color: "var(--muted)", opacity: 0.6 }}>tap to dismiss</span>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}
