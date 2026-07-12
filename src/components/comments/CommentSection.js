import { useState, useEffect } from "react";
import {
  collection, doc, query, where, orderBy, onSnapshot,
  updateDoc, deleteDoc, increment, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import { filterContent } from "../../utils/filter";
import { timeAgo } from "../../utils/time";
import Avatar from "../shared/Avatar";
import Spinner from "../shared/Spinner";
import ReportModal from "../shared/ReportModal";

export default function CommentSection({ postId, currentUser, bannedWords }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState(""); const [loading, setLoading] = useState(false);
  const [replyTo, setReplyTo] = useState(null); const [replyText, setReplyText] = useState("");
  const [report, setReport] = useState(null);
  const [expandedReplies, setExpandedReplies] = useState({}); // track which comment's replies are open

  useEffect(() => {
    const q = query(collection(db, "comments"), where("postId", "==", postId), orderBy("createdAt", "asc"));
    return onSnapshot(q, snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [postId]);

  const addComment = async (parentId = null, text = newComment) => {
    if (!text.trim()) return;
    if (filterContent(text, bannedWords).blocked) { alert("Comment contains blocked content."); return; }
    setLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("https://whispr-v2-backend.onrender.com/comment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ postId, parentId: parentId || null, text: text.trim() }),
      });
      const result = await response.json();
      if (!response.ok) {
        alert(result.detail || "Failed to post comment. Please try again.");
        return;
      }
      if (parentId) {
        setReplyTo(null); setReplyText("");
        // Auto-expand replies for this comment so the new reply is visible
        setExpandedReplies(prev => ({ ...prev, [parentId]: true }));
      } else {
        setNewComment("");
      }
    } catch (e) {
      alert("Failed to post comment. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const likeComment = async (c) => {
    const liked = c.likedBy?.includes(currentUser.uid);
    // Optimistic update
    setComments(prev => prev.map(x => x.id !== c.id ? x : {
      ...x,
      likes: Math.max(0, (x.likes || 0) + (liked ? -1 : 1)),
      likedBy: liked
        ? (x.likedBy || []).filter(id => id !== currentUser.uid)
        : [...(x.likedBy || []), currentUser.uid],
    }));
    try {
      await updateDoc(doc(db, "comments", c.id), {
        likes: increment(liked ? -1 : 1),
        likedBy: liked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
      });
    } catch (err) {
      setComments(prev => prev.map(x => x.id !== c.id ? x : c));
    }
  };

  const deleteComment = async (id) => {
    if (!window.confirm("Delete comment?")) return;
    await deleteDoc(doc(db, "comments", id));
    await updateDoc(doc(db, "posts", postId), { commentCount: increment(-1), score: increment(-3) });
  };

  const topLevel = comments.filter(c => !c.parentId);
  const getReplies = (pid) => comments.filter(c => c.parentId === pid);

  // Renders a single comment. depth controls indentation (0 = top, 1+ = reply)
  const renderComment = (c, depth = 0) => {
    const commentReplies = getReplies(c.id);
    const isExpanded = expandedReplies[c.id];
    const isReplying = replyTo === c.id;
    const isLiked = c.likedBy?.includes(currentUser.uid);

    return (
      <div key={c.id} className="comment fade-in" style={{ marginLeft: depth > 0 ? 32 : 0, borderLeft: depth > 0 ? "2px solid var(--border)" : "none", paddingLeft: depth > 0 ? 12 : 0, marginTop: depth > 0 ? 10 : 0 }}>
        <div className="comment-header">
          <Avatar username={c.username} />
          <span className="username">{c.username}</span>
          <span className="timestamp">{timeAgo(c.createdAt)}</span>
          <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "monospace" }}>{c.commentId}</span>
        </div>
        <div className="comment-text">{c.text}</div>
        <div className="comment-actions">
          <button
            className={`action-btn btn-sm ${isLiked ? "liked" : ""}`}
            onClick={() => likeComment(c)}
            style={{ padding: "4px 10px", fontSize: 12 }}
          >
            ♥ {c.likes || 0}
          </button>
          {/* Allow reply on both top-level and nested comments */}
          <button
            className="action-btn btn-sm"
            onClick={() => { setReplyTo(isReplying ? null : c.id); setReplyText(""); }}
            style={{ padding: "4px 10px", fontSize: 12 }}
          >
            ↩ Reply
          </button>
          <button className="action-btn btn-sm" onClick={() => setReport({ type: "comment", id: c.id, uid: c.uid })} style={{ padding: "4px 10px", fontSize: 12 }}>⚑ Report</button>
          {(c.uid === currentUser.uid || currentUser.role === "admin") && (
            <button className="action-btn btn-sm" onClick={() => deleteComment(c.id)} style={{ padding: "4px 10px", fontSize: 12, color: "var(--danger)" }}>🗑</button>
          )}
          {/* Collapse/expand toggle — shown only when there are replies */}
          {commentReplies.length > 0 && (
            <button
              className="action-btn btn-sm"
              onClick={() => setExpandedReplies(prev => ({ ...prev, [c.id]: !isExpanded }))}
              style={{ padding: "4px 10px", fontSize: 12, color: "var(--accent)", marginLeft: "auto" }}
            >
              {isExpanded ? `▲ Hide ${commentReplies.length} ${commentReplies.length === 1 ? "reply" : "replies"}` : `▼ ${commentReplies.length} ${commentReplies.length === 1 ? "reply" : "replies"}`}
            </button>
          )}
        </div>

        {/* Reply input */}
        {isReplying && (
          <div className="comment-reply-form" style={{ marginTop: 10 }}>
            <input
              className="inline-input"
              placeholder={`Replying to ${c.username}...`}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addComment(c.id, replyText)}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={() => addComment(c.id, replyText)} disabled={!replyText.trim()}>Reply</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setReplyTo(null)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Collapsed replies summary — shown when there are replies but collapsed */}
        {commentReplies.length > 0 && !isExpanded && (
          <div
            style={{ marginLeft: 44, marginTop: 8, fontSize: 12, color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => setExpandedReplies(prev => ({ ...prev, [c.id]: true }))}
          >
            <div style={{ display: "flex", marginRight: 4 }}>
              {commentReplies.slice(0, 3).map((r, i) => (
                <div key={r.id} style={{ width: 18, height: 18, borderRadius: "50%", background: `hsl(${r.username?.charCodeAt(0) * 15 || 0},65%,55%)`, border: "1px solid var(--surface)", marginLeft: i > 0 ? -6 : 0, fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>
                  {r.username?.slice(0, 1).toUpperCase()}
                </div>
              ))}
            </div>
            ▼ View {commentReplies.length} {commentReplies.length === 1 ? "reply" : "replies"}
          </div>
        )}

        {/* Expanded replies — rendered recursively so reply-to-reply works */}
        {commentReplies.length > 0 && isExpanded && (
          <div style={{ marginTop: 8 }}>
            {commentReplies.map(r => renderComment(r, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {report && <ReportModal type="comment" targetId={report.id} targetUid={report.uid} reporterUid={currentUser.uid} onClose={() => setReport(null)} />}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input className="inline-input" placeholder="Write a comment..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === "Enter" && addComment()} />
        <button className="btn btn-primary" onClick={() => addComment()} disabled={loading || !newComment.trim()}>{loading ? <Spinner /> : "Post"}</button>
      </div>
      {topLevel.length === 0
        ? <div className="empty"><div className="empty-icon">💬</div><div className="empty-text">No comments yet.</div></div>
        : topLevel.map(c => renderComment(c, 0))
      }
    </div>
  );
}
