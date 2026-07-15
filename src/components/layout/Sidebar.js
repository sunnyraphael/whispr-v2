import { Icon } from "../shared/Icons";

export default function Sidebar({ activeCategory, onCategoryChange, trendingPosts, onPostClick, allCategories, posts }) {
  // Count posts per category so each row can show a real number, not just a label.
  const countFor = (categoryId) => posts?.filter(p => p.category === categoryId).length ?? 0;

  return (
    <aside className="sidebar">
      <div className="sidebar-section card" style={{ padding: "12px 0" }}>
        <div className="sidebar-title">Categories</div>
        <div className="category-list">
          <button className={`category-item ${!activeCategory ? "active" : ""}`} onClick={() => onCategoryChange(null)}>
            <span className="cat-dot" style={{ background: "var(--muted)" }} />
            All Posts
            <span className="cat-count">{posts?.length ?? 0}</span>
          </button>
          {allCategories.map(c => (
            <button key={c.id} className={`category-item ${activeCategory === c.id ? "active" : ""}`} onClick={() => onCategoryChange(c.id)}>
              <span className="cat-dot" style={{ background: c.color }} />
              {c.label}
              <span className="cat-count">{countFor(c.id)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="sidebar-section card" style={{ padding: "12px 0" }}>
        <div className="sidebar-title"><Icon.Heart size={14} filled /> Trending</div>
        <div className="trending-list">
          {trendingPosts.slice(0, 5).map((p, i) => (
            <div key={p.id} className="trending-item" onClick={() => onPostClick(p)}>
              <div className={`trending-num ${i === 0 ? "trending-num-top" : ""}`}>#{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="trending-content">{p.content}</div>
                <div className="trending-stats">
                  <span><Icon.Heart size={11} /> {p.likes}</span>
                  <span><Icon.Message size={11} /> {p.commentCount}</span>
                </div>
              </div>
            </div>
          ))}
          {trendingPosts.length === 0 && <div style={{ padding: "12px 16px", color: "var(--muted)", fontSize: 13 }}>No trending posts yet</div>}
        </div>
      </div>
    </aside>
  );
}
