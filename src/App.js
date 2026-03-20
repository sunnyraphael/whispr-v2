// WHISPR v2 — Anonymous Messaging Platform
// Built with React + Firebase (Firestore + Auth)
//
// SETUP: npx create-react-app whispr && cd whispr && npm install firebase
// Replace src/App.js with this file content
// After first signup, set role: "admin" on your user doc in Firebase Console → Firestore

import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth, signInWithEmailAndPassword,
  signOut, onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore, collection, doc, addDoc, getDoc, getDocs, updateDoc,
  deleteDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp,
  increment, arrayUnion, arrayRemove, Timestamp, setDoc, writeBatch, startAfter,
} from "firebase/firestore";
// App Check disabled for v2 development

// ─── FIREBASE CONFIG ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyB3MmPn44i3yGC5LpuxzNiaZDd6eke-mcE",
  authDomain: "whispr-v2.firebaseapp.com",
  projectId: "whispr-v2",
  storageBucket: "whispr-v2.firebasestorage.app",
  messagingSenderId: "338774310441",
  appId: "1:338774310441:web:404620c8667131b8072638",
  measurementId: "G-SXMMWSPE6Z"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ─── APP CHECK (reCAPTCHA v3) ─────────────────────────────────────────────────
// Prevents external scripts from abusing your Firebase project.
// Steps to activate:
//   1. Go to Firebase Console → App Check → Register your web app
// App Check disabled for v2 development — re-enable before production deploy

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id: "confessions", label: "#confessions", color: "#ff6b6b" },
  { id: "school", label: "#school", color: "#4ecdc4" },
  { id: "relationships", label: "#relationships", color: "#ff8fab" },
  { id: "work", label: "#work", color: "#ffd93d" },
  { id: "rants", label: "#rants", color: "#ff9f43" },
  { id: "advice", label: "#advice", color: "#a29bfe" },
  { id: "secrets", label: "#secrets", color: "#fd79a8" },
  { id: "random", label: "#random", color: "#74b9ff" },
];

const REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👀"];

const DEFAULT_BANNED_KEYWORDS = [
  "nigger", "faggot", "kill yourself", "kys", "rape", "terrorist",
  "bomb threat", "suicide method", "how to make a bomb",
];

// ─── ADMIN NOTE ───────────────────────────────────────────────────────────────
// Admin role is set directly in Firebase Console → Firestore → users → your doc → role: "admin"
// Bypass emails (can create multiple accounts) are stored in Firestore:
//   settings/bypassEmails → { emails: ["you@undergraduate.mcu.edu.ng", ...] }
// Only admins can read/write that document (see Firestore rules).


const POST_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
const DISAPPEAR_MS = 24 * 60 * 60 * 1000; // 24 hours
const EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 mins to edit post

const ADJECTIVES = ["Silent","Whispering","Hidden","Midnight","Phantom","Shadow","Velvet","Crimson","Azure","Golden","Silver","Cosmic","Mystic","Neon","Lunar","Solar","Arctic","Storm","Thunder","Crystal","Brave","Swift","Clever","Witty","Calm","Bold","Fierce","Gentle"];
const NOUNS = ["Fox","Wolf","Raven","Phoenix","Serpent","Falcon","Owl","Bear","Tiger","Lynx","Hawk","Panda","Otter","Jaguar","Viper","Eagle","Poet","Ghost","Rebel","Sage","Nomad","Oracle","Cipher","Specter","Wraith","Monk","Bard","Scout","Ranger","Knight","Rogue","Mystic"];


function getDeviceFingerprint() {
  const nav = window.navigator;
  const screen = window.screen;

  // Canvas fingerprint — unique per GPU/driver/OS combination
  let canvasFp = "";
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 100, 30);
    ctx.fillStyle = "#069";
    ctx.fillText("Whispr🔒", 2, 2);
    canvasFp = canvas.toDataURL().slice(-50);
  } catch (_) {}

  // WebGL renderer — very unique per graphics card
  let webglFp = "";
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (gl) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbg) webglFp = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
    }
  } catch (_) {}

  const raw = [
    nav.userAgent,
    nav.language,
    nav.languages?.join(",") || "",
    nav.platform,
    screen.width, screen.height, screen.colorDepth,
    screen.availWidth, screen.availHeight,
    new Date().getTimezoneOffset(),
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    nav.hardwareConcurrency || "",
    nav.deviceMemory || "",
    nav.maxTouchPoints || "",
    !!nav.cookieEnabled,
    !!window.indexedDB,
    !!window.localStorage,
    canvasFp,
    webglFp,
  ].join("|");

  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
    hash |= 0;
  }
  return "fp_" + Math.abs(hash).toString(36);
}

function filterContent(text, banned = DEFAULT_BANNED_KEYWORDS) {
  const lower = text.toLowerCase();
  for (const kw of banned) {
    if (lower.includes(kw)) return { blocked: true, keyword: kw };
  }
  return { blocked: false };
}

function timeAgo(ts) {
  if (!ts) return "just now";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}


// ─── THEME CONTEXT ────────────────────────────────────────────────────────────
// Simple global theme - toggled via localStorage
const getTheme = () => localStorage.getItem("whispr_theme") || "dark";
const setThemeStorage = (t) => localStorage.setItem("whispr_theme", t);

// ─── STYLES ───────────────────────────────────────────────────────────────────
function buildStyles(theme) {
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

function StyleTag({ theme }) {
  return <style dangerouslySetInnerHTML={{ __html: buildStyles(theme) }} />;
}
function Spinner() { return <span className="spinner" />; }
function Avatar({ username }) {
  const initials = username ? username.slice(0, 2).toUpperCase() : "?";
  const hue = username ? username.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360 : 200;
  return <div className="avatar" style={{ background: `linear-gradient(135deg, hsl(${hue},70%,50%), hsl(${(hue + 60) % 360},70%,60%))` }}>{initials}</div>;
}

// ─── AUTH PAGE ────────────────────────────────────────────────────────────────
// --- TERMS & CONDITIONS -------------------------------------------------------
const TERMS_TEXT = `WHISPR MCU — TERMS & CONDITIONS

Last updated: 2025
Platform: Whispr MCU (whispr-message.web.app)
For: McPherson University (MCU) students only

By creating an account on Whispr MCU, you agree to the following terms. Please read carefully before proceeding.

1. ELIGIBILITY
   This platform is exclusively for students of McPherson University (MCU). By signing up, you confirm you are a currently enrolled MCU student. Accounts found to belong to non-students will be permanently banned.

2. ANONYMITY & IDENTITY
   You will be assigned a randomly generated username. Your real identity is not displayed publicly. However, you must not attempt to reveal, guess, or expose other users' real identities. Doxxing of any kind will result in an immediate permanent ban.

3. ALL POSTS ARE MONITORED
   ⚠️ Important: All content posted on this platform is actively monitored by the platform admin. While your username is anonymous to other users, the platform retains records that may be used to identify accounts responsible for violations if escalated to university authorities.

4. POST AT YOUR OWN RISK
   Every post you make is your sole responsibility. Whispr MCU and its administrators are not liable for any content posted by users. If your post violates these terms or university policy, you bear full responsibility for the consequences, which may include referral to MCU authorities.

5. ACCEPTABLE USE — YOU MUST NOT POST:
   • Hate speech, tribalism, racism, or discrimination of any kind
   • Harassment, bullying, or targeted attacks on any individual
   • Threats of violence or harm
   • Sexual or explicit content
   • Spam or repetitive content
   • Misinformation or false accusations
   • Content that violates MCU's student code of conduct

6. NO PERSONAL INFORMATION
   ⚠️ Do not share your own or anyone else's personal information — including full names, phone numbers, hostel/room details, photos, or any identifying details. Violations will be removed immediately and the account suspended.

7. REPORTING
   Use the Report (🚩) button on any post that violates these terms. Do not abuse the report system. False or malicious reports are also a violation.

8. ACCOUNT SUSPENSION & BANS
   Accounts that violate these terms may be temporarily or permanently banned without notice. Attempting to create a new account after a ban is a further violation and will be reported to university authorities.

9. ESCALATION TO UNIVERSITY AUTHORITIES
   In cases of serious violations — including but not limited to threats, harassment, or cyberbullying — the platform admin reserves the right to escalate the matter to MCU student affairs or relevant university authorities, providing any records necessary for investigation.

10. CONTENT REMOVAL
    The admin may remove any post at any time without explanation. Removed content will not be restored.

11. CHANGES TO TERMS
    These terms may be updated at any time. Continued use of the platform after changes means you accept the updated terms.

12. CONTACT & SUPPORT
    For issues, concerns, or to report a serious violation privately, use the support button (💬) in the app.

By clicking "Accept & Continue" you confirm that:
✓ You are a current MCU student
✓ You have read and understood these terms
✓ You accept that all posts are monitored and you post at your own risk
✓ You will not share personal information of yourself or others`;

function TermsModal({ onAccept, onDecline }) {
  const [scrolled, setScrolled] = useState(false);
  const bodyRef = useRef();
  const handleScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setScrolled(true);
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ maxWidth: 520, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-header">
          <span className="modal-title">📋 Terms & Conditions</span>
        </div>
        <div ref={bodyRef} onScroll={handleScroll} style={{ flex: 1, overflowY: "auto", padding: 24, fontSize: 13, lineHeight: 1.8, color: "var(--muted)", whiteSpace: "pre-wrap", fontFamily: "var(--font-body)" }}>
          {TERMS_TEXT}
        </div>
        {!scrolled && (
          <div style={{ padding: "8px 24px", fontSize: 12, color: "var(--warn)", textAlign: "center", borderTop: "1px solid var(--border)" }}>
            Scroll to the bottom to accept
          </div>
        )}
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={onAccept} disabled={!scrolled}>
            Accept & Continue
          </button>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={onDecline}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

function AuthPage({ theme, toggleTheme, onSignupSuccess }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const doSignup = async () => {
    setError(""); setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { setError("Please enter an email address."); setLoading(false); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); setLoading(false); return; }

    try {
      const fp = getDeviceFingerprint();

      // Send signup request to backend — all validation happens server-side
      const response = await fetch("https://web-production-549eb.up.railway.app/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          fingerprint: fp,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.detail || "Something went wrong. Please try again.");
        setLoading(false); return;
      }

      // Backend created the account — now sign in with Firebase Auth
      await signInWithEmailAndPassword(auth, normalizedEmail, password);

    } catch (e) {
      if (e.code === "auth/too-many-requests") setError("Too many attempts. Please wait a moment.");
      else if (e.code === "auth/network-request-failed") setError("Network error. Check your connection.");
      else setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const handleAuth = async () => {
    if (mode === "signup") {
      if (!termsAccepted) { setShowTerms(true); return; }
      await doSignup();
    } else {
      setError(""); setLoading(true);
      if (!email.trim()) { setError("Enter your email."); setLoading(false); return; }
      try {
        await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      } catch (e) {
        if (e.code === "auth/too-many-requests") setError("Too many failed attempts. Please wait a few minutes.");
        else if (e.code === "auth/network-request-failed") setError("Network error. Check your connection.");
        else setError("Incorrect email or password. Please try again.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      {showTerms && (
        <TermsModal
          onAccept={() => { setTermsAccepted(true); setShowTerms(false); doSignup(); }}
          onDecline={() => setShowTerms(false)}
        />
      )}
      <div className="auth-card fade-in">
        <button className="theme-btn" style={{ marginLeft: "auto", display: "flex", marginBottom: 12 }} onClick={toggleTheme}>{theme === "dark" ? "☀️" : "🌙"}</button>
        <div className="auth-logo">wh<span style={{ color: "var(--accent)" }}>i</span>spr</div>
        <div className="auth-sub">{mode === "signup" ? "Create your anonymous account." : "Welcome back. Your secret is safe."}</div>
        {error && <div className="alert alert-error">{error}</div>}
        {mode === "signup" && <div className="alert alert-info">✨ Use any email and a password of your choice. You'll get a random anonymous display name — no one will know it's you.</div>}
        <div className="auth-field">
          <label className="auth-label">Email</label>
          <input className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="any email you want" onKeyDown={e => e.key === "Enter" && handleAuth()} autoCapitalize="none" />
        </div>
        <div className="auth-field">
          <label className="auth-label">Password</label>
          <input className="auth-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleAuth()} />
          {mode === "signup" && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>⚠️ Remember your email and password — if you forget them your account cannot be recovered.</div>}
        </div>
        {mode === "signup" && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.6 }}>
            By signing up you agree to our{" "}
            <button onClick={() => setShowTerms(true)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>Terms & Conditions</button>.
          </div>
        )}
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={handleAuth} disabled={loading}>
          {loading ? <Spinner /> : mode === "signup" ? "Create Anonymous Account" : "Sign In"}
        </button>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--muted)" }}>
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setTermsAccepted(false); setEmail(""); setPassword(""); }} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>
            {mode === "login" ? "Sign Up" : "Log In"}
          </button>
        </div>
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 20, paddingTop: 16, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Need help or having trouble logging in?</div>
          <a href="mailto:ifeoluwaraphael0@gmail.com" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>💬 Contact Support</a>
        </div>
      </div>
    </div>
  );
}

// ─── REACTION BUTTON ──────────────────────────────────────────────────────────
function ReactionButton({ postId, postUid, userReaction, reactions, currentUser, onPostUpdate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const react = async (emoji) => {
    setOpen(false);
    const prev = userReaction;
    // Optimistic local update
    const newReactions = { ...reactions };
    const newUserReactions = {};
    if (prev === emoji) {
      newReactions[emoji] = Math.max(0, (newReactions[emoji] || 1) - 1);
      newUserReactions[currentUser.uid] = null;
    } else {
      if (prev) newReactions[prev] = Math.max(0, (newReactions[prev] || 1) - 1);
      newReactions[emoji] = (newReactions[emoji] || 0) + 1;
      newUserReactions[currentUser.uid] = emoji;
    }
    onPostUpdate?.(postId, {
      reactions: newReactions,
      userReactions: { ...reactions, ...newUserReactions },
    });
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("https://web-production-549eb.up.railway.app/react", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ postId, emoji }),
      });
      if (!response.ok) {
        onPostUpdate?.(postId, { reactions, userReactions: reactions });
      }
    } catch (err) {
      onPostUpdate?.(postId, { reactions, userReactions: reactions });
    }
  };
  const entries = Object.entries(reactions || {}).filter(([, v]) => v > 0);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className={`action-btn ${userReaction ? "reacted" : ""}`} onClick={() => setOpen(o => !o)}>{userReaction || "😊"} React</button>
      {open && <div className="reaction-picker">{REACTIONS.map(e => <button key={e} className="reaction-btn" onClick={() => react(e)} style={{ transform: userReaction === e ? "scale(1.3)" : "" }}>{e}</button>)}</div>}
      {entries.length > 0 && <div className="reaction-counts" style={{ marginTop: 6 }}>{entries.map(([emoji, count]) => <span key={emoji} className="reaction-count">{emoji} {count}</span>)}</div>}
    </div>
  );
}

// ─── REPORT MODAL ─────────────────────────────────────────────────────────────
function ReportModal({ type, targetId, targetUid, reporterUid, onClose }) {
  const reasons = ["Hate speech", "Harassment", "Spam", "Misinformation", "Illegal content", "Other"];
  const [reason, setReason] = useState(""); const [submitted, setSubmitted] = useState(false);
  const submit = async () => {
    if (!reason) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("https://web-production-549eb.up.railway.app/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          targetId,
          targetUid: targetUid || null,
          reason,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        alert(result.detail || "Failed to submit report.");
        return;
      }
    } catch (e) {
      alert("Failed to submit report. Please check your connection.");
      return;
    }
    setSubmitted(true); setTimeout(onClose, 1500);
  };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in" style={{ marginTop: 60 }}>
        <div className="modal-header"><span className="modal-title">Report {type}</span><button className="close-btn" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          {submitted ? <div className="alert alert-success">✅ Report submitted. Our team will review it.</div> : (
            <>
              <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>Why are you reporting this {type}?</p>
              <div className="report-options">{reasons.map(r => <label key={r} className="report-option"><input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} /><span style={{ fontSize: 14 }}>{r}</span></label>)}</div>
              <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                <button className="btn btn-primary" onClick={submit} disabled={!reason}>Submit Report</button>
                <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── POLL DISPLAY ─────────────────────────────────────────────────────────────
function PollDisplay({ poll, postId, currentUser }) {
  const uid = currentUser?.uid ?? null;
  const [voted, setVoted] = useState(uid ? (poll.votes?.[uid] ?? null) : null);
  const [localOptions, setLocalOptions] = useState({ ...poll.options });
  const total = Object.values(localOptions).reduce((a, b) => a + (Number(b) || 0), 0);
  const vote = async (idx) => {
    if (!uid) return;
    const prev = voted;
    if (prev === idx) return;
    const prevOptions = { ...localOptions };
    const updated = { ...localOptions };
    if (prev !== null && prev !== undefined) updated[prev] = Math.max(0, (Number(updated[prev]) || 1) - 1);
    updated[idx] = (Number(updated[idx]) || 0) + 1;
    setLocalOptions(updated); setVoted(idx);
    try {
      const upd = { [`poll.votes.${uid}`]: idx, [`poll.options.${idx}`]: increment(1) };
      if (prev !== null && prev !== undefined) upd[`poll.options.${prev}`] = increment(-1);
      await updateDoc(doc(db, "posts", postId), upd);
    } catch (err) {
      // Firestore write failed — roll back optimistic update
      setLocalOptions(prevOptions);
      setVoted(prev);
    }
  };
  const values = Object.values(localOptions).map(v => Number(v) || 0);
  const maxCount = Math.max(...values, 1);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10, fontWeight: 600 }}>
        Poll &mdash; {total} vote{total !== 1 ? "s" : ""}
        {voted !== null && <span style={{ marginLeft: 8, color: "var(--accent2)", fontSize: 12 }}>tap another option to change vote</span>}
      </div>
      {poll.labels.map((label, i) => {
        const count = Number(localOptions[i] || 0);
        const isVoted = voted === i;
        const barWidth = total > 0 ? Math.round((count / maxCount) * 100) : 0;
        return (
          <div key={i} className="poll-option" onClick={() => vote(i)} style={{ opacity: voted !== null && !isVoted ? 0.75 : 1 }}>
            <div className="poll-bar-wrap" style={{ border: isVoted ? "1px solid var(--accent)" : undefined }}>
              <div className="poll-bar" style={{ width: `${barWidth}%`, opacity: isVoted ? 0.5 : 0.2 }} />
              <div className="poll-label">
                <span style={{ fontWeight: isVoted ? 700 : 400 }}>{isVoted ? "check " : ""}{label}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: isVoted ? "var(--accent)" : "var(--muted)" }}>{count} votes</span>
              </div>
            </div>
          </div>
        );
      })}
      {voted !== null && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Your vote: <strong style={{ color: "var(--accent2)" }}>{poll.labels[voted]}</strong></div>}
    </div>
  );
}
// ─── COMMENT SECTION ──────────────────────────────────────────────────────────
function CommentSection({ postId, currentUser, bannedWords }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState(""); const [loading, setLoading] = useState(false);
  const [replyTo, setReplyTo] = useState(null); const [replyText, setReplyText] = useState("");
  const [report, setReport] = useState(null);
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
      const response = await fetch("https://web-production-549eb.up.railway.app/comment", {
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
    await updateDoc(doc(db, "comments", c.id), { likes: increment(liked ? -1 : 1), likedBy: liked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) });
  };
  const deleteComment = async (id) => {
    if (!window.confirm("Delete comment?")) return;
    await deleteDoc(doc(db, "comments", id));
    await updateDoc(doc(db, "posts", postId), { commentCount: increment(-1), score: increment(-3) });
  };
  const topLevel = comments.filter(c => !c.parentId);
  const replies = (pid) => comments.filter(c => c.parentId === pid);
  const renderComment = (c, isReply = false) => (
    <div key={c.id} className="comment fade-in">
      <div className="comment-header"><Avatar username={c.username} /><span className="username">{c.username}</span><span className="timestamp">{timeAgo(c.createdAt)}</span><span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "monospace" }}>{c.commentId}</span></div>
      <div className="comment-text">{c.text}</div>
      <div className="comment-actions">
        <button className={`action-btn btn-sm ${c.likedBy?.includes(currentUser.uid) ? "liked" : ""}`} onClick={() => likeComment(c)} style={{ padding: "4px 10px", fontSize: 12 }}>♥ {c.likes || 0}</button>
        {!isReply && <button className="action-btn btn-sm" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} style={{ padding: "4px 10px", fontSize: 12 }}>↩ Reply</button>}
        <button className="action-btn btn-sm" onClick={() => setReport({ type: "comment", id: c.id, uid: c.uid })} style={{ padding: "4px 10px", fontSize: 12 }}>⚑ Report</button>
        {(c.uid === currentUser.uid || currentUser.role === "admin") && <button className="action-btn btn-sm" onClick={() => deleteComment(c.id)} style={{ padding: "4px 10px", fontSize: 12, color: "var(--danger)" }}>🗑</button>}
      </div>
      {replyTo === c.id && (
        <div className="comment-reply-form" style={{ marginTop: 10 }}>
          <input className="inline-input" placeholder={`Replying to ${c.username}...`} value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === "Enter" && addComment(c.id, replyText)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}><button className="btn btn-primary btn-sm" onClick={() => addComment(c.id, replyText)} disabled={!replyText.trim()}>Reply</button><button className="btn btn-ghost btn-sm" onClick={() => setReplyTo(null)}>Cancel</button></div>
        </div>
      )}
      {replies(c.id).length > 0 && <div className="reply-indent" style={{ marginLeft: 44 }}>{replies(c.id).map(r => renderComment(r, true))}</div>}
    </div>
  );
  return (
    <div>
      {report && <ReportModal type="comment" targetId={report.id} targetUid={report.uid} reporterUid={currentUser.uid} onClose={() => setReport(null)} />}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input className="inline-input" placeholder="Write a comment..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === "Enter" && addComment()} />
        <button className="btn btn-primary" onClick={() => addComment()} disabled={loading || !newComment.trim()}>{loading ? <Spinner /> : "Post"}</button>
      </div>
      {topLevel.length === 0 ? <div className="empty"><div className="empty-icon">💬</div><div className="empty-text">No comments yet.</div></div> : topLevel.map(c => renderComment(c))}
    </div>
  );
}

// ─── POST MODAL ───────────────────────────────────────────────────────────────
function PostModal({ post, currentUser, onClose, allCategories, bannedWords, isAdmin }) {
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
            {post.pinned && <span className="pin-badge">📌 Pinned</span>}
            {post.disappearing && <span className="disappearing-badge">⏳ Disappears in {Math.max(0, Math.round((DISAPPEAR_MS - (Date.now() - (post.createdAt?.toDate?.()?.getTime?.() || 0))) / 3600000))}h</span>}
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
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
            {canEdit && !editing && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>✏️ Edit <span className="edit-window">({Math.max(0, Math.round((EDIT_WINDOW_MS - (Date.now() - (post.createdAt?.toDate?.()?.getTime?.() || 0))) / 60000))}m left)</span></button>}
            {report && <ReportModal type="post" targetId={post.id} targetUid={post.uid} reporterUid={currentUser.uid} onClose={() => setReport(false)} />}
            <button className="action-btn btn-sm" onClick={() => setReport(true)}>⚑ Report Post</button>
            {(post.uid === currentUser.uid || isAdmin) && <button className="btn btn-danger btn-sm" onClick={deletePost}>🗑 Delete</button>}
            {isAdmin && <button className="btn btn-warn btn-sm" onClick={pinPost}>{post.pinned ? "📌 Unpin" : "📌 Pin"}</button>}
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

// ─── POST CARD ────────────────────────────────────────────────────────────────
function PostCard({ post, currentUser, onOpen, allCategories, onBookmark, isBookmarked, isAdmin, onPostUpdate }) {
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
      const response = await fetch("https://web-production-549eb.up.railway.app/like", {
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
        {post.poll && <div style={{ fontSize: 13, color: "var(--accent)", marginBottom: 10, fontWeight: 600 }}>🗳️ Poll: {post.poll.labels.join(" vs ")}</div>}
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

// ─── COMPOSE POST ─────────────────────────────────────────────────────────────
function ComposePost({ currentUser, allCategories, bannedWords, onNewPost }) {
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
      const response = await fetch("https://web-production-549eb.up.railway.app/post", {
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
        <div className="compose-header">✍️ Post Anonymously as <span style={{ color: "var(--accent2)" }}>{currentUser.username}</span></div>
        {showFirstPostMsg && (
          <div className="alert alert-info" style={{ position: "relative" }}>
            👋 Welcome! You can post every <strong>2 minutes</strong> to keep things fair. Your first post is live — enjoy being anonymous!
            <button onClick={() => setShowFirstPostMsg(false)} style={{ position: "absolute", right: 10, top: 10, background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        {cooldownLeft > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="cooldown-bar" style={{ width: `${pct}%` }} />
            <div className="cooldown-msg">⏱ Next post in {cooldownLeft}s</div>
          </div>
        )}
        <textarea className="compose-area" placeholder="What's on your mind? Share anonymously..." value={content} onChange={e => setContent(e.target.value)} maxLength={MAX + 10} />
        {isPoll && (
          <div style={{ marginTop: 12, padding: 12, background: "var(--surface2)", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 8 }}>POLL OPTIONS</div>
            {pollOptions.map((opt, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input className="inline-input" placeholder={`Option ${i + 1}`} value={opt} onChange={e => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }} />
                {pollOptions.length > 2 && <button className="btn btn-ghost btn-sm" onClick={() => setPollOptions(p => p.filter((_, j) => j !== i))}>✕</button>}
              </div>
            ))}
            {pollOptions.length < 5 && <button className="btn btn-ghost btn-sm" onClick={() => setPollOptions(p => [...p, ""])}>+ Add Option</button>}
          </div>
        )}
        <div className="compose-footer">
          <select className="category-select" value={category} onChange={e => setCategory(e.target.value)}>
            {allCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button className={`btn btn-sm ${isPoll ? "btn-primary" : "btn-ghost"}`} onClick={() => setIsPoll(p => !p)}>🗳️ Poll</button>
          <button className={`btn btn-sm ${isDisappearing ? "btn-primary" : "btn-ghost"}`} onClick={() => setIsDisappearing(d => !d)} title="Post disappears after 24h">⏳ 24h</button>
          <span className={`char-count ${chars > MAX * 0.9 ? "warn" : ""} ${chars > MAX ? "over" : ""}`} style={{ marginLeft: "auto" }}>{chars}/{MAX}</span>
          <button className="btn btn-primary" onClick={submit} disabled={loading || !content.trim() || chars > MAX || cooldownLeft > 0}>{loading ? <Spinner /> : "Post"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────────

// --- SUPPORT BUTTON ----------------------------------------------------------
function SupportButton({ currentUser }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const submit = async () => {
    if (!message.trim()) return;
    setLoading(true);
    await addDoc(collection(db, "support"), {
      uid: currentUser.uid,
      username: currentUser.username,
      subject: subject.trim() || "General",
      message: message.trim(),
      status: "open",
      createdAt: serverTimestamp(),
    });
    setSent(true); setLoading(false);
    setTimeout(() => { setSent(false); setSubject(""); setMessage(""); setOpen(false); }, 2500);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="notif-btn" onClick={() => setOpen(o => !o)} title="Contact Support">💬</button>
      {open && (
        <div className="notif-panel fade-in" style={{ width: 320, padding: 0 }}>
          <div className="notif-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Contact Admin</span>
            <button className="close-btn" onClick={() => setOpen(false)}>x</button>
          </div>
          {sent ? (
            <div style={{ padding: 20 }}><div className="alert alert-success" style={{ margin: 0 }}>Message sent! We will get back to you soon.</div></div>
          ) : (
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Report a bug, ask for help, or send us feedback.</div>
              <div style={{ marginBottom: 10 }}>
                <select className="category-select" style={{ width: "100%" }} value={subject} onChange={e => setSubject(e.target.value)}>
                  <option value="">Select topic...</option>
                  <option value="Bug Report">Bug Report</option>
                  <option value="Account Issue">Account Issue</option>
                  <option value="Content Report">Content Report</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <textarea
                className="compose-area"
                placeholder="Describe your issue or message..."
                value={message} onChange={e => setMessage(e.target.value)}
                style={{ minHeight: 100, marginBottom: 10, fontSize: 13 }}
              />
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={submit} disabled={loading || !message.trim()}>
                {loading ? "Sending..." : "Send Message"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationBell({ currentUser }) {
  const [notifs, setNotifs] = useState([]); const [open, setOpen] = useState(false); const ref = useRef();
  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, "notifications"), where("toUid", "==", currentUser.uid), orderBy("createdAt", "desc"), limit(30));
    return onSnapshot(q, snap => setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser?.uid]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const markRead = async () => {
    const unread = notifs.filter(n => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, "notifications", n.id), { read: true }));
    await batch.commit();
  };
  const dismissNotif = async (e, id) => {
    e.stopPropagation();
    await deleteDoc(doc(db, "notifications", id));
  };
  const unread = notifs.filter(n => !n.read).length;
  const text = (n) => {
    if (n.type === "like") return `${n.fromUsername} liked your post`;
    if (n.type === "comment") return `${n.fromUsername} commented on your post`;
    if (n.type === "reply_comment") return `${n.fromUsername} replied to your comment`;
    if (n.type === "react") return `${n.fromUsername} reacted ${n.emoji} to your post`;
    if (n.type === "ban") return `⚠️ ${n.message}`;
    return "New notification";
  };
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="notif-btn" onClick={() => { setOpen(o => !o); if (!open) markRead(); }}>🔔{unread > 0 && <span className="notif-dot" />}</button>
      {open && (
        <div className="notif-panel fade-in">
          <div className="notif-header">Notifications {unread > 0 && `(${unread})`}</div>
          {notifs.length === 0
            ? <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No notifications</div>
            : notifs.map(n => (
              <div key={n.id} className={`notif-item ${!n.read ? "unread" : ""}`}
                onClick={(e) => dismissNotif(e, n.id)}
                style={{ cursor: "pointer" }}
                title="Tap to dismiss">
                <div className="notif-text">{text(n)}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div className="notif-time">{timeAgo(n.createdAt)}</div>
                  <span style={{ fontSize: 10, color: "var(--muted)", opacity: 0.6 }}>tap to dismiss</span>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ activeCategory, onCategoryChange, trendingPosts, onPostClick, allCategories }) {
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

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel({ currentUser, allCategories, setAllCategories }) {
  const [tab, setTab] = useState("dashboard");
  const [reports, setReports] = useState([]); const [posts, setPosts] = useState([]); const [users, setUsers] = useState([]);
  const [bannedWords, setBannedWords] = useState([...DEFAULT_BANNED_KEYWORDS]); const [newWord, setNewWord] = useState("");
  const [banModal, setBanModal] = useState(null); const [banDuration, setBanDuration] = useState("1"); const [banUnit, setBanUnit] = useState("days"); const [banReason, setBanReason] = useState("");
  const [newAnnouncement, setNewAnnouncement] = useState(""); const [announcements, setAnnouncements] = useState([]);
  const [newCatLabel, setNewCatLabel] = useState(""); const [newCatColor, setNewCatColor] = useState("#74b9ff");
  const [supportMsgs, setSupportMsgs] = useState([]);
  const [maintenance, setMaintenance] = useState(false);
  const [deviceBans, setDeviceBans] = useState([]);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "reports"), orderBy("createdAt", "desc")), snap => setReports(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(query(collection(db, "posts"), where("deleted", "==", false), orderBy("createdAt", "desc"), limit(50)), snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, "users"), snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u4 = onSnapshot(query(collection(db, "announcements"), orderBy("createdAt", "desc")), snap => setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u5 = onSnapshot(query(collection(db, "support"), orderBy("createdAt", "desc")), snap => setSupportMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u6 = onSnapshot(collection(db, "deviceBans"), snap => setDeviceBans(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    getDoc(doc(db, "settings", "keywords")).then(snap => { if (snap.exists() && snap.data().words) setBannedWords(snap.data().words); });
    getDoc(doc(db, "settings", "maintenance")).then(snap => { if (snap.exists()) setMaintenance(snap.data().enabled || false); });
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, []);

  const saveKeywords = async (words) => { await setDoc(doc(db, "settings", "keywords"), { words }); };
  const toggleMaintenance = async () => {
    const next = !maintenance;
    setMaintenance(next);
    await setDoc(doc(db, "settings", "maintenance"), { enabled: next, updatedAt: serverTimestamp() });
  };
  const addBannedWord = async () => { const w = newWord.toLowerCase().trim(); if (w && !bannedWords.includes(w)) { const u = [...bannedWords, w]; setBannedWords(u); setNewWord(""); await saveKeywords(u); } };
  const removeBannedWord = async (w) => { const u = bannedWords.filter(k => k !== w); setBannedWords(u); await saveKeywords(u); };

  const confirmBan = async () => {
    if (!banModal) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const ms = parseInt(banDuration) * (banUnit === "hours" ? 3600000 : banUnit === "days" ? 86400000 : 604800000);
      const durationDays = ms / 86400000;
      const response = await fetch("https://web-production-549eb.up.railway.app/admin/ban", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUid: banModal.uid,
          reason: banReason || "Violation of guidelines",
          durationDays,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        alert(result.detail || "Failed to ban user.");
        return;
      }
    } catch (e) {
      alert("Failed to ban user. Please check your connection.");
      return;
    }
    setBanModal(null);
  };

  const unbanUser = async (u) => {
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("https://web-production-549eb.up.railway.app/admin/unban", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUid: u.uid }),
      });
      if (!response.ok) {
        const result = await response.json();
        alert(result.detail || "Failed to unban user.");
      }
    } catch (e) {
      alert("Failed to unban user. Please check your connection.");
    }
  };
  const deletePost = async (id) => { if (!window.confirm("Delete post?")) return; await updateDoc(doc(db, "posts", id), { deleted: true }); };
  const resolveReport = async (id) => { await updateDoc(doc(db, "reports", id), { status: "resolved" }); };
  const dismissReport = async (id) => { await updateDoc(doc(db, "reports", id), { status: "dismissed" }); };
  const postAnnouncement = async () => { if (!newAnnouncement.trim()) return; await addDoc(collection(db, "announcements"), { content: newAnnouncement.trim(), createdAt: serverTimestamp(), active: true }); setNewAnnouncement(""); };
  const deleteAnnouncement = async (id) => { await deleteDoc(doc(db, "announcements", id)); };
  const addCategory = async () => {
    const id = newCatLabel.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
    if (!id || allCategories.find(c => c.id === id)) return;
    const newCat = { id, label: `#${id}`, color: newCatColor };
    const updated = [...allCategories, newCat];
    setAllCategories(updated);
    await setDoc(doc(db, "settings", "categories"), { list: updated });
    setNewCatLabel("");
  };
  const removeCategory = async (id) => {
    const updated = allCategories.filter(c => c.id !== id);
    setAllCategories(updated);
    await setDoc(doc(db, "settings", "categories"), { list: updated });
  };

  const pending = reports.filter(r => r.status === "pending");
  const banned = users.filter(u => u.banned);

  // Chart data — posts per day last 7 days
  const chartData = (() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en", { weekday: "short" });
      const count = posts.filter(p => {
        const pd = p.createdAt?.toDate?.();
        if (!pd) return false;
        return pd.toDateString() === d.toDateString();
      }).length;
      days.push({ label, count });
    }
    return days;
  })();
  const maxVal = Math.max(...chartData.map(d => d.count), 1);

  return (
    <div className="admin-page fade-in">
      <div className="admin-header">
        <div className="admin-title">⚙️ Admin Panel</div>
        <div className="admin-subtitle">Logged in as {currentUser.username}</div>
      </div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--accent)" }}>{posts.length}</div><div className="stat-label">Total Posts</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--warn)" }}>{pending.length}</div><div className="stat-label">Pending Reports</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--danger)" }}>{banned.length}</div><div className="stat-label">Banned Users</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--success)" }}>{users.length}</div><div className="stat-label">Total Users</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--accent2)" }}>{bannedWords.length}</div><div className="stat-label">Blocked Keywords</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--warn)" }}>{announcements.filter(a => a.active).length}</div><div className="stat-label">Announcements</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--accent)" }}>{supportMsgs.filter(m => m.status === "open").length}</div><div className="stat-label">Support Msgs</div></div>
      </div>
      <div className="tabs admin-tabs-desktop" style={{ marginBottom: 24 }}>
        {[["dashboard","📊 Dashboard"],["reports","🚨 Reports"],["posts","📝 Posts"],["users","👥 Users"],["duplicates","🔍 Duplicate Devices"],["keywords","🚫 Keywords"],["categories","🏷️ Categories"],["announcements","📢 Announcements"],["support","💬 Support"],["devices","🖥️ Device Bans"]].map(([id, label]) =>
          <button key={id} className={`tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}</button>
        )}
      </div>
      {/* Mobile: dropdown instead of tabs */}
      <select className="admin-tabs-mobile" value={tab} onChange={e => setTab(e.target.value)}>
        {[["dashboard","📊 Dashboard"],["reports","🚨 Reports"],["posts","📝 Posts"],["users","👥 Users"],["duplicates","🔍 Duplicate Devices"],["keywords","🚫 Keywords"],["categories","🏷️ Categories"],["announcements","📢 Announcements"],["support","💬 Support"],["devices","🖥️ Device Bans"]].map(([id, label]) =>
          <option key={id} value={id}>{label}</option>
        )}
      </select>

      {tab === "dashboard" && (
        <div>
          <div className="chart-wrap">
            <div className="chart-title">Posts Per Day (Last 7 Days)</div>
            <div className="bar-chart">
              {chartData.map((d, i) => (
                <div key={i} className="bar-item">
                  <div className="bar-val">{d.count}</div>
                  <div className="bar" style={{ height: `${Math.max(4, (d.count / maxVal) * 100)}px` }} />
                  <div className="bar-label">{d.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="card card-pad">
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 12 }}>🔥 Most Reported Posts</div>
              {reports.filter(r => r.type === "post" && r.status === "pending").slice(0, 5).map(r => (
                <div key={r.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--muted)" }}>
                  <span className="badge badge-danger">Post</span> {r.reason} — <span style={{ fontSize: 11, fontFamily: "monospace" }}>{r.targetId?.slice(0, 8)}</span>
                </div>
              ))}
              {reports.filter(r => r.type === "post" && r.status === "pending").length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No pending post reports</div>}
            </div>
            <div className="card card-pad">
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 12 }}>⚠️ Recently Banned</div>
              {banned.slice(0, 5).map(u => (
                <div key={u.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar username={u.username} /><div><div>{u.username}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{u.banReason}</div></div>
                </div>
              ))}
              {banned.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No banned users</div>}
            </div>
          </div>
          {/* Maintenance Mode Toggle */}
          <div className="card card-pad" style={{ marginTop: 20, border: maintenance ? "1px solid rgba(239,68,68,0.4)" : "1px solid var(--border)", background: maintenance ? "rgba(239,68,68,0.04)" : undefined }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
                  🔒 Maintenance Mode {maintenance && <span className="badge badge-danger" style={{ marginLeft: 8 }}>ACTIVE</span>}
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
                  When ON, the site shows a maintenance screen to all regular users. You (admin) can still access everything normally.
                </div>
              </div>
              <button
                onClick={toggleMaintenance}
                className={maintenance ? "btn btn-danger" : "btn btn-ghost"}
                style={{ minWidth: 140, justifyContent: "center" }}
              >
                {maintenance ? "🔴 Turn Off" : "🔒 Enable Maintenance"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "reports" && (
        <div className="card"><div className="table-wrap admin-table-wrap"><table>
          <thead><tr><th>Type</th><th>Reason</th><th>Status</th><th>Time</th><th>Actions</th></tr></thead>
          <tbody>
            {reports.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>No reports yet</td></tr>}
            {reports.map(r => (
              <tr key={r.id}>
                <td><span className="badge badge-purple">{r.type}</span></td>
                <td>{r.reason}</td>
                <td><span className={`badge ${r.status === "pending" ? "badge-warn" : r.status === "resolved" ? "badge-success" : "badge-danger"}`}>{r.status}</span></td>
                <td style={{ color: "var(--muted)" }}>{timeAgo(r.createdAt)}</td>
                <td>{r.status === "pending" && <div style={{ display: "flex", gap: 6 }}><button className="btn btn-primary btn-sm" onClick={() => resolveReport(r.id)}>Resolve</button><button className="btn btn-ghost btn-sm" onClick={() => dismissReport(r.id)}>Dismiss</button></div>}</td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}

      {tab === "posts" && (
        <div className="card"><div className="table-wrap admin-table-wrap"><table>
          <thead><tr><th>ID</th><th>User</th><th>Content</th><th>Likes</th><th>Comments</th><th>Actions</th></tr></thead>
          <tbody>
            {posts.map(p => (
              <tr key={p.id}>
                <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>{p.postId}</td>
                <td>{p.username}</td>
                <td style={{ maxWidth: 200 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.content}</div></td>
                <td>{p.likes}</td><td>{p.commentCount}</td>
                <td><div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-danger btn-sm" onClick={() => deletePost(p.id)}>Delete</button>
                  <button className="btn btn-warn btn-sm" onClick={() => updateDoc(doc(db, "posts", p.id), { pinned: !p.pinned })}>{p.pinned ? "Unpin" : "Pin"}</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}

      {tab === "users" && (
        <div className="card"><div className="table-wrap admin-table-wrap"><table>
          <thead><tr><th>Display Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Seen</th><th>Device FP</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map(u => {
              const lastSeen = u.lastSeen?.toDate?.();
              const minsAgo = lastSeen ? (Date.now() - lastSeen.getTime()) / 60000 : null;
              const isOnline = minsAgo !== null && minsAgo < 3; // online if seen within last 3 mins
              const status = u.banned
                ? { label: "Banned", cls: "badge-danger" }
                : isOnline
                  ? { label: "🟢 Online", cls: "badge-success" }
                  : { label: "⚫ Offline", cls: "badge-ghost" };
              const lastSeenText = minsAgo === null
                ? "Never"
                : isOnline
                  ? "Now"
                  : timeAgo(u.lastSeen);
              const fpCount = u.deviceFingerprint ? users.filter(x => x.deviceFingerprint === u.deviceFingerprint).length : 0;
              return (
                <tr key={u.id}>
                  <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar username={u.username} />{u.username}</div></td>
                  <td style={{ fontSize: 11, color: "var(--muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email || "—"}</td>
                  <td><span className={`badge ${u.role === "admin" ? "badge-purple" : "badge-success"}`}>{u.role || "user"}</span></td>
                  <td>
                    <span className={`badge ${status.cls}`}>{status.label}</span>
                    {u.banned && u.banUntil && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Until: {u.banUntil.toDate?.().toLocaleDateString()}</div>}
                    {u.banned && u.banReason && <div style={{ fontSize: 11, color: "var(--muted)" }}>{u.banReason}</div>}
                  </td>
                  <td style={{ color: isOnline ? "var(--accent2)" : "var(--muted)", fontSize: 12, fontWeight: isOnline ? 600 : 400 }}>{lastSeenText}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 10, color: fpCount > 1 ? "#fca5a5" : "var(--muted)" }}>{u.deviceFingerprint || "—"}</span>
                      {fpCount > 1 && <span className="badge badge-danger" style={{ fontSize: 10 }}>{fpCount} accts</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {u.uid !== currentUser.uid && (u.banned
                        ? <button className="btn btn-ghost btn-sm" onClick={() => unbanUser(u)}>Unban</button>
                        : <button className="btn btn-danger btn-sm" onClick={() => { setBanModal(u); setBanDuration("1"); setBanUnit("days"); setBanReason(""); }}>Ban</button>
                      )}
                      {fpCount > 1 && <button className="btn btn-warn btn-sm" onClick={() => setTab("duplicates")}>View Dupes</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div></div>
      )}

      {tab === "duplicates" && (() => {
        const fpGroups = {};
        users.forEach(u => {
          if (!u.deviceFingerprint) return;
          if (!fpGroups[u.deviceFingerprint]) fpGroups[u.deviceFingerprint] = [];
          fpGroups[u.deviceFingerprint].push(u);
        });
        const duplicateGroups = Object.entries(fpGroups)
          .filter(([, group]) => group.length > 1)
          .map(([fp, group]) => ({
            fp,
            accounts: [...group].sort((a, b) => {
              const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
              const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
              return aTime - bTime;
            }),
          }));

        const banDuplicates = async (group) => {
          const toBan = group.accounts.slice(1).filter(u => u.uid !== currentUser.uid && !u.banned);
          if (toBan.length === 0) { alert("No unbanned duplicate accounts to ban in this group."); return; }
          if (!window.confirm(`Ban ${toBan.length} duplicate account(s) from this device? The original (oldest) account will be kept.`)) return;
          for (const u of toBan) {
            const banUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            await updateDoc(doc(db, "users", u.id), { banned: true, banUntil: Timestamp.fromDate(banUntil), banReason: "Duplicate account — only one account per device is allowed." });
            await addDoc(collection(db, "notifications"), { toUid: u.uid, type: "ban", message: "Your account has been banned: multiple accounts from the same device are not allowed.", createdAt: serverTimestamp(), read: false });
          }
          const alreadyBanned = await getDocs(query(collection(db, "deviceBans"), where("fingerprint", "==", group.fp)));
          if (alreadyBanned.empty) {
            await addDoc(collection(db, "deviceBans"), { fingerprint: group.fp, reason: "Duplicate account creation", createdAt: serverTimestamp() });
          }
          alert(`Done. ${toBan.length} duplicate account(s) banned.`);
        };

        return (
          <div>
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, marginBottom: 6 }}>🔍 Duplicate Devices</div>
              <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>
                Devices that have created more than one account. The <strong style={{ color: "var(--accent2)" }}>oldest account</strong> is treated as the original.
                "Ban Duplicates" bans all newer accounts and blocks that device fingerprint from signing up again.
              </div>
            </div>
            {duplicateGroups.length === 0 ? (
              <div className="empty"><div className="empty-icon">✅</div><div className="empty-text">No duplicate devices found. All clear.</div></div>
            ) : (
              duplicateGroups.map(group => (
                <div key={group.fp} className="card card-pad" style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)", marginBottom: 6 }}>Device: {group.fp}</div>
                      <span className="badge badge-danger">{group.accounts.length} accounts from this device</span>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => banDuplicates(group)}>
                      🔨 Ban Duplicates (keep oldest)
                    </button>
                  </div>
                  <div className="table-wrap admin-table-wrap"><table>
                    <thead><tr><th>Display Name</th><th>Email</th><th>Joined</th><th>Status</th><th>Note</th><th>Action</th></tr></thead>
                    <tbody>
                      {group.accounts.map((u, i) => (
                        <tr key={u.id} style={{ background: i === 0 ? "rgba(6,182,212,0.05)" : "rgba(239,68,68,0.05)" }}>
                          <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar username={u.username} />{u.username}</div></td>
                          <td style={{ fontSize: 11, color: "var(--muted)" }}>{u.email || "—"}</td>
                          <td style={{ fontSize: 12, color: "var(--muted)" }}>{timeAgo(u.createdAt)}</td>
                          <td><span className={`badge ${u.banned ? "badge-danger" : "badge-success"}`}>{u.banned ? "Banned" : "Active"}</span></td>
                          <td>{i === 0
                            ? <span style={{ fontSize: 11, color: "var(--accent2)", fontWeight: 700 }}>⭐ Original</span>
                            : <span style={{ fontSize: 11, color: "#fca5a5", fontWeight: 700 }}>⚠️ Duplicate</span>}
                          </td>
                          <td>
                            {u.uid !== currentUser.uid && !u.banned && i !== 0 && (
                              <button className="btn btn-danger btn-sm" onClick={() => { setBanModal(u); setBanDuration("30"); setBanUnit("days"); setBanReason("Duplicate account — only one account per device is allowed."); }}>Ban</button>
                            )}
                            {u.uid !== currentUser.uid && u.banned && (
                              <button className="btn btn-ghost btn-sm" onClick={() => unbanUser(u)}>Unban</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </div>
              ))
            )}
          </div>
        );
      })()}

      {tab === "keywords" && (
        <div className="card card-pad">
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 12 }}>Blocked Keywords</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input className="inline-input" placeholder="Add keyword..." value={newWord} onChange={e => setNewWord(e.target.value)} onKeyDown={e => e.key === "Enter" && addBannedWord()} style={{ maxWidth: 300 }} />
            <button className="btn btn-primary" onClick={addBannedWord}>Add</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {bannedWords.map(w => (
              <span key={w} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", padding: "4px 12px", borderRadius: 20, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                {w}<button onClick={() => removeBannedWord(w)} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 14 }}>✕</button>
              </span>
            ))}
          </div>
          <div className="alert alert-success" style={{ marginTop: 16 }}>✅ Keywords are saved permanently to Firebase.</div>
        </div>
      )}

      {tab === "categories" && (
        <div className="card card-pad">
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 16 }}>Custom Categories</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <input className="inline-input" placeholder="Category name (e.g. gaming)" value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} style={{ maxWidth: 200 }} />
            <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} style={{ width: 44, height: 40, border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", background: "none" }} />
            <button className="btn btn-primary" onClick={addCategory}>Add Category</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {allCategories.map(c => (
              <span key={c.id} style={{ background: c.color + "22", border: `1px solid ${c.color}44`, color: c.color, padding: "6px 14px", borderRadius: 20, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                {c.label}
                {!DEFAULT_CATEGORIES.find(d => d.id === c.id) && <button onClick={() => removeCategory(c.id)} style={{ background: "none", border: "none", color: c.color, cursor: "pointer", fontSize: 13 }}>✕</button>}
              </span>
            ))}
          </div>
        </div>
      )}

      {tab === "announcements" && (
        <div>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 12 }}>Post Announcement</div>
            <textarea className="compose-area" placeholder="Write a site-wide announcement..." value={newAnnouncement} onChange={e => setNewAnnouncement(e.target.value)} style={{ minHeight: 80, marginBottom: 12 }} />
            <button className="btn btn-primary" onClick={postAnnouncement} disabled={!newAnnouncement.trim()}>📢 Post Announcement</button>
          </div>
          <div>
            {announcements.map(a => (
              <div key={a.id} className="card card-pad" style={{ marginBottom: 12, border: "1px solid rgba(245,158,11,0.3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div><div style={{ fontSize: 14, marginBottom: 6 }}>{a.content}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{timeAgo(a.createdAt)}</div></div>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteAnnouncement(a.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {tab === "devices" && (
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Banned Devices ({deviceBans.length})</div>
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            Device fingerprints are stored when a user is banned. New signups from matching devices are blocked automatically. This covers ~90% of casual ban evasion attempts.
          </div>
          {deviceBans.length === 0 ? (
            <div className="empty"><div className="empty-icon">🖥️</div><div className="empty-text">No device bans yet. Banning a user also bans their device.</div></div>
          ) : (
            <div className="card"><div className="table-wrap admin-table-wrap"><table>
              <thead><tr><th>Username</th><th>Fingerprint</th><th>Reason</th><th>Expires</th><th>Actions</th></tr></thead>
              <tbody>
                {deviceBans.map(b => (
                  <tr key={b.id}>
                    <td><strong>{b.bannedUsername}</strong></td>
                    <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>{b.fingerprint}</td>
                    <td>{b.reason}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{b.banUntil?.toDate?.().toLocaleDateString() || "Permanent"}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => deleteDoc(doc(db, "deviceBans", b.id))}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table></div></div>
          )}
        </div>
      )}

      {tab === "support" && (
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, marginBottom: 16 }}>
            User Support Messages ({supportMsgs.filter(m => m.status === "open").length} open)
          </div>
          {supportMsgs.length === 0 ? (
            <div className="empty"><div className="empty-icon">💬</div><div className="empty-text">No support messages yet</div></div>
          ) : supportMsgs.map(m => (
            <div key={m.id} className="card card-pad" style={{ marginBottom: 12, border: m.status === "open" ? "1px solid rgba(124,58,237,0.3)" : "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                    <Avatar username={m.username} />
                    <strong>{m.username}</strong>
                    <span className={`badge ${m.status === "open" ? "badge-purple" : "badge-success"}`}>{m.status}</span>
                    <span className="badge badge-cyan">{m.subject}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{timeAgo(m.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, paddingLeft: 44 }}>{m.message}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {m.status === "open" && (
                    <button className="btn btn-primary btn-sm" onClick={() => updateDoc(doc(db, "support", m.id), { status: "resolved" })}>Mark Resolved</button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={() => deleteDoc(doc(db, "support", m.id))}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ban Modal */}
      {banModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card card-pad" style={{ width: 420, maxWidth: "90vw" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, marginBottom: 4 }}>🚫 Ban User</div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>Banning <strong style={{ color: "var(--text)" }}>{banModal.username}</strong></div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6, fontWeight: 600 }}>Duration</label>
              <div style={{ display: "flex", gap: 10 }}>
                <input type="number" min="1" value={banDuration} onChange={e => setBanDuration(e.target.value)} className="inline-input" style={{ width: 80 }} />
                <select value={banUnit} onChange={e => setBanUnit(e.target.value)} className="category-select" style={{ flex: 1 }}>
                  <option value="hours">Hours</option><option value="days">Days</option><option value="weeks">Weeks</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6, fontWeight: 600 }}>Reason (shown to user)</label>
              <input className="inline-input" placeholder="e.g. Spam, harassment..." value={banReason} onChange={e => setBanReason(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmBan}>Confirm Ban</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setBanModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BOOKMARKS PAGE ───────────────────────────────────────────────────────────
// --- PROFILE PAGE -------------------------------------------------------------
function ProfilePage({ currentUser, allCategories, bannedWords, isAdmin }) {
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
        <div className="empty"><div className="empty-icon">📝</div><div className="empty-text">You haven't posted anything yet.</div></div>
      ) : (
        <div className="card">
          {sorted.map(p => {
            const cat = allCategories.find(c => c.id === p.category);
            const reactionCount = Object.values(p.reactions || {}).reduce((a, b) => a + b, 0);
            return (
              <div key={p.id} className="profile-post" onClick={() => setOpenPost(p)}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                  {cat && <span className="category-tag" style={{ background: cat.color + "22", color: cat.color }}>{cat.label}</span>}
                  {p.pinned && <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>📌 Pinned</span>}
                  {p.disappearing && <span style={{ fontSize: 11, color: "var(--accent2)" }}>⏳ Disappearing</span>}
                  <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>{timeAgo(p.createdAt)}</span>
                  <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "monospace" }}>{p.postId}</span>
                </div>
                {p.poll && <div style={{ fontSize: 12, color: "var(--accent)", marginBottom: 6, fontWeight: 600 }}>🗳️ Poll: {p.poll.labels.join(" vs ")}</div>}
                <div className="profile-post-content">{p.content}</div>
                <div className="profile-post-stats">
                  <span className="profile-post-stat" style={{ color: p.likes > 0 ? "#ef4444" : "var(--muted)" }}>♥ {p.likes || 0} likes</span>
                  <span className="profile-post-stat">💬 {p.commentCount || 0} comments</span>
                  {reactionCount > 0 && <span className="profile-post-stat">😊 {reactionCount} reactions</span>}
                  {p.edited && <span className="profile-post-stat" style={{ color: "var(--muted)" }}>✏️ edited</span>}
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

function BookmarksPage({ currentUser, bookmarks, allCategories, bannedWords, isAdmin }) {
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
      <div className="bookmarks-title">🔖 Bookmarks ({posts.length})</div>
      {posts.length === 0 ? <div className="empty"><div className="empty-icon">🔖</div><div className="empty-text">No bookmarks yet. Tap 🏷️ on any post to save it.</div></div> :
        posts.map(p => <PostCard key={p.id} post={p} currentUser={currentUser} onOpen={() => setOpenPost(p)} allCategories={allCategories} onBookmark={() => {}} isBookmarked={true} isAdmin={isAdmin} />)}
      {openPost && <PostModal post={openPost} currentUser={currentUser} onClose={() => setOpenPost(null)} allCategories={allCategories} bannedWords={bannedWords} isAdmin={isAdmin} />}
    </div>
  );
}

// ─── MAIN FEED ────────────────────────────────────────────────────────────────
function Feed({ currentUser, isAdmin, theme, toggleTheme, maintenanceMode }) {
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
  const [globalTrending, setGlobalTrending] = useState([]);       // platform-wide top by score
  const [globalMostCommented, setGlobalMostCommented] = useState([]); // platform-wide top by comments
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

  // Heartbeat — writes lastSeen every 2 minutes so admin panel shows accurate online status
  useEffect(() => {
    const write = () => updateDoc(doc(db, "users", currentUser.uid), { lastSeen: serverTimestamp() });
    write(); // write immediately on load
    const interval = setInterval(write, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser.uid]);

  // Categories via live onSnapshot — admin changes appear everywhere instantly
  useEffect(() => {
    const unsubCats = onSnapshot(doc(db, "settings", "categories"), snap => {
      if (snap.exists() && snap.data().list) setAllCategories(snap.data().list);
    });
    getDoc(doc(db, "settings", "keywords")).then(snap => { if (snap.exists() && snap.data().words) setBannedWords(snap.data().words); });
    const unsubAnnounce = onSnapshot(query(collection(db, "announcements"), orderBy("createdAt", "desc")), snap =>
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.active !== false))
    );
    // Platform-wide trending — top 20 by score across ALL posts, live
    const unsubTrending = onSnapshot(
      query(collection(db, "posts"), where("deleted", "==", false), orderBy("score", "desc"), limit(20)),
      snap => setGlobalTrending(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    // Platform-wide most discussed — top 20 by commentCount across ALL posts, live
    const unsubMostCommented = onSnapshot(
      query(collection(db, "posts"), where("deleted", "==", false), orderBy("commentCount", "desc"), limit(20)),
      snap => setGlobalMostCommented(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubCats(); unsubAnnounce(); unsubTrending(); unsubMostCommented(); };
  }, []);

  // ── Build a base Firestore query (no cursor) ────────────────────────────────
  const buildBaseQuery = useCallback((cat) => {
    if (cat) return query(collection(db, "posts"), where("deleted", "==", false), where("category", "==", cat), orderBy("createdAt", "desc"), limit(PAGE_SIZE + 1));
    return query(collection(db, "posts"), where("deleted", "==", false), orderBy("createdAt", "desc"), limit(PAGE_SIZE + 1));
  }, []);

  // ── Live listener for current page — likes/reactions/new posts update instantly ─
  useEffect(() => {
    setLoading(true);
    setHasNewer(false);
    setPageNum(1);
    const q = buildBaseQuery(activeCategory);
    const unsub = onSnapshot(q, snap => {
      const now = Date.now();
      const docs = snap.docs;
      const items = docs.slice(0, PAGE_SIZE)
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => !p.disappearing || (now - (p.createdAt?.toDate?.()?.getTime?.() || 0)) < DISAPPEAR_MS);
      setPosts(items);
      setFirstDoc(docs[0] || null);
      setLastDoc(docs[PAGE_SIZE - 1] || null);
      setHasOlder(docs.length > PAGE_SIZE);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [activeCategory, buildBaseQuery]);

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

  // ── Load NEWER posts (previous page going forward in time) ──────────────────
  const loadNewerPosts = async () => {
    if (!firstDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      // Query in ascending order from firstDoc to get posts newer than current page
      let q;
      if (activeCategory) q = query(collection(db, "posts"), where("deleted", "==", false), where("category", "==", activeCategory), orderBy("createdAt", "asc"), startAfter(firstDoc), limit(PAGE_SIZE + 1));
      else q = query(collection(db, "posts"), where("deleted", "==", false), orderBy("createdAt", "asc"), startAfter(firstDoc), limit(PAGE_SIZE + 1));
      const snap = await getDocs(q);
      const now = Date.now();
      const docs = snap.docs.reverse(); // flip back to newest-first
      const items = docs.slice(0, PAGE_SIZE)
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => !p.disappearing || (now - (p.createdAt?.toDate?.()?.getTime?.() || 0)) < DISAPPEAR_MS);
      if (items.length === 0) {
        // Already at the newest page — reload from top
        const fresh = buildBaseQuery(activeCategory);
        const freshSnap = await getDocs(fresh);
        const freshDocs = freshSnap.docs;
        const freshItems = freshDocs.slice(0, PAGE_SIZE)
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => !p.disappearing || (now - (p.createdAt?.toDate?.()?.getTime?.() || 0)) < DISAPPEAR_MS);
        setPosts(freshItems);
        setFirstDoc(freshDocs[0] || null);
        setLastDoc(freshDocs[PAGE_SIZE - 1] || null);
        setHasOlder(freshDocs.length > PAGE_SIZE);
        setHasNewer(false);
        setPageNum(1);
      } else {
        setPosts(items);
        setFirstDoc(docs[0] || null);
        setLastDoc(docs[Math.min(PAGE_SIZE - 1, docs.length - 1)] || null);
        setHasOlder(true);
        setHasNewer(docs.length > PAGE_SIZE);
        setPageNum(n => Math.max(1, n - 1));
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
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

            <ComposePost currentUser={currentUser} allCategories={allCategories} bannedWords={bannedWords} />
            <div className="section-tabs">
              {[["latest","Latest"],["trending","🔥 Trending"],["mostCommented","💬 Most Discussed"]].map(([id, label]) =>
                <button key={id} className={`section-tab ${section === id ? "active" : ""}`} onClick={() => setSection(id)}>{label}</button>
              )}
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
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [authUser, setAuthUser] = useState(null); const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true); const [banMessage, setBanMessage] = useState(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [theme, setTheme] = useState(getTheme());

  const toggleTheme = () => { const t = theme === "dark" ? "light" : "dark"; setTheme(t); setThemeStorage(t); };

  useEffect(() => {
    // Listen for maintenance mode changes in real time — always update so live toggle works instantly
    const unsubMaintenance = onSnapshot(doc(db, "settings", "maintenance"), snap => {
      setMaintenanceMode(snap.exists() ? (snap.data().enabled || false) : false);
    });
    return unsubMaintenance;
  }, []);

  useEffect(() => {
    let unsubProfile = () => {};

    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      // Clean up any previous profile listener
      unsubProfile();

      if (user) {
        // Live listener on user's own doc — ban/unban takes effect instantly
        unsubProfile = onSnapshot(doc(db, "users", user.uid), async (snap) => {
          if (!snap.exists()) { setProfile(null); setLoading(false); return; }
          const data = snap.data();

          if (data.banned) {
            if (data.banUntil) {
              const expiry = data.banUntil.toDate ? data.banUntil.toDate() : new Date(data.banUntil);
              if (Date.now() > expiry.getTime()) {
                // Ban expired — lift it automatically
                await updateDoc(snap.ref, { banned: false, banUntil: null, banReason: null });
                setProfile({ ...data, banned: false });
                setBanMessage(null);
              } else {
                setBanMessage(`Your account has been temporarily banned.\n\nReason: ${data.banReason || "Violation of guidelines"}\n\nExpires: ${expiry.toLocaleDateString()} at ${expiry.toLocaleTimeString()}`);
                setProfile(null);
              }
            } else {
              setBanMessage(`Your account has been permanently banned.\n\nReason: ${data.banReason || "Violation of guidelines"}\n\nContact support if you believe this is a mistake.`);
              setProfile(null);
            }
          } else {
            // Patch old accounts missing new fields
            const needsPatch = data.bookmarks === undefined || data.firstPostDone === undefined || data.postCount === undefined;
            if (needsPatch) {
              const patch = {};
              if (data.bookmarks === undefined) patch.bookmarks = [];
              if (data.firstPostDone === undefined) patch.firstPostDone = false;
              if (data.postCount === undefined) patch.postCount = 0;
              if (data.lastPostAt === undefined) patch.lastPostAt = null;
              await updateDoc(snap.ref, patch);
              setProfile({ ...data, ...patch });
            } else {
              setProfile(data);
            }
            setBanMessage(null); // Instantly lets them back in if admin unbans while active
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }

      // Await maintenance so correct screen shows immediately on login — no flash
      try {
        const mSnap = await getDoc(doc(db, "settings", "maintenance"));
        setMaintenanceMode(mSnap.exists() ? (mSnap.data().enabled || false) : false);
      } catch (_) {}
    });

    return () => { unsub(); unsubProfile(); };
  }, []);

  if (loading) return <><StyleTag theme={theme} /><div className="loading-screen"><div className="loading-logo">wh<span style={{ color: "var(--accent)" }}>i</span>spr</div><Spinner /></div></>;

  if (banMessage) return (
    <>
      <StyleTag theme={theme} />
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card card-pad" style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, marginBottom: 8, color: "var(--danger)" }}>Account Banned</div>
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: 20, marginBottom: 20, textAlign: "left" }}>
            {banMessage.split("\n").map((line, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.7, color: line.startsWith("Reason:") || line.startsWith("Expires:") ? "var(--text)" : "var(--muted)" }}>{line}</div>)}
          </div>
          <button className="btn btn-ghost" style={{ width: "100%" }} onClick={() => setBanMessage(null)}>← Back to Login</button>
        </div>
      </div>
    </>
  );

  // Show maintenance screen to non-admin users when maintenance is on
  if (maintenanceMode && authUser && profile && profile.role !== "admin") return (
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

  if (!authUser || !profile) return (
    <>
      <StyleTag theme={theme} />
      {maintenanceMode ? (
        <div className="maintenance-screen" style={{ background: "var(--bg)" }}>
          <div className="maintenance-icon">🔧</div>
          <div className="maintenance-title">Under Maintenance</div>
          <div className="maintenance-sub">Whispr is currently undergoing scheduled maintenance. We'll be back shortly!</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>— The Whispr Team</div>
        </div>
      ) : (
        <AuthPage theme={theme} toggleTheme={toggleTheme} onSignupSuccess={(p) => { setAuthUser(auth.currentUser); setProfile(p); }} />
      )}
    </>
  );
  return <Feed currentUser={profile} isAdmin={profile.role === "admin"} theme={theme} toggleTheme={toggleTheme} maintenanceMode={maintenanceMode} />;
}

/*
══════════════════════════════════════════════════
  FIRESTORE SECURITY RULES
  (Paste into Firebase Console → Firestore → Rules)
══════════════════════════════════════════════════

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'; }
    function isSignedIn() { return request.auth != null; }
    function notBanned() { return !get(/databases/$(database)/documents/users/$(request.auth.uid)).data.banned; }

    match /users/{userId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && request.resource.data.uid == request.auth.uid;
      allow update: if isSignedIn() && (request.auth.uid == userId || isAdmin())
                    && request.resource.data.uid == resource.data.uid  // can't change uid
                    && request.resource.data.role == resource.data.role // can't self-promote role
                    && request.resource.data.email == resource.data.email; // can't change email
    }
    match /posts/{postId} {
      allow read: if true;
      allow create: if isSignedIn() && notBanned()
                    && request.resource.data.uid == request.auth.uid  // must be your own post
                    && request.resource.data.content is string
                    && request.resource.data.content.size() <= 2000    // max post length
                    && request.resource.data.deleted == false
                    && request.resource.data.pinned == false;          // can't self-pin
      // Admin can update anything (pin, delete flag, etc.)
      allow update: if isAdmin();
      // Owner can only edit their post's text content — nothing else
      allow update: if isSignedIn() && notBanned()
                    && resource.data.uid == request.auth.uid
                    && request.resource.data.uid == resource.data.uid
                    && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['content', 'edited', 'editedAt']);
      // Any signed-in user can update social fields (likes, reactions, comments, reports)
      allow update: if isSignedIn() && notBanned()
                    && request.resource.data.uid == resource.data.uid  // can't change owner
                    && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['likes', 'likedBy', 'reactions', 'userReactions',
                                 'commentCount', 'reported', 'deleted', 'disappearsAt',
                                 'poll', 'score']);
      allow delete: if isAdmin();
    }
    match /comments/{commentId} {
      allow read: if true;
      allow create: if isSignedIn() && notBanned()
                    && request.resource.data.uid == request.auth.uid
                    && request.resource.data.text is string
                    && request.resource.data.text.size() <= 1000;      // max comment length
      allow update: if isSignedIn() && notBanned()
                    && resource.data.uid == request.auth.uid
                    && request.resource.data.uid == resource.data.uid;
      allow delete: if isSignedIn() && (request.auth.uid == resource.data.uid || isAdmin());
    }
    match /reports/{reportId} {
      allow read: if isAdmin();
      allow create: if isSignedIn()
                    && request.resource.data.reporterUid == request.auth.uid
                    && request.resource.data.reason is string
                    && request.resource.data.reason.size() <= 500;
      allow update: if isAdmin();
    }
    match /notifications/{notifId} {
      allow read: if isSignedIn() && (resource == null || resource.data.toUid == request.auth.uid);
      allow create: if isSignedIn();
      allow update: if isSignedIn() && resource.data.toUid == request.auth.uid;
      allow delete: if isSignedIn() && resource.data.toUid == request.auth.uid;
    }
    match /announcements/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /settings/{id} {
      // bypassEmails is sensitive — only admins can read or write it
      allow read: if id == "bypassEmails" ? isSignedIn() : true;
      allow write: if isAdmin();
    }
    match /support/{id} {
      allow read: if isAdmin();
      allow create: if isSignedIn()
                    && request.resource.data.uid == request.auth.uid
                    && request.resource.data.message is string
                    && request.resource.data.message.size() <= 2000;
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }
    match /deviceBans/{id} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }
  }
}
  */