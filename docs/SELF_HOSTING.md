# Self-hosting CloudOS

This document describes how to run a production CloudOS instance for a small
team or for personal use. Single-VPS deployments are well-supported; this
guide assumes one Linux VM with Docker. For multi-node Kubernetes, the same
container images apply but you'll need to author Helm charts yourself.

## Components

| Component       | Purpose                              | Image                                 |
| --------------- | ------------------------------------ | ------------------------------------- |
| `cloudos-server`| Go + Fiber API                       | `ghcr.io/yowanda/cloudos-server:latest` |
| `cloudos-desktop`| Static SolidJS bundle behind nginx  | `ghcr.io/yowanda/cloudos-desktop:latest` |
| Postgres        | User accounts, file metadata, shares | `postgres:16-alpine`                  |
| MinIO           | S3-compatible object storage         | `minio/minio:latest`                  |
| Redis           | Future use (sessions, queues)        | `redis:7-alpine`                      |
| Meilisearch     | Optional full-text search            | `getmeili/meilisearch:v1.11`          |
| Caddy           | TLS + reverse-proxy                  | `caddy:2-alpine`                      |

## One-VPS quickstart (recommended)

1. **Install Docker + Caddy** on the VPS:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo apt install -y caddy
   ```
2. **Clone CloudOS**:
   ```bash
   sudo mkdir -p /opt/cloudos
   sudo chown $USER /opt/cloudos
   git clone https://github.com/yowanda/cloudos.git /opt/cloudos
   cd /opt/cloudos
   ```
3. **Set production secrets**:
   ```bash
   cat > .env <<'EOF'
   JWT_SECRET=$(openssl rand -hex 32)
   POSTGRES_PASSWORD=$(openssl rand -hex 16)
   CORS_ORIGIN=https://cloudos.your-domain.com
   EOF
   ```
   Edit `docker-compose.yml` to read these via `${VAR}` (already wired for
   `JWT_SECRET` and `CORS_ORIGIN`).
4. **Bring up the stack**:
   ```bash
   docker compose up -d
   ```
5. **Configure Caddy**:
   ```bash
   sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
   sudo sed -i 's/cloudos.example.com/cloudos.your-domain.com/' /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```
   Caddy will provision a Let's Encrypt cert automatically on first request.
6. **Test**:
   ```bash
   curl -s https://cloudos.your-domain.com/api/v1/vfs/health
   # → {"status":"ok","kind":"vfs"}
   ```

## Backups

Run [`deploy/backup.sh`](../deploy/backup.sh) from cron:

```cron
0 3 * * * BACKUP_DIR=/srv/cloudos/backups VFS_DATA_DIR=/srv/cloudos/data/vfs PG_HOST=localhost MC_ALIAS=cloudos /opt/cloudos/deploy/backup.sh >> /var/log/cloudos-backup.log 2>&1
```

The script:
- runs `pg_dump --format=custom` against your Postgres
- mirrors the MinIO bucket via `mc mirror`
- copies the `data/vfs/` snapshots dir
- bundles everything as `cloudos-<timestamp>.tar.zst`
- prunes archives older than `RETENTION_DAYS` (default 14)

To restore:
```bash
zstd -d cloudos-20260115T030000Z.tar.zst -o /tmp/restore.tar
tar -xf /tmp/restore.tar -C /tmp/restore
PGPASSWORD=$POSTGRES_PASSWORD pg_restore -h localhost -U cloudos -d cloudos --clean /tmp/restore/postgres.dump
mc mirror /tmp/restore/minio/cloudos-files cloudos/cloudos-files
cp -r /tmp/restore/vfs /srv/cloudos/data/vfs
```

## Health checks

Both `/health` (liveness) and `/ready` (readiness) are exposed by the Go
server. Wire them to your monitoring system:

```bash
# Uptime probe
curl -fsS https://cloudos.your-domain.com/api/v1/../health || alert

# Readiness probe (returns 503 if DB or S3 down)
curl -fsS https://cloudos.your-domain.com/api/v1/../ready
```

(Or expose them directly via a Caddy `handle` block — they live at the
root of the Go server, not under `/api/v1`.)

## Scaling notes

- **Frontend** is a static bundle — put it behind a CDN if you have global
  users.
- **Backend** is stateless except for in-flight uploads streamed through it
  to MinIO. Multiple replicas can sit behind a load-balancer; share the
  same Postgres, MinIO, and Redis.
- **Postgres** is the bottleneck for write-heavy workloads. Promote to a
  managed Postgres (RDS, Crunchy, Supabase) before sharding.
- **MinIO** scales horizontally on disk; for very large fleets consider AWS
  S3 directly — the same `S3_*` env vars work, just point them at AWS.
- **Meilisearch** is single-node. Run it as a sidecar on the same VPS until
  you exceed ~10M documents.

## Updating

```bash
cd /opt/cloudos
git pull origin main
docker compose pull
docker compose up -d
```

The Go binary will run any pending GORM auto-migrations on boot. Tagged
releases (`v*.*.*`) push immutable images to GHCR — pin those in
`docker-compose.yml` (e.g. `ghcr.io/yowanda/cloudos-server:v0.2.0`) for
predictable rollbacks.

## Hardening checklist

- [ ] Change `JWT_SECRET` from any value committed to git.
- [ ] Change Postgres password from `cloudos`.
- [ ] Change MinIO credentials from `minioadmin/minioadmin`; remove the
      MinIO console port (9001) from public exposure.
- [ ] Set `MEILI_MASTER_KEY` and pass it as a Bearer token from the
      desktop's Search settings.
- [ ] Restrict the `CORS_ORIGIN` env var to your real domain.
- [ ] Remove the `/minio/` reverse-proxy block from `Caddyfile` if you
      don't need browser access to MinIO.
- [ ] Run `deploy/backup.sh` daily and copy the resulting tarball
      off-site (S3, B2, Backblaze, etc.).
- [ ] Subscribe to the `cloudos` GitHub repo's "Releases" feed so you're
      notified of security patches.
