package database

import (
	"log"

	"github.com/yowanda/cloudos/server/internal/config"
	"github.com/yowanda/cloudos/server/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect(cfg *config.DBConfig) {
	var err error
	DB, err = gorm.Open(postgres.Open(cfg.DSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Database connected")
}

func Migrate() {
	err := DB.AutoMigrate(
		&models.User{},
		&models.File{},
		&models.FileShare{},
		&models.App{},
	)
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	// Add unique index for user+path
	DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_files_user_path ON files(user_id, path)")

	log.Println("Database migrated")
}
