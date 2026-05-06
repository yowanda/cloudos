package main

import (
	"context"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/websocket/v2"
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
	authHandler := handlers.NewAuthHandler(authService, cfg.AllowRegistration)
	fileHandler := handlers.NewFileHandler(fileService)
	vfsHandler := handlers.NewVFSHandler("data/vfs")
	shareHandler := handlers.NewShareHandler(database.DB)
	ptyHandler := handlers.NewPTYHandler(authService, cfg.PTYShell, cfg.EnablePTY)
	devHandler := handlers.NewDevHandler(database.DB, cfg.AdminEmails)

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

	// Health checks
	// /health: liveness — always 200 OK if the process is up
	// /ready : readiness — checks downstream deps (Postgres, S3)
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"service": "cloudos-server",
			"version": "0.1.0",
		})
	})
	app.Get("/ready", func(c *fiber.Ctx) error {
		dbOK := true
		dbErr := ""
		if sqlDB, err := database.DB.DB(); err != nil {
			dbOK = false
			dbErr = err.Error()
		} else if err := sqlDB.PingContext(c.Context()); err != nil {
			dbOK = false
			dbErr = err.Error()
		}
		s3OK := true
		s3Err := ""
		if err := fileService.EnsureBucket(c.Context()); err != nil {
			s3OK = false
			s3Err = err.Error()
		}
		ready := dbOK && s3OK
		status := 200
		if !ready {
			status = 503
		}
		return c.Status(status).JSON(fiber.Map{
			"ready": ready,
			"checks": fiber.Map{
				"database": fiber.Map{"ok": dbOK, "error": dbErr},
				"s3":       fiber.Map{"ok": s3OK, "error": s3Err},
			},
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
	// Stage 2 of per-entry diff sync — delta push/pull keyed on the
	// monotonic logical clock the client maintains in localStorage. See
	// VFSHandler.ApplyChanges for the merge semantics.
	protected.Post("/vfs/changes", vfsHandler.ApplyChanges)

	// File sharing
	api.Get("/shares/by-token/:token", shareHandler.GetByToken)
	protected.Post("/shares", shareHandler.Create)
	protected.Get("/shares", shareHandler.List)
	protected.Delete("/shares/:id", shareHandler.Revoke)

	// Developer portal — third-party app submissions + admin review.
	// `/apps/published` is public so the AppStore can browse without
	// authentication; everything else is gated behind auth (and admin
	// review endpoints additionally gated by RequireAdmin).
	api.Get("/apps/published", devHandler.ListPublished)
	protected.Get("/dev/whoami", devHandler.WhoAmI)
	protected.Post("/dev/submissions", devHandler.Submit)
	protected.Get("/dev/submissions/mine", devHandler.ListMine)
	admin := protected.Group("/dev/admin", devHandler.RequireAdmin())
	admin.Get("/submissions", devHandler.AdminList)
	admin.Get("/submissions/:id", devHandler.AdminGet)
	admin.Post("/submissions/:id/approve", devHandler.AdminApprove)
	admin.Post("/submissions/:id/reject", devHandler.AdminReject)

	// PTY (browser Terminal). Health is public so the frontend can decide
	// whether to enable remote-shell mode without first acquiring a token.
	api.Get("/pty/health", ptyHandler.Health)
	// WS upgrade path. Auth is checked inside the upgrader (token can come
	// from either the Authorization header or the ?token query param,
	// since browsers can't set headers on `new WebSocket()`).
	api.Get("/pty", ptyHandler.Upgrade, websocket.New(ptyHandler.WS))

	log.Printf("CloudOS Server starting on :%s (pty enabled=%v)", cfg.Port, cfg.EnablePTY)
	if err := app.Listen(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
