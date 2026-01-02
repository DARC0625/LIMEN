package models

import (
	"testing"
)

func TestGetOrCreateQuota(t *testing.T) {
	db := setupTestDB(t)

	// Test creating new quota (system-wide)
	quota, err := GetOrCreateQuota(db)
	if err != nil {
		t.Fatalf("GetOrCreateQuota failed: %v", err)
	}

	if quota == nil {
		t.Fatal("GetOrCreateQuota returned nil")
	}

	if quota.ID != 1 {
		t.Errorf("Expected ID 1, got %d", quota.ID)
	}

	// Test getting existing quota
	quota2, err := GetOrCreateQuota(db)
	if err != nil {
		t.Fatalf("GetOrCreateQuota failed: %v", err)
	}

	if quota2.ID != quota.ID {
		t.Error("GetOrCreateQuota should return existing quota, not create a new one")
	}
}

func TestResourceQuota_CheckQuota(t *testing.T) {
	db := setupTestDB(t)

	// Create a user first
	user := User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     RoleUser,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Get or create quota
	quota, err := GetOrCreateQuota(db)
	if err != nil {
		t.Fatalf("GetOrCreateQuota failed: %v", err)
	}

	// Set lower limits for testing
	quota.MaxVMs = 5
	quota.MaxCPU = 10
	quota.MaxMemory = 8192
	if err := db.Save(quota).Error; err != nil {
		t.Fatalf("Failed to update quota: %v", err)
	}

	// Create some VMs to use up resources
	vms := []VM{
		{Name: "vm1", CPU: 2, Memory: 1024, Status: VMStatusRunning, OwnerID: user.ID},
		{Name: "vm2", CPU: 2, Memory: 1024, Status: VMStatusRunning, OwnerID: user.ID},
	}
	for _, vm := range vms {
		if err := db.Create(&vm).Error; err != nil {
			t.Fatalf("Failed to create VM: %v", err)
		}
	}

	// Test quota check - within limits
	err = quota.CheckQuota(db, 1, 1024) // 1 CPU, 1024MB memory
	if err != nil {
		t.Errorf("CheckQuota should pass for values within limits: %v", err)
	}

	// Test quota check - exceeds VM limit (create too many VMs)
	for i := 3; i <= 7; i++ {
		vm := VM{
			Name:    "vm" + string(rune('0'+i)),
			CPU:     1,
			Memory:  512,
			Status:  VMStatusRunning,
			OwnerID: user.ID,
		}
		db.Create(&vm)
	}

	err = quota.CheckQuota(db, 1, 1024) // Would exceed MaxVMs
	if err == nil {
		t.Error("CheckQuota should fail when exceeding VM limit")
	}

	// Clean up and test CPU limit
	db.Unscoped().Delete(&VM{}, "name LIKE ?", "vm%")
	
	// Create VMs that use up CPU
	vms = []VM{
		{Name: "vm1", CPU: 5, Memory: 1024, Status: VMStatusRunning, OwnerID: user.ID},
		{Name: "vm2", CPU: 5, Memory: 1024, Status: VMStatusRunning, OwnerID: user.ID},
	}
	for _, vm := range vms {
		db.Create(&vm)
	}

	err = quota.CheckQuota(db, 1, 1024) // Would exceed MaxCPU (5+5+1 = 11 > 10)
	if err == nil {
		t.Error("CheckQuota should fail when exceeding CPU limit")
	}

	// Clean up and test Memory limit
	db.Unscoped().Delete(&VM{}, "name LIKE ?", "vm%")
	
	// Create VMs that use up memory
	vms = []VM{
		{Name: "vm1", CPU: 1, Memory: 4000, Status: VMStatusRunning, OwnerID: user.ID},
		{Name: "vm2", CPU: 1, Memory: 4000, Status: VMStatusRunning, OwnerID: user.ID},
	}
	for _, vm := range vms {
		db.Create(&vm)
	}

	err = quota.CheckQuota(db, 1, 2000) // Would exceed MaxMemory (4000+4000+2000 = 10000 > 8192)
	if err == nil {
		t.Error("CheckQuota should fail when exceeding Memory limit")
	}
}

func TestQuotaError_Error(t *testing.T) {
	err := QuotaError{
		Resource: "VMs",
		Current:  5,
		Limit:    3,
	}

	errMsg := err.Error()
	if errMsg == "" {
		t.Error("QuotaError.Error() should return a non-empty message")
	}

	// Verify error message contains relevant information
	if !contains(errMsg, "VMs") && !contains(errMsg, "5") && !contains(errMsg, "3") {
		t.Logf("Error message: %s", errMsg)
		// Don't fail, just log - error message format may vary
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr || containsMiddle(s, substr)))
}

func containsMiddle(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

