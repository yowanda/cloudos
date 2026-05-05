package services

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/yowanda/cloudos/server/internal/database"
	"github.com/yowanda/cloudos/server/internal/models"
)

type FileService struct {
	s3     *minio.Client
	bucket string
}

func NewFileService(endpoint, accessKey, secretKey, bucket string, useSSL bool) *FileService {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		// Non-fatal: S3 might not be available in dev
		return &FileService{bucket: bucket}
	}

	return &FileService{s3: client, bucket: bucket}
}

func (s *FileService) EnsureBucket(ctx context.Context) error {
	if s.s3 == nil {
		return nil
	}
	exists, err := s.s3.BucketExists(ctx, s.bucket)
	if err != nil {
		return err
	}
	if !exists {
		return s.s3.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{})
	}
	return nil
}

func (s *FileService) CreateDefaultDirs(userID uuid.UUID) {
	dirs := []struct{ name, path string }{
		{"Home", "/"},
		{"Documents", "/Documents"},
		{"Downloads", "/Downloads"},
		{"Pictures", "/Pictures"},
		{"Music", "/Music"},
		{"Videos", "/Videos"},
		{"Desktop", "/Desktop"},
	}

	for _, d := range dirs {
		file := models.File{
			UserID:   userID,
			Name:     d.name,
			Path:     d.path,
			IsDir:    true,
			MimeType: "directory",
		}
		database.DB.Where("user_id = ? AND path = ?", userID, d.path).FirstOrCreate(&file)
	}
}

func (s *FileService) ListDirectory(userID uuid.UUID, path string) ([]models.File, error) {
	var allFiles []models.File
	if err := database.DB.Where("user_id = ? AND is_trashed = ?", userID, false).Find(&allFiles).Error; err != nil {
		return nil, err
	}

	prefix := path
	if prefix != "/" {
		prefix += "/"
	} else {
		prefix = "/"
	}

	var result []models.File
	for _, f := range allFiles {
		if f.Path == path {
			continue
		}
		if !strings.HasPrefix(f.Path, prefix) {
			continue
		}
		remainder := f.Path[len(prefix):]
		if !strings.Contains(remainder, "/") {
			result = append(result, f)
		}
	}

	return result, nil
}

func (s *FileService) CreateDirectory(userID uuid.UUID, parentPath, name string) (*models.File, error) {
	fullPath := parentPath + "/" + name
	if parentPath == "/" {
		fullPath = "/" + name
	}

	file := models.File{
		UserID:   userID,
		Name:     name,
		Path:     fullPath,
		IsDir:    true,
		MimeType: "directory",
	}

	if err := database.DB.Create(&file).Error; err != nil {
		return nil, err
	}

	return &file, nil
}

func (s *FileService) UploadFile(ctx context.Context, userID uuid.UUID, parentPath, name, mimeType string, size int64, reader io.Reader) (*models.File, error) {
	fullPath := parentPath + "/" + name
	if parentPath == "/" {
		fullPath = "/" + name
	}

	s3Key := fmt.Sprintf("%s/%s/%s", userID.String(), uuid.New().String()[:8], name)

	if s.s3 != nil {
		_, err := s.s3.PutObject(ctx, s.bucket, s3Key, reader, size, minio.PutObjectOptions{
			ContentType: mimeType,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to upload to S3: %w", err)
		}
	}

	file := models.File{
		UserID:   userID,
		Name:     name,
		Path:     fullPath,
		IsDir:    false,
		MimeType: mimeType,
		Size:     size,
		S3Key:    s3Key,
	}

	if err := database.DB.Create(&file).Error; err != nil {
		return nil, err
	}

	return &file, nil
}

func (s *FileService) GetDownloadURL(ctx context.Context, userID, fileID uuid.UUID) (string, error) {
	var file models.File
	if err := database.DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		return "", fmt.Errorf("file not found")
	}

	if file.S3Key == "" {
		return "", fmt.Errorf("no S3 key for file")
	}

	if s.s3 == nil {
		return "", fmt.Errorf("S3 not available")
	}

	url, err := s.s3.PresignedGetObject(ctx, s.bucket, file.S3Key, time.Hour, nil)
	if err != nil {
		return "", err
	}

	return url.String(), nil
}

func (s *FileService) DeleteFile(userID, fileID uuid.UUID) error {
	var file models.File
	if err := database.DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		return fmt.Errorf("file not found")
	}

	if file.S3Key != "" && s.s3 != nil {
		_ = s.s3.RemoveObject(context.Background(), s.bucket, file.S3Key, minio.RemoveObjectOptions{})
	}

	// Delete children if directory
	if file.IsDir {
		database.DB.Where("user_id = ? AND path LIKE ?", userID, file.Path+"/%").Delete(&models.File{})
	}

	return database.DB.Delete(&file).Error
}

func (s *FileService) RenameFile(userID, fileID uuid.UUID, newName string) (*models.File, error) {
	var file models.File
	if err := database.DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		return nil, fmt.Errorf("file not found")
	}

	lastSlash := strings.LastIndex(file.Path, "/")
	parentPath := "/"
	if lastSlash > 0 {
		parentPath = file.Path[:lastSlash]
	}

	newPath := parentPath + "/" + newName
	if parentPath == "/" {
		newPath = "/" + newName
	}

	file.Name = newName
	file.Path = newPath
	file.UpdatedAt = time.Now()

	if err := database.DB.Save(&file).Error; err != nil {
		return nil, err
	}

	return &file, nil
}
