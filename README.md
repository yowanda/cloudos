# CloudOS

**Browser-Based Operating System** — Open Source Internet OS

A modern, self-hostable browser-based operating system built with SolidJS, TypeScript, and Bun. Designed to be fast, extensible, and beautiful.

## Features (Planned)

- Desktop environment with window manager (drag, resize, snap, multi-desktop)
- Virtual File System with cloud sync (MinIO/S3)
- Built-in system apps (File Manager, Terminal, Text Editor, Settings, etc.)
- Sandboxed third-party app ecosystem with App Store
- AI Assistant integration
- Theming engine (light/dark/custom)
- Real-time collaboration & file sharing

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | SolidJS + TypeScript + Vite |
| Styling | Tailwind CSS |
| Backend | Bun + Hono |
| Database | PostgreSQL + Drizzle ORM |
| Cache | Redis / Valkey |
| Object Storage | MinIO (S3-compatible) |
| Search | Meilisearch |
| Terminal | xterm.js |
| Code Editor | Monaco Editor |
| Monorepo | Turborepo + pnpm |
| Deploy | Docker + Docker Compose |

## Project Status

**Phase 1 — Core OS Shell** (In Planning)

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) and [ROADMAP.md](./docs/ROADMAP.md) for full details.

## License

AGPL-3.0
