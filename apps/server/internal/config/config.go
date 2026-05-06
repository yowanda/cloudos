package config

import (
	"os"
	"strings"
)

type Config struct {
	Port       string
	JWTSecret  string
	DB         DBConfig
	S3         S3Config
	CORSOrigin string
	// PTY: WebSocket pty backend for the Terminal app.
	// Off by default — only enable on trusted, properly authenticated
	// deployments since it spawns real shells with the server's privileges.
	EnablePTY bool
	// Shell to spawn for PTY sessions (e.g. /bin/bash, /bin/sh).
	PTYShell string
	// AdminEmails is the lower-cased set of emails treated as
	// administrators (currently only used by the developer-portal
	// submission review endpoints). Comma-separated in env via
	// ADMIN_EMAILS=alice@x.com,bob@y.com — never sent to clients.
	AdminEmails map[string]struct{}
	// AllowRegistration controls whether POST /api/v1/auth/register is
	// open to the public. Defaults to true so single-user / dev setups
	// keep working, but production public deployments typically flip
	// this to false after the first user is created so the host's
	// resources aren't open for arbitrary signups. Toggled via
	// ALLOW_REGISTRATION=false in env.
	AllowRegistration bool
}

type DBConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

type S3Config struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	Region    string
	UseSSL    bool
}

func Load() *Config {
	return &Config{
		Port:       getEnv("PORT", "3000"),
		JWTSecret:  getEnv("JWT_SECRET", "cloudos-dev-secret-change-in-production"),
		CORSOrigin: getEnv("CORS_ORIGIN", "http://localhost:4100"),
		DB: DBConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "cloudos"),
			Password: getEnv("DB_PASSWORD", "cloudos"),
			Name:     getEnv("DB_NAME", "cloudos"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		S3: S3Config{
			Endpoint:  getEnv("S3_ENDPOINT", "localhost:9000"),
			AccessKey: getEnv("S3_ACCESS_KEY", "minioadmin"),
			SecretKey: getEnv("S3_SECRET_KEY", "minioadmin"),
			Bucket:    getEnv("S3_BUCKET", "cloudos-files"),
			Region:    getEnv("S3_REGION", "us-east-1"),
			UseSSL:    getEnv("S3_USE_SSL", "false") == "true",
		},
		EnablePTY:         getEnv("ENABLE_PTY", "false") == "true",
		PTYShell:          getEnv("PTY_SHELL", "/bin/bash"),
		AdminEmails:       parseAdminEmails(getEnv("ADMIN_EMAILS", "")),
		AllowRegistration: getEnv("ALLOW_REGISTRATION", "true") != "false",
	}
}

// parseAdminEmails turns "Alice@x.com, bob@y.com" into a normalised
// set: trimmed, lower-cased, ignoring empty entries.
func parseAdminEmails(s string) map[string]struct{} {
	out := make(map[string]struct{})
	for _, raw := range strings.Split(s, ",") {
		v := strings.ToLower(strings.TrimSpace(raw))
		if v != "" {
			out[v] = struct{}{}
		}
	}
	return out
}

func (c *DBConfig) DSN() string {
	return "host=" + c.Host +
		" port=" + c.Port +
		" user=" + c.User +
		" password=" + c.Password +
		" dbname=" + c.Name +
		" sslmode=" + c.SSLMode
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
