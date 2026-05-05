package handlers

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"github.com/gofiber/fiber/v2"
)

// VFSHandler stores per-user (or per-tenant) full file-system snapshots.
//
// The browser sends the entire VFS as one JSON document; the server just
// persists it on disk so a future session can pull it back. As of stage 2
// of the per-entry diff-sync feature the snapshot is also augmented with
// a monotonic logical `Clock` plus a tombstone list, and a new
// `POST /api/v1/vfs/changes` endpoint accepts deltas (entries changed
// since `since` + paths deleted since `since`) and returns the inverse
// delta the client doesn't yet know about. Old PUT/GET snapshot endpoints
// remain in place for legacy clients.
type VFSHandler struct {
	dir string
	mu  sync.Mutex
}

// VFSEntry mirrors the desktop-side type. We don't validate the content here;
// the browser is the source of truth for shape.
type VFSEntry struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	IsDir     bool   `json:"isDir"`
	Size      int64  `json:"size"`
	MimeType  string `json:"mimeType,omitempty"`
	Content   string `json:"content,omitempty"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
	// Clock is the per-entry logical clock (B31). It is monotonic across
	// the whole VFS, advances on every mutation that touches the entry,
	// and is what the diff-sync protocol uses to decide which side has
	// the newer value (last-write-wins). Older clients won't send it; we
	// treat its absence as 0.
	Clock int64 `json:"clock,omitempty"`
}

// VFSTombstone is a record that a path was deleted. The server persists
// these so a future incremental pull from another device can be told
// "this path was deleted at clock N" — without tombstones the client
// would silently re-upload the entry it had locally.
type VFSTombstone struct {
	Path  string `json:"path"`
	Clock int64  `json:"clock"`
}

// VFSSnapshot is the serialised form on disk. The legacy PUT/GET
// endpoints used `{ entries: [...] }`; the new fields default to their
// zero values when an old snapshot is read, so legacy clients are
// unaffected.
type VFSSnapshot struct {
	Entries    []VFSEntry     `json:"entries"`
	Tombstones []VFSTombstone `json:"tombstones,omitempty"`
	Clock      int64          `json:"clock,omitempty"`
}

// VFSChangesRequest is what the desktop sends to the diff-sync endpoint
// after a local mutation: the watermark `Since` (the last clock the
// client has from the server), `Entries` that changed since that
// watermark on the client, and paths the client deleted since then.
type VFSChangesRequest struct {
	Since      int64          `json:"since"`
	Entries    []VFSEntry     `json:"entries"`
	Tombstones []VFSTombstone `json:"tombstones,omitempty"`
	// Deleted is a convenience shorthand the client may send instead of
	// fully-formed tombstones. Server stamps the current `Clock+1` on
	// each one so the deletion is observed by other devices.
	Deleted []string `json:"deleted,omitempty"`
}

// VFSChangesResponse is the inverse delta the server gives back: its
// post-merge `Clock`, plus every entry / tombstone the server knows about
// whose clock is strictly greater than the client's `since` and that the
// client did NOT include in the request (i.e. things the client doesn't
// have yet).
type VFSChangesResponse struct {
	Clock      int64          `json:"clock"`
	Entries    []VFSEntry     `json:"entries"`
	Tombstones []VFSTombstone `json:"tombstones"`
}

func NewVFSHandler(dir string) *VFSHandler {
	if dir == "" {
		dir = "data/vfs"
	}
	_ = os.MkdirAll(dir, 0o755)
	return &VFSHandler{dir: dir}
}

// userKey extracts the snapshot key from request context. Falls back to "anon"
// for unauthenticated callers (e.g. local dev).
func userKey(c *fiber.Ctx) string {
	if v := c.Locals("userId"); v != nil {
		if s, ok := v.(string); ok && s != "" {
			return "user-" + s
		}
	}
	return "anon"
}

func (h *VFSHandler) snapshotPath(c *fiber.Ctx) string {
	return filepath.Join(h.dir, userKey(c)+".json")
}

// readSnapshot loads the user's snapshot. Missing file → empty snapshot;
// corrupt file → error.
func (h *VFSHandler) readSnapshot(p string) (VFSSnapshot, error) {
	b, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return VFSSnapshot{}, nil
		}
		return VFSSnapshot{}, err
	}
	var snap VFSSnapshot
	if err := json.Unmarshal(b, &snap); err != nil {
		return VFSSnapshot{}, err
	}
	return snap, nil
}

func (h *VFSHandler) writeSnapshot(p string, snap VFSSnapshot) error {
	b, err := json.Marshal(&snap)
	if err != nil {
		return err
	}
	return os.WriteFile(p, b, 0o644)
}

// GET /api/v1/vfs/health
func (h *VFSHandler) Health(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"status": "ok", "kind": "vfs", "supportsChanges": true})
}

// GET /api/v1/vfs/snapshot
func (h *VFSHandler) GetSnapshot(c *fiber.Ctx) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	p := h.snapshotPath(c)
	snap, err := h.readSnapshot(p)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if snap.Entries == nil && snap.Clock == 0 && len(snap.Tombstones) == 0 {
		// Empty / missing — preserve the historical 404 behaviour so the
		// client treats this as "no remote snapshot yet".
		if _, err := os.Stat(p); os.IsNotExist(err) {
			return c.Status(404).JSON(fiber.Map{"error": "snapshot not found"})
		}
	}
	return c.JSON(snap)
}

// PUT /api/v1/vfs/snapshot — full-snapshot upload, used by the legacy
// "remote" adapter and as a fallback when the client opts out of
// incremental sync.
func (h *VFSHandler) PutSnapshot(c *fiber.Ctx) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	var snap VFSSnapshot
	if err := c.BodyParser(&snap); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	// Compute clock if absent: take the max of incoming entry clocks +
	// tombstone clocks. Old clients that never set Clock end up with 0.
	if snap.Clock == 0 {
		snap.Clock = computeMaxClock(snap)
	}
	if err := h.writeSnapshot(h.snapshotPath(c), snap); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true, "clock": snap.Clock})
}

// DELETE /api/v1/vfs/snapshot
func (h *VFSHandler) DeleteSnapshot(c *fiber.Ctx) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	if err := os.Remove(h.snapshotPath(c)); err != nil && !os.IsNotExist(err) {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// POST /api/v1/vfs/changes — incremental diff-sync entrypoint.
//
// The client sends a `since` watermark + the entries / tombstones it
// produced after that watermark. The server merges using last-write-wins
// by `Clock`, then returns the inverse delta: every entry / tombstone in
// the server's snapshot whose Clock > since AND that the client didn't
// already include. The response's `Clock` is the new server watermark
// the client should persist for next time.
//
// Conflict resolution is intentionally simple at stage 2 — last writer
// (highest clock) wins. Stage 3 will add real 3-way merge UI for cases
// where the client and server both modified the same path concurrently.
func (h *VFSHandler) ApplyChanges(c *fiber.Ctx) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	var req VFSChangesRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	p := h.snapshotPath(c)
	snap, err := h.readSnapshot(p)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Build server-side path → entry / tombstone maps for efficient merge.
	// The merge keeps whichever side has the larger Clock (LWW). Server's
	// pre-merge state is captured in `serverEntries` / `serverTombs` so
	// we can compute the inverse delta after applying client changes.
	serverEntries := make(map[string]VFSEntry, len(snap.Entries))
	for _, e := range snap.Entries {
		serverEntries[e.Path] = e
	}
	serverTombs := make(map[string]VFSTombstone, len(snap.Tombstones))
	for _, t := range snap.Tombstones {
		serverTombs[t.Path] = t
	}

	// Track what the client already has after this round so we don't
	// echo it back in the response.
	clientHasEntries := make(map[string]struct{}, len(req.Entries))
	clientHasTombs := make(map[string]struct{}, len(req.Tombstones)+len(req.Deleted))

	maxClock := snap.Clock

	// Apply incoming entries (LWW by Clock).
	for _, e := range req.Entries {
		clientHasEntries[e.Path] = struct{}{}
		if e.Clock > maxClock {
			maxClock = e.Clock
		}
		// If a tombstone exists with a *strictly greater* clock, the
		// deletion wins and we ignore the upsert. Otherwise the upsert
		// supersedes the tombstone.
		if t, ok := serverTombs[e.Path]; ok && t.Clock > e.Clock {
			continue
		}
		delete(serverTombs, e.Path)
		if existing, ok := serverEntries[e.Path]; !ok || e.Clock >= existing.Clock {
			serverEntries[e.Path] = e
		}
	}

	// Apply incoming tombstones (paths the client explicitly deleted).
	for _, t := range req.Tombstones {
		clientHasTombs[t.Path] = struct{}{}
		if t.Clock > maxClock {
			maxClock = t.Clock
		}
		if existing, ok := serverEntries[t.Path]; ok && existing.Clock > t.Clock {
			// Server has a newer entry than this deletion — ignore.
			continue
		}
		delete(serverEntries, t.Path)
		if cur, ok := serverTombs[t.Path]; !ok || t.Clock > cur.Clock {
			serverTombs[t.Path] = t
		}
	}

	// `Deleted` is the convenience form: just paths, server stamps a
	// fresh clock. Used by clients that don't yet track their own
	// tombstones with clocks.
	for _, path := range req.Deleted {
		clientHasTombs[path] = struct{}{}
		maxClock++
		t := VFSTombstone{Path: path, Clock: maxClock}
		if existing, ok := serverEntries[path]; ok && existing.Clock > t.Clock {
			continue
		}
		delete(serverEntries, path)
		if cur, ok := serverTombs[path]; !ok || t.Clock > cur.Clock {
			serverTombs[path] = t
		}
	}

	// Persist the merged snapshot.
	merged := VFSSnapshot{
		Entries:    make([]VFSEntry, 0, len(serverEntries)),
		Tombstones: make([]VFSTombstone, 0, len(serverTombs)),
		Clock:      maxClock,
	}
	for _, e := range serverEntries {
		merged.Entries = append(merged.Entries, e)
	}
	for _, t := range serverTombs {
		merged.Tombstones = append(merged.Tombstones, t)
	}
	if err := h.writeSnapshot(p, merged); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Compute response delta — entries / tombstones the client doesn't
	// know about yet (Clock > since AND not in this round's client
	// payload).
	resp := VFSChangesResponse{
		Clock:      maxClock,
		Entries:    make([]VFSEntry, 0),
		Tombstones: make([]VFSTombstone, 0),
	}
	for _, e := range merged.Entries {
		if e.Clock <= req.Since {
			continue
		}
		if _, sent := clientHasEntries[e.Path]; sent {
			continue
		}
		resp.Entries = append(resp.Entries, e)
	}
	for _, t := range merged.Tombstones {
		if t.Clock <= req.Since {
			continue
		}
		if _, sent := clientHasTombs[t.Path]; sent {
			continue
		}
		resp.Tombstones = append(resp.Tombstones, t)
	}

	return c.JSON(resp)
}

// computeMaxClock walks every entry + tombstone in `snap` and returns
// the maximum Clock value. Used to derive a watermark for legacy
// snapshots that didn't store Clock at all.
func computeMaxClock(snap VFSSnapshot) int64 {
	var max int64
	for _, e := range snap.Entries {
		if e.Clock > max {
			max = e.Clock
		}
	}
	for _, t := range snap.Tombstones {
		if t.Clock > max {
			max = t.Clock
		}
	}
	return max
}
