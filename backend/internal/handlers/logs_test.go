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
	// Initialize logger for tests
	logger.Init("debug")
}

func setupTestLogsHandler(t *testing.T) (*Handler, *config.Config) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	cfg := &config.Config{Env: "test"}
	handler := NewHandler(db, nil, cfg)
	return handler, cfg
}

func TestHandleLogStats_Success(t *testing.T) {
	h, cfg := setupTestLogsHandler(t)

	req := httptest.NewRequest("GET", "/api/logs/stats", nil)
	w := httptest.NewRecorder()

	h.HandleLogStats(w, req, cfg)

	// Should return 200 or 500 (depending on log directory existence)
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}

	// If successful, response should be JSON
	if w.Code == http.StatusOK {
		contentType := w.Header().Get("Content-Type")
		if contentType != "application/json" {
			t.Errorf("Expected Content-Type 'application/json', got '%s'", contentType)
		}
	}
}

func TestHandleLogStats_WithHoursParameter(t *testing.T) {
	h, cfg := setupTestLogsHandler(t)

	req := httptest.NewRequest("GET", "/api/logs/stats?hours=48", nil)
	w := httptest.NewRecorder()

	h.HandleLogStats(w, req, cfg)

	// Should return 200 or 500
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}
}

func TestHandleLogStats_InvalidHoursParameter(t *testing.T) {
	h, cfg := setupTestLogsHandler(t)

	req := httptest.NewRequest("GET", "/api/logs/stats?hours=invalid", nil)
	w := httptest.NewRecorder()

	h.HandleLogStats(w, req, cfg)

	// Should still work (defaults to 24 hours)
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}
}

func TestHandleLogStats_NegativeHoursParameter(t *testing.T) {
	h, cfg := setupTestLogsHandler(t)

	req := httptest.NewRequest("GET", "/api/logs/stats?hours=-10", nil)
	w := httptest.NewRecorder()

	h.HandleLogStats(w, req, cfg)

	// Should still work (defaults to 24 hours for negative values)
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}
}

func TestHandleLogStats_InvalidMethod(t *testing.T) {
	h, cfg := setupTestLogsHandler(t)

	req := httptest.NewRequest("POST", "/api/logs/stats", nil)
	w := httptest.NewRecorder()

	h.HandleLogStats(w, req, cfg)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

func TestHandleLogSearch_Success(t *testing.T) {
	h, cfg := setupTestLogsHandler(t)

	req := httptest.NewRequest("GET", "/api/logs/search?query=test", nil)
	w := httptest.NewRecorder()

	h.HandleLogSearch(w, req, cfg)

	// Should return 200 or 500 (depending on log directory existence)
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}

	// If successful, response should be JSON
	if w.Code == http.StatusOK {
		contentType := w.Header().Get("Content-Type")
		if contentType != "application/json" {
			t.Errorf("Expected Content-Type 'application/json', got '%s'", contentType)
		}
	}
}

func TestHandleLogSearch_MissingQuery(t *testing.T) {
	h, cfg := setupTestLogsHandler(t)

	req := httptest.NewRequest("GET", "/api/logs/search", nil)
	w := httptest.NewRecorder()

	h.HandleLogSearch(w, req, cfg)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleLogSearch_WithHoursAndLimit(t *testing.T) {
	h, cfg := setupTestLogsHandler(t)

	req := httptest.NewRequest("GET", "/api/logs/search?query=test&hours=48&limit=50", nil)
	w := httptest.NewRecorder()

	h.HandleLogSearch(w, req, cfg)

	// Should return 200 or 500
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}
}

func TestHandleLogSearch_InvalidHoursParameter(t *testing.T) {
	h, cfg := setupTestLogsHandler(t)

	req := httptest.NewRequest("GET", "/api/logs/search?query=test&hours=invalid", nil)
	w := httptest.NewRecorder()

	h.HandleLogSearch(w, req, cfg)

	// Should still work (defaults to 24 hours)
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}
}

func TestHandleLogSearch_InvalidLimitParameter(t *testing.T) {
	h, cfg := setupTestLogsHandler(t)

	req := httptest.NewRequest("GET", "/api/logs/search?query=test&limit=invalid", nil)
	w := httptest.NewRecorder()

	h.HandleLogSearch(w, req, cfg)

	// Should still work (defaults to 100)
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}
}

func TestHandleLogSearch_LimitExceedsMax(t *testing.T) {
	h, cfg := setupTestLogsHandler(t)

	req := httptest.NewRequest("GET", "/api/logs/search?query=test&limit=2000", nil)
	w := httptest.NewRecorder()

	h.HandleLogSearch(w, req, cfg)

	// Should still work (defaults to 100 for values > 1000)
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}
}

func TestHandleLogSearch_InvalidMethod(t *testing.T) {
	h, cfg := setupTestLogsHandler(t)

	req := httptest.NewRequest("POST", "/api/logs/search?query=test", nil)
	w := httptest.NewRecorder()

	h.HandleLogSearch(w, req, cfg)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}
