export default function Sidebar({ activeCategory, onCategoryChange, trendingPosts, onPostClick, allCategories }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-section card" style={{ padding: "12px 0" }}>
        <div className="sidebar-title">Categories</div>
        <div className="category-list">
          <button className={`category-item ${!activeCategory ? "active" : ""}`} onClick={() => onCategoryChange(null)}><span className="cat-dot" style={{ background: "var(--muted)" }} />All Posts</button>
          {allCategories.map(c => <button key={c.id} className={`category-item ${activeCategory === c.id ? "active" : ""}`} onClick={() => onCategoryChange(c.id)}><span className="cat-dot" style={{ background: c.color }} />{c.label}</button>)}
        </div>
      </div>
      <div className="sidebar-section card" style={{ padding: "12px 0" }}>
        <div className="sidebar-title">🔥 Trending</div>
        <div className="trending-list">
          {trendingPosts.slice(0, 5).map((p, i) => (
            <div key={p.id} className="trending-item" onClick={() => onPostClick(p)}>
              <div className="trending-num">#{i + 1}</div>
              <div className="trending-content">{p.content}</div>
              <div className="trending-stats">♥ {p.likes} · 💬 {p.commentCount}</div>
            </div>
          ))}
          {trendingPosts.length === 0 && <div style={{ padding: "12px 16px", color: "var(--muted)", fontSize: 13 }}>No trending posts yet</div>}
        </div>
      </div>
    </aside>
  );
}
