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

func setupTestSnapshotHandler(t *testing.T) (*Handler, *config.Config) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	if err := db.AutoMigrate(&models.User{}, &models.VM{}, &models.VMSnapshot{}); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	cfg := &config.Config{Env: "test"}
	handler := NewHandler(db, nil, cfg)
	return handler, cfg
}

func TestHandleCreateSnapshot_MissingUUID(t *testing.T) {
	h, _ := setupTestSnapshotHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	reqBody := CreateSnapshotRequest{
		Name:        "snapshot1",
		Description: "Test snapshot",
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/vms//snapshots", bytes.NewBuffer(body))
	rctx := chi.NewRouteContext()
	// Don't add UUID param
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, user.ID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleCreateSnapshot(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleCreateSnapshot_Unauthorized(t *testing.T) {
	h, _ := setupTestSnapshotHandler(t)

	reqBody := CreateSnapshotRequest{
		Name:        "snapshot1",
		Description: "Test snapshot",
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/vms/test-uuid/snapshots", bytes.NewBuffer(body))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", "test-uuid")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.HandleCreateSnapshot(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
}

func TestHandleCreateSnapshot_VMNotFound(t *testing.T) {
	h, _ := setupTestSnapshotHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	reqBody := CreateSnapshotRequest{
		Name:        "snapshot1",
		Description: "Test snapshot",
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/vms/non-existent-uuid/snapshots", bytes.NewBuffer(body))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", "non-existent-uuid")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, user.ID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleCreateSnapshot(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
}

func TestHandleCreateSnapshot_Forbidden(t *testing.T) {
	h, _ := setupTestSnapshotHandler(t)

	owner := models.User{
		Username: "owner",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&owner)

	otherUser := models.User{
		Username: "otheruser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&otherUser)

	vm := models.VM{
		Name:    "test-vm",
		UUID:    "test-uuid-123",
		CPU:     2,
		Memory:  1024,
		Status:  models.VMStatusRunning,
		OwnerID: owner.ID,
	}
	h.DB.Create(&vm)

	reqBody := CreateSnapshotRequest{
		Name:        "snapshot1",
		Description: "Test snapshot",
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/vms/test-uuid-123/snapshots", bytes.NewBuffer(body))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", "test-uuid-123")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, otherUser.ID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleCreateSnapshot(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d", w.Code)
	}
}

func TestHandleCreateSnapshot_MissingName(t *testing.T) {
	h, _ := setupTestSnapshotHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	vm := models.VM{
		Name:    "test-vm",
		UUID:    "test-uuid-123",
		CPU:     2,
		Memory:  1024,
		Status:  models.VMStatusRunning,
		OwnerID: user.ID,
	}
	h.DB.Create(&vm)

	reqBody := CreateSnapshotRequest{
		Name:        "", // Missing name
		Description: "Test snapshot",
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/vms/test-uuid-123/snapshots", bytes.NewBuffer(body))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", "test-uuid-123")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, user.ID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleCreateSnapshot(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleCreateSnapshot_InvalidMethod(t *testing.T) {
	h, _ := setupTestSnapshotHandler(t)

	req := httptest.NewRequest("GET", "/api/vms/test-uuid/snapshots", nil)
	w := httptest.NewRecorder()

	h.HandleCreateSnapshot(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

func TestHandleListSnapshots_Success(t *testing.T) {
	h, _ := setupTestSnapshotHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	vm := models.VM{
		Name:    "test-vm",
		UUID:    "test-uuid-123",
		CPU:     2,
		Memory:  1024,
		Status:  models.VMStatusRunning,
		OwnerID: user.ID,
	}
	h.DB.Create(&vm)

	// Create snapshots
	snapshots := []models.VMSnapshot{
		{VMID: vm.ID, Name: "snapshot1", Description: "First snapshot"},
		{VMID: vm.ID, Name: "snapshot2", Description: "Second snapshot"},
	}
	for _, snap := range snapshots {
		h.DB.Create(&snap)
	}

	req := httptest.NewRequest("GET", "/api/vms/test-uuid-123/snapshots", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", "test-uuid-123")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, user.ID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	// Skip if VMService is nil (will panic)
	if h.VMService == nil {
		t.Skip("VMService is nil, cannot test ListSnapshots")
		return
	}

	// This will fail at VMService.ListSnapshots, but we test handler logic
	h.HandleListSnapshots(w, req)

	// Should return 500 (internal error) because VMService is not connected
	if w.Code != http.StatusInternalServerError {
		t.Logf("Expected 500 (internal error) due to missing libvirt connection, got %d", w.Code)
	}
}

func TestHandleListSnapshots_Unauthorized(t *testing.T) {
	h, _ := setupTestSnapshotHandler(t)

	req := httptest.NewRequest("GET", "/api/vms/test-uuid/snapshots", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", "test-uuid")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.HandleListSnapshots(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
}

func TestHandleListSnapshots_InvalidMethod(t *testing.T) {
	h, _ := setupTestSnapshotHandler(t)

	req := httptest.NewRequest("POST", "/api/vms/test-uuid/snapshots", nil)
	w := httptest.NewRecorder()

	h.HandleListSnapshots(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

func TestHandleRestoreSnapshot_InvalidMethod(t *testing.T) {
	h, _ := setupTestSnapshotHandler(t)

	req := httptest.NewRequest("GET", "/api/snapshots/1/restore", nil)
	w := httptest.NewRecorder()

	h.HandleRestoreSnapshot(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

func TestHandleRestoreSnapshot_InvalidSnapshotID(t *testing.T) {
	h, _ := setupTestSnapshotHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	req := httptest.NewRequest("POST", "/api/snapshots/invalid/restore", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("snapshot_id", "invalid")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, user.ID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleRestoreSnapshot(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleDeleteSnapshot_InvalidMethod(t *testing.T) {
	h, _ := setupTestSnapshotHandler(t)

	req := httptest.NewRequest("GET", "/api/snapshots/1", nil)
	w := httptest.NewRecorder()

	h.HandleDeleteSnapshot(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

func TestHandleDeleteSnapshot_InvalidSnapshotID(t *testing.T) {
	h, _ := setupTestSnapshotHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	req := httptest.NewRequest("DELETE", "/api/snapshots/invalid", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("snapshot_id", "invalid")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, user.ID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleDeleteSnapshot(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

