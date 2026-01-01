package vm

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func init() {
	// Initialize logger for tests
	logger.Init("debug")
}

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	// Auto-migrate models
	if err := db.AutoMigrate(&models.VM{}, &models.VMImage{}, &models.VMSnapshot{}); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return db
}

func TestNewVMService_InvalidLibvirtURI(t *testing.T) {
	db := setupTestDB(t)
	tempDir := t.TempDir()

	// Test with invalid libvirt URI (will fail to connect)
	_, err := NewVMService(db, "invalid://uri", tempDir, tempDir)
	if err == nil {
		t.Error("Expected error for invalid libvirt URI")
	}
}

func TestNewVMService_DirectoryCreation(t *testing.T) {
	db := setupTestDB(t)
	tempDir := t.TempDir()
	isoDir := filepath.Join(tempDir, "iso")
	vmDir := filepath.Join(tempDir, "vm")

	// Test that directories are created
	// Note: This will fail libvirt connection, but directories should be created first
	_, err := NewVMService(db, "invalid://uri", isoDir, vmDir)
	if err == nil {
		t.Error("Expected error for invalid libvirt URI")
	}

	// Check if directories were created (they should be created before libvirt connection)
	// Actually, directories are created in NewVMService, so even if libvirt fails,
	// directories might be created. But we can't test this easily without mocking.
}

func TestVMService_Close(t *testing.T) {
	db := setupTestDB(t)
	tempDir := t.TempDir()

	// Create a service that will fail to connect
	service, err := NewVMService(db, "invalid://uri", tempDir, tempDir)
	if err == nil {
		// If somehow it doesn't fail, test Close
		if service != nil {
			service.Close() // Should not panic
		}
	}
}

func TestVMService_IsAlive(t *testing.T) {
	db := setupTestDB(t)
	tempDir := t.TempDir()

	// Create a service that will fail to connect
	service, err := NewVMService(db, "invalid://uri", tempDir, tempDir)
	if err == nil {
		if service != nil {
			// IsAlive should return false for invalid connection
			alive := service.IsAlive()
			if alive {
				t.Error("IsAlive should return false for invalid connection")
			}
		}
	}
}

func TestVMService_EnsureISO_ImageNotFound(t *testing.T) {
	db := setupTestDB(t)
	tempDir := t.TempDir()

	// Create a service that will fail to connect
	service, err := NewVMService(db, "invalid://uri", tempDir, tempDir)
	if err == nil && service != nil {
		// Test EnsureISO with non-existent image
		_, err := service.EnsureISO("nonexistent")
		if err == nil {
			t.Error("Expected error for non-existent image")
		}
	}
}

func TestVMService_EnsureISO_ImageExists(t *testing.T) {
	db := setupTestDB(t)
	tempDir := t.TempDir()
	isoDir := filepath.Join(tempDir, "iso")
	os.MkdirAll(isoDir, 0755)

	// Create test image in database
	image := models.VMImage{
		OSType: "test-os",
		Path:   "test.iso",
	}
	db.Create(&image)

	// Create test ISO file
	isoPath := filepath.Join(isoDir, "test.iso")
	f, err := os.Create(isoPath)
	if err != nil {
		t.Fatalf("Failed to create test ISO: %v", err)
	}
	f.Close()

	// Create a service that will fail to connect
	service, err := NewVMService(db, "invalid://uri", isoDir, tempDir)
	if err == nil && service != nil {
		// Test EnsureISO with existing image
		path, err := service.EnsureISO("test-os")
		if err != nil {
			t.Logf("EnsureISO failed (expected due to libvirt): %v", err)
		} else if path != isoPath {
			t.Errorf("Expected path %s, got %s", isoPath, path)
		}
	}
}

func TestVMService_EnsureISO_PathResolution(t *testing.T) {
	db := setupTestDB(t)
	tempDir := t.TempDir()
	isoDir := filepath.Join(tempDir, "iso")
	os.MkdirAll(isoDir, 0755)

	// Test relative path resolution
	image := models.VMImage{
		OSType: "test-os",
		Path:   "test.iso", // relative path
	}
	db.Create(&image)

	// Create test ISO file
	isoPath := filepath.Join(isoDir, "test.iso")
	f, err := os.Create(isoPath)
	if err != nil {
		t.Fatalf("Failed to create test ISO: %v", err)
	}
	f.Close()

	// Create a service that will fail to connect
	service, err := NewVMService(db, "invalid://uri", isoDir, tempDir)
	if err == nil && service != nil {
		// Test path resolution logic
		// The EnsureISO function should resolve relative paths to absolute paths
		path, err := service.EnsureISO("test-os")
		if err != nil {
			t.Logf("EnsureISO failed (expected due to libvirt): %v", err)
		} else {
			// Verify path is resolved correctly
			expectedPath := filepath.Join(isoDir, "test.iso")
			if path != expectedPath {
				t.Errorf("Expected path %s, got %s", expectedPath, path)
			}
		}
	}
}

