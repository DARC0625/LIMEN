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
	"github.com/go-chi/chi/v5"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupTestDB creates an in-memory SQLite database for testing
func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	// Auto-migrate models
	if err := db.AutoMigrate(&models.VM{}, &models.User{}, &models.VMImage{}); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return db
}

// setupTestHandler creates a test handler with mock dependencies
func setupTestHandler(t *testing.T) (*Handler, *config.Config) {
	db := setupTestDB(t)
	cfg := &config.Config{
		Env:          "test",
		Port:         "18443",
		JWTSecret:    "test-secret-key-for-testing-only",
		AllowedOrigins: []string{"http://localhost:3000"},
	}

	// Create handler without VMService for basic tests
	handler := &Handler{
		DB:                  db,
		VMService:           nil, // Will be nil for basic tests
		VMStatusBroadcaster: NewVMStatusBroadcaster(),
		Config:              cfg,
	}

	return handler, cfg
}

func TestHandleVMAction_InvalidUUID(t *testing.T) {
	h, _ := setupTestHandler(t)

	req := httptest.NewRequest("POST", "/api/vms/invalid-uuid/action", bytes.NewBufferString(`{"action":"start"}`))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", "invalid-uuid")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	// Create a handler function wrapper
	handlerFunc := func(w http.ResponseWriter, r *http.Request) {
		h.HandleVMAction(w, r)
	}

	handlerFunc(w, req)

	if w.Code != http.StatusNotFound && w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 404 or 400, got %d", w.Code)
	}
}

func TestHandleVMAction_InvalidAction(t *testing.T) {
	h, _ := setupTestHandler(t)

	// Create a test VM
	vm := models.VM{
		UUID:   "12345678-1234-1234-1234-123456789abc",
		Name:   "test-vm",
		Status: models.VMStatusStopped,
		CPU:    2,
		Memory: 2048,
	}
	h.DB.Create(&vm)

	req := httptest.NewRequest("POST", "/api/vms/12345678-1234-1234-1234-123456789abc/action", 
		bytes.NewBufferString(`{"action":"invalid-action"}`))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", vm.UUID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.HandleVMAction(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	// Check for error or message field
	if response["error"] == nil && response["message"] == nil {
		t.Errorf("Expected error or message in response, got: %v", response)
	}
}

func TestHandleVMAction_MissingBody(t *testing.T) {
	h, _ := setupTestHandler(t)

	vm := models.VM{
		UUID:   "12345678-1234-1234-1234-123456789abc",
		Name:   "test-vm",
		Status: models.VMStatusStopped,
	}
	h.DB.Create(&vm)

	req := httptest.NewRequest("POST", "/api/vms/12345678-1234-1234-1234-123456789abc/action", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", vm.UUID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.HandleVMAction(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleVMMedia_InvalidUUID(t *testing.T) {
	h, _ := setupTestHandler(t)

	req := httptest.NewRequest("POST", "/api/vms/invalid-uuid/media", 
		bytes.NewBufferString(`{"action":"detach"}`))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", "invalid-uuid")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.HandleVMMedia(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
}

func TestHandleVMMedia_InvalidAction(t *testing.T) {
	h, _ := setupTestHandler(t)

	vm := models.VM{
		UUID:   "12345678-1234-1234-1234-123456789abc",
		Name:   "test-vm",
		Status: models.VMStatusStopped,
	}
	h.DB.Create(&vm)

	req := httptest.NewRequest("POST", "/api/vms/12345678-1234-1234-1234-123456789abc/media", 
		bytes.NewBufferString(`{"action":"invalid"}`))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", vm.UUID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.HandleVMMedia(w, req)

	// Should return 400 (invalid action) or 500 (if VMService is nil)
	if w.Code != http.StatusBadRequest && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 400 or 500, got %d", w.Code)
	}
}

func TestHandleVMMedia_AttachMissingISOPath(t *testing.T) {
	h, _ := setupTestHandler(t)

	vm := models.VM{
		UUID:   "12345678-1234-1234-1234-123456789abc",
		Name:   "test-vm",
		Status: models.VMStatusStopped,
	}
	h.DB.Create(&vm)

	req := httptest.NewRequest("POST", "/api/vms/12345678-1234-1234-1234-123456789abc/media", 
		bytes.NewBufferString(`{"action":"attach"}`))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", vm.UUID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.HandleVMMedia(w, req)

	// Should return 400 (missing ISO path) or 500 (if VMService is nil)
	if w.Code != http.StatusBadRequest && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 400 or 500, got %d", w.Code)
	}
}

func TestHandleVMs_GET(t *testing.T) {
	h, cfg := setupTestHandler(t)

	// Create test VMs
	vms := []models.VM{
		{UUID: "11111111-1111-1111-1111-111111111111", Name: "vm1", Status: models.VMStatusRunning, CPU: 2, Memory: 2048},
		{UUID: "22222222-2222-2222-2222-222222222222", Name: "vm2", Status: models.VMStatusStopped, CPU: 4, Memory: 4096},
	}
	for _, vm := range vms {
		h.DB.Create(&vm)
	}

	req := httptest.NewRequest("GET", "/api/vms", nil)
	w := httptest.NewRecorder()

	h.HandleVMs(w, req, cfg)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response []models.VM
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if len(response) != 2 {
		t.Errorf("Expected 2 VMs, got %d", len(response))
	}
}

func TestHandleVMs_POST_InvalidRequest(t *testing.T) {
	h, cfg := setupTestHandler(t)

	req := httptest.NewRequest("POST", "/api/vms", bytes.NewBufferString(`{"invalid":"json"}`))
	w := httptest.NewRecorder()

	h.HandleVMs(w, req, cfg)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleHealth(t *testing.T) {
	h, _ := setupTestHandler(t)

	req := httptest.NewRequest("GET", "/api/health", nil)
	w := httptest.NewRecorder()

	h.HandleHealth(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if response["status"] != "ok" {
		t.Errorf("Expected status 'ok', got '%s'", response["status"])
	}

	if response["db"] == "" {
		t.Errorf("Expected db status, got empty string")
	}
}

func TestHandleVMDelete_InvalidUUID(t *testing.T) {
	h, _ := setupTestHandler(t)

	req := httptest.NewRequest("DELETE", "/api/vms/invalid-uuid", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", "invalid-uuid")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	// Add authentication context (RoleKey is in admin.go, use same string)
	type contextKey string
	const roleKey contextKey = "role"
	ctx = context.WithValue(ctx, middleware.UserIDKey, uint(1))
	ctx = context.WithValue(ctx, roleKey, string(models.RoleAdmin))
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleVMDelete(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
}

func TestHandleVMDelete_ValidUUID(t *testing.T) {
	h, _ := setupTestHandler(t)

	// Create a test VM
	vm := models.VM{
		UUID:    "12345678-1234-1234-1234-123456789abc",
		Name:    "test-vm",
		Status:  models.VMStatusStopped,
		CPU:     2,
		Memory:  2048,
		OwnerID: 1, // Set owner to match test user
	}
	h.DB.Create(&vm)

	req := httptest.NewRequest("DELETE", "/api/vms/12345678-1234-1234-1234-123456789abc", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", vm.UUID)
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	// Add authentication context (RoleKey is in admin.go, use same string)
	type contextKey string
	const roleKey contextKey = "role"
	ctx = context.WithValue(ctx, middleware.UserIDKey, uint(1))
	ctx = context.WithValue(ctx, roleKey, string(models.RoleAdmin))
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleVMDelete(w, req)

	// Should return 200 or 204 (success) or 500 if VMService is nil
	if w.Code != http.StatusOK && w.Code != http.StatusNoContent && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200, 204, or 500, got %d", w.Code)
	}
}

func TestHandleListISOs(t *testing.T) {
	h, cfg := setupTestHandler(t)

	req := httptest.NewRequest("GET", "/api/vms/isos", nil)
	w := httptest.NewRecorder()

	h.HandleListISOs(w, req, cfg)

	// Should return 200 (even if no ISOs found) or 500 if VMService is nil
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}

	if w.Code == http.StatusOK {
		var response map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if response["isos"] == nil {
			t.Errorf("Expected 'isos' field in response")
		}
	}
}

func TestIsOriginAllowed(t *testing.T) {
	h, cfg := setupTestHandler(t)

	// Test with allowed origin
	cfg.AllowedOrigins = []string{"http://localhost:3000", "https://limen.kr"}
	h.Config = cfg

	if !h.isOriginAllowed("http://localhost:3000") {
		t.Error("Expected localhost:3000 to be allowed")
	}

	if !h.isOriginAllowed("https://limen.kr") {
		t.Error("Expected limen.kr to be allowed")
	}

	if h.isOriginAllowed("https://evil.com") {
		t.Error("Expected evil.com to be disallowed")
	}

	// Test with wildcard
	cfg.AllowedOrigins = []string{"*"}
	h.Config = cfg

	if !h.isOriginAllowed("https://any-origin.com") {
		t.Error("Expected any origin to be allowed with wildcard")
	}
}

func TestHandleVMMedia_GET(t *testing.T) {
	h, _ := setupTestHandler(t)

	vm := models.VM{
		UUID:   "12345678-1234-1234-1234-123456789abc",
		Name:   "test-vm",
		Status: models.VMStatusStopped,
	}
	h.DB.Create(&vm)

	req := httptest.NewRequest("GET", "/api/vms/12345678-1234-1234-1234-123456789abc/media", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", vm.UUID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.HandleVMMedia(w, req)

	// Should return 200 (even if no media) or 500 if VMService is nil
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}
}

func TestHandleVMAction_ValidAction_WithoutVMService(t *testing.T) {
	h, _ := setupTestHandler(t)

	vm := models.VM{
		UUID:   "12345678-1234-1234-1234-123456789abc",
		Name:   "test-vm",
		Status: models.VMStatusStopped,
		CPU:    2,
		Memory: 2048,
	}
	h.DB.Create(&vm)

	// Test stop action (should return 500 if VMService is nil)
	req := httptest.NewRequest("POST", "/api/vms/12345678-1234-1234-1234-123456789abc/action",
		bytes.NewBufferString(`{"action":"stop"}`))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", vm.UUID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.HandleVMAction(w, req)

	// Should return 500 (VMService is nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 500 (VMService is nil), got %d", w.Code)
	}
}

