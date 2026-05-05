# Getting Started

This guide walks you from a fresh clone to a running CloudOS desktop in your
browser, plus optional setup of the Go backend, Postgres, MinIO, and
Meilisearch.

## Prerequisites

| Tool        | Version       | Why                                               |
| ----------- | ------------- | ------------------------------------------------- |
| Node.js     | 22+           | Runs the Vite dev server                          |
| pnpm        | 9.15.0+       | Workspace package manager                         |
| Go          | 1.23+         | Builds the backend (only if you run the API)      |
| Docker      | 24+           | One-shot setup of all infra (Postgres/Minio/etc.) |
| Caddy       | 2.7+          | Optional, for production reverse-proxy            |

If you're only doing frontend work, Node + pnpm are sufficient.

## Frontend only (fastest path)

```bash
git clone https://github.com/yowanda/cloudos.git
cd cloudos
pnpm install
pnpm turbo build       # one-shot build sanity check
pnpm dev               # starts Vite on http://localhost:4100
```

Open http://localhost:4100 — the boot screen will appear, then the desktop
loads. All persistence is local (localStorage + optional OPFS); no server is
required for the default in-memory VFS adapter.

### Default login

The boot flow auto-creates a `yowanda` account on first launch. From the
**Settings → Accounts** page you can rename or change credentials.

## Full stack (frontend + Go backend + infra)

```bash
docker compose up -d   # postgres + redis + minio + meilisearch + server + frontend
```

This brings up:

| Service       | URL                     | Notes                            |
| ------------- | ----------------------- | -------------------------------- |
| Frontend      | http://localhost:4100   | Built bundle served via nginx    |
| Server        | http://localhost:3000   | Go + Fiber API                   |
| Postgres      | localhost:5432          | `cloudos / cloudos`              |
| Redis         | localhost:6379          |                                  |
| MinIO console | http://localhost:9001   | `minioadmin / minioadmin`        |
| Meilisearch   | http://localhost:7700   | No master key in dev             |

### Hot reload during development

```bash
# Terminal 1 — backend
cd apps/server
go run ./cmd/server

# Terminal 2 — frontend
pnpm dev
```

Set `VITE_API_BASE=http://localhost:3000/api/v1` in `.env.local` if you want
the frontend's "Remote" VFS adapter to point at your local server.

## Switching the VFS backend

Open **Settings → Backend** in the running desktop. You'll see three
adapters:

- **In-memory** (default). Fast, persists via localStorage.
- **OPFS**. Browser-native persistent file system. No setup needed; click
  "Use" and the desktop syncs the in-memory snapshot to OPFS.
- **Remote**. Set the base URL to your CloudOS server (e.g.
  `http://localhost:3000/api/v1`) and click "Use". You may also paste an
  auth bearer token if you have JWT auth enabled on the server.

The desktop debounces saves at 800 ms and pulls a snapshot from the active
backend on every page load.

## Running the test/build matrix locally

```bash
pnpm turbo build      # SolidJS build (Vite)
pnpm turbo lint       # baseline lint (currently has known warnings)

cd apps/server
go vet ./...
go build ./...
```

CI runs the same commands — see `.github/workflows/ci.yml`.

## Deploying behind Caddy (production preview)

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
# edit cloudos.example.com → your domain
sudo systemctl reload caddy
```

Caddy auto-provisions Let's Encrypt certs on first hit. The Caddyfile routes
`/api/*` to the Go backend and everything else to the frontend SPA bundle.

## Backups

```bash
deploy/backup.sh   # writes a tar.zst into $BACKUP_DIR
```

See [`deploy/backup.sh`](../deploy/backup.sh) for env var documentation
(Postgres credentials, MinIO bucket alias, retention days).

## Troubleshooting

- **Build fails with `Cannot find module 'solid-js'`** — run `pnpm install`
  again from the repo root, not from a sub-package.
- **OPFS adapter shows "Unavailable"** — your browser session is in private
  mode or running over plain HTTP. OPFS requires a secure context; use the
  `deploy/Caddyfile.dev` template to terminate TLS at localhost.
- **Remote adapter health check fails** — confirm the server is up at the
  configured base URL (`curl http://localhost:3000/api/v1/vfs/health` should
  return `{"status":"ok",...}`).
- **Workflows blocked on push** — see
  [`.github/workflows/README.md`](../.github/workflows/README.md). You need a
  PAT with the `workflow` scope to push files under `.github/workflows/`.

## Next steps

- [Architecture overview](./ARCHITECTURE.md)
- [Building third-party apps](./APP_DEV.md)
- [Self-hosting guide](./SELF_HOSTING.md)
- [API reference](./API.md)
- [Theming guide](./THEMING.md)
