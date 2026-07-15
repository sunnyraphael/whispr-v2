import { useState, useRef, useEffect, useCallback } from "react";
import {
  collection, doc, getDoc, query, where, orderBy, limit, getDocs,
  deleteDoc, writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import { timeAgo } from "../../utils/time";
import { Icon } from "../shared/Icons";

export default function NotificationBell({ currentUser, onPostClick }) {
  const [notifs, setNotifs] = useState([]); const [open, setOpen] = useState(false); const ref = useRef();

  const fetchNotifs = useCallback(async () => {
    if (!currentUser?.uid) return;
    try {
      const q = query(collection(db, "notifications"), where("toUid", "==", currentUser.uid), orderBy("createdAt", "desc"), limit(30));
      const snap = await getDocs(q);
      setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (_) {}
  }, [currentUser?.uid]);

  // Fetch on mount, then every 2 minutes — much cheaper than onSnapshot.
  // NOTE: this still isn't truly "live" — a real-time listener is a possible
  // future upgrade, logged previously, not changed here since it's a bigger
  // architectural decision (read-cost tradeoff) not a quick visual fix.
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
    setNotifs(prev => prev.filter(n => n.id !== id));
  };
  // FIX: clicking a notification used to always dismiss it — there was no
  // way to actually get to the post it was about. Every notification type
  // except "ban" carries a postId (confirmed in the backend), so we fetch
  // that post and open it. Dismissing is now only via the dedicated X button.
  const openNotif = async (n) => {
    if (!n.read) markRead();
    if (n.postId && onPostClick) {
      try {
        const postSnap = await getDoc(doc(db, "posts", n.postId));
        if (postSnap.exists()) {
          onPostClick({ id: postSnap.id, ...postSnap.data() });
          setOpen(false);
        }
      } catch (_) {}
    }
  };
  const unread = notifs.filter(n => !n.read).length;
  const text = (n) => {
    if (n.type === "like") return `${n.fromUsername} liked your post`;
    if (n.type === "comment") return `${n.fromUsername} commented on your post`;
    if (n.type === "reply_comment") return `${n.fromUsername} replied to your comment`;
    if (n.type === "react") return `${n.fromUsername} reacted ${n.emoji} to your post`;
    if (n.type === "ban") return n.message;
    return "New notification";
  };
  const typeIcon = (n) => {
    if (n.type === "like") return <Icon.Heart size={13} filled />;
    if (n.type === "comment" || n.type === "reply_comment") return <Icon.Message size={13} />;
    if (n.type === "react") return <span style={{ fontSize: 13 }}>{n.emoji}</span>;
    if (n.type === "ban") return <Icon.Flag size={13} />;
    return <Icon.Bell size={13} />;
  };
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="icon-btn notif-btn" onClick={() => { setOpen(o => !o); if (!open) fetchNotifs(); }}>
        <Icon.Bell size={16} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel fade-in">
          <div className="notif-header">
            <span>Notifications {unread > 0 && `(${unread})`}</span>
            {unread > 0 && <button className="notif-mark-read" onClick={markRead}>Mark all read</button>}
          </div>
          {notifs.length === 0
            ? <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No notifications</div>
            : notifs.map(n => (
              <div key={n.id} className={`notif-item ${!n.read ? "unread" : ""}`} onClick={() => openNotif(n)}>
                <div className="notif-icon">{typeIcon(n)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="notif-text">{text(n)}</div>
                  <div className="notif-time">{timeAgo(n.createdAt)}</div>
                </div>
                <button className="notif-dismiss" onClick={(e) => dismissNotif(e, n.id)} title="Dismiss">
                  <Icon.X size={12} />
                </button>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}
