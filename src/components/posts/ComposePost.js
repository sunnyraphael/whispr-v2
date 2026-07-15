import { useState, useRef, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { filterContent } from "../../utils/filter";
import { POST_COOLDOWN_MS } from "../../constants";
import Spinner from "../shared/Spinner";
import { Icon } from "../shared/Icons";

export default function ComposePost({ currentUser, allCategories, bannedWords, onNewPost }) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("random");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showFirstPostMsg, setShowFirstPostMsg] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [isPoll, setIsPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [isDisappearing, setIsDisappearing] = useState(false);
  const MAX = 500;
  const timerRef = useRef(null);

  const startCooldown = (seconds) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCooldownLeft(seconds);
    timerRef.current = setInterval(() => {
      setCooldownLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Check cooldown on mount (handles page refresh mid-cooldown)
  useEffect(() => {
    const checkCooldown = async () => {
      const userSnap = await getDoc(doc(db, "users", currentUser.uid));
      if (!userSnap.exists()) return;
      const data = userSnap.data();
      if (data.lastPostAt) {
        const lastPost = data.lastPostAt.toDate ? data.lastPostAt.toDate() : new Date(data.lastPostAt);
        const elapsed = Date.now() - lastPost.getTime();
        const remaining = Math.ceil((POST_COOLDOWN_MS - elapsed) / 1000);
        if (remaining > 0) startCooldown(remaining);
      }
    };
    checkCooldown();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentUser.uid]);

  const submit = async () => {
    if (!content.trim()) return;
    if (cooldownLeft > 0) { setError(`Please wait ${cooldownLeft}s before posting again.`); return; }
    if (filterContent(content, bannedWords).blocked) { setError("Content blocked: prohibited language."); return; }
    if (content.length > MAX) { setError("Post too long."); return; }
    if (isPoll && pollOptions.filter(o => o.trim()).length < 2) { setError("Add at least 2 poll options."); return; }
    setLoading(true); setError("");
    try {
      // Get the user's Firebase token to send to backend
      const token = await auth.currentUser.getIdToken();

      // Build post payload
      const payload = {
        content: content.trim(),
        category,
        disappearing: isDisappearing,
        isPoll,
        pollOptions: isPoll ? pollOptions.filter(o => o.trim()) : [],
      };

      // Send to backend instead of writing directly to Firestore
      const response = await fetch("https://whispr-v2-backend.onrender.com/post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.detail || "Failed to publish post. Please try again.");
        return;
      }

      // Build a local post object so the poster sees their post immediately
      // without waiting for a Firestore read or the 60s poll
      if (onNewPost) {
        const localPost = {
          id: result.postId || `local_${Date.now()}`,
          postId: result.postId || "",
          content: content.trim(),
          uid: currentUser.uid,
          username: currentUser.username,
          category,
          likes: 0,
          likedBy: [],
          reactions: {},
          userReactions: {},
          commentCount: 0,
          reported: false,
          deleted: false,
          pinned: false,
          score: 0,
          disappearing: isDisappearing,
          createdAt: { toDate: () => new Date(), seconds: Math.floor(Date.now() / 1000) },
          ...(isPoll ? { poll: { labels: pollOptions.filter(o => o.trim()), options: Object.fromEntries(pollOptions.filter(o => o.trim()).map((_, i) => [i, 0])), votes: {} } } : {}),
        };
        onNewPost(localPost);
      }
      setContent(""); setPollOptions(["", ""]); setIsPoll(false); setIsDisappearing(false);
      startCooldown(Math.ceil(POST_COOLDOWN_MS / 1000));
    } catch (err) {
      console.error("Post submit error:", err);
      setError("Failed to publish post. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const chars = content.length;
  const pct = Math.max(0, 100 - (cooldownLeft / (POST_COOLDOWN_MS / 1000)) * 100);
  return (
    <div className="card compose-card fade-in">
      <div className="compose-inner">
        <div className="compose-header"><Icon.Edit size={13} /> Post Anonymously as <span style={{ color: "var(--accent2)" }}>{currentUser.username}</span></div>
        {showFirstPostMsg && (
          <div className="alert alert-info" style={{ position: "relative" }}>
            👋 Welcome! You can post every <strong>2 minutes</strong> to keep things fair. Your first post is live — enjoy being anonymous!
            <button onClick={() => setShowFirstPostMsg(false)} style={{ position: "absolute", right: 10, top: 10, background: "none", border: "none", color: "inherit", cursor: "pointer" }}><Icon.X size={13} /></button>
          </div>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        {cooldownLeft > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="cooldown-bar" style={{ width: `${pct}%` }} />
            <div className="cooldown-msg"><Icon.Clock size={12} /> Next post in {cooldownLeft}s</div>
          </div>
        )}
        <textarea className="compose-area" placeholder="What's on your mind? Share anonymously..." value={content} onChange={e => setContent(e.target.value)} maxLength={MAX + 10} />
        {isPoll && (
          <div style={{ marginTop: 12, padding: 12, background: "var(--surface2)", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 8 }}>POLL OPTIONS</div>
            {pollOptions.map((opt, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input className="inline-input" placeholder={`Option ${i + 1}`} value={opt} onChange={e => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }} />
                {pollOptions.length > 2 && <button className="btn btn-ghost btn-sm" onClick={() => setPollOptions(p => p.filter((_, j) => j !== i))}><Icon.X size={11} /></button>}
              </div>
            ))}
            {pollOptions.length < 5 && <button className="btn btn-ghost btn-sm" onClick={() => setPollOptions(p => [...p, ""])}>+ Add Option</button>}
          </div>
        )}
        <div className="compose-footer">
          <select className="category-select" value={category} onChange={e => setCategory(e.target.value)}>
            {allCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button className={`btn btn-sm ${isPoll ? "btn-primary" : "btn-ghost"}`} onClick={() => setIsPoll(p => !p)} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 16l4-6 4 4 5-8" /></svg>
            Poll
          </button>
          <button className={`btn btn-sm ${isDisappearing ? "btn-primary" : "btn-ghost"}`} onClick={() => setIsDisappearing(d => !d)} title="Post disappears after 24h" style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Icon.Clock size={12} /> 24h
          </button>
          <span className={`char-count ${chars > MAX * 0.9 ? "warn" : ""} ${chars > MAX ? "over" : ""}`} style={{ marginLeft: "auto" }}>{chars}/{MAX}</span>
          <button className="btn btn-primary" onClick={submit} disabled={loading || !content.trim() || chars > MAX || cooldownLeft > 0}>{loading ? <Spinner /> : "Post"}</button>
        </div>
      </div>
    </div>
  );
}
