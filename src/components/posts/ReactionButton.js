import { useState, useRef, useEffect } from "react";
import { auth } from "../../firebase";
import { REACTIONS } from "../../constants";

export default function ReactionButton({ postId, postUid, userReaction, reactions, currentUser, onPostUpdate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const react = async (emoji) => {
    setOpen(false);
    const prev = userReaction;
    // Optimistic local update
    const newReactions = { ...reactions };
    const newUserReactions = {};
    if (prev === emoji) {
      newReactions[emoji] = Math.max(0, (newReactions[emoji] || 1) - 1);
      newUserReactions[currentUser.uid] = null;
    } else {
      if (prev) newReactions[prev] = Math.max(0, (newReactions[prev] || 1) - 1);
      newReactions[emoji] = (newReactions[emoji] || 0) + 1;
      newUserReactions[currentUser.uid] = emoji;
    }
    onPostUpdate?.(postId, {
      reactions: newReactions,
      userReactions: { ...reactions, ...newUserReactions },
    });
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("https://whispr-v2-backend.onrender.com/react", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ postId, emoji }),
      });
      if (!response.ok) {
        onPostUpdate?.(postId, { reactions, userReactions: reactions });
      }
    } catch (err) {
      onPostUpdate?.(postId, { reactions, userReactions: reactions });
    }
  };
  const entries = Object.entries(reactions || {}).filter(([, v]) => v > 0);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className={`action-btn ${userReaction ? "reacted" : ""}`} onClick={() => setOpen(o => !o)}>{userReaction || "😊"} React</button>
      {open && <div className="reaction-picker">{REACTIONS.map(e => <button key={e} className="reaction-btn" onClick={() => react(e)} style={{ transform: userReaction === e ? "scale(1.3)" : "" }}>{e}</button>)}</div>}
      {entries.length > 0 && <div className="reaction-counts" style={{ marginTop: 6 }}>{entries.map(([emoji, count]) => <span key={emoji} className="reaction-count">{emoji} {count}</span>)}</div>}
    </div>
  );
}
