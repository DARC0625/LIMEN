package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/middleware"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestQuotaHandler(t *testing.T) (*Handler, *config.Config) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	// Auto-migrate models
	if err := db.AutoMigrate(&models.User{}, &models.VM{}, &models.ResourceQuota{}); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	cfg := &config.Config{
		Env: "test",
	}

	handler := NewHandler(db, nil, cfg)
	return handler, cfg
}

func TestHandleGetQuota_Success(t *testing.T) {
	h, _ := setupTestQuotaHandler(t)

	// Create a user
	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	// Create quota
	quota, _ := models.GetOrCreateQuota(h.DB)
	quota.MaxVMs = 10
	quota.MaxCPU = 10
	quota.MaxMemory = 8192
	h.DB.Save(quota)

	// Create some VMs
	vms := []models.VM{
		{Name: "vm1", CPU: 2, Memory: 1024, Status: models.VMStatusRunning, OwnerID: user.ID},
		{Name: "vm2", CPU: 2, Memory: 1024, Status: models.VMStatusStopped, OwnerID: user.ID},
	}
	for _, vm := range vms {
		h.DB.Create(&vm)
	}

	req := httptest.NewRequest("GET", "/api/quota", nil)
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, user.ID))
	w := httptest.NewRecorder()

	h.HandleGetQuota(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var response QuotaUsage
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if response.Usage.VMs != 2 {
		t.Errorf("Expected 2 VMs, got %d", response.Usage.VMs)
	}
	if response.Usage.CPU != 2 { // Only running VMs count
		t.Errorf("Expected 2 CPU, got %d", response.Usage.CPU)
	}
	if response.Usage.Memory != 1024 { // Only running VMs count
		t.Errorf("Expected 1024 Memory, got %d", response.Usage.Memory)
	}
}

func TestHandleGetQuota_Unauthorized(t *testing.T) {
	h, _ := setupTestQuotaHandler(t)

	req := httptest.NewRequest("GET", "/api/quota", nil)
	w := httptest.NewRecorder()

	h.HandleGetQuota(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
}

func TestHandleGetQuota_InvalidMethod(t *testing.T) {
	h, _ := setupTestQuotaHandler(t)

	req := httptest.NewRequest("POST", "/api/quota", nil)
	w := httptest.NewRecorder()

	h.HandleGetQuota(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

func TestHandleUpdateQuota_Success(t *testing.T) {
	h, _ := setupTestQuotaHandler(t)

	// Create admin user
	admin := models.User{
		Username: "admin",
		Password: "hashedpassword",
		Role:     models.RoleAdmin,
	}
	h.DB.Create(&admin)

	// Create quota
	models.GetOrCreateQuota(h.DB)

	reqBody := map[string]int{
		"max_cpu":    20,
		"max_memory": 16384,
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("PUT", "/api/quota", bytes.NewBuffer(body))
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, admin.ID)
	ctx = context.WithValue(ctx, middleware.RoleKey, string(models.RoleAdmin))
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleUpdateQuota(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var quota models.ResourceQuota
	if err := json.Unmarshal(w.Body.Bytes(), &quota); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if quota.MaxCPU != 20 {
		t.Errorf("Expected MaxCPU 20, got %d", quota.MaxCPU)
	}
	if quota.MaxVMs != 20 { // MaxVMs should equal MaxCPU
		t.Errorf("Expected MaxVMs 20, got %d", quota.MaxVMs)
	}
	if quota.MaxMemory != 16384 {
		t.Errorf("Expected MaxMemory 16384, got %d", quota.MaxMemory)
	}
}

func TestHandleUpdateQuota_Unauthorized(t *testing.T) {
	h, _ := setupTestQuotaHandler(t)

	reqBody := map[string]int{"max_cpu": 20}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("PUT", "/api/quota", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.HandleUpdateQuota(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
}

func TestHandleUpdateQuota_Forbidden(t *testing.T) {
	h, _ := setupTestQuotaHandler(t)

	// Create regular user (not admin) with ID != 1
	// First create an admin user with ID 1, then create regular user
	admin := models.User{
		Username: "admin",
		Password: "hashedpassword",
		Role:     models.RoleAdmin,
	}
	h.DB.Create(&admin)

	user := models.User{
		Username: "user",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	// Ensure user.ID != 1 (backward compatibility allows userID 1)
	if user.ID == 1 {
		t.Skip("Cannot test forbidden case when user ID is 1 (backward compatibility)")
	}

	reqBody := map[string]int{"max_cpu": 20}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("PUT", "/api/quota", bytes.NewBuffer(body))
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, user.ID)
	ctx = context.WithValue(ctx, middleware.RoleKey, string(models.RoleUser))
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleUpdateQuota(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d", w.Code)
	}
}

func TestHandleUpdateQuota_InvalidMethod(t *testing.T) {
	h, _ := setupTestQuotaHandler(t)

	req := httptest.NewRequest("GET", "/api/quota", nil)
	w := httptest.NewRecorder()

	h.HandleUpdateQuota(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

func TestHandleUpdateQuota_InvalidBody(t *testing.T) {
	h, _ := setupTestQuotaHandler(t)

	admin := models.User{
		Username: "admin",
		Password: "hashedpassword",
		Role:     models.RoleAdmin,
	}
	h.DB.Create(&admin)

	req := httptest.NewRequest("PUT", "/api/quota", bytes.NewBufferString("invalid json"))
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, admin.ID)
	ctx = context.WithValue(ctx, middleware.RoleKey, string(models.RoleAdmin))
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleUpdateQuota(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleUpdateQuota_NegativeValues(t *testing.T) {
	h, _ := setupTestQuotaHandler(t)

	admin := models.User{
		Username: "admin",
		Password: "hashedpassword",
		Role:     models.RoleAdmin,
	}
	h.DB.Create(&admin)

	reqBody := map[string]int{
		"max_cpu":    -10,
		"max_memory": -100,
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("PUT", "/api/quota", bytes.NewBuffer(body))
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, admin.ID)
	ctx = context.WithValue(ctx, middleware.RoleKey, string(models.RoleAdmin))
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleUpdateQuota(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleUpdateQuota_MaxVMsIgnored(t *testing.T) {
	h, _ := setupTestQuotaHandler(t)

	admin := models.User{
		Username: "admin",
		Password: "hashedpassword",
		Role:     models.RoleAdmin,
	}
	h.DB.Create(&admin)

	// Create quota with MaxCPU = 10
	quota, _ := models.GetOrCreateQuota(h.DB)
	quota.MaxCPU = 10
	quota.MaxVMs = 10
	h.DB.Save(quota)

	// Try to update MaxVMs (should be ignored)
	reqBody := map[string]int{
		"max_vms": 5, // Should be ignored
		"max_cpu": 20,
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("PUT", "/api/quota", bytes.NewBuffer(body))
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, admin.ID)
	ctx = context.WithValue(ctx, middleware.RoleKey, string(models.RoleAdmin))
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleUpdateQuota(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var updatedQuota models.ResourceQuota
	if err := json.Unmarshal(w.Body.Bytes(), &updatedQuota); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	// MaxVMs should equal MaxCPU, not the requested value
	if updatedQuota.MaxVMs != 20 {
		t.Errorf("Expected MaxVMs to equal MaxCPU (20), got %d", updatedQuota.MaxVMs)
	}
}
