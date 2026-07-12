export const DEFAULT_CATEGORIES = [
  { id: "confessions", label: "#confessions", color: "#ff6b6b" },
  { id: "school", label: "#school", color: "#4ecdc4" },
  { id: "relationships", label: "#relationships", color: "#ff8fab" },
  { id: "work", label: "#work", color: "#ffd93d" },
  { id: "rants", label: "#rants", color: "#ff9f43" },
  { id: "advice", label: "#advice", color: "#a29bfe" },
  { id: "secrets", label: "#secrets", color: "#fd79a8" },
  { id: "random", label: "#random", color: "#74b9ff" },
];

export const REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👀"];

export const DEFAULT_BANNED_KEYWORDS = [
  "nigger", "faggot", "kill yourself", "kys", "rape", "terrorist",
  "bomb threat", "suicide method", "how to make a bomb",
];

// ─── ADMIN NOTE ───────────────────────────────────────────────────────────────
// Admin role is set directly in Firebase Console → Firestore → users → your doc → role: "admin"
// Bypass emails (can create multiple accounts) are stored in Firestore:
//   settings/bypassEmails → { emails: ["you@undergraduate.mcu.edu.ng", ...] }
// Only admins can read/write that document (see Firestore rules).

export const POST_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
export const DISAPPEAR_MS = 24 * 60 * 60 * 1000; // 24 hours
export const EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 mins to edit post
