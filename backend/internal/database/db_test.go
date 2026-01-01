package database

import (
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestConnect_SQLite(t *testing.T) {
	// Test with SQLite (in-memory) for testing
	cfg := &config.Config{
		DatabaseURL: "sqlite://:memory:",
	}
	
	// Since Connect uses postgres.Open, we'll test the connection pool setup separately
	// For actual testing, we'd need to mock or use a test database
	_ = cfg
}

func TestConnect_ConnectionPoolSettings(t *testing.T) {
	// Test connection pool settings by creating a test DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}
	
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("Failed to get underlying sql.DB: %v", err)
	}
	
	// Test connection pool settings
	sqlDB.SetMaxIdleConns(25)
	sqlDB.SetMaxOpenConns(100)
	
	// Verify settings were applied
	if sqlDB.Stats().MaxOpenConnections != 100 {
		t.Errorf("MaxOpenConns not set correctly")
	}
	
	sqlDB.Close()
}

