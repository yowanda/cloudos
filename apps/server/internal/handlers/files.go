package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/yowanda/cloudos/server/internal/models"
	"github.com/yowanda/cloudos/server/internal/services"
)

type FileHandler struct {
	fileService *services.FileService
}

func NewFileHandler(fileService *services.FileService) *FileHandler {
	return &FileHandler{fileService: fileService}
}

func (h *FileHandler) ListDir(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)
	path := c.Query("path", "/")

	entries, err := h.fileService.ListDirectory(userID, path)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if entries == nil {
		entries = []models.File{}
	}

	return c.JSON(fiber.Map{"entries": entries, "path": path})
}

func (h *FileHandler) CreateDir(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)

	var req struct {
		Path string `json:"path"`
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	entry, err := h.fileService.CreateDirectory(userID, req.Path, req.Name)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(entry)
}

func (h *FileHandler) Upload(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)
	parentPath := c.FormValue("path", "/")

	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "No file uploaded"})
	}

	f, err := file.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to read file"})
	}
	defer f.Close()

	mimeType := file.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	entry, err := h.fileService.UploadFile(c.Context(), userID, parentPath, file.Filename, mimeType, file.Size, f)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(entry)
}

func (h *FileHandler) Download(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)
	fileID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid file ID"})
	}

	url, err := h.fileService.GetDownloadURL(c.Context(), userID, fileID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"url": url})
}

func (h *FileHandler) Delete(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)
	fileID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid file ID"})
	}

	if err := h.fileService.DeleteFile(userID, fileID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"ok": true})
}

func (h *FileHandler) Rename(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)
	fileID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid file ID"})
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	entry, err := h.fileService.RenameFile(userID, fileID, req.Name)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(entry)
}
