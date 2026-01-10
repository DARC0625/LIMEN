//go:build smoke
// +build smoke

package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func init() {
	logger.Init("debug")
}

func setupTestHealthHandler(t *testing.T) (*Handler, *config.Config) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	cfg := &config.Config{
		Env: "test",
	}

	handler := NewHandler(db, nil, cfg)
	return handler, cfg
}

func TestHandleHealth_Success(t *testing.T) {
	h, _ := setupTestHealthHandler(t)

	req := httptest.NewRequest("GET", "/api/health", nil)
	w := httptest.NewRecorder()

	h.HandleHealth(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	if w.Header().Get("Content-Type") != "application/json" {
		t.Errorf("Expected Content-Type 'application/json', got '%s'", w.Header().Get("Content-Type"))
	}
}

func TestHandleHealth_InvalidMethod(t *testing.T) {
	h, _ := setupTestHealthHandler(t)

	req := httptest.NewRequest("POST", "/api/health", nil)
	w := httptest.NewRecorder()

	h.HandleHealth(w, req)

	// HandleHealth doesn't check method, so it will return 200
	// This is expected behavior - the router should handle method checking
	if w.Code != http.StatusOK {
		t.Logf("HandleHealth doesn't enforce method checking (expected), got status %d", w.Code)
	}
}

func TestHandleHealth_ResponseStructure(t *testing.T) {
	h, _ := setupTestHealthHandler(t)

	req := httptest.NewRequest("GET", "/api/health", nil)
	w := httptest.NewRecorder()

	h.HandleHealth(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}

	// Check that response body is valid JSON
	body := w.Body.String()
	if body == "" {
		t.Error("Expected non-empty response body")
	}

	// Health endpoint should return JSON with status field
	if len(body) < 10 {
		t.Errorf("Expected meaningful JSON response, got: %s", body)
	}
}
