// Package config provides configuration management for the backend.
// It loads environment variables and provides default values.
package config

import (
	"os"
	"strconv"
	"strings"
)

// Config holds the application configuration.
type Config struct {
	// Server Configuration
	Port     string // HTTP server port
	GRPCPort string // gRPC server port (for future use)

	// Database Configuration
	DBHost      string // PostgreSQL host
	DBPort      string // PostgreSQL port
	DBUser      string // PostgreSQL user
	DBPassword  string // PostgreSQL password
	DBName      string // PostgreSQL database name
	DBSSLMode   string // PostgreSQL SSL mode
	DatabaseURL string // Full PostgreSQL connection string (computed)

	// Libvirt Configuration
	LibvirtURI string // Libvirt connection URI

	// File System Paths
	ISODir string // ISO images directory
	VMDir  string // VM disk images directory

	// Security Configuration
	AdminUser      string   // Default admin username
	AdminPassword  string   // Default admin password (should be changed on first login)
	AllowedOrigins []string // CORS allowed origins
	JWTSecret      string   // JWT signing secret

	// Logging Configuration
	LogLevel string // Log level: debug, info, warn, error

	// Rate Limiting
	RateLimitEnabled bool    // Enable rate limiting
	RateLimitRPS     float64 // Requests per second per IP
	RateLimitBurst   int     // Burst size

	// Environment
	Env string // Environment: development, production, etc.
}

// Load reads environment variables and returns a Config instance.
// If an environment variable is not set, it uses the provided default value.
func Load() *Config {
	cfg := &Config{
		Port:             getEnv("PORT", "8080"),
		GRPCPort:         getEnv("GRPC_PORT", "9090"),
		DBHost:           getEnv("DB_HOST", "localhost"),
		DBPort:           getEnv("DB_PORT", "5432"),
		DBUser:           getEnv("DB_USER", "postgres"),
		DBPassword:       getEnv("DB_PASSWORD", ""),
		DBName:           getEnv("DB_NAME", "project_alpha"),
		DBSSLMode:        getEnv("DB_SSL_MODE", "disable"),
		LibvirtURI:       getEnv("LIBVIRT_URI", "qemu:///system"),
		ISODir:           getEnv("ISO_DIR", "/home/darc0/projects/LIMEN/database/iso"),
		VMDir:            getEnv("VM_DIR", "/home/darc0/projects/LIMEN/database/vms"),
		AdminUser:        getEnv("ADMIN_USER", "admin"),
		AdminPassword:    getEnv("ADMIN_PASSWORD", ""),
		JWTSecret:        getEnv("JWT_SECRET", ""),
		LogLevel:         getEnv("LOG_LEVEL", "info"),
		RateLimitEnabled: getEnv("RATE_LIMIT_ENABLED", "true") == "true",
		RateLimitRPS:     parseFloat(getEnv("RATE_LIMIT_RPS", "10"), 10),
		RateLimitBurst:   parseInt(getEnv("RATE_LIMIT_BURST", "20"), 20),
		Env:              getEnv("ENV", "development"),
	}

	// Build DatabaseURL from components
	cfg.DatabaseURL = buildDatabaseURL(cfg)

	// Parse allowed origins (comma-separated)
	originsStr := getEnv("ALLOWED_ORIGINS", "*")
	if originsStr == "*" {
		cfg.AllowedOrigins = []string{"*"}
	} else {
		cfg.AllowedOrigins = strings.Split(originsStr, ",")
		for i := range cfg.AllowedOrigins {
			cfg.AllowedOrigins[i] = strings.TrimSpace(cfg.AllowedOrigins[i])
		}
	}

	return cfg
}

// buildDatabaseURL constructs a PostgreSQL connection string from components.
func buildDatabaseURL(cfg *Config) string {
	if dbURL := getEnv("DATABASE_URL", ""); dbURL != "" {
		return dbURL
	}

	// Build from components
	return strings.Join([]string{
		"host=" + cfg.DBHost,
		"user=" + cfg.DBUser,
		"password=" + cfg.DBPassword,
		"dbname=" + cfg.DBName,
		"port=" + cfg.DBPort,
		"sslmode=" + cfg.DBSSLMode,
		"TimeZone=Asia/Seoul",
	}, " ")
}

// getEnv retrieves an environment variable or returns a fallback value.
func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}
	return fallback
}

// parseInt parses a string to int or returns fallback.
func parseInt(s string, fallback int) int {
	if val, err := strconv.Atoi(s); err == nil {
		return val
	}
	return fallback
}

// parseFloat parses a string to float64 or returns fallback.
func parseFloat(s string, fallback float64) float64 {
	if val, err := strconv.ParseFloat(s, 64); err == nil {
		return val
	}
	return fallback
}

// IsProduction returns true if the environment is production.
func (c *Config) IsProduction() bool {
	return c.Env == "production"
}

// IsDevelopment returns true if the environment is development.
func (c *Config) IsDevelopment() bool {
	return c.Env == "development"
}
