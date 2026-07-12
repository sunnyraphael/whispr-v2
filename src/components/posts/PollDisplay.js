import { useState } from "react";
import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../../firebase";

export default function PollDisplay({ poll, postId, currentUser }) {
  const uid = currentUser?.uid ?? null;
  const [voted, setVoted] = useState(uid ? (poll.votes?.[uid] ?? null) : null);
  const [localOptions, setLocalOptions] = useState({ ...poll.options });
  const total = Object.values(localOptions).reduce((a, b) => a + (Number(b) || 0), 0);
  const vote = async (idx) => {
    if (!uid) return;
    const prev = voted;
    if (prev === idx) return;
    const prevOptions = { ...localOptions };
    const updated = { ...localOptions };
    if (prev !== null && prev !== undefined) updated[prev] = Math.max(0, (Number(updated[prev]) || 1) - 1);
    updated[idx] = (Number(updated[idx]) || 0) + 1;
    setLocalOptions(updated); setVoted(idx);
    try {
      const upd = { [`poll.votes.${uid}`]: idx, [`poll.options.${idx}`]: increment(1) };
      if (prev !== null && prev !== undefined) upd[`poll.options.${prev}`] = increment(-1);
      await updateDoc(doc(db, "posts", postId), upd);
    } catch (err) {
      // Firestore write failed — roll back optimistic update
      setLocalOptions(prevOptions);
      setVoted(prev);
    }
  };
  const values = Object.values(localOptions).map(v => Number(v) || 0);
  const maxCount = Math.max(...values, 1);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10, fontWeight: 600 }}>
        Poll &mdash; {total} vote{total !== 1 ? "s" : ""}
        {voted !== null && <span style={{ marginLeft: 8, color: "var(--accent2)", fontSize: 12 }}>tap another option to change vote</span>}
      </div>
      {poll.labels.map((label, i) => {
        const count = Number(localOptions[i] || 0);
        const isVoted = voted === i;
        const barWidth = total > 0 ? Math.round((count / maxCount) * 100) : 0;
        return (
          <div key={i} className="poll-option" onClick={() => vote(i)} style={{ opacity: voted !== null && !isVoted ? 0.75 : 1 }}>
            <div className="poll-bar-wrap" style={{ border: isVoted ? "1px solid var(--accent)" : undefined }}>
              <div className="poll-bar" style={{ width: `${barWidth}%`, opacity: isVoted ? 0.5 : 0.2 }} />
              <div className="poll-label">
                <span style={{ fontWeight: isVoted ? 700 : 400 }}>{isVoted ? "check " : ""}{label}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: isVoted ? "var(--accent)" : "var(--muted)" }}>{count} votes</span>
              </div>
            </div>
          </div>
        );
      })}
      {voted !== null && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Your vote: <strong style={{ color: "var(--accent2)" }}>{poll.labels[voted]}</strong></div>}
    </div>
  );
}
