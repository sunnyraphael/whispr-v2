import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { filterContent } from "../../utils/filter";
import { timeAgo } from "../../utils/time";
import { EDIT_WINDOW_MS, DISAPPEAR_MS } from "../../constants";
import Avatar from "../shared/Avatar";
import ReportModal from "../shared/ReportModal";
import PollDisplay from "./PollDisplay";
import CommentSection from "../comments/CommentSection";
import { Icon } from "../shared/Icons";

export default function PostModal({ post, currentUser, onClose, allCategories, bannedWords, isAdmin }) {
  const [report, setReport] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content);
  const cat = allCategories.find(c => c.id === post.category);
  const canEdit = post.uid === currentUser.uid && (Date.now() - (post.createdAt?.toDate?.()?.getTime?.() || 0)) < EDIT_WINDOW_MS;
  const saveEdit = async () => {
    if (!editText.trim()) return;
    if (filterContent(editText, bannedWords).blocked) { alert("Content blocked."); return; }
    await updateDoc(doc(db, "posts", post.id), { content: editText.trim(), edited: true, editedAt: serverTimestamp() });
    setEditing(false);
  };
  const deletePost = async () => {
    if (!window.confirm("Delete this post?")) return;
    await updateDoc(doc(db, "posts", post.id), { deleted: true });
    onClose();
  };
  const pinPost = async () => { await updateDoc(doc(db, "posts", post.id), { pinned: !post.pinned }); };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in">
        <div className="modal-header">
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Avatar username={post.username} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{post.username}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{timeAgo(post.createdAt)} · {post.postId} {post.edited && <span style={{ color: "var(--muted)" }}>(edited)</span>}</div>
            </div>
            {cat && <span className="category-tag" style={{ background: cat.color + "22", color: cat.color }}>{cat.label}</span>}
            {post.pinned && <span className="pin-badge"><Icon.Pin size={11} /> Pinned</span>}
            {post.disappearing && <span className="disappearing-badge" style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon.Clock size={12} /> Disappears in {Math.max(0, Math.round((DISAPPEAR_MS - (Date.now() - (post.createdAt?.toDate?.()?.getTime?.() || 0))) / 3600000))}h</span>}
          </div>
          <button className="close-btn" onClick={onClose}><Icon.X size={14} /></button>
        </div>
        <div className="modal-body">
          {post.poll && <PollDisplay poll={post.poll} postId={post.id} currentUser={currentUser} />}
          {editing ? (
            <div style={{ marginBottom: 20 }}>
              <textarea className="compose-area" value={editText} onChange={e => setEditText(e.target.value)} style={{ minHeight: 80, marginBottom: 10 }} />
              <div style={{ display: "flex", gap: 8 }}><button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button><button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button></div>
            </div>
          ) : (
            <p style={{ fontSize: 16, lineHeight: 1.8, marginBottom: 20, whiteSpace: "pre-wrap" }}>{post.content}</p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            {canEdit && !editing && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)} style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon.Edit size={12} /> Edit <span className="edit-window">({Math.max(0, Math.round((EDIT_WINDOW_MS - (Date.now() - (post.createdAt?.toDate?.()?.getTime?.() || 0))) / 60000))}m left)</span></button>}
            {report && <ReportModal type="post" targetId={post.id} targetUid={post.uid} reporterUid={currentUser.uid} onClose={() => setReport(false)} />}
            <button className="action-btn btn-sm" onClick={() => setReport(true)} style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon.Flag size={12} /> Report Post</button>
            {(post.uid === currentUser.uid || isAdmin) && <button className="btn btn-danger btn-sm" onClick={deletePost} style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon.Trash size={12} /> Delete</button>}
            {isAdmin && <button className="btn btn-warn btn-sm" onClick={pinPost} style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}><Icon.Pin size={12} filled={!post.pinned} /> {post.pinned ? "Unpin" : "Pin"}</button>}
          </div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 16 }}>Comments ({post.commentCount || 0})</div>
            <CommentSection postId={post.id} currentUser={currentUser} bannedWords={bannedWords} />
          </div>
        </div>
      </div>
    </div>
  );
}
