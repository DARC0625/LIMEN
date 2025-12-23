// @title           LIMEN API
// @version         1.0
// @description     LIMEN (Linux Infrastructure Management Engine) - VM Management API
// @description     Comprehensive API for managing virtual machines, users, and system resources.
// @description
// @description     ## Security
// @description     - Authentication: JWT Bearer Token
// @description     - Authorization: Role-based access control (Admin/User)
// @description     - Encryption: Argon2id, ChaCha20-Poly1305, Ed25519
// @description
// @description     ## Features
// @description     - VM lifecycle management (create, start, stop, delete)
// @description     - User management and authentication
// @description     - Resource quota management
// @description     - Real-time VM status via WebSocket
// @description     - Hardware specification detection
// @description     - Security chain monitoring

// @contact.name   LIMEN Support
// @contact.url    https://github.com/DARC0625/LIMEN
// @contact.email  support@limen.local

// @license.name  MIT
// @license.url   https://opensource.org/licenses/MIT

// @host      localhost:18443
// @BasePath  /api

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token. Example: "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."

package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/auth"
	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/database"
	"github.com/DARC0625/LIMEN/backend/internal/handlers"
	"github.com/DARC0625/LIMEN/backend/internal/hardware"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/middleware"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/DARC0625/LIMEN/backend/internal/router"
	"github.com/DARC0625/LIMEN/backend/internal/security"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		// .env file is optional, continue without it
	}

	// Load configuration
	cfg := config.Load()

	// Initialize logger with rotation support
	if cfg.LogDir != "" {
		if err := logger.InitWithRotation(cfg.LogLevel, cfg.LogDir); err != nil {
			panic("Failed to initialize logger: " + err.Error())
		}
		logger.Log.Info("Log rotation enabled", zap.String("log_dir", cfg.LogDir))
	} else {
		if err := logger.Init(cfg.LogLevel); err != nil {
			panic("Failed to initialize logger: " + err.Error())
		}
		logger.Log.Info("Console logging enabled (no file rotation)")
	}
	defer logger.Sync()

	logger.Log.Info("Starting server", zap.String("env", cfg.Env), zap.String("port", cfg.Port))

	// Initialize hardware specification detection
	if err := hardware.Initialize(); err != nil {
		logger.Log.Warn("Failed to initialize hardware detection", zap.Error(err))
	} else {
		// Validate hardware security
		warnings := hardware.ValidateHardwareSecurity()
		for _, warning := range warnings {
			logger.Log.Warn("Hardware security warning", zap.String("warning", warning))
		}
		
		// Get optimal security configuration
		secConfig := hardware.GetOptimalSecurityConfig()
		logger.Log.Info("Optimal security configuration determined",
			zap.String("encryption", secConfig.PreferredEncryption),
			zap.Uint32("argon2id_memory_kb", secConfig.Argon2idConfig.Memory),
			zap.Uint32("argon2id_iterations", secConfig.Argon2idConfig.Iterations),
			zap.Uint8("argon2id_parallelism", secConfig.Argon2idConfig.Parallelism),
			zap.Bool("hardware_rng", secConfig.UseHardwareRNG),
			zap.Bool("hardware_accel", secConfig.EnableHardwareAccel),
		)
		
		// Start hardware monitoring (check every 5 minutes)
		hardware.StartMonitor(5 * time.Minute)
		defer hardware.StopMonitor()
	}

	// Initialize security chain monitoring
	ctx := context.Background()
	if _, err := security.ValidateSecurityChain(ctx); err != nil {
		logger.Log.Warn("Failed to validate security chain", zap.Error(err))
	} else {
		// Start security chain monitoring (check every 10 minutes)
		security.StartChainMonitoring(ctx, 10*time.Minute)
		logger.Log.Info("Security chain monitoring started")
	}

	// Connect to database
	if err := database.Connect(cfg); err != nil {
		logger.Log.Fatal("Failed to connect to database", zap.Error(err))
	}
	logger.Log.Info("Database connection established")

	// Initialize admin user
	if err := ensureAdminUser(cfg); err != nil {
		logger.Log.Fatal("Failed to ensure admin user", zap.Error(err))
	}

	// Initialize VM images
	if err := initImages(database.DB, cfg.ISODir); err != nil {
		logger.Log.Fatal("Failed to initialize images", zap.Error(err))
	}

	// Create handlers
	h := &handlers.Handler{
		DB: database.DB,
	}

	// Setup routes
	router := router.SetupRoutes(h, cfg)

	// Apply middleware to regular HTTP routes (excluding WebSocket)
	handler := middleware.Recovery(router)
	handler = middleware.Logging(handler)
	handler = middleware.RequestID(handler)

	// Security headers
	isHTTPS := cfg.Port == "443" || cfg.Port == "8443"
	handler = middleware.SecurityHeaders(isHTTPS)(handler)

	// CORS must be before Auth to handle OPTIONS preflight requests
	handler = middleware.CORS(cfg.AllowedOrigins)(handler)

	// IP Whitelist for Admin routes is handled in router.go

	// Rate limiting (if enabled)
	if cfg.RateLimitEnabled {
		rateLimitConfig := middleware.RateLimitConfig{
			DefaultRPS:   cfg.RateLimitRPS,
			DefaultBurst: cfg.RateLimitBurst,
			EndpointRPS: map[string]float64{
				"/api/vms":           5.0,  // VM operations: 5 req/s
				"/api/admin":         2.0,  // Admin operations: 2 req/s
				"/api/snapshots":     3.0,  // Snapshot operations: 3 req/s
				"/api/quota":         5.0,  // Quota queries: 5 req/s
				"/api/metrics":       10.0, // Metrics: 10 req/s
				"/agent/metrics":    10.0, // Agent metrics: 10 req/s
			},
		}
		handler = middleware.RateLimitWithConfig(rateLimitConfig)(handler)
	}

	handler = middleware.Auth(cfg)(handler) // Authentication middleware

	// HTTP Response Compression (gzip)
	handler = middleware.Compression(handler)

	// Start HTTP server
	addr := ":" + cfg.Port
	logger.Log.Info("Server starting", zap.String("address", addr))
	if err := http.ListenAndServe(addr, handler); err != nil {
		logger.Log.Fatal("Server failed", zap.Error(err))
	}
}

// ensureAdminUser ensures that an admin user exists in the database
func ensureAdminUser(cfg *config.Config) error {
	var adminUser models.User
	result := database.DB.Where("username = ?", cfg.AdminUser).First(&adminUser)

	if result.Error == gorm.ErrRecordNotFound {
		// Admin user doesn't exist, create it
		hashedPassword, err := auth.HashPassword(cfg.AdminPassword)
		if err != nil {
			return err
		}

		adminUser = models.User{
			UUID:     uuid.New().String(),
			Username: cfg.AdminUser,
			Password: hashedPassword,
			Role:     models.RoleAdmin,
			Approved: true, // Admin is always approved
		}

		if err := database.DB.Create(&adminUser).Error; err != nil {
			return err
		}

		logger.Log.Info("Admin user created", zap.String("username", cfg.AdminUser))
	} else if result.Error != nil {
		return result.Error
	} else {
		// Admin user exists, update password if needed
		if cfg.AdminPassword != "" {
			hashedPassword, err := auth.HashPassword(cfg.AdminPassword)
			if err != nil {
				return err
			}
			adminUser.Password = hashedPassword
			if err := database.DB.Save(&adminUser).Error; err != nil {
				return err
			}
			logger.Log.Info("Admin user password updated", zap.String("username", cfg.AdminUser))
		}
	}

	return nil
}

// initImages initializes VM images in the database
func initImages(db *gorm.DB, isoDir string) error {
	// Check if ISO directory exists
	if isoDir == "" {
		logger.Log.Warn("ISO directory not configured, skipping image initialization")
		return nil
	}

	// Read ISO directory
	files, err := os.ReadDir(isoDir)
	if err != nil {
		logger.Log.Warn("Failed to read ISO directory", zap.String("dir", isoDir), zap.Error(err))
		return nil // Don't fail if ISO directory doesn't exist
	}

	// Process each file
	for _, file := range files {
		if file.IsDir() {
			continue
		}

		filename := file.Name()
		filePath := filepath.Join(isoDir, filename)

		// Check if it's an ISO or disk image
		isISO := strings.HasSuffix(strings.ToLower(filename), ".iso")
		if !isISO && !strings.HasSuffix(strings.ToLower(filename), ".img") && !strings.HasSuffix(strings.ToLower(filename), ".qcow2") {
			continue
		}

		// Determine OS type from filename (simple heuristic)
		osType := "unknown"
		filenameLower := strings.ToLower(filename)
		if strings.Contains(filenameLower, "ubuntu") {
			osType = "ubuntu"
		} else if strings.Contains(filenameLower, "debian") {
			osType = "debian"
		} else if strings.Contains(filenameLower, "centos") || strings.Contains(filenameLower, "rhel") {
			osType = "centos"
		} else if strings.Contains(filenameLower, "fedora") {
			osType = "fedora"
		} else if strings.Contains(filenameLower, "windows") {
			osType = "windows"
		}

		// Check if image already exists in database
		var existingImage models.VMImage
		result := db.Where("path = ?", filePath).First(&existingImage)

		if result.Error == gorm.ErrRecordNotFound {
			// Image doesn't exist, create it
			image := models.VMImage{
				Name:        filename,
				OSType:      osType,
				Path:        filePath,
				IsISO:       isISO,
				Description: fmt.Sprintf("Auto-detected %s image", osType),
			}

			if err := db.Create(&image).Error; err != nil {
				logger.Log.Warn("Failed to create image record", zap.String("file", filename), zap.Error(err))
				continue
			}

			logger.Log.Info("VM image initialized", zap.String("name", filename), zap.String("os_type", osType))
		}
	}

	return nil
}
