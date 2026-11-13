# Whispr

An anonymous confessions app for students. Post, react, and comment without anyone
knowing it's you — built for one campus community, kept deliberately simple, and
run on free-tier infrastructure only.

This repo is the **frontend** (React 19). The backend is a separate FastAPI service —
see [Backend](#backend) below.

---

## What Whispr actually does

- **Anonymous posting.** Every user gets a random display name (e.g. `Anon_9F2`) on
  signup — no real names, no profile photos tied to identity.
- **Categories.** Confessions, School, Relationships, Work, Rants, Advice, Secrets,
  Random — each with its own color tag.
- **Reactions & comments.** Six emoji reactions, threaded comments with replies.
- **Polls.** Optional multiple-choice poll attached to a post.
- **Disappearing posts.** Optional 24-hour self-destruct on a post.
- **Bookmarks.** Save posts to revisit later.
- **Notifications.** Likes, comments, replies, reactions, bans, warnings, and report
  follow-ups all show up in one bell icon.
- **Light & dark mode.** Full theme toggle, every component has matching values for both.
- **Moderation.** Keyword filtering, user reports with admin follow-through (delete /
  delete + warn / delete + temp-ban), device-fingerprint duplicate-account detection,
  and a maintenance-mode gate that locks the app to non-admins while keeping admin
  access live.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, plain CSS-in-JS (no Tailwind/styled-components) |
| Backend | FastAPI (separate repo — see below) |
| Database | Firebase Firestore |
| Auth | Firebase Authentication (email/password) |
| Push notifications | Firebase Cloud Messaging |
| Hosting (backend) | Render.com free tier |

No paid services anywhere in this stack — the project runs entirely on free tiers by design.

---

## Getting started

```bash
npm install
npm start
```

Opens at `http://localhost:3000`. That's it — Firebase config is already wired up
in `src/firebase.js` (see [Firebase config](#firebase-config--why-the-api-key-is-public)
for why those keys are safe to have in the repo).

To build for production:

```bash
npm run build
```

---

## Project structure

```
src/
├── App.js                  # Root component — auth gate, maintenance-mode gate, routes to Feed
├── firebase.js              # Firebase init, config, push notification registration
├── constants/index.js       # Categories, reactions, banned keywords, timing constants
│
├── components/
│   ├── layout/
│   │   ├── Feed.js          # Main feed — navbar, search, tabs, post list, compose FAB (largest file)
│   │   ├── Sidebar.js       # Desktop category list + trending panel
│   │   ├── NotificationBell.js
│   │   ├── PushToast.js     # In-app toast for foreground push notifications
│   │   └── StyleTag.js      # Injects the global <style> block from styles/theme.js
│   │
│   ├── posts/
│   │   ├── PostCard.js      # A single post in the feed
│   │   ├── PostModal.js     # Full post view with comments (opened from PostCard)
│   │   ├── ComposePost.js   # New-post form (text, poll, 24h toggle, cooldown UI)
│   │   ├── PollDisplay.js   # Renders/handles voting on a poll
│   │   └── ReactionButton.js
│   │
│   ├── comments/CommentSection.js
│   │
│   ├── auth/
│   │   ├── AuthPage.js      # Login/signup, blocked-device screen, theme toggle
│   │   └── TermsModal.js    # Scroll-to-accept terms gate
│   │
│   ├── admin/AdminPanel.js  # 12-tab admin console (see below) — largest single component
│   │
│   └── shared/
│       ├── Icons.js         # Every icon in the app — one shared SVG set, see below
│       ├── Avatar.js
│       ├── Spinner.js
│       ├── SupportButton.js # Floating contact-admin panel
│       └── ReportModal.js   # Report a post/comment
│
├── pages/
│   ├── ProfilePage.js       # Your own posts + stats
│   └── BookmarksPage.js
│
├── hooks/useForegroundPush.js   # Listens for FCM pushes while the tab is open
├── utils/
│   ├── fingerprint.js         # Device fingerprinting for duplicate-account detection
│   ├── filter.js              # Banned-keyword content filter
│   ├── theme.js               # Reads/writes dark-or-light choice to localStorage — NOT the CSS file, see below
│   └── time.js                # "5m ago" style relative timestamps
│
└── styles/theme.js           # The ENTIRE app's CSS lives here — see below
```

> ⚠️ **Two files are both called `theme.js`** — `utils/theme.js` (a few lines, just
> persists the dark/light choice to `localStorage`) and `styles/theme.js` (the entire
> app's CSS, thousands of lines). They're unrelated; the naming collision is just a
> historical accident, not a hint they're connected.

---

## Design system

The whole visual identity lives in **`src/styles/theme.js`** as one large injected
`<style>` block (via `StyleTag.js`), using CSS custom properties for theming. There
is no separate CSS-in-JS library and no Tailwind — this is deliberate, so the whole
theme can be reasoned about in one file.

**Colors:**
- Accent: coral `#e8734a` — used sparingly, reserved for primary actions (Post button,
  active states, links). Chosen specifically to *not* be the generic violet/blue that
  most AI-assisted or template UIs default to.
- Dark mode background: warm near-black `#0c0b10` (not pure black — pure black plus a
  bright accent is a very recognizable "generic AI app" look, so this was shifted warm).
- Light mode: warm off-white `#faf7f5`, not cool white — kept the same color
  temperature as dark mode so the coral accent doesn't clash in either theme.
- Semantic colors: red = destructive, amber = admin-only/caution, green = success,
  cyan = informational. These are consistent everywhere — a red button always means
  "this can't be undone."

**Typography:** Syne (headings, labels, buttons) + DM Sans (body text).

**Icons:** `src/components/shared/Icons.js` exports every icon used across the whole
app as small inline SVG React components (`<Icon.Heart />`, `<Icon.Bookmark filled />`,
etc.). There are no emoji used as UI icons anywhere in the app — emoji only appear
where they're actual content (the six reaction emoji users pick, casual tone in a
few copy strings). If you need a new icon, add it here once rather than inlining SVG
in a component — several icons are shared across multiple files.

**Hierarchy principle:** buttons are colored by consequence, not just position — a
neutral/ghost style for everyday actions (Edit, Reply), amber for admin-only actions,
red for anything destructive/permanent (Delete, Ban), and coral reserved strictly for
the one primary call-to-action on a given screen.

---

## The Admin Panel

`components/admin/AdminPanel.js` is the largest single component (~800+ lines) and
covers 12 tabs: Dashboard, Reports, Posts, Users, Duplicate Devices, Keywords,
Categories, Announcements, Support, Device Bans, Whitelist, and Ads.

A few things worth knowing if you're extending it:

- **Tab list lives in one place.** `ADMIN_TABS` (top of the file) is the single
  source of truth for both the desktop button row and the mobile dropdown — don't
  add a tab in one without the other, they both read from the same array.
- **Report actions.** A pending report can be resolved three ways: **Delete** (just
  removes the post), **Delete + Warn** (removes the post, sends the poster a warning
  notification), or **Delete + Ban** (removes the post, then opens the existing ban
  modal pre-filled — it does *not* auto-ban; you still confirm duration/reason).
  Whoever filed the report also gets a "thank you, we reviewed it" notification,
  closing the loop rather than reports disappearing silently.
- **Maintenance mode toggle** lives here, and only here — the maintenance screen
  itself (in `App.js`, shown to non-admins) has no controls, just a Sign Out button.
- **Responsive tab switching** relies on a specific CSS specificity fix — see the
  comment above `.admin-tabs-desktop` / `.admin-tabs-mobile` in `theme.js` if the
  mobile dropdown ever silently stops appearing. (It did once, mid-build — a later,
  unrelated `.tabs { display: flex }` rule was overriding the mobile hide-rule. Fixed
  by combining selectors so specificity always wins regardless of file order.)

---

## Firebase config — why the API key is public

`src/firebase.js` has real, working Firebase config values (API key, project ID,
etc.) committed in plain text. **This is intentional and safe** — Firebase's client
config identifies which project to connect to, it does not grant access to anything.
Actual access control is enforced entirely by **Firestore Security Rules**, which
live in the Firebase project itself (not in this repo). If you fork this project,
you still can't read or write data unless your own account passes those rules.

The one thing that *is* meant to stay private: the **VAPID key** for push
notifications should be your own if you fork this — see the comment in `firebase.js`.

---

## Backend

The FastAPI backend (`whispr-v2-backend`, hosted on Render's free tier) is a
**separate repository**, not included here. The frontend calls it for anything that
needs server-side validation or moderation logic: `/signup`, `/post`, `/comment`,
`/like`, `/react`, `/report`, and the `/admin/*` moderation endpoints (ban, unban,
delete-account).

Reads (loading the feed, comments, notifications) go straight to Firestore from the
client — only writes that need validation or moderation logic go through the backend.

If something looks broken on the backend side (a report field not saving, a
notification not firing), it may be a backend-side fix, not a frontend one — check
that repo separately.

---

## Known limitations (by design, not oversight)

- **No full-text search.** The search bar filters posts already loaded on the
  current page — it doesn't query the whole database. True search would need either
  a stored lowercase/prefix field in Firestore (limited — only matches from the start
  of a word) or a paid search service, which conflicts with the zero-budget constraint.
- **No real-time backend push for new posts across all users** beyond the
  "new posts available" banner — Whispr intentionally doesn't auto-inject other
  people's posts into your feed while you're reading, to avoid content jumping
  around under you. You get a banner, you choose when to refresh.
- **CRA (`react-scripts`) has known, unfixable `npm audit` warnings.** These live in
  build-time tooling (Jest, webpack-dev-server internals), not in anything shipped
  to production. Don't run `npm audit fix --force` — it can break the build. This is
  a long-standing, widely-known situation with Create React App generally.

---

## A note on what this app deliberately avoids

Whispr does not have public leaderboards, karma scores, or streak counters. This
was a deliberate choice, not a missing feature: this is an anonymous confessions
app where people are often being vulnerable, and visible competitive metrics tend
to nudge people toward writing what performs well rather than what's honest. If
you're extending this app, it's worth keeping that tension in mind before adding
anything gamified.
