import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { timeAgo } from "../utils/time";
import Spinner from "../components/shared/Spinner";
import PostModal from "../components/posts/PostModal";
import { Icon } from "../components/shared/Icons";

export default function ProfilePage({ currentUser, allCategories, bannedWords, isAdmin }) {
  const [posts, setPosts] = useState([]);
  const [openPost, setOpenPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("newest"); // newest | mostLiked | mostCommented

  useEffect(() => {
    const q = query(
      collection(db, "posts"),
      where("uid", "==", currentUser.uid),
      where("deleted", "==", false)
    );
    const unsub = onSnapshot(q, snap => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [currentUser.uid]);

  const sorted = [...posts].sort((a, b) => {
    if (sortBy === "mostLiked") return (b.likes || 0) - (a.likes || 0);
    if (sortBy === "mostCommented") return (b.commentCount || 0) - (a.commentCount || 0);
    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
  });

  const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const totalComments = posts.reduce((sum, p) => sum + (p.commentCount || 0), 0);
  const totalReactions = posts.reduce((sum, p) => sum + Object.values(p.reactions || {}).reduce((a, b) => a + b, 0), 0);

  const hue = currentUser.username ? currentUser.username.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360 : 200;

  return (
    <div className="profile-page fade-in">
      {/* Header */}
      <div className="card profile-header-card">
        <div className="profile-avatar-lg" style={{ background: `linear-gradient(135deg, hsl(${hue},70%,50%), hsl(${(hue+60)%360},70%,60%))` }}>
          {currentUser.username.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{currentUser.username}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Anonymous member · joined {timeAgo(currentUser.createdAt)}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 0 }}>
            <div className="profile-stat">
              <div className="profile-stat-num" style={{ color: "var(--accent)" }}>{posts.length}</div>
              <div className="profile-stat-label">Posts</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-num" style={{ color: "#ef4444" }}>{totalLikes}</div>
              <div className="profile-stat-label">Likes received</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-num" style={{ color: "var(--accent2)" }}>{totalComments}</div>
              <div className="profile-stat-label">Comments</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-num" style={{ color: "var(--warn)" }}>{totalReactions}</div>
              <div className="profile-stat-label">Reactions</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sort tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>Your Posts</div>
        <div className="tabs">
          {[["newest","Newest"],["mostLiked","Most Liked"],["mostCommented","Most Commented"]].map(([id, label]) => (
            <button key={id} className={`tab ${sortBy === id ? "active" : ""}`} onClick={() => setSortBy(id)} style={{ fontSize: 12, padding: "5px 12px" }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Posts list */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner /></div>
      ) : sorted.length === 0 ? (
        <div className="empty"><div className="empty-icon"><Icon.Edit size={28} /></div><div className="empty-text">You haven't posted anything yet.</div></div>
      ) : (
        <div className="card">
          {sorted.map(p => {
            const cat = allCategories.find(c => c.id === p.category);
            const reactionCount = Object.values(p.reactions || {}).reduce((a, b) => a + b, 0);
            return (
              <div key={p.id} className="profile-post" onClick={() => setOpenPost(p)}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                  {cat && <span className="category-tag" style={{ background: cat.color + "22", color: cat.color }}>{cat.label}</span>}
                  {p.pinned && <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--accent)", fontWeight: 700 }}><Icon.Pin size={10} /> Pinned</span>}
                  {p.disappearing && <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--accent2)" }}><Icon.Clock size={11} /> Disappearing</span>}
                  <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>{timeAgo(p.createdAt)}</span>
                  <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "monospace" }}>{p.postId}</span>
                </div>
                {p.poll && <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--accent)", marginBottom: 6, fontWeight: 600 }}><Icon.BarChart size={12} /> Poll: {p.poll.labels.join(" vs ")}</div>}
                <div className="profile-post-content">{p.content}</div>
                <div className="profile-post-stats">
                  <span className="profile-post-stat" style={{ color: p.likes > 0 ? "#ef4444" : "var(--muted)" }}><Icon.Heart size={11} filled={p.likes > 0} /> {p.likes || 0} likes</span>
                  <span className="profile-post-stat"><Icon.Message size={11} /> {p.commentCount || 0} comments</span>
                  {reactionCount > 0 && <span className="profile-post-stat"><Icon.Smile size={11} /> {reactionCount} reactions</span>}
                  {p.edited && <span className="profile-post-stat" style={{ color: "var(--muted)" }}><Icon.Edit size={10} /> edited</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openPost && (
        <PostModal
          post={openPost} currentUser={currentUser} onClose={() => setOpenPost(null)}
          allCategories={allCategories} bannedWords={bannedWords} isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
