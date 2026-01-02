package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestHandleHardwareSpec(t *testing.T) {
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	cfg := &config.Config{
		Env: "test",
	}
	h := &Handler{
		DB:     db,
		Config: cfg,
	}

	req := httptest.NewRequest("GET", "/api/hardware/spec", nil)
	w := httptest.NewRecorder()

	h.HandleHardwareSpec(w, req, cfg)

	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}

	if w.Code == http.StatusOK {
		var response map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}
	}
}

func TestHandleHardwareSpec_InvalidMethod(t *testing.T) {
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	cfg := &config.Config{
		Env: "test",
	}
	h := &Handler{
		DB:     db,
		Config: cfg,
	}

	req := httptest.NewRequest("POST", "/api/hardware/spec", nil)
	w := httptest.NewRecorder()

	h.HandleHardwareSpec(w, req, cfg)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

func TestHandleHardwareSecurityConfig(t *testing.T) {
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	cfg := &config.Config{
		Env: "test",
	}
	h := &Handler{
		DB:     db,
		Config: cfg,
	}

	req := httptest.NewRequest("GET", "/api/hardware/security-config", nil)
	w := httptest.NewRecorder()

	h.HandleHardwareSecurityConfig(w, req, cfg)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}
}

func TestHandleHardwareSecurityConfig_InvalidMethod(t *testing.T) {
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	cfg := &config.Config{
		Env: "test",
	}
	h := &Handler{
		DB:     db,
		Config: cfg,
	}

	req := httptest.NewRequest("POST", "/api/hardware/security-config", nil)
	w := httptest.NewRecorder()

	h.HandleHardwareSecurityConfig(w, req, cfg)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

func TestHandleHardwareUpdate(t *testing.T) {
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	cfg := &config.Config{
		Env: "test",
	}
	h := &Handler{
		DB:     db,
		Config: cfg,
	}

	req := httptest.NewRequest("POST", "/api/hardware/update", nil)
	w := httptest.NewRecorder()

	h.HandleHardwareUpdate(w, req, cfg)

	// Should return 200 (success) or 500 (if update fails)
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}

	if w.Code == http.StatusOK {
		var response map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if response["message"] == nil {
			t.Error("Expected 'message' field in response")
		}
	}
}

func TestHandleHardwareUpdate_InvalidMethod(t *testing.T) {
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	cfg := &config.Config{
		Env: "test",
	}
	h := &Handler{
		DB:     db,
		Config: cfg,
	}

	req := httptest.NewRequest("GET", "/api/hardware/update", nil)
	w := httptest.NewRecorder()

	h.HandleHardwareUpdate(w, req, cfg)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

func TestNewHandler(t *testing.T) {
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	cfg := &config.Config{
		Env:           "test",
		AllowedOrigins: []string{"http://localhost:3000"},
	}

	handler := NewHandler(db, nil, cfg)

	if handler == nil {
		t.Fatal("NewHandler returned nil")
	}

	if handler.DB != db {
		t.Error("Handler DB not set correctly")
	}

	if handler.Config != cfg {
		t.Error("Handler Config not set correctly")
	}

	if handler.VMStatusBroadcaster == nil {
		t.Error("Handler VMStatusBroadcaster not initialized")
	}
}

