package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email        string         `gorm:"uniqueIndex;size:255;not null" json:"email"`
	Username     string         `gorm:"uniqueIndex;size:50;not null" json:"username"`
	Password     string         `gorm:"size:255" json:"-"`
	AvatarURL    string         `gorm:"type:text" json:"avatar_url,omitempty"`
	StorageQuota int64          `gorm:"default:5368709120" json:"storage_quota"`
	StorageUsed  int64          `gorm:"default:0" json:"storage_used"`
	Settings     map[string]any `gorm:"type:jsonb;default:'{}';serializer:json" json:"settings"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

type File struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	Name      string    `gorm:"size:255;not null" json:"name"`
	Path      string    `gorm:"type:text;not null" json:"path"`
	ParentID  *uuid.UUID `gorm:"type:uuid" json:"parent_id,omitempty"`
	IsDir     bool      `gorm:"default:false" json:"is_dir"`
	MimeType  string    `gorm:"size:100" json:"mime_type,omitempty"`
	Size      int64     `gorm:"default:0" json:"size"`
	S3Key     string    `gorm:"type:text" json:"-"`
	Checksum  string    `gorm:"size:64" json:"checksum,omitempty"`
	IsTrashed bool      `gorm:"default:false" json:"is_trashed"`
	Shared    bool      `gorm:"default:false" json:"shared"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type FileShare struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	FileID     uuid.UUID  `gorm:"type:uuid;not null" json:"file_id"`
	SharedBy   uuid.UUID  `gorm:"type:uuid" json:"shared_by"`
	SharedWith *uuid.UUID `gorm:"type:uuid" json:"shared_with,omitempty"`
	ShareToken string     `gorm:"uniqueIndex;size:100" json:"share_token"`
	Permission string     `gorm:"size:10;default:read" json:"permission"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

type App struct {
	ID          string         `gorm:"primaryKey;size:100" json:"id"`
	Name        string         `gorm:"size:100;not null" json:"name"`
	Author      string         `gorm:"size:100" json:"author"`
	Description string         `gorm:"type:text" json:"description"`
	IconURL     string         `gorm:"type:text" json:"icon_url"`
	EntryURL    string         `gorm:"type:text;not null" json:"entry_url"`
	Manifest    map[string]any `gorm:"type:jsonb;not null;serializer:json" json:"manifest"`
	Version     string         `gorm:"size:20" json:"version"`
	Downloads   int            `gorm:"default:0" json:"downloads"`
	Category    string         `gorm:"size:50" json:"category"`
	Published   bool           `gorm:"default:false" json:"published"`
	CreatedAt   time.Time      `json:"created_at"`
}

// AppSubmission tracks third-party app submissions through the
// developer portal. A row starts in "pending" and an admin moves it
// to "approved" or "rejected". On approval an App row is created /
// upserted from the snapshot stored in Manifest.
type AppSubmission struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	SubmittedBy uuid.UUID      `gorm:"type:uuid;not null;index" json:"submitted_by"`
	AppID       string         `gorm:"size:100;not null;index" json:"app_id"`
	Manifest    map[string]any `gorm:"type:jsonb;not null;serializer:json" json:"manifest"`
	Status      string         `gorm:"size:20;default:pending;index" json:"status"`
	ReviewerID  *uuid.UUID     `gorm:"type:uuid" json:"reviewer_id,omitempty"`
	ReviewNote  string         `gorm:"type:text" json:"review_note,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

func (f *File) BeforeCreate(tx *gorm.DB) error {
	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	return nil
}

func (fs *FileShare) BeforeCreate(tx *gorm.DB) error {
	if fs.ID == uuid.Nil {
		fs.ID = uuid.New()
	}
	return nil
}

func (s *AppSubmission) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	if s.Status == "" {
		s.Status = "pending"
	}
	return nil
}
