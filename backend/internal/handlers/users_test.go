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

func setupTestUsersHandler(t *testing.T) (*Handler, *config.Config) {
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

func TestHandleListUsers_Success(t *testing.T) {
	h, cfg := setupTestUsersHandler(t)

	// Create test users
	user1 := models.User{Username: "user1", Password: "hash1", Role: models.RoleUser}
	user2 := models.User{Username: "user2", Password: "hash2", Role: models.RoleUser}
	h.DB.Create(&user1)
	h.DB.Create(&user2)

	// Create VMs for user1
	vms := []models.VM{
		{Name: "vm1", CPU: 2, Memory: 1024, OwnerID: user1.ID},
		{Name: "vm2", CPU: 4, Memory: 2048, OwnerID: user1.ID},
	}
	for _, vm := range vms {
		h.DB.Create(&vm)
	}

	req := httptest.NewRequest("GET", "/api/admin/users", nil)
	w := httptest.NewRecorder()

	h.HandleListUsers(w, req, cfg)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var response []UserWithStats
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if len(response) != 2 {
		t.Errorf("Expected 2 users, got %d", len(response))
	}

	// Find user1 in response
	var user1Stats *UserWithStats
	for i := range response {
		if response[i].Username == "user1" {
			user1Stats = &response[i]
			break
		}
	}
	if user1Stats == nil {
		t.Fatal("user1 not found in response")
	}
	if user1Stats.VMCount != 2 {
		t.Errorf("Expected user1 VMCount 2, got %d", user1Stats.VMCount)
	}
	if user1Stats.TotalCPU != 6 {
		t.Errorf("Expected user1 TotalCPU 6, got %d", user1Stats.TotalCPU)
	}
	if user1Stats.TotalMemory != 3072 {
		t.Errorf("Expected user1 TotalMemory 3072, got %d", user1Stats.TotalMemory)
	}
}

func TestHandleGetUser_Success(t *testing.T) {
	h, cfg := setupTestUsersHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	// Create VMs for user
	vms := []models.VM{
		{Name: "vm1", CPU: 2, Memory: 1024, OwnerID: user.ID},
	}
	for _, vm := range vms {
		h.DB.Create(&vm)
	}

	req := httptest.NewRequest("GET", "/api/admin/users/1", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "1")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.HandleGetUser(w, req, cfg)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var response struct {
		UserResponse
		VMs []models.VM `json:"vms"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if response.Username != "testuser" {
		t.Errorf("Expected username 'testuser', got '%s'", response.Username)
	}
	if len(response.VMs) != 1 {
		t.Errorf("Expected 1 VM, got %d", len(response.VMs))
	}
}

func TestHandleGetUser_NotFound(t *testing.T) {
	h, cfg := setupTestUsersHandler(t)

	req := httptest.NewRequest("GET", "/api/admin/users/999", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "999")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.HandleGetUser(w, req, cfg)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
}

func TestHandleGetUser_InvalidID(t *testing.T) {
	h, cfg := setupTestUsersHandler(t)

	req := httptest.NewRequest("GET", "/api/admin/users/invalid", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "invalid")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.HandleGetUser(w, req, cfg)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleCreateUser_Success(t *testing.T) {
	h, cfg := setupTestUsersHandler(t)

	reqBody := CreateUserRequest{
		Username: "newuser",
		Password: "password123",
		Role:     "user",
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/admin/users", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.HandleCreateUser(w, req, cfg)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d. Body: %s", w.Code, w.Body.String())
	}

	var user models.User
	if err := h.DB.Where("username = ?", "newuser").First(&user).Error; err != nil {
		t.Errorf("User was not created: %v", err)
	}
	if !user.Approved {
		t.Error("Admin-created user should be auto-approved")
	}
}

func TestHandleCreateUser_DuplicateUsername(t *testing.T) {
	h, cfg := setupTestUsersHandler(t)

	// Create existing user
	existingUser := models.User{
		Username: "existinguser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&existingUser)

	reqBody := CreateUserRequest{
		Username: "existinguser",
		Password: "password123",
		Role:     "user",
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/admin/users", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.HandleCreateUser(w, req, cfg)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleCreateUser_InvalidUsername(t *testing.T) {
	h, cfg := setupTestUsersHandler(t)

	reqBody := CreateUserRequest{
		Username: "ab", // Too short
		Password: "password123",
		Role:     "user",
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/admin/users", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.HandleCreateUser(w, req, cfg)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleCreateUser_InvalidPassword(t *testing.T) {
	h, cfg := setupTestUsersHandler(t)

	reqBody := CreateUserRequest{
		Username: "newuser",
		Password: "12345", // Too short
		Role:     "user",
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/admin/users", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.HandleCreateUser(w, req, cfg)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleCreateUser_InvalidRole(t *testing.T) {
	h, cfg := setupTestUsersHandler(t)

	reqBody := CreateUserRequest{
		Username: "newuser",
		Password: "password123",
		Role:     "invalidrole",
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/admin/users", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.HandleCreateUser(w, req, cfg)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleUpdateUser_Success(t *testing.T) {
	h, cfg := setupTestUsersHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	reqBody := UpdateUserRequest{
		Username: "updateduser",
		Password: "newpassword123",
		Role:     "admin",
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("PUT", "/api/admin/users/1", bytes.NewBuffer(body))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "1")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.HandleUpdateUser(w, req, cfg)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var updatedUser models.User
	h.DB.First(&updatedUser, user.ID)
	if updatedUser.Username != "updateduser" {
		t.Errorf("Expected username 'updateduser', got '%s'", updatedUser.Username)
	}
	if updatedUser.Role != models.RoleAdmin {
		t.Errorf("Expected role 'admin', got '%s'", updatedUser.Role)
	}
}

func TestHandleUpdateUser_NotFound(t *testing.T) {
	h, cfg := setupTestUsersHandler(t)

	reqBody := UpdateUserRequest{Username: "updateduser"}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("PUT", "/api/admin/users/999", bytes.NewBuffer(body))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "999")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.HandleUpdateUser(w, req, cfg)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
}

func TestHandleDeleteUser_Success(t *testing.T) {
	h, cfg := setupTestUsersHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	// Create another user to be the deleter
	deleter := models.User{
		Username: "deleter",
		Password: "hashedpassword",
		Role:     models.RoleAdmin,
	}
	h.DB.Create(&deleter)

	req := httptest.NewRequest("DELETE", "/api/admin/users/1", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "1")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, deleter.ID))
	w := httptest.NewRecorder()

	h.HandleDeleteUser(w, req, cfg)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	// Check user is soft deleted
	var deletedUser models.User
	if err := h.DB.First(&deletedUser, user.ID).Error; err == nil {
		t.Error("User should be deleted")
	}
}

func TestHandleDeleteUser_CannotDeleteSelf(t *testing.T) {
	h, cfg := setupTestUsersHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	req := httptest.NewRequest("DELETE", "/api/admin/users/1", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "1")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, user.ID))
	w := httptest.NewRecorder()

	h.HandleDeleteUser(w, req, cfg)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleUpdateUserRole_Success(t *testing.T) {
	h, cfg := setupTestUsersHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	reqBody := UpdateUserRoleRequest{Role: "admin"}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("PUT", "/api/admin/users/1/role", bytes.NewBuffer(body))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "1")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.HandleUpdateUserRole(w, req, cfg)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var updatedUser models.User
	h.DB.First(&updatedUser, user.ID)
	if updatedUser.Role != models.RoleAdmin {
		t.Errorf("Expected role 'admin', got '%s'", updatedUser.Role)
	}
}

func TestHandleApproveUser_Success(t *testing.T) {
	h, cfg := setupTestUsersHandler(t)

	user := models.User{
		Username: "testuser",
		Password: "hashedpassword",
		Role:     models.RoleUser,
		Approved: false,
	}
	h.DB.Create(&user)

	req := httptest.NewRequest("PUT", "/api/admin/users/1/approve", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "1")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.HandleApproveUser(w, req, cfg)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var approvedUser models.User
	h.DB.First(&approvedUser, user.ID)
	if !approvedUser.Approved {
		t.Error("User should be approved")
	}
}
