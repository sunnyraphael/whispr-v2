// This function returns the entire app's CSS as a string, injected via <StyleTag>.
// It builds two color palettes (dark/light) using CSS custom properties (--bg, --accent, etc)
// so the rest of the CSS below can just reference var(--whatever) without caring which theme is active.
export function buildStyles(theme) {
  const dark = theme === "dark";
  return `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: ${dark ? "#0a0a0f" : "#f0f0f8"};
    --surface: ${dark ? "#12121a" : "#ffffff"};
    --surface2: ${dark ? "#1a1a26" : "#f5f5ff"};
    --surface3: ${dark ? "#22223a" : "#e8e8f8"};
    --border: ${dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.1)"};
    --text: ${dark ? "#e8e8f0" : "#111128"};
    --muted: ${dark ? "#8888aa" : "#6666aa"};
    --accent: #7c3aed;
    --accent2: #06b6d4;
    --danger: #ef4444;
    --warn: #f59e0b;
    --success: #10b981;
    --glow: rgba(124,58,237,0.3);
    --font-display: 'Syne', sans-serif;
    --font-body: 'DM Sans', sans-serif;
    --radius: 16px; --radius-sm: 8px;
    --shadow: ${dark ? "0 4px 24px rgba(0,0,0,0.4)" : "0 4px 24px rgba(0,0,0,0.12)"};
  }
  body { background: var(--bg); color: var(--text); font-family: var(--font-body); min-height: 100vh; transition: background 0.3s, color 0.3s; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--surface3); border-radius: 4px; }

  .app { min-height: 100vh; display: flex; flex-direction: column; }
  .navbar {
    position: sticky; top: 0; z-index: 100;
    background: ${dark ? "rgba(10,10,15,0.85)" : "rgba(240,240,248,0.9)"}; backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    padding: 0 24px; height: 64px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .logo { font-family: var(--font-display); font-size: 22px; font-weight: 800; color: var(--text); letter-spacing: -0.5px; }
  .logo span { color: var(--accent); }
  .nav-right { display: flex; align-items: center; gap: 10px; flex-wrap: nowrap; }
  .main { display: flex; max-width: 1200px; margin: 0 auto; width: 100%; padding: 24px 16px; gap: 24px; }
  .feed-col { flex: 1; min-width: 0; }
  .sidebar { width: 280px; flex-shrink: 0; }

  /* Mobile */
  @media (max-width: 900px) { .sidebar { display: none; } }
  @media (max-width: 600px) {
    /* Navbar */
    .navbar { padding: 0 12px; height: 52px; }
    .logo { font-size: 18px; }
    .nav-username { display: none; }

    /* Search bar — hide from navbar on mobile, show as full-width bar below navbar instead */
    .search-bar { display: none; }
    .mobile-search-bar {
      display: flex; align-items: center;
      background: var(--surface2); border-bottom: 1px solid var(--border);
      padding: 8px 12px; gap: 8px;
    }
    .mobile-search-bar input {
      flex: 1; background: var(--surface); border: 1px solid var(--border);
      border-radius: 20px; padding: 8px 16px 8px 16px;
      color: var(--text); font-family: var(--font-body); font-size: 14px;
      outline: none; min-width: 0;
    }
    .mobile-search-bar input:focus { border-color: var(--accent); }
    .mobile-search-clear {
      background: none; border: none; color: var(--muted);
      font-size: 16px; cursor: pointer; padding: 4px; flex-shrink: 0;
    }

    /* Layout */
    .main { padding: 10px 8px; gap: 12px; }
    .feed-col { min-width: 0; }

    /* Cards */
    .card-pad { padding: 14px; }
    .card { border-radius: 12px; }

    /* Compose — keep footer as single row on mobile, shrink elements */
    .compose-area { font-size: 14px; min-height: 80px; }
    .compose-footer { flex-wrap: nowrap; gap: 6px; }
    .compose-footer .category-select { max-width: 90px; font-size: 12px; padding: 6px 6px; }
    .compose-footer .btn-sm { padding: 6px 8px; font-size: 11px; }
    .compose-footer .btn-primary { padding: 7px 14px; font-size: 13px; }
    .char-count { font-size: 11px; }

    /* Post actions */
    .action-btn { padding: 5px 10px; font-size: 12px; }
    .post-actions { flex-wrap: wrap; gap: 6px; }

    /* Auth */
    .auth-card { padding: 24px 18px; border-radius: 16px; margin: 12px; }
    .auth-logo { font-size: 32px; }
    .auth-wrap { padding: 12px; align-items: flex-start; padding-top: 40px; }

    /* Modal */
    .modal { border-radius: 16px 16px 0 0; max-height: 92vh; }
    .modal-overlay { align-items: flex-end; padding: 0; }

    /* Notifications & Support panels — fixed to viewport so they never clip */
    .notif-panel {
      position: fixed !important;
      top: 60px !important;
      left: 12px !important;
      right: 12px !important;
      width: auto !important;
      max-height: calc(100vh - 80px);
      overflow-y: auto;
      z-index: 300;
    }

    /* Profile dropdown */
    .profile-dropdown { right: 0; min-width: 160px; }

    /* Tabs */
    .tab { padding: 5px 12px; font-size: 12px; }
    /* Admin tabs — switch to a full-width select dropdown on mobile */
    .admin-tabs-desktop { display: none; }
    .admin-tabs-mobile { display: block; width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-family: var(--font-body); font-size: 14px; padding: 10px 12px; cursor: pointer; margin-bottom: 16px; }
    /* All admin tables scroll horizontally */
    .admin-table-wrap {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: var(--radius-sm);
    }
    .admin-table-wrap::after {
      content: "← scroll →";
      display: block;
      text-align: center;
      font-size: 11px;
      color: var(--muted);
      padding: 6px 0 2px;
      opacity: 0.6;
    }
    .admin-table-wrap table { min-width: 600px; font-size: 11px; }
    .admin-table-wrap th { padding: 8px 8px; font-size: 10px; }
    .admin-table-wrap td { padding: 8px 8px; font-size: 11px; }
    .admin-table-wrap .btn-sm { padding: 4px 8px; font-size: 10px; }
    .admin-page { padding: 12px 8px; }
    .admin-title { font-size: 20px; }
    .stat-card { padding: 12px; }
    .stat-num { font-size: 22px; }
    /* Admin stat cards wrap nicely */
    .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .section-tab { font-size: 12px; padding: 8px 6px; }

    /* Trending numbers */
    .trending-num { font-size: 14px; }

    /* Typography */
    .post-content { font-size: 14px; line-height: 1.6; }
    
    /* Buttons in modals */
    .modal .btn { font-size: 13px; padding: 8px 14px; }

    /* Avatar */
    .avatar { width: 32px; height: 32px; font-size: 12px; }

    /* Category tags */
    .category-tag { font-size: 10px; padding: 2px 8px; }

    /* Cooldown bar */
    .cooldown-bar { height: 2px; }
  }

  /* Extra small phones */
  @media (max-width: 380px) {
    .auth-card { padding: 20px 14px; }
    .navbar { padding: 0 8px; }
    .main { padding: 8px 6px; }
  }

  /* Hide mobile search bar on desktop */
  @media (min-width: 601px) {
    .mobile-search-bar { display: none; }
    .admin-tabs-desktop { display: flex !important; }
    .admin-tabs-mobile { display: none !important; }
  }

  /* Touch — larger tap targets */
  @media (hover: none) and (pointer: coarse) {
    .action-btn { min-height: 36px; }
    .btn { min-height: 40px; }
    .tab { min-height: 36px; }
    .close-btn { width: 40px; height: 40px; }
    .theme-btn { width: 40px; height: 40px; }
    .notif-btn { width: 40px; height: 40px; }
  }

  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; transition: border-color 0.2s, background 0.3s; }
  .card:hover { border-color: rgba(124,58,237,0.25); }
  .card-pad { padding: 20px; }

  /* Pinned */
  .pinned-post { border: 1px solid rgba(124,58,237,0.4) !important; background: ${dark ? "rgba(124,58,237,0.05)" : "rgba(124,58,237,0.03)"} !important; }
  .pin-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--accent); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }

  /* Announcement */
  .announcement { border: 1px solid rgba(245,158,11,0.4) !important; background: ${dark ? "rgba(245,158,11,0.06)" : "rgba(245,158,11,0.04)"} !important; margin-bottom: 16px; border-radius: var(--radius); overflow: hidden; }
  .announcement-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--warn); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }

  /* Disappearing */
  .disappearing-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--accent2); font-weight: 600; }

  .post-card { margin-bottom: 16px; cursor: pointer; }
  .post-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
  .post-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; font-family: var(--font-display); flex-shrink: 0; }
  .username { font-size: 13px; font-weight: 600; color: var(--text); }
  .timestamp { font-size: 12px; color: var(--muted); }
  .post-id { font-size: 11px; color: var(--muted); font-family: monospace; }
  .category-tag { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; letter-spacing: 0.3px; display: inline-block; }
  .post-content { font-size: 15px; line-height: 1.7; color: var(--text); margin-bottom: 16px; white-space: pre-wrap; word-break: break-word; }
  .post-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .action-btn { display: flex; align-items: center; gap: 6px; background: none; border: 1px solid var(--border); border-radius: 20px; padding: 6px 14px; font-size: 13px; color: var(--muted); cursor: pointer; font-family: var(--font-body); transition: all 0.15s; }
  .action-btn:hover { border-color: var(--accent); color: var(--text); background: var(--surface2); }
  .action-btn.liked { border-color: #ef4444; color: #ef4444; background: rgba(239,68,68,0.1); }
  .action-btn.bookmarked { border-color: var(--warn); color: var(--warn); background: rgba(245,158,11,0.1); }
  .action-btn.reacted { border-color: var(--accent); color: var(--text); background: rgba(124,58,237,0.1); }
  .reaction-picker { position: absolute; bottom: 100%; left: 0; margin-bottom: 8px; background: var(--surface2); border: 1px solid var(--border); border-radius: 40px; padding: 8px 12px; display: flex; gap: 8px; z-index: 50; box-shadow: var(--shadow); }
  .reaction-btn { font-size: 20px; cursor: pointer; transition: transform 0.15s; background: none; border: none; line-height: 1; }
  .reaction-btn:hover { transform: scale(1.3); }
  .reaction-counts { display: flex; gap: 6px; flex-wrap: wrap; }
  .reaction-count { font-size: 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: 20px; padding: 3px 10px; }

  /* Poll */
  .poll-option { margin-bottom: 10px; cursor: pointer; }
  .poll-bar-wrap { height: 36px; background: var(--surface2); border-radius: 8px; position: relative; overflow: hidden; border: 1px solid var(--border); }
  .poll-bar { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); opacity: 0.3; transition: width 0.4s ease; }
  .poll-bar-voted { opacity: 0.6; }
  .poll-label { position: absolute; inset: 0; display: flex; align-items: center; padding: 0 12px; font-size: 13px; font-weight: 500; justify-content: space-between; }

  /* Compose */
  .compose-card { margin-bottom: 20px; }
  .compose-inner { padding: 20px; }
  .compose-header { font-family: var(--font-display); font-size: 14px; font-weight: 700; color: var(--muted); margin-bottom: 12px; letter-spacing: 0.5px; text-transform: uppercase; }
  .compose-area { width: 100%; min-height: 100px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px; color: var(--text); font-family: var(--font-body); font-size: 15px; resize: vertical; line-height: 1.6; transition: border-color 0.2s; }
  .compose-area:focus { outline: none; border-color: var(--accent); }
  .compose-area::placeholder { color: var(--muted); }
  .compose-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; flex-wrap: nowrap; gap: 8px; }
  .category-select { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-family: var(--font-body); font-size: 13px; padding: 8px 12px; cursor: pointer; }
  .category-select:focus { outline: none; border-color: var(--accent); }
  .char-count { font-size: 12px; color: var(--muted); }
  .char-count.warn { color: var(--warn); }
  .char-count.over { color: var(--danger); }

  /* Cooldown */
  .cooldown-bar { height: 3px; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 3px; transition: width 0.5s linear; }
  .cooldown-msg { font-size: 12px; color: var(--warn); margin-top: 6px; }

  /* Edit */
  .edit-window { font-size: 11px; color: var(--accent2); display: inline-flex; align-items: center; gap: 4px; }

  .btn { padding: 9px 20px; border-radius: var(--radius-sm); font-family: var(--font-display); font-size: 13px; font-weight: 700; cursor: pointer; border: none; transition: all 0.15s; letter-spacing: 0.3px; display: inline-flex; align-items: center; gap: 6px; }
  .btn-primary { background: var(--accent); color: white; }
  .btn-primary:hover { background: #6d28d9; transform: translateY(-1px); box-shadow: 0 4px 16px var(--glow); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .btn-ghost { background: var(--surface2); border: 1px solid var(--border); color: var(--text); }
  .btn-ghost:hover { background: var(--surface3); }
  .btn-danger { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; }
  .btn-danger:hover { background: #ef4444; color: white; }
  .btn-warn { background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); color: var(--warn); }
  .btn-sm { padding: 5px 12px; font-size: 12px; }
  .btn-icon { width: 36px; height: 36px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 8px; }

  /* Theme toggle */
  .theme-btn { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; width: 36px; height: 36px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: background 0.15s; }
  .theme-btn:hover { background: var(--surface3); }

  /* Tabs */
  .tabs { display: flex; gap: 4px; flex-wrap: wrap; }
  .tab { background: none; border: 1px solid var(--border); border-radius: 20px; padding: 6px 16px; font-size: 13px; cursor: pointer; color: var(--muted); font-family: var(--font-body); transition: all 0.15s; white-space: nowrap; }
  .tab.active { background: var(--accent); border-color: var(--accent); color: white; }
  .tab:hover:not(.active) { background: var(--surface2); color: var(--text); }
  .section-tabs { display: flex; gap: 0; margin-bottom: 16px; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
  .section-tab { flex: 1; background: none; border: none; padding: 10px; font-size: 13px; cursor: pointer; color: var(--muted); font-family: var(--font-display); font-weight: 600; transition: all 0.15s; white-space: nowrap; }
  .section-tab.active { background: var(--accent); color: white; }
  .section-tab:hover:not(.active) { background: var(--surface2); color: var(--text); }

  /* Sidebar */
  .sidebar-section { margin-bottom: 16px; }
  .sidebar-title { font-family: var(--font-display); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--muted); padding: 12px 16px 6px; }
  .category-list { display: flex; flex-direction: column; }
  .category-item { background: none; border: none; padding: 9px 16px; font-size: 13px; cursor: pointer; color: var(--muted); text-align: left; display: flex; align-items: center; gap: 8px; transition: background 0.15s; font-family: var(--font-body); }
  .category-item:hover { background: var(--surface2); color: var(--text); }
  .category-item.active { color: var(--text); background: var(--surface2); font-weight: 600; }
  .cat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .trending-list { padding: 4px 0; }
  .trending-item { padding: 10px 16px; cursor: pointer; transition: background 0.15s; }
  .trending-item:hover { background: var(--surface2); }
  .trending-num { font-family: var(--font-display); font-size: 18px; font-weight: 800; color: var(--surface3); }
  .trending-content { font-size: 12px; color: var(--muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .trending-stats { font-size: 11px; color: var(--muted); margin-top: 4px; }

  /* Modal */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; display: flex; align-items: flex-start; justify-content: center; padding: 24px; overflow-y: auto; }
  .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; width: 100%; max-width: 640px; overflow: hidden; }
  .modal-header { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .modal-title { font-family: var(--font-display); font-size: 16px; font-weight: 700; }
  .modal-body { padding: 24px; max-height: 70vh; overflow-y: auto; }
  .close-btn { background: var(--surface2); border: none; color: var(--muted); width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
  .close-btn:hover { background: var(--surface3); color: var(--text); }

  /* Comments */
  .comment { padding: 14px 0; border-bottom: 1px solid var(--border); }
  .comment:last-child { border-bottom: none; }
  .comment-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
  .comment-text { font-size: 14px; line-height: 1.6; color: var(--text); padding-left: 44px; white-space: pre-wrap; word-break: break-word; }
  .comment-actions { display: flex; gap: 8px; padding-left: 44px; margin-top: 8px; flex-wrap: wrap; }
  .comment-reply-form { padding-left: 44px; margin-top: 10px; }
  .inline-input { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; color: var(--text); font-family: var(--font-body); font-size: 14px; }
  .inline-input:focus { outline: none; border-color: var(--accent); }
  .reply-indent { padding-left: 30px; border-left: 2px solid var(--border); margin-top: 10px; }

  /* Notifications */
  .notif-dot { width: 8px; height: 8px; background: var(--danger); border-radius: 50%; position: absolute; top: 4px; right: 4px; }
  .notif-btn { position: relative; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; width: 36px; height: 36px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; }
  .notif-panel { position: absolute; top: 100%; right: 0; margin-top: 8px; width: 320px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow); z-index: 150; }
  .notif-header { padding: 14px 16px; border-bottom: 1px solid var(--border); font-family: var(--font-display); font-size: 13px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .notif-item { padding: 12px 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s; }
  .notif-item:hover { background: var(--surface2); }
  .notif-item.unread { background: rgba(124,58,237,0.07); }
  .notif-text { font-size: 13px; line-height: 1.5; }
  .notif-time { font-size: 11px; color: var(--muted); margin-top: 2px; }

  /* Admin */
  .admin-page { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
  .admin-header { margin-bottom: 28px; }
  .admin-title { font-family: var(--font-display); font-size: 28px; font-weight: 800; }
  .admin-subtitle { color: var(--muted); font-size: 14px; margin-top: 4px; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; margin-bottom: 28px; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 16px; }
  .stat-num { font-family: var(--font-display); font-size: 28px; font-weight: 800; }
  .stat-label { font-size: 12px; color: var(--muted); margin-top: 2px; }

  /* Chart */
  .chart-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 20px; margin-bottom: 20px; }
  .chart-title { font-family: var(--font-display); font-size: 14px; font-weight: 700; margin-bottom: 16px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 120px; }
  .bar-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .bar { width: 100%; background: linear-gradient(180deg, var(--accent), var(--accent2)); border-radius: 4px 4px 0 0; min-height: 4px; transition: height 0.5s ease; }
  .bar-label { font-size: 10px; color: var(--muted); text-align: center; }
  .bar-val { font-size: 10px; font-weight: 700; color: var(--text); }

  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); padding: 10px 12px; border-bottom: 1px solid var(--border); font-family: var(--font-display); }
  td { padding: 12px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; display: inline-block; }
  .badge-danger { background: rgba(239,68,68,0.15); color: #ef4444; }
  .badge-warn { background: rgba(245,158,11,0.15); color: #f59e0b; }
  .badge-success { background: rgba(16,185,129,0.15); color: #10b981; }
  .badge-purple { background: rgba(124,58,237,0.15); color: #a78bfa; }
  .badge-cyan { background: rgba(6,182,212,0.15); color: #06b6d4; }

  .empty { text-align: center; padding: 60px 20px; color: var(--muted); }
  .empty-icon { font-size: 48px; margin-bottom: 12px; }
  .empty-text { font-size: 15px; }

  .alert { padding: 12px 16px; border-radius: var(--radius-sm); font-size: 13px; margin-bottom: 16px; }
  .alert-error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
  .alert-success { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: #6ee7b7; }
  .alert-warn { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); color: #fcd34d; }
  .alert-info { background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.3); color: #67e8f9; }

  .spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid var(--surface3); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-screen { display: flex; align-items: center; justify-content: center; min-height: 100vh; flex-direction: column; gap: 16px; }
  .loading-logo { font-family: var(--font-display); font-size: 40px; font-weight: 800; }

  .report-options { display: flex; flex-direction: column; gap: 8px; }
  .report-option { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; transition: all 0.15s; }
  .report-option:hover { border-color: var(--accent); background: var(--surface2); }
  .report-option input[type=radio] { accent-color: var(--accent); }

  .profile-menu { position: relative; }
  .profile-btn { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 13px; color: var(--text); font-family: var(--font-display); font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .profile-dropdown { position: absolute; top: 100%; right: 0; margin-top: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; min-width: 180px; box-shadow: var(--shadow); z-index: 150; }
  .dropdown-item { padding: 11px 16px; font-size: 14px; cursor: pointer; transition: background 0.15s; display: block; color: var(--text); border: none; background: none; width: 100%; text-align: left; font-family: var(--font-body); }
  .dropdown-item:hover { background: var(--surface2); }
  .dropdown-item.danger { color: var(--danger); }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .fade-in { animation: fadeIn 0.25s ease; }

  .search-bar { position: relative; flex: 1; max-width: 280px; }
  .search-input { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 20px; padding: 8px 16px 8px 36px; color: var(--text); font-family: var(--font-body); font-size: 13px; }
  .search-input:focus { outline: none; border-color: var(--accent); }
  .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 14px; pointer-events: none; }

  .bookmarks-page { max-width: 700px; margin: 0 auto; padding: 24px 16px; }
  .bookmarks-title { font-family: var(--font-display); font-size: 24px; font-weight: 800; margin-bottom: 20px; }

  /* Auth */
  .auth-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: var(--bg); }
  .auth-card { background: var(--surface); border: 1px solid var(--border); border-radius: 24px; padding: 40px; width: 100%; max-width: 400px; }
  .auth-logo { font-family: var(--font-display); font-size: 36px; font-weight: 800; text-align: center; margin-bottom: 8px; }
  .auth-sub { text-align: center; color: var(--muted); font-size: 14px; margin-bottom: 32px; }
  .auth-field { margin-bottom: 16px; }
  .auth-label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .auth-input { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px; color: var(--text); font-family: var(--font-body); font-size: 14px; }
  .auth-input:focus { outline: none; border-color: var(--accent); }

  .glow-text { background: linear-gradient(135deg, #c084fc, #67e8f9); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

  /* Profile page */
  .profile-page { max-width: 700px; margin: 0 auto; padding: 24px 16px; }
  .profile-header-card { padding: 28px; margin-bottom: 20px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
  .profile-avatar-lg { width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; font-family: var(--font-display); flex-shrink: 0; }
  .profile-stat { text-align: center; padding: 0 16px; border-right: 1px solid var(--border); }
  .profile-stat:last-child { border-right: none; }
  .profile-stat-num { font-family: var(--font-display); font-size: 22px; font-weight: 800; }
  .profile-stat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
  .profile-post { padding: 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s; }
  .profile-post:hover { background: var(--surface2); }
  .profile-post:last-child { border-bottom: none; }
  .profile-post-content { font-size: 14px; line-height: 1.6; color: var(--text); margin-bottom: 10px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .profile-post-stats { display: flex; gap: 16px; font-size: 12px; color: var(--muted); flex-wrap: wrap; }
  .profile-post-stat { display: flex; align-items: center; gap: 4px; }

  /* Maintenance */
  .maintenance-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 16px; padding: 24px; text-align: center; }
  .maintenance-icon { font-size: 64px; animation: spin 4s linear infinite; }
  .maintenance-title { font-family: var(--font-display); font-size: 28px; font-weight: 800; }
  .maintenance-sub { color: var(--muted); font-size: 15px; max-width: 400px; line-height: 1.7; }
  .maintenance-toggle { position: fixed; bottom: 24px; right: 24px; background: var(--accent); color: white; border: none; border-radius: 12px; padding: 10px 20px; font-family: var(--font-display); font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 4px 20px var(--glow); z-index: 999; }
  `;
}
