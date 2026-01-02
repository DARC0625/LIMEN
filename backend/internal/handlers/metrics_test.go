package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestMetricsHandler(t *testing.T) (*Handler, *config.Config) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	if err := db.AutoMigrate(&models.User{}, &models.VM{}); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	cfg := &config.Config{Env: "test"}
	handler := NewHandler(db, nil, cfg)
	return handler, cfg
}

func TestHandleMetrics_Success(t *testing.T) {
	h, _ := setupTestMetricsHandler(t)

	req := httptest.NewRequest("GET", "/metrics", nil)
	w := httptest.NewRecorder()

	h.HandleMetrics(w, req)

	// Prometheus metrics endpoint should return 200
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// Check that response contains Prometheus metrics format
	body := w.Body.String()
	if body == "" {
		t.Error("Expected non-empty response body")
	}
	// Prometheus metrics typically start with # HELP or metric names
	if len(body) < 10 {
		t.Error("Expected meaningful metrics response")
	}
}

func TestUpdateMetrics_Success(t *testing.T) {
	h, _ := setupTestMetricsHandler(t)

	// Create test users
	users := []models.User{
		{Username: "user1", Password: "hash1", Role: models.RoleUser},
		{Username: "user2", Password: "hash2", Role: models.RoleUser},
	}
	for _, user := range users {
		h.DB.Create(&user)
	}

	// Create test VMs with different statuses
	vms := []models.VM{
		{Name: "vm1", CPU: 2, Memory: 1024, Status: models.VMStatusRunning, OwnerID: users[0].ID},
		{Name: "vm2", CPU: 4, Memory: 2048, Status: models.VMStatusRunning, OwnerID: users[0].ID},
		{Name: "vm3", CPU: 1, Memory: 512, Status: models.VMStatusStopped, OwnerID: users[1].ID},
	}
	for _, vm := range vms {
		h.DB.Create(&vm)
	}

	err := h.UpdateMetrics()
	if err != nil {
		t.Errorf("UpdateMetrics failed: %v", err)
	}

	// Verify metrics were updated by checking the metrics endpoint
	req := httptest.NewRequest("GET", "/metrics", nil)
	w := httptest.NewRecorder()
	h.HandleMetrics(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestUpdateMetrics_EmptyDatabase(t *testing.T) {
	h, _ := setupTestMetricsHandler(t)

	// Update metrics with empty database
	err := h.UpdateMetrics()
	if err != nil {
		t.Errorf("UpdateMetrics should not fail with empty database: %v", err)
	}
}

func TestUpdateMetrics_WithVMs(t *testing.T) {
	h, _ := setupTestMetricsHandler(t)

	// Create user
	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	// Create VMs with different statuses
	vms := []models.VM{
		{Name: "running-vm", CPU: 2, Memory: 1024, Status: models.VMStatusRunning, OwnerID: user.ID},
		{Name: "stopped-vm", CPU: 4, Memory: 2048, Status: models.VMStatusStopped, OwnerID: user.ID},
		{Name: "creating-vm", CPU: 1, Memory: 512, Status: models.VMStatusCreating, OwnerID: user.ID},
	}
	for _, vm := range vms {
		h.DB.Create(&vm)
	}

	err := h.UpdateMetrics()
	if err != nil {
		t.Errorf("UpdateMetrics failed: %v", err)
	}

	// Metrics should be updated without error
	// We can't easily verify the exact metric values without accessing prometheus internals,
	// but we can verify the function completes successfully
}

