package config

import (
	"strings"
	"testing"
)

// TestGetEnvFallback verifies that getEnv returns the fallback when
// the env var is unset or empty, and the actual value otherwise.
// Using t.Setenv keeps the parent process environment clean.
func TestGetEnvFallback(t *testing.T) {
	const key = "CLOUDOS_TEST_GET_ENV"
	t.Run("unset returns fallback", func(t *testing.T) {
		t.Setenv(key, "")
		got := getEnv(key, "fallback-value")
		if got != "fallback-value" {
			t.Fatalf("getEnv unset = %q, want %q", got, "fallback-value")
		}
	})
	t.Run("set returns the value", func(t *testing.T) {
		t.Setenv(key, "actual-value")
		got := getEnv(key, "fallback-value")
		if got != "actual-value" {
			t.Fatalf("getEnv set = %q, want %q", got, "actual-value")
		}
	})
}

// TestLoadDefaults verifies the defaults shipped by Load() — these
// are documented in `docs/SELF_HOSTING.md` and changing them is a
// breaking change, so the test guards against accidental edits.
func TestLoadDefaults(t *testing.T) {
	// Wipe every env var Load reads so we get pure defaults.
	for _, key := range []string{
		"PORT", "JWT_SECRET", "CORS_ORIGIN",
		"DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "DB_SSLMODE",
		"S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET", "S3_REGION", "S3_USE_SSL",
		"ENABLE_PTY", "PTY_SHELL",
		"ALLOW_REGISTRATION", "ADMIN_EMAILS",
	} {
		t.Setenv(key, "")
	}

	cfg := Load()
	if cfg.Port != "3000" {
		t.Errorf("Port default = %q, want %q", cfg.Port, "3000")
	}
	if cfg.DB.Host != "localhost" {
		t.Errorf("DB.Host default = %q, want %q", cfg.DB.Host, "localhost")
	}
	if cfg.DB.Port != "5432" {
		t.Errorf("DB.Port default = %q, want %q", cfg.DB.Port, "5432")
	}
	if cfg.S3.Bucket != "cloudos-files" {
		t.Errorf("S3.Bucket default = %q, want %q", cfg.S3.Bucket, "cloudos-files")
	}
	if cfg.EnablePTY {
		t.Errorf("EnablePTY default = true, want false (PTY is opt-in)")
	}
	if cfg.PTYShell != "/bin/bash" {
		t.Errorf("PTYShell default = %q, want %q", cfg.PTYShell, "/bin/bash")
	}
	if cfg.S3.UseSSL {
		t.Errorf("S3.UseSSL default = true, want false")
	}
	if !cfg.AllowRegistration {
		t.Errorf("AllowRegistration default = false, want true (open by default; flip to false in production)")
	}
}

// TestLoadAllowRegistration verifies the explicit-opt-out form reads
// back as false, and any other value (including the default) keeps
// registration open.
func TestLoadAllowRegistration(t *testing.T) {
	cases := []struct {
		env  string
		want bool
	}{
		{"", true},       // unset → default true
		{"true", true},   // explicit true
		{"TRUE", true},   // env strings are case-sensitive only on the literal "false"
		{"1", true},      // anything not equal to "false"
		{"false", false}, // explicit opt-out
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.env, func(t *testing.T) {
			t.Setenv("ALLOW_REGISTRATION", tc.env)
			got := Load().AllowRegistration
			if got != tc.want {
				t.Errorf("ALLOW_REGISTRATION=%q → %v, want %v", tc.env, got, tc.want)
			}
		})
	}
}

// TestDBConfigDSN verifies the DSN string includes every part in the
// shape the Postgres driver expects — host=…  port=…  user=…  etc.
func TestDBConfigDSN(t *testing.T) {
	c := DBConfig{
		Host:     "db.example.com",
		Port:     "5433",
		User:     "alice",
		Password: "s3cret",
		Name:     "cloudos_test",
		SSLMode:  "require",
	}
	dsn := c.DSN()
	for _, want := range []string{
		"host=db.example.com",
		"port=5433",
		"user=alice",
		"password=s3cret",
		"dbname=cloudos_test",
		"sslmode=require",
	} {
		if !strings.Contains(dsn, want) {
			t.Errorf("DSN missing %q in %q", want, dsn)
		}
	}
}

// TestParseAdminEmails verifies the comma-separated parsing strips
// whitespace, lower-cases, and skips empties — both directly via the
// internal helper and via Load() so we know wiring is correct.
func TestParseAdminEmails(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want []string // sorted set
	}{
		{"empty", "", nil},
		{"whitespace", "   ", nil},
		{"single", "alice@example.com", []string{"alice@example.com"}},
		{"upper", "ALICE@example.com", []string{"alice@example.com"}},
		{"trim", "  bob@x.com ", []string{"bob@x.com"}},
		{
			"multi",
			"Alice@x.com, bob@y.com,,charlie@z.com",
			[]string{"alice@x.com", "bob@y.com", "charlie@z.com"},
		},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			got := parseAdminEmails(tc.in)
			if len(got) != len(tc.want) {
				t.Fatalf("parseAdminEmails(%q) = %v, want %v", tc.in, got, tc.want)
			}
			for _, w := range tc.want {
				if _, ok := got[w]; !ok {
					t.Errorf("parseAdminEmails(%q) missing %q", tc.in, w)
				}
			}
		})
	}
}

// TestS3UseSSLToggle verifies the UseSSL string-to-bool round-trip.
func TestS3UseSSLToggle(t *testing.T) {
	cases := []struct {
		envValue string
		want     bool
	}{
		{"true", true},
		{"false", false},
		{"", false}, // fallback "false"
		{"1", false},
		{"yes", false},
		{"TRUE", false}, // case-sensitive on purpose; mismatches today
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.envValue, func(t *testing.T) {
			// Clear all DB / S3 vars except the one we're toggling so
			// Load() doesn't pick up parent process env leakage.
			for _, k := range []string{
				"S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY",
				"S3_BUCKET", "S3_REGION",
			} {
				t.Setenv(k, "")
			}
			t.Setenv("S3_USE_SSL", tc.envValue)
			got := Load().S3.UseSSL
			if got != tc.want {
				t.Errorf("S3_USE_SSL=%q -> %v, want %v", tc.envValue, got, tc.want)
			}
		})
	}
}
