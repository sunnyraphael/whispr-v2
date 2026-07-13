import { doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { timeAgo } from "../../utils/time";
import Avatar from "../shared/Avatar";
import ReactionButton from "./ReactionButton";
import PollDisplay from "./PollDisplay";

export default function PostCard({ post, currentUser, onOpen, allCategories, onBookmark, isBookmarked, isAdmin, onPostUpdate }) {
  const liked = post.likedBy?.includes(currentUser.uid) ?? false;
  const cat = allCategories.find(c => c.id === post.category);
  const userReaction = post.userReactions?.[currentUser.uid];
  const toggleLike = async (e) => {
    e.stopPropagation();
    const nowLiked = !liked;
    // Optimistic update
    onPostUpdate?.(post.id, {
      likes: (post.likes || 0) + (nowLiked ? 1 : -1),
      likedBy: nowLiked
        ? [...(post.likedBy || []), currentUser.uid]
        : (post.likedBy || []).filter(id => id !== currentUser.uid),
    });
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("https://whispr-v2-backend.onrender.com/like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ postId: post.id }),
      });
      if (!response.ok) {
        // Rollback on failure
        onPostUpdate?.(post.id, { likes: post.likes, likedBy: post.likedBy });
      }
    } catch (err) {
      // Rollback on failure
      onPostUpdate?.(post.id, { likes: post.likes, likedBy: post.likedBy });
    }
  };
  const pinPost = async (e) => { e.stopPropagation(); await updateDoc(doc(db, "posts", post.id), { pinned: !post.pinned }); };
  return (
    <div className={`card post-card fade-in ${post.pinned ? "pinned-post" : ""}`} onClick={onOpen}>
      <div className="card-pad">
        <div className="post-header">
          <div className="post-meta">
            <Avatar username={post.username} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="username">{post.username}</span>
                {cat && <span className="category-tag" style={{ background: cat.color + "22", color: cat.color }}>{cat.label}</span>}
                {post.pinned && <span className="pin-badge">📌 Pinned</span>}
                {post.disappearing && <span className="disappearing-badge">⏳</span>}
              </div>
              <div style={{ display: "flex", gap: 8 }}><span className="timestamp">{timeAgo(post.createdAt)}</span><span className="post-id">{post.postId}</span>{post.edited && <span style={{ fontSize: 11, color: "var(--muted)" }}>(edited)</span>}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {isAdmin && <button className="btn btn-sm" style={{ padding: "4px 8px", fontSize: 12, background: "none", border: "none", color: "var(--muted)" }} onClick={pinPost}>{post.pinned ? "📌" : "📍"}</button>}
          </div>
        </div>
        {post.poll && <div onClick={e => e.stopPropagation()}><PollDisplay poll={post.poll} postId={post.id} currentUser={currentUser} /></div>}
        <div className="post-content" style={{ WebkitLineClamp: 4, overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical" }}>{post.content}</div>
        <div className="post-actions" onClick={e => e.stopPropagation()}>
          <button className={`action-btn ${liked ? "liked" : ""}`} onClick={toggleLike}>{liked ? "♥" : "♡"} {post.likes || 0}</button>
          <button className="action-btn" onClick={onOpen}>💬 {post.commentCount || 0}</button>
          <ReactionButton postId={post.id} postUid={post.uid} userReaction={userReaction} reactions={post.reactions || {}} currentUser={currentUser} onPostUpdate={onPostUpdate} />
          <button className={`action-btn ${isBookmarked ? "bookmarked" : ""}`} onClick={e => { e.stopPropagation(); onBookmark(post.id); }}>{isBookmarked ? "🔖" : "🏷️"}</button>
        </div>
      </div>
    </div>
  );
}
