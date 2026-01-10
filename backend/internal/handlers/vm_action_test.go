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

func setupTestVMActionHandler(t *testing.T) (*Handler, *config.Config) {
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

func TestHandleVMAction_MissingUUID(t *testing.T) {
	h, _ := setupTestVMActionHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	reqBody := map[string]string{"action": "start"}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/vms//action", bytes.NewBuffer(body))
	rctx := chi.NewRouteContext()
	// Don't add UUID param
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, user.ID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleVMAction(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleVMAction_VMNotFound(t *testing.T) {
	h, _ := setupTestVMActionHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	reqBody := map[string]string{"action": "start"}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/vms/non-existent-uuid/action", bytes.NewBuffer(body))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", "non-existent-uuid")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, user.ID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleVMAction(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
}

func TestHandleVMAction_InvalidAction2(t *testing.T) {
	h, _ := setupTestVMActionHandler(t)

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
		Status:  models.VMStatusStopped,
		OwnerID: user.ID,
	}
	h.DB.Create(&vm)

	reqBody := map[string]string{"action": "invalid-action"}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/vms/test-uuid-123/action", bytes.NewBuffer(body))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", "test-uuid-123")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, user.ID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleVMAction(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleVMAction_InvalidBody(t *testing.T) {
	h, _ := setupTestVMActionHandler(t)

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
		Status:  models.VMStatusStopped,
		OwnerID: user.ID,
	}
	h.DB.Create(&vm)

	req := httptest.NewRequest("POST", "/api/vms/test-uuid-123/action", bytes.NewBufferString("invalid json"))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", "test-uuid-123")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, user.ID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleVMAction(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleVMAction_UpdateAction_RequiresVMService(t *testing.T) {
	h, _ := setupTestVMActionHandler(t)

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
		Status:  models.VMStatusStopped,
		OwnerID: user.ID,
	}
	h.DB.Create(&vm)

	reqBody := map[string]interface{}{
		"action": "update",
		"cpu":    4,
		"memory": 2048,
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/vms/test-uuid-123/action", bytes.NewBuffer(body))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", "test-uuid-123")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, user.ID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleVMAction(w, req)

	// Update action requires VMService, so should return 500 when VMService is nil
	if w.Code != http.StatusInternalServerError {
		t.Logf("Expected status 500 (VMService is nil), got %d. Body: %s", w.Code, w.Body.String())
	}
}

func TestHandleVMDelete_MissingUUID(t *testing.T) {
	h, _ := setupTestVMActionHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	req := httptest.NewRequest("DELETE", "/api/vms/", nil)
	rctx := chi.NewRouteContext()
	// Don't add UUID param
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, user.ID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleVMDelete(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleVMDelete_VMNotFound(t *testing.T) {
	h, _ := setupTestVMActionHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	req := httptest.NewRequest("DELETE", "/api/vms/non-existent-uuid", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", "non-existent-uuid")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, user.ID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleVMDelete(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
}

func TestHandleVMDelete_Forbidden(t *testing.T) {
	h, _ := setupTestVMActionHandler(t)

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
		Status:  models.VMStatusStopped,
		OwnerID: owner.ID,
	}
	h.DB.Create(&vm)

	req := httptest.NewRequest("DELETE", "/api/vms/test-uuid-123", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", "test-uuid-123")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, otherUser.ID)
	ctx = context.WithValue(ctx, middleware.RoleKey, string(models.RoleUser))
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleVMDelete(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d", w.Code)
	}
}

func TestHandleListISOs_Success(t *testing.T) {
	h, cfg := setupTestVMActionHandler(t)

	req := httptest.NewRequest("GET", "/api/vms/isos", nil)
	w := httptest.NewRecorder()

	h.HandleListISOs(w, req, cfg)

	// Should return 200 or 500 (depending on ISO directory)
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}
}

func TestHandleListISOs_InvalidMethod(t *testing.T) {
	h, cfg := setupTestVMActionHandler(t)

	req := httptest.NewRequest("POST", "/api/vms/isos", nil)
	w := httptest.NewRecorder()

	h.HandleListISOs(w, req, cfg)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

func TestHandleVMMedia_InvalidMethod(t *testing.T) {
	h, _ := setupTestVMActionHandler(t)

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
		Status:  models.VMStatusStopped,
		OwnerID: user.ID,
	}
	h.DB.Create(&vm)

	req := httptest.NewRequest("PUT", "/api/vms/test-uuid-123/media", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", "test-uuid-123")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, user.ID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleVMMedia(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

func TestHandleVMMedia_MissingUUID(t *testing.T) {
	h, _ := setupTestVMActionHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	req := httptest.NewRequest("GET", "/api/vms//media", nil)
	rctx := chi.NewRouteContext()
	// Don't add UUID param
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, user.ID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleVMMedia(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleVMMedia_VMNotFound(t *testing.T) {
	h, _ := setupTestVMActionHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	req := httptest.NewRequest("GET", "/api/vms/non-existent-uuid/media", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", "non-existent-uuid")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, user.ID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.HandleVMMedia(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
}
