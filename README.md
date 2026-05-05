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
- **Keyboard Shortcuts** — Alt+Tab (window switcher), Ctrl+D (show desktop), Ctrl+L (lock screen), Ctrl+Alt+→/← (next/prev workspace), Ctrl+Alt+1..9 (jump to workspace)
- **Lock Screen** — Login/register form, session restore, clock display

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
| App Store | Browse by category, search, install/uninstall apps |
| Media Player | Audio player with track list, playback controls, volume |

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
