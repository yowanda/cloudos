package handlers

import (
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/yowanda/cloudos/server/internal/models"
	"gorm.io/gorm"
)

// DevHandler implements the developer-portal endpoints used by the
// `com.cloudos.devportal` desktop app: developers submit AppManifest
// snapshots, admins approve / reject them. On approval the manifest
// graduates to a published `App` row.
type DevHandler struct {
	db          *gorm.DB
	adminEmails map[string]struct{}
}

func NewDevHandler(db *gorm.DB, adminEmails map[string]struct{}) *DevHandler {
	if adminEmails == nil {
		adminEmails = map[string]struct{}{}
	}
	return &DevHandler{db: db, adminEmails: adminEmails}
}

// userFromCtx extracts the authenticated user UUID. Mirrors the
// convention in handlers/files.go (Locals("userID") set by middleware).
func userFromCtx(c *fiber.Ctx) (uuid.UUID, error) {
	v := c.Locals("userID")
	if v == nil {
		return uuid.Nil, errors.New("unauthenticated")
	}
	id, ok := v.(uuid.UUID)
	if !ok {
		return uuid.Nil, errors.New("unauthenticated")
	}
	return id, nil
}

// IsAdmin returns true when the authenticated user's email is in the
// configured admin allowlist. Wired into routes via RequireAdmin so
// callers get a 403 before the handler body runs.
func (h *DevHandler) IsAdmin(c *fiber.Ctx) bool {
	uid, err := userFromCtx(c)
	if err != nil {
		return false
	}
	var u models.User
	if err := h.db.Select("email").First(&u, "id = ?", uid).Error; err != nil {
		return false
	}
	_, ok := h.adminEmails[strings.ToLower(strings.TrimSpace(u.Email))]
	return ok
}

// RequireAdmin is a Fiber middleware that 403s non-admin requests.
func (h *DevHandler) RequireAdmin() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !h.IsAdmin(c) {
			return c.Status(403).JSON(fiber.Map{"error": "admin only"})
		}
		return c.Next()
	}
}

// validateManifest sanity-checks an inbound manifest. We don't require
// every AppManifest field — entry / icon / window default in the
// frontend — but id / name / version / icon / entry must be present
// to graduate to a published App row.
func validateManifest(m map[string]any) error {
	for _, k := range []string{"id", "name", "version", "icon", "entry"} {
		v, ok := m[k]
		if !ok {
			return errors.New("missing " + k)
		}
		if s, isStr := v.(string); isStr && strings.TrimSpace(s) == "" {
			return errors.New("empty " + k)
		}
	}
	id, _ := m["id"].(string)
	if !strings.Contains(id, ".") {
		return errors.New("id must look like com.example.myapp")
	}
	return nil
}

type submitInput struct {
	Manifest map[string]any `json:"manifest"`
}

// POST /api/v1/dev/submissions
//
// Body: { manifest: <AppManifest JSON> }
// Returns the created submission row.
func (h *DevHandler) Submit(c *fiber.Ctx) error {
	uid, err := userFromCtx(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}
	var in submitInput
	if err := c.BodyParser(&in); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	if in.Manifest == nil {
		return c.Status(400).JSON(fiber.Map{"error": "manifest required"})
	}
	if err := validateManifest(in.Manifest); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid manifest: " + err.Error()})
	}
	appID, _ := in.Manifest["id"].(string)
	row := models.AppSubmission{
		SubmittedBy: uid,
		AppID:       appID,
		Manifest:    in.Manifest,
		Status:      "pending",
	}
	if err := h.db.Create(&row).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(row)
}

// GET /api/v1/dev/submissions/mine
func (h *DevHandler) ListMine(c *fiber.Ctx) error {
	uid, err := userFromCtx(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}
	var rows []models.AppSubmission
	if err := h.db.Where("submitted_by = ?", uid).
		Order("created_at DESC").
		Find(&rows).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(rows)
}

// GET /api/v1/dev/whoami — small helper so the frontend can show /
// hide the admin tab without hitting the admin endpoints first.
// Returns { admin: bool }.
func (h *DevHandler) WhoAmI(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"admin": h.IsAdmin(c)})
}

// GET /api/v1/dev/admin/submissions[?status=pending|approved|rejected]
func (h *DevHandler) AdminList(c *fiber.Ctx) error {
	q := h.db.Model(&models.AppSubmission{}).Order("created_at DESC")
	if s := c.Query("status"); s != "" {
		q = q.Where("status = ?", s)
	}
	var rows []models.AppSubmission
	if err := q.Find(&rows).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(rows)
}

// GET /api/v1/dev/admin/submissions/:id
func (h *DevHandler) AdminGet(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	var row models.AppSubmission
	if err := h.db.First(&row, "id = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "submission not found"})
	}
	return c.JSON(row)
}

type reviewInput struct {
	Note string `json:"note"`
}

// POST /api/v1/dev/admin/submissions/:id/approve
//
// Marks the submission approved and upserts an `App` row keyed by
// manifest.id with Published=true. Manifest fields that map cleanly
// to App columns (name, author, description, icon, version, category)
// are denormalised so the existing `App` queries continue to work
// without re-parsing the JSON blob.
func (h *DevHandler) AdminApprove(c *fiber.Ctx) error {
	uid, err := userFromCtx(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	var in reviewInput
	_ = c.BodyParser(&in)

	var row models.AppSubmission
	if err := h.db.First(&row, "id = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "submission not found"})
	}
	if row.Status != "pending" {
		return c.Status(409).JSON(fiber.Map{"error": "submission already reviewed"})
	}

	app := models.App{
		ID:          row.AppID,
		Name:        stringField(row.Manifest, "name"),
		Author:      stringField(row.Manifest, "author"),
		Description: stringField(row.Manifest, "description"),
		IconURL:     stringField(row.Manifest, "icon"),
		EntryURL:    extractEntryURL(row.Manifest),
		Manifest:    row.Manifest,
		Version:     stringField(row.Manifest, "version"),
		Category:    stringField(row.Manifest, "category"),
		Published:   true,
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		// Upsert the App row keyed by id.
		if err := tx.Save(&app).Error; err != nil {
			return err
		}
		row.Status = "approved"
		row.ReviewerID = &uid
		row.ReviewNote = in.Note
		return tx.Save(&row).Error
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"submission": row, "app": app})
}

// POST /api/v1/dev/admin/submissions/:id/reject
func (h *DevHandler) AdminReject(c *fiber.Ctx) error {
	uid, err := userFromCtx(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	var in reviewInput
	_ = c.BodyParser(&in)

	var row models.AppSubmission
	if err := h.db.First(&row, "id = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "submission not found"})
	}
	if row.Status != "pending" {
		return c.Status(409).JSON(fiber.Map{"error": "submission already reviewed"})
	}
	row.Status = "rejected"
	row.ReviewerID = &uid
	row.ReviewNote = in.Note
	if err := h.db.Save(&row).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(row)
}

// GET /api/v1/apps/published — public list of approved + published
// apps. Lightweight projection (no manifest JSON) so the AppStore
// browse view loads quickly.
func (h *DevHandler) ListPublished(c *fiber.Ctx) error {
	type publishedApp struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Author      string `json:"author"`
		Description string `json:"description"`
		IconURL     string `json:"icon_url"`
		Version     string `json:"version"`
		Category    string `json:"category"`
		Downloads   int    `json:"downloads"`
	}
	var rows []publishedApp
	if err := h.db.Model(&models.App{}).
		Select("id, name, author, description, icon_url, version, category, downloads").
		Where("published = ?", true).
		Order("downloads DESC, name ASC").
		Find(&rows).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(rows)
}

func stringField(m map[string]any, k string) string {
	if v, ok := m[k]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// extractEntryURL pulls a usable URL out of an AppManifest.entry of
// shape { type: "iframe-url", url: "..." } or { type: "iframe", html: "..." }.
// For the html variant we fall back to a `data:` URL or empty string —
// the AppStore listing only needs *something* renderable; the actual
// install path uses the full manifest blob.
func extractEntryURL(m map[string]any) string {
	entry, ok := m["entry"].(map[string]any)
	if !ok {
		return ""
	}
	if u, ok := entry["url"].(string); ok && u != "" {
		return u
	}
	return ""
}
