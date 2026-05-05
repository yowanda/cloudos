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
- [x] Basic auth
  - [x] Backend: register + login API ([`apps/server/internal/handlers/auth.go`](../apps/server/internal/handlers/auth.go))
  - [x] Lock screen UI ([`apps/desktop/src/shell/LockScreen.tsx`](../apps/desktop/src/shell/LockScreen.tsx))
  - [x] JWT session management ([`apps/desktop/src/stores/auth-store.ts`](../apps/desktop/src/stores/auth-store.ts), bcrypt + JWT on the backend)
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
  - [x] Copy/paste support — `Ctrl+Shift+C` copies the current selection (or prompt input) to the system clipboard, `Ctrl+Shift+V` pastes the clipboard at the cursor. Works in both local mode (window selection / prompt) and remote xterm.js mode (`term.getSelection()` ↔ `term.paste()`). Plain `Ctrl+C` is left alone so it still sends `SIGINT` in the remote shell. New `copy <text>` / `paste` built-ins for keyboard-free use.
- [x] Text Editor
  - [x] Code editor with line numbers
  - [x] Multi-file tabs UI (open, switch, close, scratch tabs)
  - [x] Monaco Editor integration — opt-in via Settings → Editor → "Use Monaco Editor". Off by default. Lazy-loaded (`solid-js` `lazy()` + dynamic import) so Monaco's ~3 MB stays out of the initial bundle and lands in its own chunk only when the user actually flips the toggle. `MonacoEditor.tsx` wraps `monaco-editor/esm/vs/editor/editor.api`, applies a CloudOS-themed dark palette, syncs `value` / `language` reactively across tab switches, and rebinds `Ctrl+S` onto the host's `saveActive`. Workers are wired through `MonacoEnvironment.getWorker(_, label)` — base `editor.worker` plus `json.worker` (schema validation) and `ts.worker` (JS / TS autocomplete + hover + diagnostics) loaded as separate Vite `?worker` chunks; CSS / HTML workers are deliberately skipped to keep the on-toggle download closer to ~1 MB instead of ~2 MB. Falls back to a plain `<textarea>` if the dynamic import fails (offline + no SW cache). Built-in tokenizer overlay remains the default and is fully preserved. See `apps/desktop/src/apps/MonacoEditor.tsx` and `apps/desktop/src/core/editor-prefs.ts`.
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
  - [x] Per-entry diff sync / conflict resolution
    - **Stage 1 / clock metadata** — every `VFSEntry` carries a monotonic `clock` field bumped on every create / write / rename / move; persisted in `localStorage:cloudos:vfs:clock` so it survives reloads; `importSnapshot` advances the local counter past any incoming max so subsequent local writes are always strictly greater. Exports `getLatestClock()` / `entriesChangedSince(since)` for the diff-sync protocol. See `apps/desktop/src/vfs/vfs.ts`.
    - **Stage 2a / backend endpoint** — `POST /api/v1/vfs/changes` accepts `{ since, entries, tombstones, deleted }` and returns the inverse delta `{ clock, entries, tombstones }`. Snapshot file is augmented with a top-level `Clock` and a `Tombstones` list so deletions survive across devices. Merge semantics are last-write-wins by per-entry clock — incoming entries with `clock >= stored.clock` overwrite, tombstones with greater clock than the entry win, and the convenience `Deleted: []string` shorthand is server-stamped with the current `clock+1`. Legacy `PUT/GET /api/v1/vfs/snapshot` endpoints are kept for old clients. See `apps/server/internal/handlers/vfs.go`.
    - **Stage 2b / client adapter** — `vfs/sync.ts` now prefers the incremental path: every save tick collects `entriesChangedSince(lastPushedClock)` + `tombstonesSince(lastPushedClock)` and POSTs to `/vfs/changes`; the inverse delta the server returns is applied back into the local tree via a new `mergeDelta()` (LWW by clock — never clobbers strictly-newer local writes). Tombstones are recorded by `deleteEntry`, `moveToTrash`, `moveEntry`, and `renameEntry`, persisted in `localStorage:cloudos:vfs:tombstones` (capped at 5000 with LRU drop), and survive reloads. The watermark lives in `localStorage:cloudos:vfs:last-pushed-clock`. The remote adapter falls back to the legacy `PUT /vfs/snapshot` if the server returns `404` (old build) or if the user disables incremental mode in Settings → Backend. The Settings panel also displays current local clock vs. last-pushed clock and a pending-delta count, refreshing every 2 s. See `apps/desktop/src/vfs/sync.ts`, `apps/desktop/src/vfs/adapters/remote.ts`, `apps/desktop/src/vfs/adapter.ts`.
    - **Stage 3 / conflict UI** — `vfs.ts` now tracks a `syncedClocks` map (path → clock at last successful round-trip) persisted in `localStorage:cloudos:vfs:synced-clocks`; this is the "fork point" that lets `mergeDelta` distinguish a one-sided update from a genuine concurrent edit. When both `local.clock > fork` AND `incoming.clock > fork` AND content differs, the LWW winner still becomes live but the loser is preserved as a `VFSConflict` record (`apps/desktop/src/vfs/conflicts.ts`). The Taskbar grows a 🔀 badge when any conflict is pending; clicking it opens Settings → Backend → Sync conflicts, which lists every conflict with side-by-side text diffs and Keep-local / Keep-remote / Dismiss buttons (Keep-loser writes the loser's content back into the live VFS with a fresh clock so it propagates on the next sync). The `/conflicts` slash command lists pending conflicts from the Assistant, and `/clock` reports the count.
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
  - [x] LLM API integration with **one-click provider presets** in `apps/desktop/src/stores/ai-provider-presets.ts`. The Settings panel exposes a single "Quick start preset" dropdown that auto-fills base URL + model + a curated suggested-models dropdown. Presets covered: **free** (Akash Chat, Groq, OpenRouter `:free`, Google Gemini AI Studio, Cerebras, Together AI, Mistral La Plateforme, Hugging Face Inference, Ollama local), **paid** (OpenAI, Anthropic), **offline** (Echo mock, custom OpenAI-compatible endpoint). Each preset that requires a key carries a "Get free API key →" button linking straight to the provider's signup / key-management page. API keys are stored only in browser `localStorage`; they are never synced to the CloudOS backend. Suggested-models lists are curated to the free / cheap SKUs the user most likely wants. See `apps/desktop/src/apps/AIAssistant.tsx` and `apps/desktop/src/stores/ai-provider-presets.ts`.
  - [x] Context-aware (can read files, run commands) — rule-based slash-command tool layer in `apps/desktop/src/stores/ai-tools.ts` intercepts user messages before they hit the LLM. Commands: `/help`, `/read <path>`, `/ls [path]`, `/stat <path>`, `/find <pattern>`, `/tree [path] [maxDepth]`, `/storage`, `/clock`, `/conflicts`, `/apps`, `/windows`, `/desktops`, `/whoami`, `/recent`, `/now`. Works in **every provider mode** (echo / OpenAI / Anthropic / Ollama / OpenAI-compatible) — no API key required, fully offline. Read-only by design (peek at VFS contents, query desktop state, inspect storage / clock / sync conflicts); write operations stay behind explicit user actions in the respective apps. Future stage will graduate to LLM tool-calling so models can decide which tool to invoke based on natural-language requests.
  - [x] Prompt templates (configurable system prompt)
- [x] Media Player
  - [x] Video player (HTML5 <video>, supports mp4/webm/ogg)
  - [x] Audio player with track list
  - [x] Playback controls + volume + seek + mute
  - [x] Playlist support (search, filter audio/video, shuffle, repeat off/all/one, drag/drop or file picker)
- [x] Advanced features
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
  - [x] Caddy reverse proxy (auto-SSL) ([`deploy/Caddyfile`](../deploy/Caddyfile), [`deploy/Caddyfile.dev`](../deploy/Caddyfile.dev))
  - [x] Backup scripts ([`deploy/backup.sh`](../deploy/backup.sh) — Postgres + MinIO + VFS, zstd-compressed, retention)
  - [x] Health checks (`/health` liveness + `/ready` readiness pings Postgres + S3; wired into `docker-compose` healthchecks)
- [x] CI/CD
  - [x] GitHub Actions (lint, test, build) — [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs frontend build, Go backend `build`+`vet`, and Docker image build on every PR + push to `main`
  - [x] Auto-deploy on push to main — tag-based release at [`.github/workflows/release.yml`](../.github/workflows/release.yml) publishes to `ghcr.io` on `v*.*.*` tags
- [x] Documentation
  - [x] Getting started guide ([`docs/GETTING_STARTED.md`](./GETTING_STARTED.md))
  - [x] API reference ([`docs/API.md`](./API.md))
  - [x] App development guide ([`docs/APP_DEV.md`](./APP_DEV.md))
  - [x] Self-hosting guide ([`docs/SELF_HOSTING.md`](./SELF_HOSTING.md))
  - [x] Theming guide ([`docs/THEMING.md`](./THEMING.md))
