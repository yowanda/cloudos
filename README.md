# CloudOS

**Browser-Based Operating System** — A modern, self-hostable Internet OS built for the cloud era.

> Desktop environment yang berjalan sepenuhnya di browser. Drag, resize, snap windows — lengkap dengan file manager, terminal, app store, dan banyak lagi.

---

## Features

### Core Desktop
- **Window Manager** — Drag, resize (8 handles), snap to edges/corners, minimize, maximize, z-index management
- **Multi-Desktop Workspaces** — Multiple virtual desktops, taskbar switcher, per-workspace window filtering, drag-to-workspace via window context menu, persisted across reloads
- **Taskbar** — Running apps, system tray (clock, Wi-Fi, volume, notification bell, workspace switcher), start menu
- **Dock** — Pinned apps with running indicators, hover animations
- **Start Menu** — App grid with search/filter
- **Context Menu** — Right-click menus (desktop, window title bar with workspace move, per-component)
- **Theme Engine** — Dark/light mode, CSS custom properties, glassmorphism effects
- **System Sounds** — WebAudio synth-based effects for window open/close/minimize/maximize, notifications, lock/unlock; toggle and volume slider in Settings
- **Keyboard Shortcuts** — Alt+Tab (window switcher), Ctrl+D (show desktop), Ctrl+L (lock screen), Ctrl+Alt+→/← (next/prev workspace), Ctrl+Alt+1..9 (jump to workspace) — fully remappable from the **Shortcuts** app (record-key UI, conflict detection, reset to default)
- **Lock Screen** — Login/register form, session restore, clock display
- **Trash / Recycle Bin** — Soft delete with restore, permanent delete, empty trash; persisted across reloads
- **Storage Dashboard** — Per-folder usage breakdown, quota gauge with warnings, file/folder/trash counts in Settings → Storage

### System Apps
| App | Description |
|-----|------------|
| File Manager | Grid/list view, breadcrumbs, sidebar, create/rename/delete |
| Terminal | Built-in shell with commands (ls, help, neofetch, echo, etc) |
| Text Editor | Code editor with line numbers, multi-tab UI |
| Browser | iframe-based web browser with URL bar |
| Calculator | Fully functional calculator |
| Settings | Theme toggle, accent color picker, system info |
| Notes | Notepad app |
| Image Viewer | Image viewer placeholder |
| App Store | Browse by category, search, install/uninstall, **ratings & reviews** (1–5 stars, write/edit/delete your own, histogram, persisted) |
| Media Player | Audio + video playback, library with search/filter, drag/drop file import, shuffle, repeat (off/all/one), real seek/volume/mute |
| Shortcuts | Browse, remap, and reset all keyboard shortcuts |
| AI Assistant | Pluggable LLM chat (OpenAI / Anthropic / Ollama / OpenAI-compatible / offline echo); persisted conversations, multi-chat sidebar, system prompt config |
| Sandbox Hello / Stopwatch | Demo manifest apps running inside `sandbox="allow-scripts"` iframes, talking to the OS through `window.cloudos.*` IPC bridge — see [`docs/APPS.md`](./docs/APPS.md) |

### File Manager extras
- **Quick Look** — click the 👁️ button in the toolbar (or after selecting a file) to slide out a preview pane with the file icon, MIME type, size, modified time, and inline content for text / JSON / SVG. Folders show their child count.
- **Drag-to-move** — drag a file or folder onto any folder (in the file listing **or** in the left sidebar) to move it. The drop target glows with the accent color, the source row dims while dragging, and a notification confirms the move.

### Deployment & Ops
- **CI** (`.github/workflows/ci.yml`) builds the frontend + Go backend on every PR; on `main` it also builds both Docker images.
- **Release** (`.github/workflows/release.yml`) on `v*.*.*` tags publishes images to `ghcr.io/<owner>/cloudos-{server,desktop}` and creates a GitHub Release with auto-generated changelog.
- **Health endpoints**: `/health` (liveness) and `/ready` (readiness — pings Postgres + S3); wired into docker-compose healthchecks.
- **Reverse proxy**: ready-to-deploy Caddyfiles in [`deploy/`](./deploy/) — production (auto-TLS via Let's Encrypt) and local-HTTPS variants.
- **Backup**: [`deploy/backup.sh`](./deploy/backup.sh) snapshots Postgres + MinIO bucket + VFS data into a single zstd-compressed archive with configurable retention.

### Search (Spotlight)
- **Ctrl+K** (or **Ctrl+Space**, or the magnifier in the taskbar) opens a Spotlight-style overlay.
- Searches **apps + manifests + files (name & content)** with arrow-key navigation, ranked by exact/prefix/token/contains scoring.
- Optional **Meilisearch** backend (`apps/desktop/src/core/search.ts`'s `searchMeili`) — point it at `https://meili.example/indexes/<name>/search` for remote-indexed search of larger corpora.

### File sharing
- Per-file Share dialog (right-click any file → **Share...**) with permissions (`read` / `comment` / `write`), optional expiry (1h, 1d, 7d, 30d, never), and optional password.
- Local-only share links (`?share=<token>`) viewable in any browser tab via a built-in **Shared file viewer** that handles password unlock and expiry checks.
- Backend endpoints (`POST/GET/DELETE /api/v1/shares`, `GET /api/v1/shares/by-token/:token`) ready for multi-user deployment.

### Storage backends
The VFS supports three pluggable backends (Settings → Backend):
- **In-memory** (default) — fast, data lives in the tab.
- **OPFS** — browser-native Origin Private File System, persists across reloads even when localStorage is cleared.
- **Remote** — pushes a JSON snapshot to a CloudOS API server (`/api/v1/vfs/snapshot`), pulls on boot, debounced auto-save on every mutation.

### Cloud & Backend
- **Go + Fiber** REST API backend
- **PostgreSQL + GORM** database with auto-migration
- **JWT Authentication** (register, login, session management)
- **MinIO (S3)** object storage for file upload/download
- **File API** — List, create, upload, download, delete, rename
- **Docker Compose** full stack deployment

### Notification System
- Toast notifications (slide-in, auto-dismiss)
- Notification center panel
- Notification bell with unread badge
- Mark as read / clear all

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | SolidJS + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Backend | Go + Fiber |
| Database | PostgreSQL + GORM |
| Cache | Redis |
| Object Storage | MinIO (S3-compatible) |
| Search | Meilisearch |
| Monorepo | Turborepo + pnpm |
| Deploy | Docker + Docker Compose |

---

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- Go 1.23+ (for backend)
- Docker & Docker Compose (for full stack)

### Development (Frontend Only)

```bash
# Clone
git clone https://github.com/yowanda/cloudos.git
cd cloudos

# Install dependencies
pnpm install

# Build
pnpm turbo build

# Dev server
cd apps/desktop
pnpm dev
```

Open `http://localhost:4100` in your browser.

### Full Stack (Docker Compose)

```bash
# Clone
git clone https://github.com/yowanda/cloudos.git
cd cloudos

# Start all services
docker compose up -d

# Services:
# Frontend:    http://localhost:4100
# Backend API: http://localhost:3000
# MinIO:       http://localhost:9001 (admin: minioadmin/minioadmin)
# Meilisearch: http://localhost:7700
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Backend server port |
| `JWT_SECRET` | `cloudos-dev-secret` | JWT signing secret |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `cloudos` | PostgreSQL user |
| `DB_PASSWORD` | `cloudos` | PostgreSQL password |
| `DB_NAME` | `cloudos` | PostgreSQL database |
| `S3_ENDPOINT` | `localhost:9000` | MinIO/S3 endpoint |
| `S3_ACCESS_KEY` | `minioadmin` | S3 access key |
| `S3_SECRET_KEY` | `minioadmin` | S3 secret key |
| `S3_BUCKET` | `cloudos-files` | S3 bucket name |
| `CORS_ORIGIN` | `http://localhost:4100` | CORS allowed origin |

---

## Project Structure

```
cloudos/
├── apps/
│   ├── desktop/          # SolidJS frontend (desktop shell)
│   │   ├── src/
│   │   │   ├── apps/     # Built-in applications
│   │   │   ├── core/     # App registry, event bus, shortcuts
│   │   │   ├── shell/    # Desktop, Taskbar, Dock, StartMenu, etc
│   │   │   ├── stores/   # State management (window, theme, auth, etc)
│   │   │   ├── theme/    # Theme engine + dark/light themes
│   │   │   ├── vfs/      # Virtual File System (in-memory)
│   │   │   └── window/   # Window manager components
│   │   └── Dockerfile
│   └── server/           # Go + Fiber backend
│       ├── cmd/server/   # Main entrypoint
│       ├── internal/
│       │   ├── config/   # Environment config
│       │   ├── database/ # GORM + PostgreSQL
│       │   ├── handlers/ # HTTP handlers
│       │   ├── middleware/ # Auth middleware
│       │   ├── models/   # Database models
│       │   └── services/ # Business logic (auth, files)
│       └── Dockerfile
├── packages/
│   └── shared/           # Shared types & utilities
├── docs/
│   ├── ARCHITECTURE.md   # System architecture
│   └── ROADMAP.md        # Development roadmap
├── docker-compose.yml    # Full stack deployment
├── turbo.json
└── pnpm-workspace.yaml
```

---

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login |
| GET | `/api/v1/auth/me` | Get current user (protected) |

### Files (protected)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/files?path=/` | List directory |
| POST | `/api/v1/files/mkdir` | Create directory |
| POST | `/api/v1/files/upload` | Upload file (multipart) |
| GET | `/api/v1/files/:id/download` | Get download URL |
| DELETE | `/api/v1/files/:id` | Delete file |
| PATCH | `/api/v1/files/:id/rename` | Rename file |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |

---

## Documentation

| Doc                                       | What's inside                                              |
| ----------------------------------------- | ---------------------------------------------------------- |
| [Getting Started](./docs/GETTING_STARTED.md) | Clone → run, frontend-only and full-stack flows         |
| [Architecture](./docs/ARCHITECTURE.md)    | High-level layout of the desktop, server, stores, IPC      |
| [API reference](./docs/API.md)            | All `/api/v1/*` endpoints, request/response shapes         |
| [Building apps](./docs/APP_DEV.md)        | Manifest format + sandbox SDK for third-party apps         |
| [Self-hosting](./docs/SELF_HOSTING.md)    | Production VPS deployment, backups, hardening checklist    |
| [Theming](./docs/THEMING.md)              | Design tokens, palettes, wallpapers, manifest theming      |
| [App protocol](./docs/APPS.md)            | Wire-level IPC details for sandboxed manifest apps         |
| [Roadmap](./docs/ROADMAP.md)              | Phase-by-phase progress tracker                            |

## Roadmap

See [ROADMAP.md](./docs/ROADMAP.md) for the full development roadmap.

**Completed:**
- Phase 1: Core OS Shell (window manager, taskbar, dock, themes, shortcuts)
- Phase 2: System Apps (10 built-in apps)
- Phase 3: Cloud & Storage (Go backend, auth, file API, Docker)
- Phase 4 (partial): Notifications, App Store, Media Player

**Coming Next:**
- AI Assistant integration
- Sandboxed third-party apps
- File sync & sharing
- Full-text search
- Trash / recycle bin
- Video player & playlists in Media Player
- CI/CD GitHub Actions

---

## License

AGPL-3.0
