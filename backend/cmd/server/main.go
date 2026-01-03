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
	"github.com/DARC0625/LIMEN/backend/internal/metrics"
	"github.com/DARC0625/LIMEN/backend/internal/middleware"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/DARC0625/LIMEN/backend/internal/router"
	"github.com/DARC0625/LIMEN/backend/internal/security"
	"github.com/DARC0625/LIMEN/backend/internal/shutdown"
	"github.com/DARC0625/LIMEN/backend/internal/vm"
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

		// Check hardware changes once at startup (event-driven)
		if err := hardware.CheckHardwareChanges(); err != nil {
			logger.Log.Warn("Failed to check hardware changes", zap.Error(err))
		}
		logger.Log.Info("Hardware monitoring initialized (event-driven)")
	}

	// Initialize security chain monitoring
	ctx := context.Background()
	if _, err := security.ValidateSecurityChain(ctx); err != nil {
		logger.Log.Warn("Failed to validate security chain", zap.Error(err))
	} else {
		// Check security chain once at startup (event-driven)
		if _, err := security.CheckSecurityChain(ctx); err != nil {
			logger.Log.Warn("Failed to check security chain", zap.Error(err))
		}
		logger.Log.Info("Security chain monitoring initialized (event-driven)")
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

	// Initialize VM Service (libvirt connection)
	libvirtURI := cfg.LibvirtURI
	vmService, err := vm.NewVMService(database.DB, libvirtURI, cfg.ISODir, cfg.VMDir)
	if err != nil {
		logger.Log.Warn("Failed to initialize VM service (libvirt connection)",
			zap.Error(err),
			zap.String("libvirt_uri", libvirtURI),
			zap.String("iso_dir", cfg.ISODir),
			zap.String("vm_dir", cfg.VMDir))
		logger.Log.Info("VM operations will be unavailable until libvirt connection is established")
		vmService = nil // Continue without VM service
	} else {
		logger.Log.Info("VM service initialized successfully",
			zap.String("libvirt_uri", libvirtURI))
		defer vmService.Close() // Close libvirt connection on shutdown
	}

	// Start host metrics collection
	metrics.StartHostMetricsCollection(logger.Log)
	logger.Log.Info("Host metrics collection started")

	// Create handlers
	h := handlers.NewHandler(database.DB, vmService, cfg)

	// Setup routes
	router := router.SetupRoutes(h, cfg)

	// Create a wrapper that skips middleware for WebSocket connections and public endpoints
	// WebSocket requires http.Hijacker interface which is broken by middleware wrapping
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if this is a WebSocket upgrade request or WebSocket path
		// Some proxies may not send Upgrade header initially, so also check path
		isWebSocketPath := strings.HasPrefix(r.URL.Path, "/ws/") || 
			r.URL.Path == "/vnc" ||
			strings.HasPrefix(r.URL.Path, "/vnc/") || // VNC with UUID in path
			r.URL.Path == "/ws/vnc" ||
			r.URL.Path == "/ws/vm-status"
		isWebSocketUpgrade := r.Header.Get("Upgrade") == "websocket" || 
			strings.ToLower(r.Header.Get("Connection")) == "upgrade"
		
		// Check if this is a static file path (should skip authentication)
		isStaticPath := strings.HasPrefix(r.URL.Path, "/downloads/") || 
			strings.HasPrefix(r.URL.Path, "/media/") ||
			strings.HasPrefix(r.URL.Path, "/swagger/") ||
			r.URL.Path == "/swagger" ||
			r.URL.Path == "/docs"
		
		// Check if this is a public endpoint (should skip authentication middleware)
		isPublicEndpoint := middleware.IsPublicEndpoint(r.URL.Path)
		
		if isWebSocketPath || isWebSocketUpgrade {
			logger.Log.Info("WebSocket request detected - skipping middleware",
				zap.String("path", r.URL.Path),
				zap.String("upgrade", r.Header.Get("Upgrade")),
				zap.String("connection", r.Header.Get("Connection")),
				zap.String("origin", r.Header.Get("Origin")),
				zap.String("remote_addr", r.RemoteAddr))
			// Skip middleware for WebSocket connections - they need direct access to http.Hijacker
			router.ServeHTTP(w, r)
			return
		}
		
		if isStaticPath {
			// Skip middleware for static file paths
			router.ServeHTTP(w, r)
			return
		}
		
		if isPublicEndpoint {
			// Skip authentication middleware for public endpoints (but apply other middleware)
			httpHandler := middleware.Recovery(router)
			httpHandler = middleware.Logging(httpHandler)
			httpHandler = middleware.RequestID(httpHandler)
			
			// Security headers
			isHTTPS := cfg.Port == "443" || cfg.Port == "8443"
			httpHandler = middleware.SecurityHeaders(isHTTPS)(httpHandler)
			
			// CORS must be before Auth to handle OPTIONS preflight requests
			httpHandler = middleware.CORS(cfg.AllowedOrigins)(httpHandler)
			
			// HTTP Response Compression (gzip)
			httpHandler = middleware.Compression(httpHandler)
			
			httpHandler.ServeHTTP(w, r)
			return
		}

		// Apply middleware to regular HTTP routes (excluding WebSocket)
		httpHandler := middleware.Recovery(router)
		httpHandler = middleware.Logging(httpHandler)
		httpHandler = middleware.RequestID(httpHandler)

		// Security headers
		isHTTPS := cfg.Port == "443" || cfg.Port == "8443"
		httpHandler = middleware.SecurityHeaders(isHTTPS)(httpHandler)

		// CORS must be before Auth to handle OPTIONS preflight requests
		httpHandler = middleware.CORS(cfg.AllowedOrigins)(httpHandler)

		// IP Whitelist for Admin routes is handled in router.go

		// Rate limiting (if enabled)
		if cfg.RateLimitEnabled {
			rateLimitConfig := middleware.RateLimitConfig{
				DefaultRPS:   cfg.RateLimitRPS,
				DefaultBurst: cfg.RateLimitBurst,
				EndpointRPS: map[string]float64{
					"/api/vms":       5.0,  // VM operations: 5 req/s
					"/api/admin":     2.0,  // Admin operations: 2 req/s
					"/api/snapshots": 3.0,  // Snapshot operations: 3 req/s
					"/api/quota":     5.0,  // Quota queries: 5 req/s
					"/api/metrics":   10.0, // Metrics: 10 req/s
					"/agent/metrics": 10.0, // Agent metrics: 10 req/s
				},
			}
			httpHandler = middleware.RateLimitWithConfig(rateLimitConfig)(httpHandler)
		}

		// Request deduplication (prevent duplicate requests)
		httpHandler = middleware.Deduplication()(httpHandler)

		httpHandler = middleware.Auth(cfg)(httpHandler) // Authentication middleware

		// HTTP Response Compression (gzip)
		httpHandler = middleware.Compression(httpHandler)

		httpHandler.ServeHTTP(w, r)
	})

	// Start HTTP server with optimized timeouts
	addr := ":" + cfg.Port
	server := &http.Server{
		Addr:         addr,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,  // Timeout for reading request body
		WriteTimeout: 15 * time.Second,  // Timeout for writing response
		IdleTimeout:  120 * time.Second, // Timeout for idle connections (keep-alive)
		MaxHeaderBytes: 1 << 20,         // 1MB max header size
	}

	// Create shutdown manager for graceful shutdown
	shutdownMgr := shutdown.NewShutdownManager(server, logger.Log)

	// Register cleanup functions
	shutdownMgr.RegisterCleanup(func(ctx context.Context) error {
		logger.Log.Info("Closing database connections...")
		if sqlDB, err := database.DB.DB(); err == nil {
			return sqlDB.Close()
		}
		return nil
	})

	// Register VM service cleanup if available
	if vmService != nil {
		shutdownMgr.RegisterCleanup(func(ctx context.Context) error {
			logger.Log.Info("Closing libvirt connections...")
			// VM service cleanup can be added here if needed
			return nil
		})
	}

	// Register host metrics cleanup
	shutdownMgr.RegisterCleanup(func(ctx context.Context) error {
		logger.Log.Info("Stopping host metrics collection...")
		metrics.StopHostMetricsCollection()
		return nil
	})

	// Register WebSocket broadcaster cleanup
	if h != nil && h.VMStatusBroadcaster != nil {
		shutdownMgr.RegisterCleanup(func(ctx context.Context) error {
			logger.Log.Info("Shutting down WebSocket broadcaster...")
			h.VMStatusBroadcaster.Shutdown()
			return nil
		})
	}

	// Start server in a goroutine
	go func() {
		logger.Log.Info("Server starting", zap.String("address", addr))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Log.Fatal("Server failed", zap.Error(err))
		}
	}()

	// Wait for shutdown signal and perform graceful shutdown
	if err := shutdownMgr.WaitForShutdown(); err != nil {
		logger.Log.Error("Error during shutdown", zap.Error(err))
		os.Exit(1)
	}

	logger.Log.Info("Server stopped")
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
