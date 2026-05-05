package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/yowanda/cloudos/server/internal/models"
	"gorm.io/gorm"
)

type ShareHandler struct {
	db *gorm.DB
}

func NewShareHandler(db *gorm.DB) *ShareHandler {
	return &ShareHandler{db: db}
}

type createShareInput struct {
	FileID        string `json:"file_id"`
	Permission    string `json:"permission"`
	ExpiresInDays int    `json:"expires_in_days"`
}

func randomToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// POST /api/v1/shares
func (h *ShareHandler) Create(c *fiber.Ctx) error {
	var in createShareInput
	if err := c.BodyParser(&in); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	if in.Permission == "" {
		in.Permission = "read"
	}
	if in.Permission != "read" && in.Permission != "comment" && in.Permission != "write" {
		return c.Status(400).JSON(fiber.Map{"error": "permission must be read|comment|write"})
	}
	fileID, err := uuid.Parse(in.FileID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid file_id"})
	}
	userIDVal := c.Locals("userId")
	userIDStr, _ := userIDVal.(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "unauthenticated"})
	}

	// Verify file ownership
	var f models.File
	if err := h.db.First(&f, "id = ? AND user_id = ?", fileID, userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "file not found"})
	}

	tok, err := randomToken()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	share := models.FileShare{
		FileID:     fileID,
		SharedBy:   userID,
		ShareToken: tok,
		Permission: in.Permission,
	}
	if in.ExpiresInDays > 0 {
		t := time.Now().AddDate(0, 0, in.ExpiresInDays)
		share.ExpiresAt = &t
	}
	if err := h.db.Create(&share).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	// Mark file as shared
	h.db.Model(&f).Update("shared", true)

	return c.JSON(share)
}

// GET /api/v1/shares
func (h *ShareHandler) List(c *fiber.Ctx) error {
	userIDStr, _ := c.Locals("userId").(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "unauthenticated"})
	}
	var shares []models.FileShare
	if err := h.db.Where("shared_by = ?", userID).Order("created_at DESC").Find(&shares).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(shares)
}

// DELETE /api/v1/shares/:id
func (h *ShareHandler) Revoke(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	userIDStr, _ := c.Locals("userId").(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "unauthenticated"})
	}
	res := h.db.Where("id = ? AND shared_by = ?", id, userID).Delete(&models.FileShare{})
	if res.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": res.Error.Error()})
	}
	if res.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "share not found"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// GET /api/v1/shares/by-token/:token (public)
func (h *ShareHandler) GetByToken(c *fiber.Ctx) error {
	tok := c.Params("token")
	if tok == "" {
		return c.Status(400).JSON(fiber.Map{"error": "missing token"})
	}
	var s models.FileShare
	if err := h.db.First(&s, "share_token = ?", tok).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "share not found"})
	}
	if s.ExpiresAt != nil && s.ExpiresAt.Before(time.Now()) {
		return c.Status(410).JSON(fiber.Map{"error": "share expired"})
	}
	var f models.File
	if err := h.db.First(&f, "id = ?", s.FileID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "file not found"})
	}
	return c.JSON(fiber.Map{
		"share": s,
		"file":  f,
	})
}
