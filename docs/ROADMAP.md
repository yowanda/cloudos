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
  - [x] Snap to edges (left/right half, quadrants)
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
  - [ ] Recent apps
- [x] Context Menu system (right-click)
  - [x] Desktop context menu
  - [x] Custom per-component menus
- [x] Theme engine
  - [x] Light theme
  - [x] Dark theme
  - [x] CSS custom properties system
  - [x] Glassmorphism / blur effects
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
  - [ ] File preview panel (quick look)
  - [ ] Drag & drop within app
- [x] Terminal
  - [x] Shell emulation with built-in commands
  - [ ] xterm.js integration (needs backend)
  - [ ] WebSocket ↔ PTY bridge (backend)
  - [x] Multi-tab support
  - [x] Terminal color themes
  - [x] cd, history, uptime commands
  - [ ] Copy/paste support
- [x] Text Editor
  - [x] Code editor with line numbers
  - [x] Multi-file tabs UI
  - [ ] Monaco Editor integration
  - [ ] Syntax highlighting (auto-detect)
  - [ ] Save to VFS
  - [x] Minimap placeholder
- [x] Image Viewer (placeholder)
  - [ ] Pan, zoom, rotate
  - [ ] Slideshow mode
  - [ ] Support: PNG, JPG, GIF, WebP, SVG
- [x] Settings App
  - [x] Appearance (theme, accent color)
  - [x] Wallpaper picker (12 gradient wallpapers)
  - [ ] Account (profile, password)
  - [x] Storage (usage, quota, trash management)
  - [ ] Apps (installed, defaults)
  - [ ] Keyboard shortcuts
  - [x] About (system info)
- [x] Calculator app
- [x] Browser app (iframe-based)
- [x] Notes app
- [x] Notification system
  - [x] Toast notifications
  - [x] Notification center panel
  - [ ] Permission-based per app

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
  - [ ] Storage quota enforcement
- [x] File API
  - [x] List directory, create directory
  - [x] Upload file, download (presigned URL)
  - [x] Delete file/directory
  - [x] Rename file
- [ ] Virtual File System (VFS)
  - [ ] OPFS adapter (local browser storage)
  - [ ] S3 adapter (remote cloud storage)
  - [ ] Unified API layer
- [ ] File sync
  - [ ] Local ↔ cloud sync
  - [ ] Conflict resolution
  - [ ] Offline support (Service Worker)
- [ ] File sharing
  - [x] DB schema for shares (share token, permission, expiry)
  - [ ] Public share links (with expiry)
  - [ ] User-to-user sharing (read/write)
  - [ ] Share dialog UI
- [ ] Search
  - [ ] Meilisearch integration
  - [ ] Full-text file search
  - [ ] Search UI in taskbar
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
- [ ] App manifest system
  - [ ] manifest.json spec
  - [ ] Permission system (fs, clipboard, network, notifications)
  - [ ] App lifecycle hooks
- [ ] Sandboxed iframe apps
  - [ ] Secure iframe sandbox
  - [ ] postMessage IPC bridge
  - [ ] OS API exposed to apps (window, fs, clipboard, notifications)
- [x] App Store
  - [x] Browse apps by category
  - [x] Install / uninstall
  - [x] Ratings & reviews (1–5 stars, write/edit/delete your own, average + histogram, persisted in localStorage)
  - [ ] Developer portal (submit apps)
- [ ] AI Assistant
  - [ ] Chat UI (sidebar or window)
  - [ ] LLM API integration (OpenAI/Anthropic/local)
  - [ ] Context-aware (can read files, run commands)
  - [ ] Prompt templates
- [x] Media Player
  - [x] Video player (HTML5 <video>, supports mp4/webm/ogg)
  - [x] Audio player with track list
  - [x] Playback controls + volume + seek + mute
  - [x] Playlist support (search, filter audio/video, shuffle, repeat off/all/one, drag/drop or file picker)
- [ ] Advanced features
  - [x] Multi-desktop workspace UI (taskbar switcher, Ctrl+Alt+Arrow / Ctrl+Alt+1..9 shortcuts, per-workspace window filtering, persisted)
  - [x] Custom keyboard shortcut editor (Shortcuts app: record key combos, conflict detection, per-shortcut + global reset, persisted in localStorage)
  - [x] Widget system (desktop widgets: clock, weather, system monitor, quick notes)
  - [ ] Drag & drop between windows
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
