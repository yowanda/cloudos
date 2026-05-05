# API reference

CloudOS exposes a Go + Fiber HTTP API at `/api/v1`. All endpoints return JSON
unless noted. Protected endpoints require a JWT bearer token in the
`Authorization: Bearer <token>` header.

## Base URL

| Environment | URL                              |
| ----------- | -------------------------------- |
| Local dev   | `http://localhost:3000`          |
| Production  | `https://your-domain` (via Caddy) |

## Health

### `GET /health`

Liveness probe. Always 200 OK if the process is running.

```json
{
  "status": "ok",
  "service": "cloudos-server",
  "version": "0.1.0"
}
```

### `GET /ready`

Readiness probe. 200 if all downstream deps healthy, 503 otherwise. Used by
Docker compose / Kubernetes readiness probes.

```json
{
  "ready": true,
  "checks": {
    "database": { "ok": true, "error": "" },
    "s3":       { "ok": true, "error": "" }
  }
}
```

## Authentication

### `POST /api/v1/auth/register`

```json
{ "email": "user@example.com", "username": "alice", "password": "..." }
```

Returns:

```json
{
  "user":  { "id": "...", "email": "...", "username": "...", ... },
  "token": "eyJhbGciOi..."
}
```

### `POST /api/v1/auth/login`

Same payload as register without the username; returns the same shape.

### `GET /api/v1/auth/me`

**Auth required.** Returns the current user from the bearer token.

## Files

All endpoints are `Auth required.`

### `GET /api/v1/files?path=/Documents`

List directory contents. Returns `[]File`.

### `POST /api/v1/files/mkdir`

```json
{ "path": "/Documents", "name": "Notes" }
```

### `POST /api/v1/files/upload`

Multipart form: `file` (the binary), `path` (parent directory).

### `GET /api/v1/files/:id/download`

Returns a 302 redirect to a presigned MinIO/S3 URL with a 5-minute TTL.

### `DELETE /api/v1/files/:id`

Soft-delete (sets `is_trashed = true` in DB).

### `PATCH /api/v1/files/:id/rename`

```json
{ "name": "new-name.txt" }
```

## VFS snapshot (browser "Remote" adapter)

Used by the desktop's pluggable VFS layer to push/pull a complete file-system
JSON document. See [`apps/desktop/src/vfs/adapters/remote.ts`](../apps/desktop/src/vfs/adapters/remote.ts).

### `GET /api/v1/vfs/health`

**Public.** Quick probe used by the desktop to test reachability before
switching backends.

### `GET /api/v1/vfs/snapshot`

**Auth required.** Returns the user's snapshot. 404 if none exists yet.

```json
{
  "entries": [ { "name": "...", "path": "/...", "isDir": false, "content": "...", ... } ]
}
```

### `PUT /api/v1/vfs/snapshot`

**Auth required.** Replaces the user's snapshot atomically.

```json
{ "ok": true, "bytes": 124592 }
```

### `DELETE /api/v1/vfs/snapshot`

**Auth required.** Removes the snapshot.

## File sharing

### `POST /api/v1/shares`

**Auth required.** Create a public share for a file you own.

```json
{ "file_id": "uuid", "permission": "read|comment|write", "expires_in_days": 7 }
```

Returns the full `FileShare` row, including the random `share_token`.

### `GET /api/v1/shares`

**Auth required.** List your shares.

### `DELETE /api/v1/shares/:id`

**Auth required.** Revoke a share.

### `GET /api/v1/shares/by-token/:token`

**Public.** Resolve a share token. 404 if unknown, 410 if expired. Returns:

```json
{
  "share": { "id": "...", "permission": "read", "expires_at": "..." },
  "file":  { "id": "...", "name": "...", "size": 1234, "mime_type": "..." }
}
```

The desktop's `SharedFileViewer` (rendered when `?share=<token>` is in the
URL) reads from the local share store first; this endpoint is the
multi-user fallback.

## App Store

Read-only metadata for installable apps:

### `GET /api/v1/apps`

Returns published apps (`Published = true`). Filter via `?category=...` and
`?q=...` query params (server-side).

## Error format

```json
{ "error": "human-readable message" }
```

HTTP status codes follow standard semantics:

- `400` invalid payload
- `401` missing or invalid JWT
- `403` action not permitted
- `404` resource not found
- `410` resource expired (shares)
- `500` server error

## OpenAPI

A machine-readable schema is on the roadmap (`docs/openapi.yaml`). For now
the source-of-truth is [`apps/server/cmd/server/main.go`](../apps/server/cmd/server/main.go)
and the handlers under `apps/server/internal/handlers/`.
