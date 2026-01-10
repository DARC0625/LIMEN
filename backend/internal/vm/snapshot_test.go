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

func setupTestSnapshotDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	if err := db.AutoMigrate(&models.User{}, &models.VM{}, &models.VMSnapshot{}); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return db
}

func TestVMService_ListSnapshots_DB(t *testing.T) {
	db := setupTestSnapshotDB(t)

	// Create VM
	vm := models.VM{
		Name:    "test-vm",
		UUID:    "test-uuid",
		CPU:     2,
		Memory:  1024,
		Status:  models.VMStatusRunning,
		OwnerID: 1,
	}
	db.Create(&vm)

	// Create snapshots
	snapshots := []models.VMSnapshot{
		{VMID: vm.ID, Name: "snapshot1", Description: "First snapshot"},
		{VMID: vm.ID, Name: "snapshot2", Description: "Second snapshot"},
		{VMID: vm.ID, Name: "snapshot3", Description: "Third snapshot"},
	}
	for _, snap := range snapshots {
		db.Create(&snap)
	}

	// Test ListSnapshots using DB directly (without VMService)
	var result []models.VMSnapshot
	if err := db.Where("vm_id = ?", vm.ID).Find(&result).Error; err != nil {
		t.Fatalf("Failed to list snapshots: %v", err)
	}

	if len(result) != 3 {
		t.Errorf("Expected 3 snapshots, got %d", len(result))
	}

	// Verify snapshot names
	names := make(map[string]bool)
	for _, snap := range result {
		names[snap.Name] = true
	}
	if !names["snapshot1"] || !names["snapshot2"] || !names["snapshot3"] {
		t.Error("Expected snapshots not found")
	}
}

func TestVMService_ListSnapshots_Empty_DB(t *testing.T) {
	db := setupTestSnapshotDB(t)

	vm := models.VM{
		Name:    "test-vm",
		UUID:    "test-uuid",
		CPU:     2,
		Memory:  1024,
		Status:  models.VMStatusRunning,
		OwnerID: 1,
	}
	db.Create(&vm)

	// Test with no snapshots
	var result []models.VMSnapshot
	if err := db.Where("vm_id = ?", vm.ID).Find(&result).Error; err != nil {
		t.Fatalf("Failed to list snapshots: %v", err)
	}

	if len(result) != 0 {
		t.Errorf("Expected 0 snapshots, got %d", len(result))
	}
}

func TestVMService_GetSnapshot_DB(t *testing.T) {
	db := setupTestSnapshotDB(t)

	vm := models.VM{
		Name:    "test-vm",
		UUID:    "test-uuid",
		CPU:     2,
		Memory:  1024,
		Status:  models.VMStatusRunning,
		OwnerID: 1,
	}
	db.Create(&vm)

	snapshot := models.VMSnapshot{
		VMID:        vm.ID,
		Name:        "test-snapshot",
		Description: "Test description",
		LibvirtName: "libvirt-snapshot-123",
	}
	db.Create(&snapshot)

	// Test GetSnapshot using DB directly
	var result models.VMSnapshot
	if err := db.First(&result, snapshot.ID).Error; err != nil {
		t.Fatalf("Failed to get snapshot: %v", err)
	}

	if result.Name != "test-snapshot" {
		t.Errorf("Expected snapshot name 'test-snapshot', got '%s'", result.Name)
	}
	if result.Description != "Test description" {
		t.Errorf("Expected description 'Test description', got '%s'", result.Description)
	}
	if result.VMID != vm.ID {
		t.Errorf("Expected VMID %d, got %d", vm.ID, result.VMID)
	}
}

func TestVMService_GetSnapshot_NotFound_DB(t *testing.T) {
	db := setupTestSnapshotDB(t)

	// Try to get non-existent snapshot
	var result models.VMSnapshot
	err := db.First(&result, 999).Error
	if err == nil {
		t.Error("Expected error for non-existent snapshot, got nil")
	}
}

func TestVMService_SnapshotModel(t *testing.T) {
	db := setupTestSnapshotDB(t)

	vm := models.VM{
		Name:    "test-vm",
		UUID:    "test-uuid",
		CPU:     2,
		Memory:  1024,
		Status:  models.VMStatusRunning,
		OwnerID: 1,
	}
	db.Create(&vm)

	// Test snapshot creation with all fields
	snapshot := models.VMSnapshot{
		VMID:        vm.ID,
		Name:        "full-snapshot",
		Description: "Full description",
		LibvirtName:  "libvirt-full-123",
	}
	if err := db.Create(&snapshot).Error; err != nil {
		t.Fatalf("Failed to create snapshot: %v", err)
	}

	if snapshot.ID == 0 {
		t.Error("Snapshot ID should be auto-generated")
	}
	if snapshot.CreatedAt.IsZero() {
		t.Error("Snapshot CreatedAt should be set")
	}
}

func TestVMService_SnapshotWithMultipleVMs(t *testing.T) {
	db := setupTestSnapshotDB(t)

	// Create multiple VMs
	vm1 := models.VM{Name: "vm1", UUID: "uuid1", CPU: 2, Memory: 1024, Status: models.VMStatusRunning, OwnerID: 1}
	vm2 := models.VM{Name: "vm2", UUID: "uuid2", CPU: 4, Memory: 2048, Status: models.VMStatusRunning, OwnerID: 1}
	db.Create(&vm1)
	db.Create(&vm2)

	// Create snapshots for different VMs
	snapshots := []models.VMSnapshot{
		{VMID: vm1.ID, Name: "vm1-snapshot1"},
		{VMID: vm1.ID, Name: "vm1-snapshot2"},
		{VMID: vm2.ID, Name: "vm2-snapshot1"},
	}
	for _, snap := range snapshots {
		db.Create(&snap)
	}

	// Test filtering by VM ID
	var vm1Snapshots []models.VMSnapshot
	if err := db.Where("vm_id = ?", vm1.ID).Find(&vm1Snapshots).Error; err != nil {
		t.Fatalf("Failed to list VM1 snapshots: %v", err)
	}
	if len(vm1Snapshots) != 2 {
		t.Errorf("Expected 2 snapshots for VM1, got %d", len(vm1Snapshots))
	}

	var vm2Snapshots []models.VMSnapshot
	if err := db.Where("vm_id = ?", vm2.ID).Find(&vm2Snapshots).Error; err != nil {
		t.Fatalf("Failed to list VM2 snapshots: %v", err)
	}
	if len(vm2Snapshots) != 1 {
		t.Errorf("Expected 1 snapshot for VM2, got %d", len(vm2Snapshots))
	}
}

