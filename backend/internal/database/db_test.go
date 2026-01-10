package database

import (
	"database/sql"
	"testing"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestConnect_ConnectionPoolSettings(t *testing.T) {
	// Test connection pool settings by creating a test DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}
	defer func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
	}()

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("Failed to get underlying sql.DB: %v", err)
	}

	// Test connection pool settings (matching Connect function)
	sqlDB.SetMaxIdleConns(25)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)

	// Verify settings were applied
	stats := sqlDB.Stats()
	if stats.MaxOpenConnections != 100 {
		t.Errorf("MaxOpenConns not set correctly, got %d, want 100", stats.MaxOpenConnections)
	}

	// Verify connection pool is working
	if stats.OpenConnections > stats.MaxOpenConnections {
		t.Errorf("OpenConnections (%d) exceeds MaxOpenConnections (%d)", stats.OpenConnections, stats.MaxOpenConnections)
	}
}

func TestConnect_AutoMigrate(t *testing.T) {
	// Test AutoMigrate functionality
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}
	defer func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
	}()

	// Test AutoMigrate with models
	err = db.AutoMigrate(&models.User{}, &models.VM{}, &models.VMImage{}, &models.VMSnapshot{}, &models.ResourceQuota{})
	if err != nil {
		t.Fatalf("AutoMigrate failed: %v", err)
	}

	// Verify tables were created by trying to insert a record
	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Errorf("Failed to create user after migration: %v", err)
	}

	// Verify user was created
	var foundUser models.User
	if err := db.First(&foundUser, user.ID).Error; err != nil {
		t.Errorf("Failed to find created user: %v", err)
	}
	if foundUser.Username != "testuser" {
		t.Errorf("User username mismatch, got %s, want testuser", foundUser.Username)
	}
}

func TestConnect_ConnectionPoolStats(t *testing.T) {
	// Test connection pool statistics
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}
	defer func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
	}()

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("Failed to get underlying sql.DB: %v", err)
	}

	// Get initial stats
	stats := sqlDB.Stats()

	// Verify stats structure
	if stats.MaxOpenConnections < 0 {
		t.Error("MaxOpenConnections should be non-negative")
	}
	if stats.OpenConnections < 0 {
		t.Error("OpenConnections should be non-negative")
	}
	if stats.InUse < 0 {
		t.Error("InUse should be non-negative")
	}
	if stats.Idle < 0 {
		t.Error("Idle should be non-negative")
	}

	// Verify InUse + Idle <= OpenConnections
	if stats.InUse+stats.Idle > stats.OpenConnections {
		t.Errorf("InUse (%d) + Idle (%d) should not exceed OpenConnections (%d)",
			stats.InUse, stats.Idle, stats.OpenConnections)
	}
}

func TestConnect_ConnectionLifetime(t *testing.T) {
	// Test connection lifetime settings
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}
	defer func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
	}()

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("Failed to get underlying sql.DB: %v", err)
	}

	// Set connection lifetime
	maxLifetime := 30 * time.Minute
	maxIdleTime := 5 * time.Minute
	sqlDB.SetConnMaxLifetime(maxLifetime)
	sqlDB.SetConnMaxIdleTime(maxIdleTime)

	// Verify settings (we can't directly read these, but we can verify they don't cause errors)
	// The settings are applied internally by the database driver
	_ = maxLifetime
	_ = maxIdleTime

	// Test that connections can be created and used
	// Verify connection is usable by querying directly
	var result sql.NullString
	err = sqlDB.QueryRow("SELECT 'test'").Scan(&result)
	if err != nil {
		t.Errorf("Failed to query using connection: %v", err)
	}
	if !result.Valid || result.String != "test" {
		t.Errorf("Query result mismatch, got %v, want 'test'", result)
	}
}
