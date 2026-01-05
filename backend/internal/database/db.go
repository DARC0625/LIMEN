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
	// These values are optimized for 10+ concurrent users:
	// - MaxIdleConns: Keep connections ready for immediate use (2-3 per user)
	// - MaxOpenConns: Support 10+ concurrent users with multiple requests each
	// - ConnMaxLifetime: Recycle connections to prevent stale connections
	// - ConnMaxIdleTime: Close idle connections to free resources
	sqlDB.SetMaxIdleConns(30)                  // 2-3 connections per user for 10+ users
	sqlDB.SetMaxOpenConns(100)                 // Support 10+ concurrent users with multiple requests
	sqlDB.SetConnMaxLifetime(30 * time.Minute) // Prevent stale connections
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)  // Balance between cleanup and reuse

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
		&models.Waitlist{},
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
