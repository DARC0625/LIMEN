// Package database provides database connection and migration functionality.
package database

import (
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

// Connect establishes a connection to the database using configuration.
// It performs automatic schema migration for all models.
func Connect(cfg *config.Config) error {
	var err error
	DB, err = gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil {
		return err
	}

	// Optimize connection pool settings for production
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}

	// Set connection pool parameters for optimal performance
	// These values are optimized for production workloads:
	// - MaxIdleConns: Keep some connections ready for immediate use
	// - MaxOpenConns: Limit concurrent connections to prevent database overload
	// - ConnMaxLifetime: Recycle connections to prevent stale connections
	// - ConnMaxIdleTime: Close idle connections to free resources
	sqlDB.SetMaxIdleConns(25)                  // Increased from 10 for better connection reuse
	sqlDB.SetMaxOpenConns(100)                 // Maximum open connections (unchanged)
	sqlDB.SetConnMaxLifetime(30 * time.Minute) // Reduced from 1 hour to prevent stale connections
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)  // Reduced from 10 minutes for faster cleanup

	// Migrate the schema
	err = DB.AutoMigrate(
		&models.User{},
		&models.VM{},
		&models.VMImage{},
		&models.VMSnapshot{},
		&models.ResourceQuota{},
		&models.ConsoleSession{},
		&models.UserQuota{},
		&models.AuditLog{},
	)
	if err != nil {
		return err
	}

	// Create additional indexes for performance optimization
	if err := CreateIndexes(DB); err != nil {
		// Log error but don't fail - indexes might already exist
		// This is a non-critical operation
	}

	// Ensure system-wide quota exists and MaxVMs equals MaxCPU
	var quota models.ResourceQuota
	if err := DB.First(&quota, 1).Error; err == nil {
		if quota.MaxVMs != quota.MaxCPU {
			quota.MaxVMs = quota.MaxCPU
			DB.Save(&quota)
		}
	}

	return nil
}
