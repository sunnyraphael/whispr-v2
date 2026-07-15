// Shared inline SVG icon set — lucide-style outline icons, 1.5-2px stroke.
// Centralized here so every redesigned component uses the exact same icons,
// instead of each file pasting its own SVG (which drifts over time).
// Usage: <Icon.Heart size={14} filled />

const base = (size, strokeWidth = 2) => ({
  width: size, height: size, viewBox: "0 0 24 24",
  fill: "none", stroke: "currentColor", strokeWidth,
  strokeLinecap: "round", strokeLinejoin: "round",
});

export const Icon = {
  Heart: ({ size = 14, filled = false }) => (
    <svg {...base(size)} fill={filled ? "currentColor" : "none"}>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  ),
  Message: ({ size = 14 }) => (
    <svg {...base(size)}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Bookmark: ({ size = 14, filled = false }) => (
    <svg {...base(size)} fill={filled ? "currentColor" : "none"}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Pin: ({ size = 12, filled = true }) => (
    <svg {...base(size)} fill={filled ? "currentColor" : "none"}>
      <path d="M12 2l2.4 7.4H22l-6 4.6L18.2 22 12 17.3 5.8 22 8 14 2 9.4h7.6z" />
    </svg>
  ),
  Clock: ({ size = 12 }) => (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  ),
  Edit: ({ size = 12 }) => (
    <svg {...base(size)}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
    </svg>
  ),
  Trash: ({ size = 12 }) => (
    <svg {...base(size)}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
    </svg>
  ),
  Flag: ({ size = 12 }) => (
    <svg {...base(size)}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22V15" />
    </svg>
  ),
  X: ({ size = 12 }) => (
    <svg {...base(size)}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  Search: ({ size = 14 }) => (
    <svg {...base(size)}>
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
    </svg>
  ),
  Sun: ({ size = 15 }) => (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
    </svg>
  ),
  Moon: ({ size = 15 }) => (
    <svg {...base(size)}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
    </svg>
  ),
  Bell: ({ size = 15 }) => (
    <svg {...base(size)}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  Chat: ({ size = 15 }) => (
    <svg {...base(size)}>
      <path d="M4 4h16v12H7l-3 3z" />
    </svg>
  ),
  User: ({ size = 14 }) => (
    <svg {...base(size)}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Settings: ({ size = 14 }) => (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  RefreshCw: ({ size = 14 }) => (
    <svg {...base(size)}>
      <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  ),
  Copy: ({ size = 12 }) => (
    <svg {...base(size)}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Smartphone: ({ size = 13 }) => (
    <svg {...base(size)}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </svg>
  ),
  Info: ({ size = 14 }) => (
    <svg {...base(size)}>
      <path d="M12 2l9 4.5v6.5c0 4.7-3.4 9-9 10-5.6-1-9-5.3-9-10V6.5z" />
    </svg>
  ),
  AlertTriangle: ({ size = 12 }) => (
    <svg {...base(size)}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  ),
  BarChart: ({ size = 12 }) => (
    <svg {...base(size)}>
      <path d="M3 3v18h18" /><path d="M7 16l4-6 4 4 5-8" />
    </svg>
  ),
  Smile: ({ size = 12 }) => (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01M15 9h.01" />
    </svg>
  ),
  FileText: ({ size = 15 }) => (
    <svg {...base(size)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h6" />
    </svg>
  ),
  Wrench: ({ size = 42 }) => (
    <svg {...base(size, 1.8)}>
      <path d="M14.7 6.3a4 4 0 0 1-4.4 5.6L4 18l2 2 6.1-6.3a4 4 0 0 1 5.6-4.4l-3-3z" />
    </svg>
  ),
  ChevronDown: ({ size = 12 }) => (
    <svg {...base(size)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  Reply: ({ size = 13 }) => (
    <svg {...base(size)}>
      <path d="M9 17l-5-5 5-5" /><path d="M4 12h10a5 5 0 0 1 5 5v2" />
    </svg>
  ),
  Users: ({ size = 14 }) => (
    <svg {...base(size)}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Lock: ({ size = 12 }) => (
    <svg {...base(size)}>
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  Unlock: ({ size = 12 }) => (
    <svg {...base(size)}>
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  ),
  Star: ({ size = 11, filled = false }) => (
    <svg {...base(size)} fill={filled ? "currentColor" : "none"}>
      <path d="M12 2l2.4 7.4H22l-6 4.6L18.2 22 12 17.3 5.8 22 8 14 2 9.4h7.6z" />
    </svg>
  ),
  Mail: ({ size = 12 }) => (
    <svg {...base(size)}>
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6l-10 7L2 6" />
    </svg>
  ),
  DollarSign: ({ size = 15 }) => (
    <svg {...base(size)}>
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  Monitor: ({ size = 13 }) => (
    <svg {...base(size)}>
      <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
    </svg>
  ),
  Hammer: ({ size = 12 }) => (
    <svg {...base(size)}>
      <path d="M15 12l-8.5 8.5a2.1 2.1 0 0 1-3-3L12 9" />
      <path d="M17.6 6.4a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0l-3 3 4 4z" />
    </svg>
  ),
  Check: ({ size = 12 }) => (
    <svg {...base(size)}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  Coffee: ({ size = 14 }) => (
    <svg {...base(size)}>
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" />
      <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  ),
};
