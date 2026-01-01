package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/handlers"
	"github.com/go-chi/chi/v5"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestRouter(t *testing.T) (*chi.Mux, *handlers.Handler, *config.Config) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	cfg := &config.Config{
		Env:           "test",
		Port:          "18443",
		JWTSecret:     "test-secret-key-for-testing-only-very-long-key",
		AllowedOrigins: []string{"http://localhost:3000"},
	}

	h := &handlers.Handler{
		DB:     db,
		Config: cfg,
	}

	r := SetupRoutes(h, cfg)
	return r, h, cfg
}

func TestSetupRoutes(t *testing.T) {
	r, _, _ := setupTestRouter(t)

	if r == nil {
		t.Error("SetupRoutes() returned nil router")
	}
}

func TestHealthEndpoint(t *testing.T) {
	r, _, _ := setupTestRouter(t)

	req := httptest.NewRequest("GET", "/api/health", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestVNCEndpoint(t *testing.T) {
	r, _, _ := setupTestRouter(t)

	// Test /vnc endpoint exists
	req := httptest.NewRequest("GET", "/vnc", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should not return 404 (endpoint exists, but may return 401 for auth)
	if w.Code == http.StatusNotFound {
		t.Errorf("Expected /vnc endpoint to exist, got 404")
	}
}

func TestVNCEndpointWithUUID(t *testing.T) {
	r, _, _ := setupTestRouter(t)

	// Test /vnc/{uuid} endpoint exists
	req := httptest.NewRequest("GET", "/vnc/7b20e9e6-b652-43ee-b9cc-681216bef7a4", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should not return 404 (endpoint exists, but may return 401 for auth)
	if w.Code == http.StatusNotFound {
		t.Errorf("Expected /vnc/{uuid} endpoint to exist, got 404")
	}
}

func TestWebSocketVNCEndpoint(t *testing.T) {
	r, _, _ := setupTestRouter(t)

	// Test /ws/vnc endpoint exists
	req := httptest.NewRequest("GET", "/ws/vnc", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should not return 404 (endpoint exists, but may return 401 for auth)
	if w.Code == http.StatusNotFound {
		t.Errorf("Expected /ws/vnc endpoint to exist, got 404")
	}
}

func TestStaticFileEndpoint(t *testing.T) {
	r, _, _ := setupTestRouter(t)

	// Test static file endpoint (may not exist in test, but should not crash)
	req := httptest.NewRequest("GET", "/uploads/test.txt", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should not crash, may return 404 if file doesn't exist
	_ = w.Code
}

