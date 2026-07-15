import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import PostCard from "../components/posts/PostCard";
import PostModal from "../components/posts/PostModal";
import { Icon } from "../components/shared/Icons";

export default function BookmarksPage({ currentUser, bookmarks, allCategories, bannedWords, isAdmin, onBookmark }) {
  const [posts, setPosts] = useState([]); const [openPost, setOpenPost] = useState(null);
  useEffect(() => {
    if (bookmarks.length === 0) { setPosts([]); return; }
    const fetchPosts = async () => {
      const chunks = [];
      for (let i = 0; i < bookmarks.length; i += 10) chunks.push(bookmarks.slice(i, i + 10));
      const all = [];
      for (const chunk of chunks) {
        const snap = await getDocs(query(collection(db, "posts"), where("__name__", "in", chunk)));
        snap.docs.forEach(d => all.push({ id: d.id, ...d.data() }));
      }
      setPosts(all.filter(p => !p.deleted));
    };
    fetchPosts();
  }, [bookmarks]);
  return (
    <div className="bookmarks-page fade-in">
      <div className="bookmarks-title"><Icon.Bookmark size={18} filled /> Bookmarks ({posts.length})</div>
      {posts.length === 0 ? <div className="empty"><div className="empty-icon"><Icon.Bookmark size={28} /></div><div className="empty-text">No bookmarks yet. Tap the tag icon on any post to save it.</div></div> :
        posts.map(p => <PostCard key={p.id} post={p} currentUser={currentUser} onOpen={() => setOpenPost(p)} allCategories={allCategories} onBookmark={onBookmark} isBookmarked={true} isAdmin={isAdmin} />)}
      {openPost && <PostModal post={openPost} currentUser={currentUser} onClose={() => setOpenPost(null)} allCategories={allCategories} bannedWords={bannedWords} isAdmin={isAdmin} />}
    </div>
  );
}
