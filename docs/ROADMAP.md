# CloudOS — Development Roadmap

## Phase 1 — Core OS Shell (MVP)

**Goal:** Desktop environment dasar yang functional di browser.

- [x] Project setup (Turborepo + pnpm + SolidJS + Vite + Tailwind)
- [x] Desktop surface + wallpaper system
- [x] Window Manager
  - [x] Window chrome (title bar, close/minimize/maximize buttons)
  - [x] Drag to move
  - [x] Resize (8 handles: corners + edges)
  - [x] Minimize to taskbar
  - [x] Maximize / restore
  - [x] Snap to edges (left/right half, quadrants) — drag-to-snap **and** keyboard snap presets (`Win+←/→` halves, `Win+1..4` quadrants, `Win+↑` maximize, `Win+↓` step-down). Backed by a new `metaOnly` flag on `ShortcutBinding` that distinguishes Meta-only from Ctrl/Meta-merged matches.
  - [x] Z-index management (focus/blur)
  - [x] Multi-desktop / workspace switching
- [x] Taskbar (top)
  - [x] App menu / Start button
  - [x] Running apps indicator
  - [x] System tray (clock, wifi icon, battery)
  - [x] Search bar
- [x] Dock (bottom)
  - [x] Pinned apps
  - [x] Running app indicators
  - [x] App launch animation
- [x] Start Menu / App Launcher
  - [x] App grid
  - [x] Search/filter
  - [x] Recent apps (Start menu surfaces last 6 launches; recorded from Start menu, Dock, and elsewhere)
- [x] Context Menu system (right-click)
  - [x] Desktop context menu
  - [x] Custom per-component menus
- [x] Theme engine
  - [x] Light theme
  - [x] Dark theme
  - [x] CSS custom properties system
  - [x] Glassmorphism / blur effects
  - [x] **Built-in presets** — Solarized Dark, Solarized Light, Nord
  - [x] **Custom theme JSON** — import/export from Settings → Appearance, validated against `REQUIRED_THEME_VARS`, persisted in `localStorage:cloudos:theme:custom`. Active theme tracked separately under `cloudos:theme:active`
- [ ] Basic auth
  - [ ] Backend: register + login API
  - [ ] Lock screen UI
  - [ ] JWT session management
- [x] Keyboard shortcuts
  - [x] Alt+Tab window switcher
  - [x] Ctrl+D show desktop
  - [x] Super key → Start Menu

---

## Phase 2 — System Apps

**Goal:** Built-in apps yang bikin OS useful.

- [x] File Manager
  - [x] Grid view + List view toggle
  - [x] Breadcrumb navigation
  - [x] Sidebar (favorites, tree view)
  - [x] File operations (create, rename, delete, copy, move)
  - [x] Drag & drop upload from host
  - [x] File preview panel (quick look) — toolbar 👁️ toggle, right pane shows file icon + metadata + inline content (text, JSON, SVG; placeholder for image/video/audio)
  - [x] Drag & drop within app — drag any entry onto another folder (in the listing or sidebar) to move; visual ring highlights the drop target, source dims to 50%
- [x] Terminal
  - [x] Shell emulation with built-in commands (local mode)
  - [x] Real shell binding — xterm.js + WebSocket pty backend (`/api/v1/pty`, `creack/pty` shell, gated by `ENABLE_PTY=true`); auto-detected from `/api/v1/pty/health`. Tab UI shows local 💻 and remote 🔌 mode, with a connection status indicator.
  - [x] xterm.js integration (`@xterm/xterm` + `@xterm/addon-fit`, mounted per remote tab)
  - [x] WebSocket ↔ PTY bridge (backend) — JSON `{type:"resize",cols,rows}` control + binary stream both directions, JWT auth via header or `?token=`
  - [x] Multi-tab support
  - [x] Terminal color themes
  - [x] cd, history, uptime commands
  - [ ] Copy/paste support
- [x] Text Editor
  - [x] Code editor with line numbers
  - [x] Multi-file tabs UI (open, switch, close, scratch tabs)
  - [ ] Monaco Editor integration
  - [x] Syntax highlighting (auto-detect — JS/TS/JSON/Python/CSS/HTML/Markdown via `core/syntax.ts` regex tokenizer, transparent textarea over colored overlay)
  - [x] Save to VFS (`Ctrl+S` via `vfs.writeFile()` upsert)
  - [x] Find & replace (`Ctrl+F`)
  - [x] Open from File Manager double-click via `openInEditor()` cross-window handoff
  - [x] Minimap placeholder
- [x] Image Viewer (placeholder)
  - [x] Pan, zoom, rotate (mouse wheel zoom, click-drag pan, ↺/↻ rotate, R key, 0 reset)
  - [x] Slideshow mode (Space key / toolbar button, 3 s auto-advance, ←/→ navigate)
  - [x] Support: PNG, JPG, GIF, WebP, SVG (data URLs from VFS, raw URLs, host drag-drop)
- [x] Settings App
  - [x] Appearance (theme, accent color)
  - [x] Wallpaper picker (12 gradient wallpapers)
  - [x] Account (display name, email, avatar emoji, bio — persisted to `cloudos:profile`)
  - [x] Storage (usage, quota, trash management)
  - [x] Apps (list installed manifest apps, launch / uninstall, manage recent-app history)
  - [x] Keyboard shortcuts (read-only summary + reset-custom; deep-link to Shortcuts app for editing)
  - [x] About (system info)
- [x] Calculator app
- [x] Browser app (iframe-based)
  - [x] **Back / forward navigation** — own per-window stack (iframe `contentWindow.history` is blocked by same-origin policy)
  - [x] **Reload** — re-assigns iframe `src` to itself to force a fresh load
  - [x] **History** — last 200 visits, persisted to `localStorage:cloudos:browser:history`, clear-all + per-entry remove
  - [x] **Bookmarks** — ★ toggle in toolbar, persisted to `localStorage:cloudos:browser:bookmarks`, side panel for management
- [x] Notes app
- [x] Notification system
  - [x] Toast notifications
  - [x] Notification center panel
  - [x] Permission-based per app — runtime grant/deny via `requestPermission()`, persisted, revocable from Settings
  - [x] Action buttons — `actions: NotificationAction[]` (default/primary/danger styles) with built-in helpers `dismissAction()`, `snoozeAction(ms)`, `openAppAction(appId,…)` plus custom `run()`. Toasts with actions stay until interacted with; snoozed items show a 💤 pill with "Wake now" in the center; `runAction` surfaces failures as their own error notification.

---

## Phase 3 — Cloud & Storage

**Goal:** Cloud storage dan file sharing.

- [x] Backend server (Go + Fiber)
  - [x] REST API with Fiber framework
  - [x] GORM + PostgreSQL database
  - [x] Auto-migration for all models
  - [x] Docker Compose full stack
- [x] Auth system
  - [x] Register + Login API (bcrypt + JWT)
  - [x] Auth middleware (Bearer token)
  - [x] Lock Screen UI (frontend)
  - [x] Session restore from localStorage
- [x] MinIO integration
  - [x] S3-compatible object storage setup
  - [x] File upload/download via presigned URLs
  - [x] **Storage quota enforcement** — `vfs.ts` exports `getQuotaBytes()`, `setQuotaBytes()`, `usedBytes()`, and a `VFSQuotaExceededError` class. `createFile` / `writeFile` call `enforceQuota(delta)` on the byte delta and throw the error instead of silently writing past the cap. Settings → Storage exposes 1/2/5/10/20/50 GB presets and refuses to drop below current usage. Trash counts towards the cap.
- [x] File API
  - [x] List directory, create directory
  - [x] Upload file, download (presigned URL)
  - [x] Delete file/directory
  - [x] Rename file
- [x] Virtual File System (VFS)
  - [x] OPFS adapter (browser-native persistent storage)
  - [x] Remote API adapter (HTTP, snapshot push/pull)
  - [x] In-memory adapter (default)
  - [x] Unified switchable API layer (`vfs/sync.ts`) with debounced auto-save
- [x] File sync
  - [x] Browser ↔ cloud snapshot sync (push + pull)
  - [ ] Per-entry diff sync / conflict resolution
  - [x] **Offline support (Service Worker)** — `apps/desktop/public/sw.js` precaches the shell on install and uses a tiered fetch strategy: navigation requests are network-first with a cached `/` fallback, static assets (`/assets/`, JS / CSS / SVG / icons / fonts) are stale-while-revalidate, and API calls (`/api/`, `/auth/`, `/ws/`) are network-only so live data and auth tokens are never served from cache. The cache name is versioned (`cloudos-shell-v1`) so a new deploy purges the old cache on `activate`. Backed by `apps/desktop/public/manifest.webmanifest` (installable PWA: name, theme color, scope, icons) and `icon.svg` / `icon-maskable.svg`. Registration is gated to `import.meta.env.PROD` so the dev server's HMR isn't fighting the SW's caching.
- [x] File sharing
  - [x] DB schema for shares (share token, permission, expiry)
  - [x] Public share links (with expiry, optional password)
  - [x] User-to-user sharing (read/comment/write permission tiers)
  - [x] Share dialog UI (per-file, list/create/revoke, copy link)
- [x] Search
  - [x] Built-in local index (file name + content + apps + manifests)
  - [x] Optional Meilisearch integration (`searchMeili`, config in localStorage)
  - [x] Full-text file search via Spotlight overlay
  - [x] Search UI in taskbar (button + Ctrl+K / Ctrl+Space shortcut)
  - [x] **Command palette** — `>`/`:` prefix in Spotlight switches to commands-only mode. `core/commands.ts` exposes a system-wide registry (close/maximize/minimize focused window, snap left/right, reload, lock, toggle sound, empty trash, switch theme per id, jump-to Settings page, switch workspace). Settings deep-links use a `pendingSettingsPage` cross-window signal so the same Settings window can be re-targeted instead of opening a new one.
- [x] CI/CD & Deployment
  - [x] GitHub Actions: build frontend + backend on every PR
  - [x] Release workflow: tag-triggered, publishes Docker images to GHCR
  - [x] Liveness `/health` + readiness `/ready` endpoints (DB + S3 checks)
  - [x] Docker compose healthchecks (postgres, server, frontend)
  - [x] Caddy reverse-proxy templates (production + local TLS)
  - [x] Backup script (`deploy/backup.sh`: pg_dump + mc mirror + VFS, retention)

- [x] Documentation
  - [x] Getting Started (`docs/GETTING_STARTED.md`)
  - [x] API reference (`docs/API.md`)
  - [x] App developer guide (`docs/APP_DEV.md`)
  - [x] Self-hosting guide (`docs/SELF_HOSTING.md`)
  - [x] Theming guide (`docs/THEMING.md`)

- [x] Storage management
  - [x] Usage dashboard (Settings → Storage: per-folder breakdown, file/folder counts)
  - [x] Trash / recycle bin (move to trash, restore, permanent delete, empty trash, persisted)
  - [x] Quota warnings (warning at 75%, danger at 90%)

---

## Phase 4 — Ecosystem

**Goal:** Third-party apps, AI, dan polishing.

- [x] Notification system
  - [x] Toast notifications (slide-in, auto-dismiss)
  - [x] Notification center (panel overlay)
  - [x] Notification bell with unread badge
  - [x] Mark as read / clear all
- [x] App manifest system
  - [x] AppManifest spec (`docs/APPS.md`) — id, version, icon, permissions, entry, window
  - [x] Permission system (notifications, files.read/write, windows, clipboard.read/write)
  - [x] **First-use runtime permission prompts** — manifest declares; user grants/denies on first call; choice persisted in localStorage; revocable from Settings → Apps → Permissions; cleared on uninstall ([`core/permissions.ts`](../apps/desktop/src/core/permissions.ts), [`shell/PermissionPrompt.tsx`](../apps/desktop/src/shell/PermissionPrompt.tsx))
  - [x] Install / uninstall manifest at runtime, persisted to localStorage
- [x] Sandboxed iframe apps
  - [x] Secure iframe sandbox (`sandbox="allow-scripts"` for inline, +allow-same-origin for URL)
  - [x] postMessage IPC bridge with two-stage permission gating (manifest declaration + runtime grant)
  - [x] OS API exposed (window.cloudos.{ping,notify,windows,vfs,clipboard,manifest})
- [x] App Store
  - [x] Browse apps by category
  - [x] Install / uninstall
  - [x] Ratings & reviews (1–5 stars, write/edit/delete your own, average + histogram, persisted in localStorage)
  - [ ] Developer portal (submit apps)
- [x] AI Assistant
  - [x] Chat UI (windowed app, multi-conversation sidebar, persisted)
  - [x] LLM API integration (OpenAI, Anthropic, Ollama, OpenAI-compatible, offline echo)
  - [ ] Context-aware (can read files, run commands)
  - [x] Prompt templates (configurable system prompt)
- [x] Media Player
  - [x] Video player (HTML5 <video>, supports mp4/webm/ogg)
  - [x] Audio player with track list
  - [x] Playback controls + volume + seek + mute
  - [x] Playlist support (search, filter audio/video, shuffle, repeat off/all/one, drag/drop or file picker)
- [ ] Advanced features
  - [x] Multi-desktop workspace UI (taskbar switcher, Ctrl+Alt+Arrow / Ctrl+Alt+1..9 shortcuts, per-workspace window filtering, persisted)
  - [x] Custom keyboard shortcut editor (Shortcuts app: record key combos, conflict detection, per-shortcut + global reset, persisted in localStorage)
  - [x] Widget system (desktop widgets: clock, weather, system monitor, quick notes)
  - [x] **Drag & drop between windows** — `core/drag-drop.ts` defines a single shared MIME (`application/x-cloudos-vfs-path`) used by all CloudOS windows that participate. Drag a row in **FileManager** onto an open **TextEditor** to open it as a new tab (focuses the existing tab if the path is already open). Drag onto an open **ImageViewer** to add it to the carousel (rejects non-image MIMEs with a friendly notification). Drops also accept `Files` from outside the browser (host OS drag-in) — TextEditor reads as text, ImageViewer reads as data-URL. Both apps show a dashed accent overlay while a drop is staged.
  - [x] System sounds (WebAudio synth: open/close/min/max, notify success/warning/error, lock/unlock; Settings toggle + volume + preview)
  - [x] Boot animation / splash screen

---

## Infrastructure & DevOps

- [x] Docker Compose (dev environment)
  - [x] Frontend container (Nginx + SolidJS)
  - [x] Backend container (Go + Fiber)
  - [x] PostgreSQL
  - [x] Redis
  - [x] MinIO
  - [x] Meilisearch
- [x] Production deploy
  - [x] Dockerfile (multi-stage build)
  - [ ] Caddy reverse proxy (auto-SSL)
  - [ ] Backup scripts
  - [ ] Health checks
- [ ] CI/CD
  - [ ] GitHub Actions (lint, test, build)
  - [ ] Auto-deploy on push to main
- [ ] Documentation
  - [ ] Getting started guide
  - [ ] API reference
  - [ ] App development guide
  - [ ] Self-hosting guide
  - [ ] Theming guide
