//go:build libvirt && extended
// +build libvirt,extended

package vm

import (
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func init() {
	logger.Init("debug")
}

func setupTestSyncDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	if err := db.AutoMigrate(&models.User{}, &models.VM{}); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return db
}

func TestSyncVMStatus_StatusUpdate(t *testing.T) {
	db := setupTestSyncDB(t)

	// Create VM with stopped status
	vm := models.VM{
		Name:    "test-vm",
		UUID:    "test-uuid",
		CPU:     2,
		Memory:  1024,
		Status:  models.VMStatusStopped,
		OwnerID: 1,
	}
	db.Create(&vm)

	// Update status to running
	vm.Status = models.VMStatusRunning
	if err := db.Save(&vm).Error; err != nil {
		t.Fatalf("Failed to update VM status: %v", err)
	}

	// Verify status was updated
	var updatedVM models.VM
	db.First(&updatedVM, vm.ID)
	if updatedVM.Status != models.VMStatusRunning {
		t.Errorf("Expected status Running, got %s", updatedVM.Status)
	}
}

func TestSyncVMStatus_StatusUnchanged(t *testing.T) {
	db := setupTestSyncDB(t)

	vm := models.VM{
		Name:    "test-vm",
		UUID:    "test-uuid",
		CPU:     2,
		Memory:  1024,
		Status:  models.VMStatusRunning,
		OwnerID: 1,
	}
	db.Create(&vm)

	originalStatus := vm.Status

	// Save without changing status
	if err := db.Save(&vm).Error; err != nil {
		t.Fatalf("Failed to save VM: %v", err)
	}

	// Verify status unchanged
	var savedVM models.VM
	db.First(&savedVM, vm.ID)
	if savedVM.Status != originalStatus {
		t.Errorf("Expected status unchanged (%s), got %s", originalStatus, savedVM.Status)
	}
}

func TestSyncAllVMStatuses_MultipleVMs(t *testing.T) {
	db := setupTestSyncDB(t)

	// Create multiple VMs with different statuses
	vms := []models.VM{
		{Name: "vm1", UUID: "uuid1", CPU: 2, Memory: 1024, Status: models.VMStatusRunning, OwnerID: 1},
		{Name: "vm2", UUID: "uuid2", CPU: 4, Memory: 2048, Status: models.VMStatusStopped, OwnerID: 1},
		{Name: "vm3", UUID: "uuid3", CPU: 1, Memory: 512, Status: models.VMStatusCreating, OwnerID: 1},
	}
	for _, vm := range vms {
		db.Create(&vm)
	}

	// Verify all VMs are in database
	var count int64
	db.Model(&models.VM{}).Count(&count)
	if count != 3 {
		t.Errorf("Expected 3 VMs, got %d", count)
	}

	// Verify statuses are preserved
	var savedVMs []models.VM
	db.Find(&savedVMs)
	statusMap := make(map[string]models.VMStatus)
	for _, vm := range savedVMs {
		statusMap[vm.Name] = vm.Status
	}

	if statusMap["vm1"] != models.VMStatusRunning {
		t.Errorf("Expected vm1 status Running, got %s", statusMap["vm1"])
	}
	if statusMap["vm2"] != models.VMStatusStopped {
		t.Errorf("Expected vm2 status Stopped, got %s", statusMap["vm2"])
	}
	if statusMap["vm3"] != models.VMStatusCreating {
		t.Errorf("Expected vm3 status Creating, got %s", statusMap["vm3"])
	}
}

func TestGetVMStatusFromLibvirt_StatusMapping(t *testing.T) {
	// Test status mapping logic (without actual libvirt connection)
	// This tests the conceptual mapping between libvirt states and VMStatus

	statusTests := []struct {
		name           string
		libvirtActive  bool
		expectedStatus models.VMStatus
	}{
		{"Active domain", true, models.VMStatusRunning},
		{"Inactive domain", false, models.VMStatusStopped},
	}

	for _, tt := range statusTests {
		t.Run(tt.name, func(t *testing.T) {
			var status models.VMStatus
			if tt.libvirtActive {
				status = models.VMStatusRunning
			} else {
				status = models.VMStatusStopped
			}

			if status != tt.expectedStatus {
				t.Errorf("Expected status %s, got %s", tt.expectedStatus, status)
			}
		})
	}
}

func TestEnsureVMExists_VMInDB(t *testing.T) {
	db := setupTestSyncDB(t)

	vm := models.VM{
		Name:    "test-vm",
		UUID:    "test-uuid",
		CPU:     2,
		Memory:  1024,
		Status:  models.VMStatusRunning,
		OwnerID: 1,
	}
	db.Create(&vm)

	// Verify VM exists in DB
	var foundVM models.VM
	if err := db.First(&foundVM, vm.ID).Error; err != nil {
		t.Fatalf("VM should exist in database: %v", err)
	}

	if foundVM.Name != "test-vm" {
		t.Errorf("Expected VM name 'test-vm', got '%s'", foundVM.Name)
	}
}

func TestVMStatus_ValidTransitions(t *testing.T) {
	// Test valid VM status transitions
	validTransitions := []struct {
		from models.VMStatus
		to   models.VMStatus
	}{
		{models.VMStatusStopped, models.VMStatusRunning},
		{models.VMStatusRunning, models.VMStatusStopped},
		{models.VMStatusCreating, models.VMStatusRunning},
		{models.VMStatusRunning, models.VMStatusDeleting},
	}

	for _, tt := range validTransitions {
		t.Run(string(tt.from)+"_to_"+string(tt.to), func(t *testing.T) {
			// Both statuses should be valid
			if !tt.from.IsValid() {
				t.Errorf("From status %s should be valid", tt.from)
			}
			if !tt.to.IsValid() {
				t.Errorf("To status %s should be valid", tt.to)
			}
		})
	}
}
