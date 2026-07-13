import { useState, useEffect, useRef, useCallback } from "react";
import { signOut } from "firebase/auth";
import {
  collection, doc, getDoc, getDocs, updateDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp,
  writeBatch, startAfter,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import { timeAgo } from "../../utils/time";
import { DEFAULT_CATEGORIES, DEFAULT_BANNED_KEYWORDS, DISAPPEAR_MS } from "../../constants";
import { useForegroundPush } from "../../hooks/useForegroundPush";
import Avatar from "../shared/Avatar";
import Spinner from "../shared/Spinner";
import StyleTag from "./StyleTag";
import PushToast from "./PushToast";
import NotificationBell from "./NotificationBell";
import Sidebar from "./Sidebar";
import SupportButton from "../shared/SupportButton";
import AdminPanel from "../admin/AdminPanel";
import PostCard from "../posts/PostCard";
import PostModal from "../posts/PostModal";
import ComposePost from "../posts/ComposePost";
import ProfilePage from "../../pages/ProfilePage";
import BookmarksPage from "../../pages/BookmarksPage";

export default function Feed({ currentUser, isAdmin, theme, toggleTheme, maintenanceMode }) {
  const pushToast = useForegroundPush();
  const [posts, setPosts] = useState([]);
  const [section, setSection] = useState("latest");
  const [feedTab, setFeedTab] = useState("newest");
  const [activeCategory, setActiveCategory] = useState(null);
  const [openPost, setOpenPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [page, setPage] = useState("feed");
  const [bookmarks, setBookmarks] = useState(currentUser.bookmarks || []);
  const [allCategories, setAllCategories] = useState([...DEFAULT_CATEGORIES]);
  const [bannedWords, setBannedWords] = useState([...DEFAULT_BANNED_KEYWORDS]);
  const [announcements, setAnnouncements] = useState([]);
  const [randomSeed, setRandomSeed] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [globalTrending, setGlobalTrending] = useState([]);       // platform-wide top by score
  const [globalMostCommented, setGlobalMostCommented] = useState([]); // platform-wide top by comments
  const [sponsoredAd, setSponsoredAd] = useState(null); // sponsored ad shown at top of feed
  // True Firestore pagination state
  const PAGE_SIZE = 20;
  const [lastDoc, setLastDoc] = useState(null);       // cursor for "load older"
  const [firstDoc, setFirstDoc] = useState(null);     // cursor for "load newer"
  const [hasOlder, setHasOlder] = useState(false);    // whether more old posts exist
  const [hasNewer, setHasNewer] = useState(false);    // whether newer posts exist before current page
  const [pageNum, setPageNum] = useState(1);          // display only
  const profileRef = useRef();

  useEffect(() => {
    const h = (e) => { if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  // Heartbeat — writes lastSeen every 5 minutes (reduced from 2min to save writes)
  useEffect(() => {
    const write = () => updateDoc(doc(db, "users", currentUser.uid), { lastSeen: serverTimestamp() });
    write();
    const interval = setInterval(write, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser.uid]);

  // One-time fetch on load — no live listeners to avoid burning Firestore reads.
  // User must manually refresh (via 🔄 button) to see updates. This is intentional.
  useEffect(() => {
    const fetchStaticData = async () => {
      try {
        // Categories
        const catSnap = await getDoc(doc(db, "settings", "categories"));
        if (catSnap.exists() && catSnap.data().list) setAllCategories(catSnap.data().list);
      } catch (_) {}
      try {
        // Banned keywords
        const kwSnap = await getDoc(doc(db, "settings", "keywords"));
        if (kwSnap.exists() && kwSnap.data().words) setBannedWords(kwSnap.data().words);
      } catch (_) {}
      try {
        // Announcements
        const annSnap = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc")));
        setAnnouncements(annSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.active !== false));
      } catch (_) {}
      try {
        // Trending — fetched once, refreshed only when user taps 🔄
        const trendSnap = await getDocs(query(collection(db, "posts"), where("deleted", "==", false), orderBy("score", "desc"), limit(20)));
        setGlobalTrending(trendSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (_) {}
      try {
        // Most discussed — same, one-time fetch
        const commSnap = await getDocs(query(collection(db, "posts"), where("deleted", "==", false), orderBy("commentCount", "desc"), limit(20)));
        setGlobalMostCommented(commSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (_) {}
    };
    fetchStaticData();
  }, []);

  // Fetch one random approved sponsored ad on load
  useEffect(() => {
    const fetchAd = async () => {
      try {
        const snap = await getDocs(query(collection(db, "ads"), where("status", "==", "approved")));
        const approved = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (approved.length > 0) {
          setSponsoredAd(approved[Math.floor(Math.random() * approved.length)]);
        }
      } catch (_) {} // ads are optional — never break the feed
    };
    fetchAd();
  }, []);

  // ── Build a base Firestore query (no cursor) ────────────────────────────────
  const buildBaseQuery = useCallback((cat) => {
    if (cat) return query(collection(db, "posts"), where("deleted", "==", false), where("category", "==", cat), orderBy("createdAt", "desc"), limit(PAGE_SIZE + 1));
    return query(collection(db, "posts"), where("deleted", "==", false), orderBy("createdAt", "desc"), limit(PAGE_SIZE + 1));
  }, []);

  // ── Fetch feed with getDocs (saves reads vs onSnapshot) ────────────────────
  // onSnapshot was draining quota — it re-read ALL posts every time any field
  // changed (likes, reactions etc). Now we fetch once and refresh manually.
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);
  const latestPostCreatedAt = useRef(null); // track newest post timestamp

  const fetchFeed = useCallback(async (cat = activeCategory) => {
    setLoading(true);
    setHasNewer(false);
    setPageNum(1);
    setNewPostsAvailable(false);
    try {
      const q = buildBaseQuery(cat);
      const snap = await getDocs(q);
      const now = Date.now();
      const docs = snap.docs;
      const items = docs.slice(0, PAGE_SIZE)
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => !p.disappearing || (now - (p.createdAt?.toDate?.()?.getTime?.() || 0)) < DISAPPEAR_MS);
      setPosts(items);
      setFirstDoc(docs[0] || null);
      setLastDoc(docs[PAGE_SIZE - 1] || null);
      setHasOlder(docs.length > PAGE_SIZE);
      // Remember the newest post's timestamp so we can detect new posts
      if (docs[0]) latestPostCreatedAt.current = docs[0].data().createdAt;
    } finally { setLoading(false); }
  }, [activeCategory, buildBaseQuery]);

  // Initial load and reload when category changes
  useEffect(() => { fetchFeed(activeCategory); }, [activeCategory, fetchFeed]);

  // Poll every 60s to check if new posts arrived — much cheaper than onSnapshot
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const q = query(
          collection(db, "posts"),
          where("deleted", "==", false),
          ...(activeCategory ? [where("category", "==", activeCategory)] : []),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const snap = await getDocs(q);
        if (snap.docs.length > 0 && latestPostCreatedAt.current) {
          const newest = snap.docs[0].data().createdAt;
          // Compare timestamps — if newer post exists, show the refresh banner
          if (newest && latestPostCreatedAt.current &&
              newest.seconds > latestPostCreatedAt.current.seconds) {
            setNewPostsAvailable(true);
          }
        }
      } catch (_) {}
    }, 60000); // check every 60 seconds — costs 1 read per user per minute
    return () => clearInterval(interval);
  }, [activeCategory]);

  // ── Load OLDER posts (next page going back in time) ─────────────────────────
  const loadOlderPosts = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      let q;
      if (activeCategory) q = query(collection(db, "posts"), where("deleted", "==", false), where("category", "==", activeCategory), orderBy("createdAt", "desc"), startAfter(lastDoc), limit(PAGE_SIZE + 1));
      else q = query(collection(db, "posts"), where("deleted", "==", false), orderBy("createdAt", "desc"), startAfter(lastDoc), limit(PAGE_SIZE + 1));
      const snap = await getDocs(q);
      const now = Date.now();
      const docs = snap.docs;
      const items = docs.slice(0, PAGE_SIZE)
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => !p.disappearing || (now - (p.createdAt?.toDate?.()?.getTime?.() || 0)) < DISAPPEAR_MS);
      setPosts(items);
      setFirstDoc(docs[0] || null);
      setLastDoc(docs[PAGE_SIZE - 1] || null);
      setHasOlder(docs.length > PAGE_SIZE);
      setHasNewer(true); // we've gone back, so there's definitely newer
      setPageNum(n => n + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally { setLoadingMore(false); }
  };

  // ── Load NEWER posts (go forward in time toward page 1) ────────────────────
  const loadNewerPosts = async () => {
    if (!firstDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const now = Date.now();
      // Query ascending starting after firstDoc — gives posts newer than current page
      let q;
      if (activeCategory) q = query(collection(db, "posts"), where("deleted", "==", false), where("category", "==", activeCategory), orderBy("createdAt", "asc"), startAfter(firstDoc), limit(PAGE_SIZE + 1));
      else q = query(collection(db, "posts"), where("deleted", "==", false), orderBy("createdAt", "asc"), startAfter(firstDoc), limit(PAGE_SIZE + 1));
      const snap = await getDocs(q);
      const rawDocs = snap.docs;

      if (rawDocs.length === 0) {
        // Already at the newest page — just reload from top fresh
        await fetchFeed(activeCategory);
      } else {
        // rawDocs: oldest → newest (asc). Reverse → newest → oldest for display.
        const hasEvenNewer = rawDocs.length > PAGE_SIZE;
        const pageDocs = rawDocs.slice(0, PAGE_SIZE).reverse();
        const items = pageDocs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => !p.disappearing || (now - (p.createdAt?.toDate?.()?.getTime?.() || 0)) < DISAPPEAR_MS);
        setPosts(items);
        setFirstDoc(pageDocs[0] || null);              // newest doc on this page
        setLastDoc(pageDocs[pageDocs.length - 1] || null); // oldest doc on this page
        setHasNewer(hasEvenNewer);
        setHasOlder(true);
        setPageNum(n => Math.max(1, n - 1));
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally { setLoadingMore(false); }
  };

  // Prune expired disappearing posts from current view every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPosts(prev => prev.filter(p => {
        if (!p.disappearing) return true;
        return (now - (p.createdAt?.toDate?.()?.getTime?.() || 0)) < DISAPPEAR_MS;
      }));
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Ban expiry is now handled by the live onSnapshot listener in App root

  const toggleBookmark = async (postId) => {
    const isBookmarked = bookmarks.includes(postId);
    const updated = isBookmarked ? bookmarks.filter(b => b !== postId) : [...bookmarks, postId];
    setBookmarks(updated);
    await updateDoc(doc(db, "users", currentUser.uid), { bookmarks: updated });
  };

  // Update a single post's fields in local state — used for optimistic UI updates
  const updatePostInState = useCallback((postId, fields) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...fields } : p));
  }, []);

  // Admin: purge all expired disappearing posts from Firestore
  const purgeExpiredPosts = async () => {
    if (!window.confirm("Delete all expired disappearing posts from the database?")) return;
    const snap = await getDocs(query(collection(db, "posts"), where("disappearing", "==", true), where("deleted", "==", false)));
    const now = Date.now();
    const expired = snap.docs.filter(d => {
      const created = d.data().createdAt?.toDate?.()?.getTime?.() || 0;
      return (now - created) >= DISAPPEAR_MS;
    });
    const batch = writeBatch(db);
    expired.forEach(d => batch.update(d.ref, { deleted: true }));
    await batch.commit();
    alert(`Purged ${expired.length} expired post${expired.length !== 1 ? "s" : ""}.`);
  };

  const sortedPosts = useCallback(() => {
    let list = [...posts];
    if (search) { const s = search.toLowerCase(); list = list.filter(p => p.content.toLowerCase().includes(s) || p.username.toLowerCase().includes(s)); }
    if (section === "latest") {
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      if (feedTab === "popular") list.sort((a, b) => (b.score || 0) - (a.score || 0));
      if (feedTab === "random") { const seed = randomSeed; list.sort((a, b) => Math.sin(seed + a.id.charCodeAt(0)) - Math.sin(seed + b.id.charCodeAt(0))); }
    } else if (section === "trending") {
      // Use platform-wide global trending list — falls back to current page if not loaded yet
      list = globalTrending.length > 0 ? [...globalTrending] : list.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (section === "mostCommented") {
      // Use platform-wide global most commented list
      list = globalMostCommented.length > 0 ? [...globalMostCommented] : list.sort((a, b) => b.commentCount - a.commentCount);
    }
    if (section === "latest") {
      const pinned = list.filter(p => p.pinned); const rest = list.filter(p => !p.pinned);
      return [...pinned, ...rest];
    }
    return list;
  }, [posts, section, feedTab, search, randomSeed, globalTrending, globalMostCommented]);

  const trending = globalTrending.length > 0 ? globalTrending : [...posts].sort((a, b) => (b.score || 0) - (a.score || 0));

  // After all hooks — instantly shows maintenance screen if toggled on while user is active
  if (maintenanceMode && !isAdmin) return (
    <>
      <StyleTag theme={theme} />
      <div className="maintenance-screen" style={{ background: "var(--bg)" }}>
        <div className="maintenance-icon">🔧</div>
        <div className="maintenance-title">Under Maintenance</div>
        <div className="maintenance-sub">Whispr is currently undergoing scheduled maintenance. We'll be back shortly — hang tight!</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>— The Whispr Team</div>
        <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => signOut(auth)}>Sign Out</button>
      </div>
    </>
  );

  if (showAdmin && isAdmin) return (
    <div className="app">
      <StyleTag theme={theme} />
      <nav className="navbar">
        <span className="logo">wh<span>i</span>spr</span>
        <div className="nav-right">
          <button className="theme-btn" onClick={toggleTheme}>{theme === "dark" ? "☀️" : "🌙"}</button>
          <button className="btn btn-ghost" onClick={() => setShowAdmin(false)}>← Back to Feed</button>
        </div>
      </nav>
      <AdminPanel currentUser={currentUser} allCategories={allCategories} setAllCategories={setAllCategories} />
    </div>
  );

  return (
    <div className="app">
      <StyleTag theme={theme} />
      <nav className="navbar">
        <span className="logo">wh<span>i</span>spr</span>
        <div className="nav-right">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input className="search-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="theme-btn" onClick={toggleTheme}>{theme === "dark" ? "☀️" : "🌙"}</button>
          <NotificationBell currentUser={currentUser} />
          <SupportButton currentUser={currentUser} />
          <div className="profile-menu" ref={profileRef}>
            <button className="profile-btn" onClick={() => setProfileOpen(o => !o)}>
              <Avatar username={currentUser.username} />
              <span className="nav-username">{currentUser.username}</span>
            </button>
            {profileOpen && (
              <div className="profile-dropdown fade-in">
                <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--muted)" }}>Anonymous account</div>
                <button className="dropdown-item" onClick={() => { setPage("profile"); setProfileOpen(false); }}>👤 My Profile</button>
                <button className="dropdown-item" onClick={() => { setPage("bookmarks"); setProfileOpen(false); }}>🔖 Bookmarks ({bookmarks.length})</button>
                {isAdmin && <button className="dropdown-item" onClick={() => { setShowAdmin(true); setProfileOpen(false); }}>⚙️ Admin Panel</button>}
                <button className="dropdown-item danger" onClick={() => signOut(auth)}>Sign Out</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile search bar — full width below navbar, hidden on desktop */}
      <div className="mobile-search-bar">
        <input
          placeholder="🔍 Search posts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="mobile-search-clear" onClick={() => setSearch("")}>✕</button>
        )}
      </div>

      {page === "profile" ? (
        <div>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 16px" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage("feed")}>← Back to Feed</button>
          </div>
          <ProfilePage currentUser={currentUser} allCategories={allCategories} bannedWords={bannedWords} isAdmin={isAdmin} />
        </div>
      ) : page === "bookmarks" ? (
        <div>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 16px" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage("feed")}>← Back to Feed</button>
          </div>
          <BookmarksPage currentUser={currentUser} bookmarks={bookmarks} allCategories={allCategories} bannedWords={bannedWords} isAdmin={isAdmin} />
        </div>
      ) : (
        <div className="main">
          <div className="feed-col">
            {/* Announcements */}
            {announcements.map(a => (
              <div key={a.id} className="announcement card-pad">
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 20 }}>📢</div>
                  <div>
                    <div className="announcement-badge">Site Announcement</div>
                    <div style={{ fontSize: 14, marginTop: 4, lineHeight: 1.6 }}>{a.content}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{timeAgo(a.createdAt)}</div>
                  </div>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 0 }}>
              <div className="section-tabs" style={{ flex: 1, marginBottom: 0 }}>
                {[["latest","Latest"],["trending","🔥 Trending"],["mostCommented","💬 Most Discussed"]].map(([id, label]) =>
                  <button key={id} className={`section-tab ${section === id ? "active" : ""}`} onClick={() => setSection(id)}>{label}</button>
                )}
              </div>
              <button
                onClick={() => fetchFeed(activeCategory)}
                disabled={loading}
                title="Refresh posts"
                style={{
                  flexShrink: 0,
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--muted)",
                  cursor: loading ? "not-allowed" : "pointer",
                  padding: "6px 10px",
                  fontSize: 15,
                  lineHeight: 1,
                  transition: "color 0.2s, border-color 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.color = "var(--accent)"}
                onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}
              >
                {loading ? "⏳" : "🔄"}
              </button>
            </div>
            {section === "latest" && (
              <div className="tabs" style={{ marginBottom: 16 }}>
                {[["newest","Newest"],["popular","Popular"]].map(([id, label]) =>
                  <button key={id} className={`tab ${feedTab === id ? "active" : ""}`} onClick={() => setFeedTab(id)}>{label}</button>
                )}
                <button className={`tab ${feedTab === "random" ? "active" : ""}`} onClick={() => { setFeedTab("random"); setRandomSeed(s => s + 1); }}>🎲 Random</button>
              </div>
            )}
            {/* Admin purge button */}
            {isAdmin && (
              <div style={{ marginBottom: 12, textAlign: "right" }}>
                <button className="btn btn-warn btn-sm" onClick={purgeExpiredPosts}>🗑 Purge Expired Posts</button>
              </div>
            )}
            {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner /></div> : (() => {
              const all = sortedPosts();
              if (all.length === 0 && !hasOlder && !hasNewer) return (
                <div className="empty">
                  <div className="empty-icon">{search ? "🔍" : "🌑"}</div>
                  <div className="empty-text">{search ? `No posts matching "${search}"` : "No posts yet. Be the first to whisper."}</div>
                </div>
              );
              return (
                <>
                  {/* Sponsored ad — shown at top of feed if one is approved */}
                  {sponsoredAd && (
                    <div style={{
                      background: "var(--surface)",
                      border: "1px solid rgba(124,58,237,0.35)",
                      borderRadius: "var(--radius)",
                      padding: "14px 16px",
                      marginBottom: 16,
                    }}>
                      <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
                        Sponsored
                      </div>
                      <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 10, color: "var(--text)" }}>{sponsoredAd.adText}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <span style={{ fontSize: 13, color: "var(--muted)" }}>📌 {sponsoredAd.businessName}</span>
                        {sponsoredAd.link && (
                          <a href={sponsoredAd.link} target="_blank" rel="noopener noreferrer"
                             style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                            Learn more →
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  {/* New posts banner — shows when polling detects new content */}
                  {newPostsAvailable && (
                    <button
                      onClick={() => fetchFeed(activeCategory)}
                      style={{
                        width: "100%", marginBottom: 12, padding: "10px",
                        background: "var(--accent)", color: "#fff", border: "none",
                        borderRadius: "var(--radius-sm)", cursor: "pointer",
                        fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}
                    >
                      ✨ New posts available — tap to refresh
                    </button>
                  )}
                  {/* ↑ Load newer — at the TOP, mobile-friendly */}
                  {hasNewer && (
                    <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", marginBottom: 12 }}
                      onClick={loadNewerPosts} disabled={loadingMore}>
                      {loadingMore ? <Spinner /> : "↑ Load newer posts"}
                    </button>
                  )}
                  {/* Page indicator */}
                  <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginBottom: 12 }}>
                    Page {pageNum} {hasOlder || hasNewer ? "· scroll down for older" : "· end of posts"}
                  </div>
                  {all.map(p => <PostCard key={p.id} post={p} currentUser={currentUser} onOpen={() => setOpenPost(p)} allCategories={allCategories} onBookmark={toggleBookmark} isBookmarked={bookmarks.includes(p.id)} isAdmin={isAdmin} onPostUpdate={updatePostInState} />)}
                  {/* ↓ Load older — at the BOTTOM */}
                  {hasOlder && (
                    <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
                      onClick={loadOlderPosts} disabled={loadingMore}>
                      {loadingMore ? <Spinner /> : "↓ Load older posts"}
                    </button>
                  )}
                </>
              );
            })()}
          </div>
          <Sidebar activeCategory={activeCategory} onCategoryChange={setActiveCategory} trendingPosts={trending} onPostClick={setOpenPost} allCategories={allCategories} />
        </div>
      )}
      {openPost && <PostModal post={openPost} currentUser={currentUser} onClose={() => setOpenPost(null)} allCategories={allCategories} bannedWords={bannedWords} isAdmin={isAdmin} />}
      {/* Floating Compose Button — bottom left */}
      <button
        onClick={() => setComposeOpen(true)}
        title="Write a post"
        style={{
          position: "fixed", bottom: 24, left: 24,
          background: "var(--accent)", color: "#fff",
          border: "none", borderRadius: 99,
          width: 56, height: 56,
          fontSize: 24, cursor: "pointer", zIndex: 998,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px var(--glow)",
          transition: "transform 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        ✏️
      </button>

      {/* Donate — smaller floating button, bottom right */}
      <a
        href="https://paystack.shop/pay/donatetowhispr-app"
        target="_blank"
        rel="noopener noreferrer"
        title="Support Whispr"
        style={{
          position: "fixed", bottom: 24, right: 24,
          background: "#FFDD00", color: "#000",
          borderRadius: 99, padding: "8px 14px",
          fontWeight: 700, fontSize: 12,
          textDecoration: "none", zIndex: 998,
          display: "flex", alignItems: "center", gap: 5,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          transition: "transform 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        ☕ Donate
      </a>

      {/* Compose Bottom Sheet */}
      {composeOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setComposeOpen(false); }}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 999,
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div style={{
            width: "100%", maxWidth: 680,
            background: "var(--surface)",
            borderRadius: "20px 20px 0 0",
            padding: "0 0 24px 0",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.4)",
            animation: "slideUp 0.25s ease",
            maxHeight: "90vh", overflowY: "auto",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px 8px",
              borderBottom: "1px solid var(--border)",
            }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>New Post</span>
              <button
                onClick={() => setComposeOpen(false)}
                style={{
                  background: "var(--surface3)", border: "none", borderRadius: "50%",
                  width: 30, height: 30, cursor: "pointer", color: "var(--text)",
                  fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✕</button>
            </div>
            <div style={{ padding: "0 4px" }}>
              <ComposePost
                currentUser={currentUser}
                allCategories={allCategories}
                bannedWords={bannedWords}
                onNewPost={(post) => {
                  setPosts(prev => [post, ...prev.filter(p => p.id !== post.id)]);
                  setNewPostsAvailable(false);
                  latestPostCreatedAt.current = post.createdAt;
                  setComposeOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <PushToast toast={pushToast} />
    </div>
  );
}
