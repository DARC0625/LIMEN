package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/auth"
	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/DARC0625/LIMEN/backend/internal/security"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func init() {
	// Initialize logger for tests
	logger.Init("debug")
}

// setupTestAuthHandler creates a test handler with auth dependencies
func setupTestAuthHandler(t *testing.T) (*Handler, *config.Config) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	if err := db.AutoMigrate(&models.User{}, &models.VM{}); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	cfg := &config.Config{
		Env:           "test",
		Port:          "18443",
		JWTSecret:     "test-secret-key-for-testing-only-very-long-key",
		AllowedOrigins: []string{"http://localhost:3000"},
	}

	handler := &Handler{
		DB:     db,
		Config: cfg,
	}

	// Initialize session store
	auth.GetSessionStore()

	return handler, cfg
}

func TestHandleLogin_Success(t *testing.T) {
	h, cfg := setupTestAuthHandler(t)

	// Create test user
	hashedPassword, _ := auth.HashPassword("password")
	user := models.User{
		Username: "testuser",
		Password: hashedPassword,
		Role:     models.RoleUser,
		Approved: true,
	}
	h.DB.Create(&user)

	reqBody := map[string]string{
		"username": "testuser",
		"password": "password",
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.HandleLogin(w, req, cfg)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if response["access_token"] == nil {
		t.Error("Expected access_token in response")
	}
	if response["expires_in"] == nil {
		t.Error("Expected expires_in in response")
	}
}

func TestHandleLogin_InvalidCredentials(t *testing.T) {
	h, cfg := setupTestAuthHandler(t)

	// Create test user
	hashedPassword, _ := auth.HashPassword("password")
	user := models.User{
		Username: "testuser",
		Password: hashedPassword,
		Role:     models.RoleUser,
		Approved: true,
	}
	h.DB.Create(&user)

	reqBody := map[string]string{
		"username": "testuser",
		"password": "wrongpassword",
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.HandleLogin(w, req, cfg)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d. Body: %s", w.Code, w.Body.String())
	}
}

func TestHandleLogin_UserNotApproved(t *testing.T) {
	h, cfg := setupTestAuthHandler(t)

	// Create unapproved user
	hashedPassword, _ := auth.HashPassword("password")
	user := models.User{
		Username: "testuser",
		Password: hashedPassword,
		Role:     models.RoleUser,
		Approved: false, // Not approved
	}
	h.DB.Create(&user)

	reqBody := map[string]string{
		"username": "testuser",
		"password": "password",
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.HandleLogin(w, req, cfg)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d. Body: %s", w.Code, w.Body.String())
	}
}

func TestHandleLogin_InvalidJSON(t *testing.T) {
	h, cfg := setupTestAuthHandler(t)

	req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.HandleLogin(w, req, cfg)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleRegister_Success(t *testing.T) {
	h, cfg := setupTestAuthHandler(t)

	reqBody := map[string]string{
		"username": "newuser",
		"password": "password123",
		"email":    "newuser@example.com",
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.HandleRegister(w, req, cfg)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d. Body: %s", w.Code, w.Body.String())
	}

	// Verify user was created
	var user models.User
	if err := h.DB.Where("username = ?", "newuser").First(&user).Error; err != nil {
		t.Errorf("User was not created: %v", err)
	}
}

func TestHandleRegister_DuplicateUsername(t *testing.T) {
	h, cfg := setupTestAuthHandler(t)

	// Create existing user
	hashedPassword, _ := auth.HashPassword("password")
	user := models.User{
		Username: "existinguser",
		Password: hashedPassword,
		Role:     models.RoleUser,
	}
	h.DB.Create(&user)

	reqBody := map[string]string{
		"username": "existinguser",
		"password": "password123",
		"email":    "existinguser@example.com",
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.HandleRegister(w, req, cfg)

	if w.Code != http.StatusConflict {
		t.Errorf("Expected status 409, got %d. Body: %s", w.Code, w.Body.String())
	}
}

func TestHandleGetSession_NoCookie(t *testing.T) {
	h, cfg := setupTestAuthHandler(t)

	req := httptest.NewRequest("GET", "/api/auth/session", nil)
	w := httptest.NewRecorder()

	h.HandleGetSession(w, req, cfg)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if response["valid"] != false {
		t.Error("Expected valid=false when no cookie")
	}
}

func TestHandleGetSession_ValidCookie(t *testing.T) {
	h, cfg := setupTestAuthHandler(t)

	// Create user and session
	hashedPassword, _ := auth.HashPassword("password")
	user := models.User{
		Username: "testuser",
		Password: hashedPassword,
		Role:     models.RoleUser,
		Approved: true,
	}
	h.DB.Create(&user)

	// Create session
	sessionStore := auth.GetSessionStore()
	refreshToken, tokenID, _ := auth.GenerateRefreshToken(user.ID, user.Username, string(user.Role), user.Approved, cfg.JWTSecret)
	accessToken, _ := auth.GenerateAccessToken(user.ID, user.Username, string(user.Role), user.Approved, cfg.JWTSecret)
	csrfToken, _ := security.GenerateCSRFToken()
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	sessionStore.CreateSession(accessToken, refreshToken, tokenID, csrfToken, user.ID, user.Username, string(user.Role), expiresAt)

	req := httptest.NewRequest("GET", "/api/auth/session", nil)
	req.AddCookie(&http.Cookie{
		Name:  "refresh_token",
		Value: refreshToken,
	})
	w := httptest.NewRecorder()

	h.HandleGetSession(w, req, cfg)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if response["valid"] != true {
		t.Error("Expected valid=true when valid cookie")
	}
}

func TestHandleRefreshToken_Success(t *testing.T) {
	h, cfg := setupTestAuthHandler(t)

	// Create user and session
	hashedPassword, _ := auth.HashPassword("password")
	user := models.User{
		Username: "testuser",
		Password: hashedPassword,
		Role:     models.RoleUser,
		Approved: true,
	}
	h.DB.Create(&user)

	// Create session
	sessionStore := auth.GetSessionStore()
	refreshToken, tokenID, _ := auth.GenerateRefreshToken(user.ID, user.Username, string(user.Role), user.Approved, cfg.JWTSecret)
	accessToken, _ := auth.GenerateAccessToken(user.ID, user.Username, string(user.Role), user.Approved, cfg.JWTSecret)
	csrfToken, _ := security.GenerateCSRFToken()
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	sessionStore.CreateSession(accessToken, refreshToken, tokenID, csrfToken, user.ID, user.Username, string(user.Role), expiresAt)

	req := httptest.NewRequest("POST", "/api/auth/refresh", nil)
	req.AddCookie(&http.Cookie{
		Name:  "refresh_token",
		Value: refreshToken,
	})
	w := httptest.NewRecorder()

	h.HandleRefreshToken(w, req, cfg)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if response["access_token"] == nil {
		t.Error("Expected access_token in response")
	}
}

func TestHandleRefreshToken_InvalidToken(t *testing.T) {
	h, cfg := setupTestAuthHandler(t)

	req := httptest.NewRequest("POST", "/api/auth/refresh", nil)
	req.AddCookie(&http.Cookie{
		Name:  "refresh_token",
		Value: "invalid-token",
	})
	w := httptest.NewRecorder()

	h.HandleRefreshToken(w, req, cfg)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
}

func TestHandleDeleteSession_Success(t *testing.T) {
	h, cfg := setupTestAuthHandler(t)

	// Create user and session
	hashedPassword, _ := auth.HashPassword("password")
	user := models.User{
		Username: "testuser",
		Password: hashedPassword,
		Role:     models.RoleUser,
		Approved: true,
	}
	h.DB.Create(&user)

	// Create session
	sessionStore := auth.GetSessionStore()
	refreshToken, tokenID, _ := auth.GenerateRefreshToken(user.ID, user.Username, string(user.Role), user.Approved, cfg.JWTSecret)
	accessToken, _ := auth.GenerateAccessToken(user.ID, user.Username, string(user.Role), user.Approved, cfg.JWTSecret)
	csrfToken, _ := security.GenerateCSRFToken()
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	sessionStore.CreateSession(accessToken, refreshToken, tokenID, csrfToken, user.ID, user.Username, string(user.Role), expiresAt)

	req := httptest.NewRequest("DELETE", "/api/auth/session", nil)
	req.AddCookie(&http.Cookie{
		Name:  "refresh_token",
		Value: refreshToken,
	})
	w := httptest.NewRecorder()

	h.HandleDeleteSession(w, req, cfg)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	// Verify session was deleted
	_, exists := sessionStore.GetSessionByRefreshToken(refreshToken)
	if exists {
		t.Error("Session should be deleted")
	}
}

func TestMin(t *testing.T) {
	tests := []struct {
		name     string
		a        int
		b        int
		expected int
	}{
		{"a < b", 1, 2, 1},
		{"a > b", 2, 1, 1}, // min returns the smaller value
		{"a == b", 1, 1, 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := min(tt.a, tt.b)
			if result != tt.expected {
				t.Errorf("min(%d, %d) = %d, expected %d", tt.a, tt.b, result, tt.expected)
			}
		})
	}
}

