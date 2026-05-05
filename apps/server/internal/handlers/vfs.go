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
// This is the simple bridge endpoint used by the desktop's "remote" VFS
// adapter. The browser sends the entire VFS as one JSON document; the server
// just persists it on disk so a future session can pull it back.
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
}

type VFSSnapshot struct {
	Entries []VFSEntry `json:"entries"`
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

// GET /api/v1/vfs/health
func (h *VFSHandler) Health(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"status": "ok", "kind": "vfs"})
}

// GET /api/v1/vfs/snapshot
func (h *VFSHandler) GetSnapshot(c *fiber.Ctx) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	p := h.snapshotPath(c)
	b, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return c.Status(404).JSON(fiber.Map{"error": "snapshot not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	var snap VFSSnapshot
	if err := json.Unmarshal(b, &snap); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "corrupt snapshot: " + err.Error()})
	}
	return c.JSON(snap)
}

// PUT /api/v1/vfs/snapshot
func (h *VFSHandler) PutSnapshot(c *fiber.Ctx) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	var snap VFSSnapshot
	if err := c.BodyParser(&snap); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	b, err := json.Marshal(&snap)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if err := os.WriteFile(h.snapshotPath(c), b, 0o644); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true, "bytes": len(b)})
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
