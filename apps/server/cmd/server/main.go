package main

import (
	"context"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/yowanda/cloudos/server/internal/config"
	"github.com/yowanda/cloudos/server/internal/database"
	"github.com/yowanda/cloudos/server/internal/handlers"
	"github.com/yowanda/cloudos/server/internal/middleware"
	"github.com/yowanda/cloudos/server/internal/services"
)

func main() {
	cfg := config.Load()

	// Database
	database.Connect(&cfg.DB)
	database.Migrate()

	// Services
	authService := services.NewAuthService(cfg.JWTSecret)
	fileService := services.NewFileService(
		cfg.S3.Endpoint,
		cfg.S3.AccessKey,
		cfg.S3.SecretKey,
		cfg.S3.Bucket,
		cfg.S3.UseSSL,
	)

	// Ensure S3 bucket
	if err := fileService.EnsureBucket(context.Background()); err != nil {
		log.Printf("Warning: S3 bucket setup failed: %v", err)
	}

	// Handlers
	authHandler := handlers.NewAuthHandler(authService)
	fileHandler := handlers.NewFileHandler(fileService)
	vfsHandler := handlers.NewVFSHandler("data/vfs")

	// Fiber app
	app := fiber.New(fiber.Config{
		BodyLimit: 100 * 1024 * 1024, // 100MB
	})

	// Middleware
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: cfg.CORSOrigin,
		AllowHeaders: "Origin, Content-Type, Authorization",
		AllowMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	}))

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"service": "cloudos-server",
			"version": "0.1.0",
		})
	})

	// API routes
	api := app.Group("/api/v1")

	// Auth (public)
	api.Post("/auth/register", authHandler.Register)
	api.Post("/auth/login", authHandler.Login)

	// Protected routes
	protected := api.Group("", middleware.Auth(authService))
	protected.Get("/auth/me", authHandler.Me)

	// Files
	protected.Get("/files", fileHandler.ListDir)
	protected.Post("/files/mkdir", fileHandler.CreateDir)
	protected.Post("/files/upload", fileHandler.Upload)
	protected.Get("/files/:id/download", fileHandler.Download)
	protected.Delete("/files/:id", fileHandler.Delete)
	protected.Patch("/files/:id/rename", fileHandler.Rename)

	// VFS snapshot (used by the browser "remote" VFS adapter).
	// Health endpoint is public so the browser can probe availability
	// without first needing a token; snapshot read/write is protected.
	api.Get("/vfs/health", vfsHandler.Health)
	protected.Get("/vfs/snapshot", vfsHandler.GetSnapshot)
	protected.Put("/vfs/snapshot", vfsHandler.PutSnapshot)
	protected.Delete("/vfs/snapshot", vfsHandler.DeleteSnapshot)

	log.Printf("CloudOS Server starting on :%s", cfg.Port)
	if err := app.Listen(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
