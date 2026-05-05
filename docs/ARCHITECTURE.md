# CloudOS — Browser-Based Operating System

## Architecture & Project Structure

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                             │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Desktop Shell (SolidJS)                     │  │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌───────────────────┐  │  │
│  │  │ Taskbar │ │ Dock/    │ │ System  │ │ Notification      │  │  │
│  │  │ (Top)   │ │ App Bar  │ │ Tray    │ │ Center            │  │  │
│  │  └─────────┘ └──────────┘ └─────────┘ └───────────────────┘  │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │              Window Manager (WM)                         │  │  │
│  │  │                                                         │  │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │  │
│  │  │  │ Window 1 │  │ Window 2 │  │ Window 3 │   ...        │  │  │
│  │  │  │ (App A)  │  │ (App B)  │  │ (App C)  │              │  │  │
│  │  │  │ [iframe] │  │ [iframe] │  │ [native] │              │  │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘              │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                                                               │  │
│  │  ┌──────────────────────────────────┐  ┌───────────────────┐  │  │
│  │  │    Virtual File System (VFS)     │  │   App Registry    │  │  │
│  │  │  ┌──────┐ ┌──────┐ ┌─────────┐  │  │  (manifest.json)  │  │  │
│  │  │  │ OPFS │ │ S3   │ │ IndexDB │  │  └───────────────────┘  │  │
│  │  │  └──────┘ └──────┘ └─────────┘  │                         │  │
│  │  └──────────────────────────────────┘                         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                    WebSocket + REST API                              │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Server)                             │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│  │  API Gateway │  │  WebSocket   │  │  Auth Service             │  │
│  │  (Go+Fiber) │  │  Server      │  │  (JWT + bcrypt)           │  │
│  │             │  │              │  │  ┌─────┐ ┌─────┐ ┌─────┐  │  │
│  │  /api/v1/*  │  │  - Terminal  │  │  │Email│ │OAuth│ │Magic│  │  │
│  │  /auth/*    │  │  - File Sync │  │  │     │ │     │ │Link │  │  │
│  │  /ws/*      │  │  - Notif     │  │  └─────┘ └─────┘ └─────┘  │  │
│  └──────┬──────┘  └──────┬───────┘  └───────────────────────────┘  │
│         │                │                                          │
│  ┌──────▼────────────────▼──────────────────────────────────────┐  │
│  │                   Service Layer                               │  │
│  │                                                               │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │  │
│  │  │  File    │  │  User    │  │  App     │  │  AI         │  │  │
│  │  │  Service │  │  Service │  │  Service │  │  Service    │  │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘  │  │
│  └───────┼──────────────┼──────────────┼──────────────┼─────────┘  │
│          │              │              │              │             │
│  ┌───────▼──────────────▼──────────────▼──────────────▼─────────┐  │
│  │                   Data Layer                                  │  │
│  │                                                               │  │
│  │  ┌────────────┐  ┌─────────┐  ┌────────────┐  ┌───────────┐  │  │
│  │  │ PostgreSQL │  │  Redis  │  │   MinIO    │  │Meilisearch│  │  │
│  │  │ (Users,    │  │ (Cache, │  │ (Files,    │  │ (Search)  │  │  │
│  │  │  Apps,     │  │  Auth   │  │  Objects)  │  │           │  │  │
│  │  │  Settings) │  │  Queue) │  │            │  │           │  │  │
│  │  └────────────┘  └─────────┘  └────────────┘  └───────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture (Frontend Detail)

```
Desktop Shell
│
├── Core/
│   ├── Kernel (boot sequence, service registry, event bus)
│   ├── ProcessManager (app lifecycle: spawn, kill, focus, minimize)
│   ├── WindowManager (position, resize, snap, z-index, multi-desktop)
│   └── VirtualFileSystem (abstraksi di atas OPFS/S3/IndexedDB)
│
├── Shell UI/
│   ├── Taskbar (top bar: clock, system tray, search, app menu)
│   ├── Dock (bottom: pinned apps, running apps indicator)
│   ├── Desktop (wallpaper, shortcuts, right-click context menu)
│   ├── NotificationCenter (toast + sidebar panel)
│   ├── LockScreen (login, clock, wallpaper blur)
│   └── ContextMenu (global right-click system)
│
├── System Apps/ (built-in, native SolidJS)
│   ├── FileManager (grid/list view, breadcrumb, drag-drop, preview)
│   ├── Terminal (xterm.js, multi-tab, themes)
│   ├── Settings (appearance, accounts, storage, apps, about)
│   ├── TextEditor (Monaco Editor / CodeMirror 6)
│   ├── ImageViewer (zoom, rotate, slideshow)
│   ├── MediaPlayer (video.js, audio visualizer)
│   ├── Browser (embedded iframe browser)
│   ├── AppStore (install/uninstall third-party apps)
│   └── AIAssistant (chat UI, connect ke LLM API)
│
├── Sandboxed Apps/ (third-party, iframe-isolated)
│   ├── Loaded via App Manifest (manifest.json)
│   ├── Communication via postMessage API
│   └── Permission system (fs access, network, notifications)
│
└── Services/
    ├── AuthService (login state, token refresh)
    ├── StorageService (OPFS + cloud sync bridge)
    ├── ThemeService (dark/light/custom, accent colors, wallpaper)
    ├── ShortcutService (keyboard shortcuts, hotkeys)
    ├── DragDropService (cross-window drag & drop)
    └── WebSocketService (real-time connection manager)
```

---

## 3. Data Flow

```
User Action (click, drag, keyboard)
       │
       ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Shell UI   │───▶│ EventBus     │───▶│ ProcessManager  │
│  Component  │    │ (pub/sub)    │    │ (app lifecycle) │
└─────────────┘    └──────────────┘    └────────┬────────┘
                                                │
                          ┌─────────────────────┼───────────────────┐
                          ▼                     ▼                   ▼
                   ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
                   │ Window      │    │ VFS          │    │ API Client   │
                   │ Manager     │    │ (local ops)  │    │ (remote ops) │
                   └─────────────┘    └──────┬───────┘    └──────┬───────┘
                                             │                    │
                                             ▼                    ▼
                                      ┌─────────────┐    ┌──────────────┐
                                      │ OPFS /      │    │ Backend API  │
                                      │ IndexedDB   │    │ (WebSocket)  │
                                      └─────────────┘    └──────────────┘
```

---

## 4. Window Manager Detail

```
Window State Machine:

  ┌─────────┐   open    ┌──────────┐   maximize   ┌────────────┐
  │ CLOSED  │─────────▶│  NORMAL  │────────────▶│ MAXIMIZED  │
  └─────────┘          └──────────┘              └────────────┘
       ▲                 │  ▲   │                   │
       │          minimize│  │   │ snap              │ restore
       │                 ▼  │   ▼                   │
       │            ┌──────────┐  ┌──────────┐      │
       │            │MINIMIZED │  │ SNAPPED  │      │
       │            └──────────┘  │(L/R/quad)│      │
       │                          └──────────┘      │
       │              close                         │
       └────────────────────────────────────────────┘

Window Properties:
  - id, title, icon, appId
  - x, y, width, height
  - zIndex, state (normal/min/max/snapped)
  - snapZone (left/right/top-left/top-right/bottom-left/bottom-right)
  - desktopId (multi-desktop support)
  - resizable, draggable, closable, minimizable
```

---

## 5. App Manifest System

```json
{
  "id": "com.cloudos.calculator",
  "name": "Calculator",
  "version": "1.0.0",
  "icon": "/apps/calculator/icon.svg",
  "entry": "/apps/calculator/index.html",
  "type": "sandboxed",
  "window": {
    "width": 320,
    "height": 480,
    "resizable": false,
    "minWidth": 280,
    "minHeight": 400
  },
  "permissions": [
    "clipboard.read",
    "clipboard.write"
  ],
  "categories": ["utilities"],
  "author": "CloudOS Team",
  "description": "Simple calculator app"
}
```

---

## 6. Project Structure

```
cloudos/
│
├── README.md
├── LICENSE
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── turbo.json                    # Turborepo config (monorepo)
├── package.json                  # Root workspace
│
├── packages/                     # Shared packages
│   │
│   ├── shared/                   # Shared types & utilities
│   │   ├── package.json
│   │   └── src/
│   │       ├── types/
│   │       │   ├── window.ts         # Window state types
│   │       │   ├── file-system.ts    # VFS types
│   │       │   ├── app.ts            # App manifest types
│   │       │   ├── user.ts           # User & auth types
│   │       │   ├── events.ts         # Event bus message types
│   │       │   └── index.ts
│   │       ├── constants/
│   │       │   ├── keybindings.ts    # Default keyboard shortcuts
│   │       │   ├── mime-types.ts     # File type mappings
│   │       │   └── permissions.ts    # App permission definitions
│   │       └── utils/
│   │           ├── path.ts           # Path manipulation utils
│   │           ├── format.ts         # File size, date formatters
│   │           └── id.ts             # UUID/nanoid generators
│   │
│   └── api-client/               # Type-safe API client
│       ├── package.json
│       └── src/
│           ├── client.ts             # HTTP + WebSocket client
│           ├── endpoints/
│           │   ├── auth.ts
│           │   ├── files.ts
│           │   ├── apps.ts
│           │   └── users.ts
│           └── index.ts
│
├── apps/                         # Main applications
│   │
│   ├── desktop/                  # Desktop Shell (SolidJS) ← MAIN FRONTEND
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   ├── public/
│   │   │   ├── wallpapers/           # Default wallpapers
│   │   │   ├── sounds/               # System sounds
│   │   │   └── fonts/                # System fonts
│   │   └── src/
│   │       ├── index.tsx             # Entry point
│   │       ├── App.tsx               # Root component
│   │       │
│   │       ├── core/                 # OS Core (kernel-level)
│   │       │   ├── kernel.ts             # Boot sequence, init services
│   │       │   ├── event-bus.ts          # Global pub/sub event system
│   │       │   ├── process-manager.ts    # App lifecycle management
│   │       │   ├── window-manager.ts     # Window state, z-index, focus
│   │       │   ├── desktop-manager.ts    # Multi-desktop/workspace
│   │       │   ├── shortcut-manager.ts   # Keyboard shortcut registry
│   │       │   ├── drag-drop-manager.ts  # Cross-window drag & drop
│   │       │   ├── clipboard-manager.ts  # System clipboard
│   │       │   └── notification-manager.ts
│   │       │
│   │       ├── vfs/                  # Virtual File System
│   │       │   ├── vfs.ts                # VFS abstraction layer
│   │       │   ├── adapters/
│   │       │   │   ├── opfs-adapter.ts       # Origin Private FS
│   │       │   │   ├── s3-adapter.ts         # MinIO/S3 remote
│   │       │   │   └── indexeddb-adapter.ts  # Fallback
│   │       │   └── watcher.ts            # File change watcher
│   │       │
│   │       ├── shell/                # Desktop Shell UI
│   │       │   ├── Desktop.tsx           # Desktop surface
│   │       │   ├── Taskbar.tsx           # Top bar
│   │       │   ├── Dock.tsx              # Bottom dock
│   │       │   ├── StartMenu.tsx         # App launcher
│   │       │   ├── SystemTray.tsx        # Clock, wifi, battery
│   │       │   ├── SearchBar.tsx         # Global search
│   │       │   ├── LockScreen.tsx        # Lock/login screen
│   │       │   ├── NotificationCenter.tsx
│   │       │   └── ContextMenu.tsx       # Right-click menus
│   │       │
│   │       ├── window/               # Window System
│   │       │   ├── Window.tsx            # Window chrome (title bar, controls)
│   │       │   ├── WindowContent.tsx     # Content area (native or iframe)
│   │       │   ├── SnapOverlay.tsx       # Snap zone preview
│   │       │   └── WindowSwitcher.tsx    # Alt-Tab overlay
│   │       │
│   │       ├── theme/                # Theming Engine
│   │       │   ├── theme-provider.tsx    # Theme context
│   │       │   ├── themes/
│   │       │   │   ├── light.ts
│   │       │   │   ├── dark.ts
│   │       │   │   └── custom.ts         # User-defined themes
│   │       │   └── css/
│   │       │       ├── variables.css     # CSS custom properties
│   │       │       ├── glass.css         # Glassmorphism effects
│   │       │       └── animations.css    # System animations
│   │       │
│   │       ├── stores/               # State Management (Solid stores)
│   │       │   ├── window-store.ts       # All window states
│   │       │   ├── process-store.ts      # Running processes
│   │       │   ├── fs-store.ts           # File system cache
│   │       │   ├── auth-store.ts         # Auth state
│   │       │   ├── theme-store.ts        # Theme preferences
│   │       │   ├── settings-store.ts     # User settings
│   │       │   └── notification-store.ts
│   │       │
│   │       └── hooks/                # Reusable Solid primitives
│   │           ├── useWindow.ts          # Window operations
│   │           ├── useFileSystem.ts      # VFS operations
│   │           ├── useContextMenu.ts     # Context menu trigger
│   │           ├── useDragResize.ts      # Window drag/resize
│   │           ├── useKeyboard.ts        # Keyboard shortcuts
│   │           └── useWebSocket.ts       # WS connection
│   │
│   ├── system-apps/              # Built-in System Applications
│   │   │
│   │   ├── file-manager/
│   │   │   ├── package.json
│   │   │   └── src/
│   │   │       ├── FileManager.tsx       # Main component
│   │   │       ├── Sidebar.tsx           # Navigation (favorites, tree)
│   │   │       ├── FileGrid.tsx          # Grid view
│   │   │       ├── FileList.tsx          # List/detail view
│   │   │       ├── Breadcrumb.tsx        # Path navigation
│   │   │       ├── FilePreview.tsx       # Quick look panel
│   │   │       ├── UploadDialog.tsx      # Upload progress
│   │   │       └── manifest.json
│   │   │
│   │   ├── terminal/
│   │   │   ├── package.json
│   │   │   └── src/
│   │   │       ├── Terminal.tsx          # xterm.js wrapper
│   │   │       ├── TabBar.tsx            # Multi-tab terminal
│   │   │       ├── themes.ts             # Terminal color schemes
│   │   │       └── manifest.json
│   │   │
│   │   ├── settings/
│   │   │   ├── package.json
│   │   │   └── src/
│   │   │       ├── Settings.tsx          # Main settings
│   │   │       ├── pages/
│   │   │       │   ├── Appearance.tsx        # Theme, wallpaper, dock
│   │   │       │   ├── Accounts.tsx          # User profile, auth
│   │   │       │   ├── Storage.tsx           # Disk usage, cloud sync
│   │   │       │   ├── Apps.tsx              # Installed apps, defaults
│   │   │       │   ├── Keyboard.tsx          # Shortcut customization
│   │   │       │   ├── Display.tsx           # Resolution, scaling
│   │   │       │   └── About.tsx             # System info
│   │   │       └── manifest.json
│   │   │
│   │   ├── text-editor/
│   │   │   ├── package.json
│   │   │   └── src/
│   │   │       ├── TextEditor.tsx        # Monaco/CodeMirror wrapper
│   │   │       ├── TabBar.tsx            # Multi-file tabs
│   │   │       ├── Minimap.tsx           # Code minimap
│   │   │       └── manifest.json
│   │   │
│   │   ├── image-viewer/
│   │   │   └── src/
│   │   │       ├── ImageViewer.tsx        # Zoom, rotate, pan
│   │   │       └── manifest.json
│   │   │
│   │   ├── media-player/
│   │   │   └── src/
│   │   │       ├── MediaPlayer.tsx        # Video + audio player
│   │   │       └── manifest.json
│   │   │
│   │   ├── app-store/
│   │   │   └── src/
│   │   │       ├── AppStore.tsx           # Browse, install, update
│   │   │       ├── AppCard.tsx            # App listing card
│   │   │       └── manifest.json
│   │   │
│   │   └── ai-assistant/
│   │       └── src/
│   │           ├── AIAssistant.tsx        # Chat UI
│   │           ├── MessageBubble.tsx      # Message rendering
│   │           └── manifest.json
│   │
│   └── server/                   # Backend Server
│       ├── package.json          # (atau go.mod / Cargo.toml)
│       ├── Dockerfile
│       └── src/
│           ├── index.ts              # Server entry (Hono/Bun)
│           ├── config.ts             # Environment config
│           │
│           ├── routes/
│           │   ├── auth.ts               # /api/auth/*
│           │   ├── files.ts              # /api/files/*
│           │   ├── apps.ts               # /api/apps/*
│           │   ├── users.ts              # /api/users/*
│           │   ├── search.ts             # /api/search/*
│           │   └── ai.ts                 # /api/ai/*
│           │
│           ├── services/
│           │   ├── auth-service.ts       # JWT, OAuth, sessions
│           │   ├── file-service.ts       # MinIO operations
│           │   ├── user-service.ts       # User CRUD
│           │   ├── app-service.ts        # App registry
│           │   ├── search-service.ts     # Meilisearch integration
│           │   └── ai-service.ts         # LLM API proxy
│           │
│           ├── ws/
│           │   ├── handler.ts            # WebSocket connection handler
│           │   ├── terminal.ts           # PTY ↔ WebSocket bridge
│           │   ├── file-sync.ts          # Real-time file sync
│           │   └── notifications.ts      # Push notifications
│           │
│           ├── db/
│           │   ├── schema.ts             # Drizzle schema
│           │   ├── migrations/           # SQL migrations
│           │   └── seed.ts               # Default data
│           │
│           └── middleware/
│               ├── auth.ts               # JWT validation
│               ├── rate-limit.ts         # Rate limiting
│               └── cors.ts               # CORS config
│
├── infra/                        # Infrastructure
│   ├── docker/
│   │   ├── Dockerfile.desktop        # Frontend build
│   │   ├── Dockerfile.server         # Backend build
│   │   └── nginx.conf                # Reverse proxy config
│   ├── k8s/                          # Kubernetes (optional, untuk scale)
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── ingress.yaml
│   └── scripts/
│       ├── setup.sh                  # One-click setup
│       ├── backup.sh                 # Database + files backup
│       └── deploy.sh                 # Production deploy
│
└── docs/                         # Documentation
    ├── getting-started.md
    ├── architecture.md
    ├── api-reference.md
    ├── app-development.md            # Guide bikin third-party app
    ├── theming.md                    # Cara bikin custom theme
    └── self-hosting.md               # Deploy guide
```

---

## 7. Database Schema

```sql
-- Users
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    username    VARCHAR(50) UNIQUE NOT NULL,
    password    VARCHAR(255),  -- nullable (OAuth users)
    avatar_url  TEXT,
    storage_quota BIGINT DEFAULT 5368709120,  -- 5GB default
    storage_used  BIGINT DEFAULT 0,
    settings    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Files & Folders
CREATE TABLE files (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    path        TEXT NOT NULL,              -- /documents/work/report.pdf
    parent_id   UUID REFERENCES files(id), -- null = root
    is_dir      BOOLEAN DEFAULT FALSE,
    mime_type   VARCHAR(100),
    size        BIGINT DEFAULT 0,
    s3_key      TEXT,                       -- MinIO object key
    checksum    VARCHAR(64),               -- SHA-256
    is_trashed  BOOLEAN DEFAULT FALSE,
    shared      BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, path)
);

-- Installed Apps (per user)
CREATE TABLE user_apps (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    app_id      VARCHAR(100) NOT NULL,     -- com.cloudos.calculator
    version     VARCHAR(20),
    pinned      BOOLEAN DEFAULT FALSE,     -- pinned to dock
    position    INT,                       -- dock position
    settings    JSONB DEFAULT '{}',
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, app_id)
);

-- App Store Registry
CREATE TABLE apps (
    id          VARCHAR(100) PRIMARY KEY,  -- com.cloudos.calculator
    name        VARCHAR(100) NOT NULL,
    author      VARCHAR(100),
    description TEXT,
    icon_url    TEXT,
    entry_url   TEXT NOT NULL,
    manifest    JSONB NOT NULL,
    version     VARCHAR(20),
    downloads   INT DEFAULT 0,
    rating      DECIMAL(2,1) DEFAULT 0,
    category    VARCHAR(50),
    published   BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions
CREATE TABLE sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(500) UNIQUE NOT NULL,
    ip_address  INET,
    user_agent  TEXT,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Shared Files
CREATE TABLE file_shares (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id     UUID REFERENCES files(id) ON DELETE CASCADE,
    shared_by   UUID REFERENCES users(id),
    shared_with UUID REFERENCES users(id),  -- null = public link
    share_token VARCHAR(100) UNIQUE,
    permission  VARCHAR(10) DEFAULT 'read', -- read, write
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_files_user_path ON files(user_id, path);
CREATE INDEX idx_files_parent ON files(parent_id);
CREATE INDEX idx_files_user_trashed ON files(user_id, is_trashed);
CREATE INDEX idx_user_apps_user ON user_apps(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

---

## 8. API Endpoints

```
Auth:
  POST   /api/auth/register         # Register new user
  POST   /api/auth/login             # Login (email/password)
  POST   /api/auth/oauth/:provider   # OAuth login (Google, GitHub)
  POST   /api/auth/logout            # Logout
  POST   /api/auth/refresh           # Refresh JWT token
  GET    /api/auth/me                # Get current user

Files:
  GET    /api/files?path=/docs       # List directory
  GET    /api/files/:id              # Get file metadata
  GET    /api/files/:id/download     # Download file
  POST   /api/files/upload           # Upload file(s)
  POST   /api/files/mkdir            # Create directory
  PATCH  /api/files/:id              # Rename / move
  DELETE /api/files/:id              # Delete (trash)
  POST   /api/files/:id/share        # Share file
  GET    /api/files/search?q=term    # Search files

Apps:
  GET    /api/apps                   # List app store
  GET    /api/apps/:id               # Get app details
  POST   /api/apps/:id/install       # Install app
  DELETE /api/apps/:id/uninstall     # Uninstall app
  GET    /api/apps/installed         # User's installed apps

Users:
  GET    /api/users/settings         # Get user settings
  PATCH  /api/users/settings         # Update settings
  PATCH  /api/users/avatar           # Update avatar
  GET    /api/users/storage          # Storage usage info

WebSocket:
  WS     /ws/terminal               # Terminal PTY
  WS     /ws/files                   # File change notifications
  WS     /ws/notifications           # Push notifications
```

---

## 9. Tech Stack Summary

```
┌──────────────────────────────────────────────────────┐
│                    TECH STACK                         │
├───────────────┬──────────────────────────────────────┤
│ Frontend      │ SolidJS + TypeScript + Vite          │
│ Styling       │ Tailwind CSS + CSS Custom Properties │
│ State         │ Solid Stores (built-in reactivity)   │
│ Terminal      │ xterm.js                             │
│ Code Editor   │ Monaco Editor                        │
│ Animations    │ Motion One + CSS Animations          │
├───────────────┼──────────────────────────────────────┤
│ Backend       │ Bun + Hono (TypeScript)              │
│ WebSocket     │ Bun native WebSocket                 │
│ Auth          │ JWT + OAuth2 (Google, GitHub)         │
│ Validation    │ Zod                                  │
├───────────────┼──────────────────────────────────────┤
│ Database      │ PostgreSQL (Drizzle ORM)             │
│ Cache         │ Redis / Valkey                       │
│ Object Store  │ MinIO (S3-compatible)                │
│ Search        │ Meilisearch                          │
├───────────────┼──────────────────────────────────────┤
│ Monorepo      │ Turborepo                            │
│ Package Mgr   │ pnpm                                 │
│ Linting       │ Biome (lint + format)                │
│ Testing       │ Vitest + Playwright                  │
│ CI/CD         │ GitHub Actions                       │
│ Deploy        │ Docker + Docker Compose              │
│ Reverse Proxy │ Caddy (auto-SSL)                     │
└───────────────┴──────────────────────────────────────┘
```

---

## 10. Roadmap

### Phase 1 — Core OS Shell (MVP) ⏱️ ~3-4 minggu
- [ ] Desktop surface + wallpaper
- [ ] Window Manager (drag, resize, minimize, maximize, snap)
- [ ] Taskbar + Dock
- [ ] Start Menu / App Launcher
- [ ] Context Menu system
- [ ] Theme engine (light/dark)
- [ ] Basic auth (register/login)

### Phase 2 — System Apps ⏱️ ~3-4 minggu
- [ ] File Manager (upload, download, preview, CRUD)
- [ ] Terminal (xterm.js + WebSocket PTY)
- [ ] Text Editor (Monaco)
- [ ] Image Viewer
- [ ] Settings app
- [ ] Notification system

### Phase 3 — Cloud & Storage ⏱️ ~2-3 minggu
- [ ] MinIO integration (cloud storage)
- [ ] File sync (local ↔ cloud)
- [ ] File sharing (public links, user-to-user)
- [ ] Search (Meilisearch)
- [ ] Storage quota management

### Phase 4 — Ecosystem ⏱️ ~3-4 minggu
- [ ] App manifest system
- [ ] Sandboxed iframe apps
- [ ] App Store (browse, install, rate)
- [ ] AI Assistant integration
- [ ] Multi-desktop / workspace
- [ ] Keyboard shortcuts customization
- [ ] Media Player
