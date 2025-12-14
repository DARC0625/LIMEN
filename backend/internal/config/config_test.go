package config

import (
	"os"
	"testing"
)

func TestLoad(t *testing.T) {
	// Save original env
	originalEnv := make(map[string]string)
	envVars := []string{
		"PORT", "GRPC_PORT", "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD",
		"DB_NAME", "DB_SSL_MODE", "LIBVIRT_URI", "ISO_DIR", "VM_DIR",
		"ADMIN_USER", "ADMIN_PASSWORD", "JWT_SECRET", "LOG_LEVEL", "ENV",
		"ALLOWED_ORIGINS", "DATABASE_URL",
	}

	for _, key := range envVars {
		if val, ok := os.LookupEnv(key); ok {
			originalEnv[key] = val
			os.Unsetenv(key)
		}
	}
	defer func() {
		// Restore original env
		for key, val := range originalEnv {
			os.Setenv(key, val)
		}
	}()

	cfg := Load()

	// Test defaults
	if cfg.Port != "8080" {
		t.Errorf("Expected default port 8080, got %s", cfg.Port)
	}
	if cfg.LibvirtURI != "qemu:///system" {
		t.Errorf("Expected default libvirt URI, got %s", cfg.LibvirtURI)
	}
	if cfg.Env != "development" {
		t.Errorf("Expected default env development, got %s", cfg.Env)
	}
	if len(cfg.AllowedOrigins) != 1 || cfg.AllowedOrigins[0] != "*" {
		t.Errorf("Expected default allowed origins [*], got %v", cfg.AllowedOrigins)
	}
}

func TestLoad_WithEnvVars(t *testing.T) {
	// Save original env
	originalEnv := make(map[string]string)
	envVars := []string{"PORT", "DB_HOST", "ALLOWED_ORIGINS"}

	for _, key := range envVars {
		if val, ok := os.LookupEnv(key); ok {
			originalEnv[key] = val
		}
	}
	defer func() {
		// Restore original env
		for key, val := range originalEnv {
			os.Setenv(key, val)
		}
		for _, key := range envVars {
			if _, ok := originalEnv[key]; !ok {
				os.Unsetenv(key)
			}
		}
	}()

	// Set test env vars
	os.Setenv("PORT", "9090")
	os.Setenv("DB_HOST", "test-host")
	os.Setenv("ALLOWED_ORIGINS", "http://localhost:3000,https://example.com")

	cfg := Load()

	if cfg.Port != "9090" {
		t.Errorf("Expected port 9090, got %s", cfg.Port)
	}
	if cfg.DBHost != "test-host" {
		t.Errorf("Expected DB host test-host, got %s", cfg.DBHost)
	}
	if len(cfg.AllowedOrigins) != 2 {
		t.Errorf("Expected 2 allowed origins, got %d", len(cfg.AllowedOrigins))
	}
	if cfg.AllowedOrigins[0] != "http://localhost:3000" {
		t.Errorf("Expected first origin http://localhost:3000, got %s", cfg.AllowedOrigins[0])
	}
	if cfg.AllowedOrigins[1] != "https://example.com" {
		t.Errorf("Expected second origin https://example.com, got %s", cfg.AllowedOrigins[1])
	}
}

func TestIsProduction(t *testing.T) {
	tests := []struct {
		name string
		env  string
		want bool
	}{
		{"production", "production", true},
		{"development", "development", false},
		{"staging", "staging", false},
		{"empty", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &Config{Env: tt.env}
			if got := cfg.IsProduction(); got != tt.want {
				t.Errorf("Config.IsProduction() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsDevelopment(t *testing.T) {
	tests := []struct {
		name string
		env  string
		want bool
	}{
		{"development", "development", true},
		{"production", "production", false},
		{"staging", "staging", false},
		{"empty", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &Config{Env: tt.env}
			if got := cfg.IsDevelopment(); got != tt.want {
				t.Errorf("Config.IsDevelopment() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestBuildDatabaseURL(t *testing.T) {
	cfg := &Config{
		DBHost:     "localhost",
		DBPort:     "5432",
		DBUser:     "testuser",
		DBPassword: "testpass",
		DBName:     "testdb",
		DBSSLMode:  "disable",
	}

	url := buildDatabaseURL(cfg)
	expected := "host=localhost user=testuser password=testpass dbname=testdb port=5432 sslmode=disable TimeZone=Asia/Seoul"

	if url != expected {
		t.Errorf("buildDatabaseURL() = %v, want %v", url, expected)
	}
}


