# CloudOS — Development Roadmap

## Phase 1 — Core OS Shell (MVP)

**Goal:** Desktop environment dasar yang functional di browser.

- [ ] Project setup (Turborepo + pnpm + SolidJS + Vite + Tailwind)
- [ ] Desktop surface + wallpaper system
- [ ] Window Manager
  - [ ] Window chrome (title bar, close/minimize/maximize buttons)
  - [ ] Drag to move
  - [ ] Resize (8 handles: corners + edges)
  - [ ] Minimize to taskbar
  - [ ] Maximize / restore
  - [ ] Snap to edges (left/right half, quadrants)
  - [ ] Z-index management (focus/blur)
  - [ ] Multi-desktop / workspace switching
- [ ] Taskbar (top)
  - [ ] App menu / Start button
  - [ ] Running apps indicator
  - [ ] System tray (clock, wifi icon, battery)
  - [ ] Search bar
- [ ] Dock (bottom)
  - [ ] Pinned apps
  - [ ] Running app indicators
  - [ ] App launch animation
- [ ] Start Menu / App Launcher
  - [ ] App grid
  - [ ] Search/filter
  - [ ] Recent apps
- [ ] Context Menu system (right-click)
  - [ ] Desktop context menu
  - [ ] Custom per-component menus
- [ ] Theme engine
  - [ ] Light theme
  - [ ] Dark theme
  - [ ] CSS custom properties system
  - [ ] Glassmorphism / blur effects
- [ ] Basic auth
  - [ ] Backend: register + login API
  - [ ] Lock screen UI
  - [ ] JWT session management
- [ ] Keyboard shortcuts
  - [ ] Alt+Tab window switcher
  - [ ] Ctrl+D show desktop
  - [ ] Super key → Start Menu

---

## Phase 2 — System Apps

**Goal:** Built-in apps yang bikin OS useful.

- [ ] File Manager
  - [ ] Grid view + List view toggle
  - [ ] Breadcrumb navigation
  - [ ] Sidebar (favorites, tree view)
  - [ ] File operations (create, rename, delete, copy, move)
  - [ ] Drag & drop (within + upload from host)
  - [ ] File preview panel (quick look)
  - [ ] Upload/download files
- [ ] Terminal
  - [ ] xterm.js integration
  - [ ] WebSocket ↔ PTY bridge (backend)
  - [ ] Multi-tab support
  - [ ] Terminal color themes
  - [ ] Copy/paste support
- [ ] Text Editor
  - [ ] Monaco Editor integration
  - [ ] Multi-file tabs
  - [ ] Syntax highlighting (auto-detect)
  - [ ] Save to VFS
  - [ ] Minimap
- [ ] Image Viewer
  - [ ] Pan, zoom, rotate
  - [ ] Slideshow mode
  - [ ] Support: PNG, JPG, GIF, WebP, SVG
- [ ] Settings App
  - [ ] Appearance (theme, wallpaper, accent color)
  - [ ] Account (profile, password)
  - [ ] Storage (usage, quota)
  - [ ] Apps (installed, defaults)
  - [ ] Keyboard shortcuts
  - [ ] About (system info)
- [ ] Notification system
  - [ ] Toast notifications
  - [ ] Notification center panel
  - [ ] Permission-based per app

---

## Phase 3 — Cloud & Storage

**Goal:** Cloud storage dan file sharing.

- [ ] MinIO integration
  - [ ] S3-compatible object storage setup
  - [ ] File upload/download via presigned URLs
  - [ ] Storage quota enforcement
- [ ] Virtual File System (VFS)
  - [ ] OPFS adapter (local browser storage)
  - [ ] S3 adapter (remote cloud storage)
  - [ ] Unified API layer
- [ ] File sync
  - [ ] Local ↔ cloud sync
  - [ ] Conflict resolution
  - [ ] Offline support (Service Worker)
- [ ] File sharing
  - [ ] Public share links (with expiry)
  - [ ] User-to-user sharing (read/write)
  - [ ] Share dialog UI
- [ ] Search
  - [ ] Meilisearch integration
  - [ ] Full-text file search
  - [ ] Search UI in taskbar
- [ ] Storage management
  - [ ] Usage dashboard
  - [ ] Trash / recycle bin
  - [ ] Quota warnings

---

## Phase 4 — Ecosystem

**Goal:** Third-party apps, AI, dan polishing.

- [ ] App manifest system
  - [ ] manifest.json spec
  - [ ] Permission system (fs, clipboard, network, notifications)
  - [ ] App lifecycle hooks
- [ ] Sandboxed iframe apps
  - [ ] Secure iframe sandbox
  - [ ] postMessage IPC bridge
  - [ ] OS API exposed to apps (window, fs, clipboard, notifications)
- [ ] App Store
  - [ ] Browse apps by category
  - [ ] Install / uninstall
  - [ ] Ratings & reviews
  - [ ] Developer portal (submit apps)
- [ ] AI Assistant
  - [ ] Chat UI (sidebar or window)
  - [ ] LLM API integration (OpenAI/Anthropic/local)
  - [ ] Context-aware (can read files, run commands)
  - [ ] Prompt templates
- [ ] Media Player
  - [ ] Video player (video.js)
  - [ ] Audio player with visualizer
  - [ ] Playlist support
- [ ] Advanced features
  - [ ] Multi-desktop workspace UI
  - [ ] Custom keyboard shortcut editor
  - [ ] Widget system (desktop widgets)
  - [ ] Drag & drop between windows
  - [ ] System sounds
  - [ ] Boot animation / splash screen

---

## Infrastructure & DevOps

- [ ] Docker Compose (dev environment)
  - [ ] Frontend container
  - [ ] Backend container
  - [ ] PostgreSQL
  - [ ] Redis
  - [ ] MinIO
  - [ ] Meilisearch
- [ ] Production deploy
  - [ ] Dockerfile (multi-stage build)
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
