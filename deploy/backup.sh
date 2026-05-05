#!/usr/bin/env bash
# CloudOS backup script
# ────────────────────────────────────────────────────────────────────────
# Snapshots Postgres + MinIO + VFS snapshot directory into a single
# timestamped archive at $BACKUP_DIR. Designed to run from cron.
#
# Required env (or override):
#   PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DB
#   MC_ALIAS, MC_BUCKET                  # MinIO bucket name + mc alias
#   VFS_DATA_DIR                         # data/vfs/ from cloudos-server
#   BACKUP_DIR
#   RETENTION_DAYS (default: 14)
#
# Example cron (daily at 03:00 UTC):
#   0 3 * * * /opt/cloudos/deploy/backup.sh >> /var/log/cloudos-backup.log 2>&1

set -euo pipefail

PG_HOST="${PG_HOST:-postgres}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-cloudos}"
PG_PASSWORD="${PG_PASSWORD:-cloudos}"
PG_DB="${PG_DB:-cloudos}"

MC_ALIAS="${MC_ALIAS:-cloudos}"
MC_BUCKET="${MC_BUCKET:-cloudos-files}"

VFS_DATA_DIR="${VFS_DATA_DIR:-/srv/cloudos/data/vfs}"
BACKUP_DIR="${BACKUP_DIR:-/srv/cloudos/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
work="$(mktemp -d -t cloudos-backup-XXXXXX)"
trap 'rm -rf "$work"' EXIT

echo "==> CloudOS backup $ts"
mkdir -p "$BACKUP_DIR"

echo "    [1/3] postgres (pg_dump)"
PGPASSWORD="$PG_PASSWORD" pg_dump \
	--host="$PG_HOST" --port="$PG_PORT" --username="$PG_USER" --dbname="$PG_DB" \
	--no-owner --no-privileges --format=custom \
	> "$work/postgres.dump"

echo "    [2/3] minio bucket $MC_BUCKET"
mc mirror --quiet --overwrite "$MC_ALIAS/$MC_BUCKET" "$work/minio/$MC_BUCKET"

if [ -d "$VFS_DATA_DIR" ]; then
	echo "    [3/3] vfs snapshots ($VFS_DATA_DIR)"
	cp -r "$VFS_DATA_DIR" "$work/vfs"
else
	echo "    [3/3] vfs snapshots: $VFS_DATA_DIR not found, skipping"
fi

archive="$BACKUP_DIR/cloudos-$ts.tar.zst"
echo "==> Compressing → $archive"
tar --use-compress-program="zstd -19 -T0" -cf "$archive" -C "$work" .

echo "==> Pruning archives older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -type f -name 'cloudos-*.tar.zst' -mtime "+$RETENTION_DAYS" -print -delete

echo "==> Done. $(du -h "$archive" | cut -f1) at $archive"
