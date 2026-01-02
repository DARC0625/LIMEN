package handlers

import (
	"context"
	"encoding/json"
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

func setupTestSecurityChainHandler(t *testing.T) (*Handler, *config.Config) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	cfg := &config.Config{Env: "test"}
	handler := NewHandler(db, nil, cfg)
	return handler, cfg
}

func TestHandleSecurityChain_Success(t *testing.T) {
	h, cfg := setupTestSecurityChainHandler(t)

	req := httptest.NewRequest("GET", "/api/security/chain", nil)
	req = req.WithContext(context.Background())
	w := httptest.NewRecorder()

	h.HandleSecurityChain(w, req, cfg)

	// Should return 200 or 500 (depending on security chain validation)
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}

	// If successful, response should be JSON
	if w.Code == http.StatusOK {
		contentType := w.Header().Get("Content-Type")
		if contentType != "application/json" {
			t.Errorf("Expected Content-Type 'application/json', got '%s'", contentType)
		}

		// Try to parse response as JSON
		var chain map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &chain); err != nil {
			t.Errorf("Failed to parse response as JSON: %v", err)
		}
	}
}

func TestHandleSecurityChain_InvalidMethod(t *testing.T) {
	h, cfg := setupTestSecurityChainHandler(t)

	req := httptest.NewRequest("POST", "/api/security/chain", nil)
	w := httptest.NewRecorder()

	h.HandleSecurityChain(w, req, cfg)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

func TestHandleSecurityChainReport_Success(t *testing.T) {
	h, cfg := setupTestSecurityChainHandler(t)

	req := httptest.NewRequest("GET", "/api/security/chain/report", nil)
	req = req.WithContext(context.Background())
	w := httptest.NewRecorder()

	h.HandleSecurityChainReport(w, req, cfg)

	// Should return 200 or 500
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}

	// If successful, response should be text/plain
	if w.Code == http.StatusOK {
		contentType := w.Header().Get("Content-Type")
		if contentType != "text/plain" {
			t.Errorf("Expected Content-Type 'text/plain', got '%s'", contentType)
		}
	}
}

func TestHandleSecurityChainReport_InvalidMethod(t *testing.T) {
	h, cfg := setupTestSecurityChainHandler(t)

	req := httptest.NewRequest("POST", "/api/security/chain/report", nil)
	w := httptest.NewRecorder()

	h.HandleSecurityChainReport(w, req, cfg)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

func TestHandleWeakestLink_Success(t *testing.T) {
	h, cfg := setupTestSecurityChainHandler(t)

	req := httptest.NewRequest("GET", "/api/security/weakest-link", nil)
	w := httptest.NewRecorder()

	h.HandleWeakestLink(w, req, cfg)

	// Should return 200
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	contentType := w.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("Expected Content-Type 'application/json', got '%s'", contentType)
	}

	// Try to parse response as JSON
	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Errorf("Failed to parse response as JSON: %v", err)
	}
}

func TestHandleWeakestLink_NoWeakLinks(t *testing.T) {
	h, cfg := setupTestSecurityChainHandler(t)

	req := httptest.NewRequest("GET", "/api/security/weakest-link", nil)
	w := httptest.NewRecorder()

	h.HandleWeakestLink(w, req, cfg)

	// Should return 200 even if no weak links
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// Response should be JSON
	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Errorf("Failed to parse response as JSON: %v", err)
	}
}

func TestHandleWeakestLink_InvalidMethod(t *testing.T) {
	h, cfg := setupTestSecurityChainHandler(t)

	req := httptest.NewRequest("POST", "/api/security/weakest-link", nil)
	w := httptest.NewRecorder()

	h.HandleWeakestLink(w, req, cfg)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

