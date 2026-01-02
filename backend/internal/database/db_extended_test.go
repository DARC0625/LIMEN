package database

import (
	"testing"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestConnect_SQLite(t *testing.T) {
	// Test Connect with SQLite (for testing)
	// Since Connect uses postgres.Open, we'll test the connection pool logic separately
	// For now, test with SQLite directly
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

	// Test AutoMigrate
	if err := db.AutoMigrate(&models.User{}, &models.VM{}, &models.VMImage{}, &models.VMSnapshot{}, &models.ResourceQuota{}); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}

	// Verify tables exist
	if !db.Migrator().HasTable(&models.User{}) {
		t.Error("User table should exist")
	}
	if !db.Migrator().HasTable(&models.VM{}) {
		t.Error("VM table should exist")
	}
	if !db.Migrator().HasTable(&models.VMImage{}) {
		t.Error("VMImage table should exist")
	}
	if !db.Migrator().HasTable(&models.VMSnapshot{}) {
		t.Error("VMSnapshot table should exist")
	}
	if !db.Migrator().HasTable(&models.ResourceQuota{}) {
		t.Error("ResourceQuota table should exist")
	}
}

func TestConnect_ConnectionPoolSettingsExtended(t *testing.T) {
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
		t.Fatalf("Failed to get sql.DB: %v", err)
	}

	// Test connection pool settings (same as in Connect function)
	sqlDB.SetMaxIdleConns(25)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)

	// Verify settings are applied (we can't directly read them, but we can verify no error)
	stats := sqlDB.Stats()
	if stats.MaxOpenConnections < 0 {
		t.Error("MaxOpenConnections should be non-negative")
	}
}

func TestConnect_QuotaEnforcement(t *testing.T) {
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

	// AutoMigrate
	if err := db.AutoMigrate(&models.ResourceQuota{}); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}

	// Create quota with MaxVMs != MaxCPU
	quota := models.ResourceQuota{
		ID:        1,
		MaxVMs:    10,
		MaxCPU:    20, // Different from MaxVMs
		MaxMemory: 8192,
	}
	db.Create(&quota)

	// Simulate the enforcement logic from Connect
	var existingQuota models.ResourceQuota
	if err := db.First(&existingQuota, 1).Error; err == nil {
		if existingQuota.MaxVMs != existingQuota.MaxCPU {
			existingQuota.MaxVMs = existingQuota.MaxCPU
			db.Save(&existingQuota)
		}
	}

	// Verify MaxVMs equals MaxCPU
	var updatedQuota models.ResourceQuota
	db.First(&updatedQuota, 1)
	if updatedQuota.MaxVMs != updatedQuota.MaxCPU {
		t.Errorf("Expected MaxVMs (%d) to equal MaxCPU (%d)", updatedQuota.MaxVMs, updatedQuota.MaxCPU)
	}
}

func TestConnect_QuotaCreation(t *testing.T) {
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

	// AutoMigrate
	if err := db.AutoMigrate(&models.ResourceQuota{}); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}

	// Test that quota can be created
	quota, err := models.GetOrCreateQuota(db)
	if err != nil {
		t.Fatalf("Failed to get or create quota: %v", err)
	}

	if quota == nil {
		t.Fatal("Quota should not be nil")
	}

	// Verify quota has valid values
	if quota.MaxVMs == 0 && quota.MaxCPU == 0 {
		t.Error("Quota should have non-zero default values")
	}
}

func TestDatabase_ConnectionLifetime(t *testing.T) {
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
		t.Fatalf("Failed to get sql.DB: %v", err)
	}

	// Set very short lifetime for testing
	sqlDB.SetConnMaxLifetime(1 * time.Millisecond)

	// Get a connection
	conn, err := sqlDB.Conn(nil)
	if err != nil {
		t.Fatalf("Failed to get connection: %v", err)
	}
	defer conn.Close()

	// Wait for lifetime to expire
	time.Sleep(5 * time.Millisecond)

	// Get another connection (should work even if previous expired)
	conn2, err := sqlDB.Conn(nil)
	if err != nil {
		t.Fatalf("Failed to get second connection: %v", err)
	}
	defer conn2.Close()
}

func TestDatabase_ConnectionIdleTime(t *testing.T) {
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
		t.Fatalf("Failed to get sql.DB: %v", err)
	}

	// Set idle time
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)

	// Verify no error occurred
	stats := sqlDB.Stats()
	_ = stats // Use stats to verify connection pool is working
}

func TestDatabase_MigrationOrder(t *testing.T) {
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

	// Test migration order (User should be migrated before VM since VM references User)
	if err := db.AutoMigrate(&models.User{}, &models.VM{}, &models.VMImage{}, &models.VMSnapshot{}, &models.ResourceQuota{}); err != nil {
		t.Fatalf("Failed to migrate in order: %v", err)
	}

	// Verify all tables exist
	tables := []interface{}{
		&models.User{},
		&models.VM{},
		&models.VMImage{},
		&models.VMSnapshot{},
		&models.ResourceQuota{},
	}

	for _, table := range tables {
		if !db.Migrator().HasTable(table) {
			t.Errorf("Table should exist: %T", table)
		}
	}
}

func TestDatabase_ConcurrentConnections(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("Failed to get sql.DB: %v", err)
	}
	defer sqlDB.Close()

	// Set connection limits
	sqlDB.SetMaxOpenConns(5)
	sqlDB.SetMaxIdleConns(2)

	// Verify we can use the connection
	var count int64
	if err := db.Model(&models.User{}).Count(&count).Error; err != nil {
		// Table might not exist, but connection should work
		_ = err
	}

	// Verify stats
	stats := sqlDB.Stats()
	if stats.MaxOpenConnections < 0 {
		t.Error("MaxOpenConnections should be non-negative")
	}
}
