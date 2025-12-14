package main

import (
	"net/http"
	"path/filepath"

	"github.com/DARC0625/LIMEN/backend/internal/auth"
	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/database"
	"github.com/DARC0625/LIMEN/backend/internal/handlers"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/middleware"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/DARC0625/LIMEN/backend/internal/router"
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

	// Initialize logger
	if err := logger.Init(cfg.LogLevel); err != nil {
		panic("Failed to initialize logger: " + err.Error())
	}
	defer logger.Sync()

	logger.Log.Info("Starting server", zap.String("env", cfg.Env), zap.String("port", cfg.Port))

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

	// Create VM service
	vmService, err := vm.NewVMService(database.DB, cfg.LibvirtURI, cfg.ISODir, cfg.VMDir)
	if err != nil {
		logger.Log.Fatal("Failed to create VM service", zap.Error(err))
	}
	defer vmService.Close()

	// Create handler
	h := handlers.NewHandler(database.DB, vmService)

	// Initialize metrics
	if err := h.UpdateMetrics(); err != nil {
		logger.Log.Warn("Failed to initialize metrics", zap.Error(err))
	}

	// Setup routes
	router := router.SetupRoutes(h, cfg)

	// WebSocket endpoints need to bypass middleware that wraps ResponseWriter
	// because WebSocket upgrade requires http.Hijacker interface
	// Create a separate handler for WebSocket routes
	wsHandler := router
	
	// Apply middleware to regular HTTP routes (excluding WebSocket)
	// WebSocket routes are handled separately to avoid ResponseWriter wrapping issues
	handler := middleware.Recovery(router)
	handler = middleware.Logging(handler)
	handler = middleware.RequestID(handler)
	
	// Rate limiting (if enabled)
	if cfg.RateLimitEnabled {
		handler = middleware.RateLimit(cfg.RateLimitRPS, cfg.RateLimitBurst)(handler)
	}
	
	handler = middleware.Auth(cfg)(handler) // Authentication middleware
	handler = middleware.CORS(cfg.AllowedOrigins)(handler)
	
	// Wrap handler to route WebSocket requests to wsHandler
	// This allows WebSocket to bypass middleware that wraps ResponseWriter
	finalHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if this is a WebSocket upgrade request
		if r.Header.Get("Upgrade") == "websocket" {
			// Route WebSocket requests directly (only CORS and Auth middleware applied via router)
			wsHandler.ServeHTTP(w, r)
			return
		}
		// Regular HTTP requests go through all middleware
		handler.ServeHTTP(w, r)
	})

	logger.Log.Info("Server starting", zap.String("port", cfg.Port))
	if err := http.ListenAndServe(":"+cfg.Port, finalHandler); err != nil {
		logger.Log.Fatal("Server failed", zap.Error(err))
	}
}

func ensureAdminUser(cfg *config.Config) error {
	var adminUser models.User
	result := database.DB.First(&adminUser, 1)
	if result.Error == gorm.ErrRecordNotFound {
		// Use configured admin credentials, but require password change if default
		adminPassword := cfg.AdminPassword
		if adminPassword == "" {
			adminPassword = "password" // Default fallback, but should be set via env
			logger.Log.Warn("Using default admin password. Please set ADMIN_PASSWORD environment variable.")
		}

		// Hash password before storing
		hashedPassword, err := auth.HashPassword(adminPassword)
		if err != nil {
			return err
		}

		adminUser = models.User{
			ID:       1,
			UUID:     uuid.New().String(),
			Username: cfg.AdminUser,
			Password: hashedPassword,
			Role:     models.RoleAdmin, // Set admin role
			Approved: true,              // Admin is auto-approved
		}
		if err := database.DB.Create(&adminUser).Error; err != nil {
			return err
		}
		logger.Log.Info("Created default admin user", zap.String("username", cfg.AdminUser), zap.String("role", string(models.RoleAdmin)))
		if cfg.AdminPassword == "" {
			logger.Log.Warn("Using default admin password. Please set ADMIN_PASSWORD environment variable.")
		}
	} else {
		// Ensure existing admin user has admin role and is approved (for migration)
		needsUpdate := false
		if adminUser.Role != models.RoleAdmin {
			adminUser.Role = models.RoleAdmin
			needsUpdate = true
		}
		if !adminUser.Approved {
			adminUser.Approved = true
			needsUpdate = true
		}
		// Ensure UUID exists (for migration)
		if adminUser.UUID == "" {
			adminUser.UUID = uuid.New().String()
			needsUpdate = true
		}
		if needsUpdate {
			if err := database.DB.Save(&adminUser).Error; err != nil {
				logger.Log.Warn("Failed to update admin user", zap.Error(err))
			} else {
				logger.Log.Info("Updated admin user", zap.String("username", adminUser.Username))
			}
		}
	}

	// Migrate existing users without UUID (including soft-deleted)
	var usersWithoutUUID []models.User
	if err := database.DB.Unscoped().Where("uuid = '' OR uuid IS NULL").Find(&usersWithoutUUID).Error; err == nil {
		if len(usersWithoutUUID) > 0 {
			logger.Log.Info("Migrating users without UUID", zap.Int("count", len(usersWithoutUUID)))
			for i := range usersWithoutUUID {
				if usersWithoutUUID[i].UUID == "" {
					usersWithoutUUID[i].UUID = uuid.New().String()
					if err := database.DB.Unscoped().Save(&usersWithoutUUID[i]).Error; err != nil {
						logger.Log.Warn("Failed to update user UUID", zap.Uint("user_id", usersWithoutUUID[i].ID), zap.Error(err))
					} else {
						logger.Log.Info("Updated user UUID", zap.Uint("user_id", usersWithoutUUID[i].ID), zap.String("username", usersWithoutUUID[i].Username))
					}
				}
			}
		}
		// Check if all users have UUID before setting NOT NULL
		var count int64
		database.DB.Unscoped().Model(&models.User{}).Where("uuid = '' OR uuid IS NULL").Count(&count)
		if count == 0 {
			if err := database.DB.Exec("ALTER TABLE users ALTER COLUMN uuid SET NOT NULL").Error; err != nil {
				logger.Log.Warn("Failed to set UUID column to NOT NULL", zap.Error(err))
			} else {
				logger.Log.Info("UUID column set to NOT NULL")
			}
		} else {
			logger.Log.Warn("Cannot set UUID to NOT NULL, some users still have NULL UUID", zap.Int64("count", count))
		}
	} else {
		logger.Log.Warn("Failed to query users without UUID", zap.Error(err))
	}

	// Migrate existing VMs without UUID (including soft-deleted)
	var vmsWithoutUUID []models.VM
	if err := database.DB.Unscoped().Where("uuid = '' OR uuid IS NULL").Find(&vmsWithoutUUID).Error; err == nil {
		if len(vmsWithoutUUID) > 0 {
			logger.Log.Info("Migrating VMs without UUID", zap.Int("count", len(vmsWithoutUUID)))
			for i := range vmsWithoutUUID {
				if vmsWithoutUUID[i].UUID == "" {
					vmsWithoutUUID[i].UUID = uuid.New().String()
					if err := database.DB.Unscoped().Save(&vmsWithoutUUID[i]).Error; err != nil {
						logger.Log.Warn("Failed to update VM UUID", zap.Uint("vm_id", vmsWithoutUUID[i].ID), zap.Error(err))
					} else {
						logger.Log.Info("Updated VM UUID", zap.Uint("vm_id", vmsWithoutUUID[i].ID), zap.String("vm_name", vmsWithoutUUID[i].Name))
					}
				}
			}
		}
		// Check if all VMs have UUID before setting NOT NULL
		var count int64
		database.DB.Unscoped().Model(&models.VM{}).Where("uuid = '' OR uuid IS NULL").Count(&count)
		if count == 0 {
			if err := database.DB.Exec("ALTER TABLE vms ALTER COLUMN uuid SET NOT NULL").Error; err != nil {
				logger.Log.Warn("Failed to set VM UUID column to NOT NULL", zap.Error(err))
			} else {
				logger.Log.Info("VM UUID column set to NOT NULL")
			}
		} else {
			logger.Log.Warn("Cannot set VM UUID to NOT NULL, some VMs still have NULL UUID", zap.Int64("count", count))
		}
	} else {
		logger.Log.Warn("Failed to query VMs without UUID", zap.Error(err))
	}

	return nil
}

func initImages(db *gorm.DB, isoDir string) error {
	images := []models.VMImage{
		{Name: "Ubuntu Desktop 22.04", OSType: "ubuntu-desktop", Path: filepath.Join(isoDir, "ubuntu-desktop.iso"), IsISO: true, Description: "GUI Installer"},
		{Name: "Ubuntu Server 22.04", OSType: "ubuntu-server", Path: filepath.Join(isoDir, "ubuntu-server.iso"), IsISO: true, Description: "CLI Installer"},
		{Name: "Kali Linux 2023.4", OSType: "kali", Path: filepath.Join(isoDir, "kali.iso"), IsISO: true, Description: "GUI Installer"},
		{Name: "Windows 10/11", OSType: "windows", Path: filepath.Join(isoDir, "windows.iso"), IsISO: true, Description: "Manual ISO Required"},
	}

	for _, img := range images {
		var count int64
		db.Model(&models.VMImage{}).Where("name = ?", img.Name).Count(&count)
		if count == 0 {
			if err := db.Create(&img).Error; err != nil {
				return err
			}
			logger.Log.Info("Initialized image", zap.String("name", img.Name))
		}
	}
	return nil
}
