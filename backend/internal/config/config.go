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
	Port        string // HTTP server port
	BindAddress string // HTTP server bind address (default: "0.0.0.0" for all interfaces, or specific IP like "10.0.0.100")
	GRPCPort    string // gRPC server port (for future use)

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
	ISODir  string // ISO images directory
	VMDir   string // VM disk images directory
	RAGPath string // RAG documents directory

	// Security Configuration
	AdminUser            string   // Default admin username
	AdminPassword        string   // Default admin password (should be changed on first login)
	AllowedOrigins       []string // CORS allowed origins
	JWTSecret            string   // JWT signing secret (HMAC, deprecated - use Ed25519)
	JWTEd25519PrivateKey string   // Ed25519 private key for JWT signing (preferred)
	JWTEd25519PublicKey  string   // Ed25519 public key for JWT verification (preferred)

	// Logging Configuration
	LogLevel string // Log level: debug, info, warn, error
	LogDir   string // Log directory for file rotation (empty = console only)

	// Rate Limiting
	RateLimitEnabled bool    // Enable rate limiting
	RateLimitRPS     float64 // Requests per second per IP
	RateLimitBurst   int     // Burst size

	// IP Whitelist
	AdminIPWhitelist []string // IP whitelist for admin endpoints (empty = allow all)

	// Environment
	Env string // Environment: development, production, etc.

	// Alerting Configuration
	AlertingEnabled    bool     // Enable alerting
	AlertWebhookURL    string   // Webhook URL for alerts (e.g., Slack, Discord)
	AlertEmailEnabled  bool     // Enable email alerts
	AlertEmailSMTPHost string   // SMTP host
	AlertEmailSMTPPort int      // SMTP port
	AlertEmailSMTPUser string   // SMTP username
	AlertEmailSMTPPass string   // SMTP password
	AlertEmailFrom     string   // Email sender address
	AlertEmailTo       []string // Email recipient addresses
	AlertDedupWindow   int      // Deduplication window in minutes

	// VM Minimum Resource Configuration (안전장치: 최소 리소스 강제)
	VMMinVCPU     int // Minimum CPU cores (default: 2)
	VMMinMemMB    int // Minimum memory in MB for Linux VMs (default: 2048)
	VMMinMemMBISO int // Minimum memory in MB for Windows/ISO VMs (default: 4096)
}

// Load reads environment variables and returns a Config instance.
// If an environment variable is not set, it uses the provided default value.
func Load() *Config {
	cfg := &Config{
		Port:             getEnv("PORT", "18443"),           // Custom port for security (default: 18443)
		BindAddress:      getEnv("BIND_ADDRESS", "0.0.0.0"), // Bind all interfaces by default
		GRPCPort:         getEnv("GRPC_PORT", "9090"),
		DBHost:           getEnv("DB_HOST", "localhost"),
		DBPort:           getEnv("DB_PORT", "5432"),
		DBUser:           getEnv("DB_USER", "postgres"),
		DBPassword:       getEnv("DB_PASSWORD", ""),
		DBName:           getEnv("DB_NAME", "limen"),
		DBSSLMode:        getEnv("DB_SSL_MODE", "disable"),
		LibvirtURI:       getEnv("LIBVIRT_URI", "qemu:///system"),
		ISODir:           getEnv("ISO_DIR", "../database/iso"),
		VMDir:            getEnv("VM_DIR", "../database/vms"),
		RAGPath:          getEnv("RAG_PATH", "../RAG"),
		AdminUser:        getEnv("ADMIN_USER", "admin"),
		AdminPassword:    getEnv("ADMIN_PASSWORD", ""),
		JWTSecret:        getEnv("JWT_SECRET", ""),
		LogLevel:         getEnv("LOG_LEVEL", "info"),
		LogDir:           getEnv("LOG_DIR", ""), // Empty = console only, set to enable file rotation
		RateLimitEnabled: getEnv("RATE_LIMIT_ENABLED", "true") == "true",
		RateLimitRPS:     parseFloat(getEnv("RATE_LIMIT_RPS", "10"), 10),
		RateLimitBurst:   parseInt(getEnv("RATE_LIMIT_BURST", "20"), 20),
		Env:              getEnv("ENV", "development"),

		// IP Whitelist
		AdminIPWhitelist: parseStringSlice(getEnv("ADMIN_IP_WHITELIST", "")),

		// Alerting
		AlertingEnabled:    getEnv("ALERTING_ENABLED", "false") == "true",
		AlertWebhookURL:    getEnv("ALERT_WEBHOOK_URL", ""),
		AlertEmailEnabled:  getEnv("ALERT_EMAIL_ENABLED", "false") == "true",
		AlertEmailSMTPHost: getEnv("ALERT_EMAIL_SMTP_HOST", ""),
		AlertEmailSMTPPort: parseInt(getEnv("ALERT_EMAIL_SMTP_PORT", "587"), 587),
		AlertEmailSMTPUser: getEnv("ALERT_EMAIL_SMTP_USER", ""),
		AlertEmailSMTPPass: getEnv("ALERT_EMAIL_SMTP_PASS", ""),
		AlertEmailFrom:     getEnv("ALERT_EMAIL_FROM", ""),
		AlertDedupWindow:   parseInt(getEnv("ALERT_DEDUP_WINDOW", "5"), 5),

		// VM Minimum Resource Configuration (안전장치)
		VMMinVCPU:     parseInt(getEnv("VM_MIN_VCPU", "2"), 2),             // Minimum 2 CPU cores
		VMMinMemMB:    parseInt(getEnv("VM_MIN_MEM_MB", "2048"), 2048),     // Minimum 2GB for Linux
		VMMinMemMBISO: parseInt(getEnv("VM_MIN_MEM_MB_ISO", "4096"), 4096), // Minimum 4GB for Windows/ISO
	}

	// Build DatabaseURL from components
	cfg.DatabaseURL = buildDatabaseURL(cfg)

	// Parse allowed origins (comma-separated)
	originsStr := getEnv("ALLOWED_ORIGINS", "")
	if originsStr == "" {
		cfg.AllowedOrigins = []string{}
	} else {
		cfg.AllowedOrigins = strings.Split(originsStr, ",")
		for i := range cfg.AllowedOrigins {
			cfg.AllowedOrigins[i] = strings.TrimSpace(cfg.AllowedOrigins[i])
		}
	}

	// Parse alert email recipients (comma-separated)
	emailToStr := getEnv("ALERT_EMAIL_TO", "")
	if emailToStr != "" {
		cfg.AlertEmailTo = strings.Split(emailToStr, ",")
		for i := range cfg.AlertEmailTo {
			cfg.AlertEmailTo[i] = strings.TrimSpace(cfg.AlertEmailTo[i])
		}
	} else {
		cfg.AlertEmailTo = []string{}
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

// parseStringSlice parses a comma-separated string into a slice of strings.
func parseStringSlice(s string) []string {
	if s == "" {
		return []string{}
	}
	parts := strings.Split(s, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// IsProduction returns true if the environment is production.
func (c *Config) IsProduction() bool {
	return c.Env == "production"
}

// IsDevelopment returns true if the environment is development.
func (c *Config) IsDevelopment() bool {
	return c.Env == "development"
}
