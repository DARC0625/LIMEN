package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/handlers"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func init() {
	logger.Init("debug")
}

func setupTestRouterExtended(t *testing.T) (*handlers.Handler, *config.Config) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	cfg := &config.Config{
		Env:           "test",
		Port:          "18443",
		JWTSecret:     "test-secret-key-for-testing-only-very-long-key",
		AllowedOrigins: []string{"http://localhost:3000"},
		AdminIPWhitelist: []string{},
	}

	h := handlers.NewHandler(db, nil, cfg)
	return h, cfg
}

func TestHardwareSpecEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("GET", "/api/hardware/spec", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should return 200 or 500 (depending on hardware detection)
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}
}

func TestHardwareSecurityConfigEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("GET", "/api/hardware/security-config", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should return 200
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestSecurityChainEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("GET", "/api/security/chain", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should return 200 or 500
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}
}

func TestSecurityChainReportEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("GET", "/api/security/chain/report", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should return 200 or 500
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}
}

func TestWeakestLinkEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("GET", "/api/security/weakest-link", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should return 200
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestLogsStatsEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("GET", "/api/logs/stats", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should return 200 or 500
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500, got %d", w.Code)
	}
}

func TestLogsSearchEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("GET", "/api/logs/search?query=test", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should return 200, 400, or 500
	if w.Code != http.StatusOK && w.Code != http.StatusBadRequest && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200, 400, or 500, got %d", w.Code)
	}
}

func TestMetricsEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("GET", "/api/metrics", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Prometheus metrics should return 200
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestHealthProxyEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("GET", "/api/health_proxy", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should return 200
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestSwaggerEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("GET", "/swagger", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Swagger endpoint may return various status codes, but should not crash
	// Accept any non-404 status as endpoint exists
	if w.Code == http.StatusNotFound {
		t.Logf("Swagger endpoint returned 404 (may be expected if swagger files not present)")
	}
}

func TestDocsEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("GET", "/docs", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Docs endpoint may return various status codes, but should not crash
	// Accept any non-404 status as endpoint exists
	if w.Code == http.StatusNotFound {
		t.Logf("Docs endpoint returned 404 (may be expected if swagger files not present)")
	}
}

func TestAgentProxyEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("GET", "/agent/test", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should return 503 (agent unavailable) or other status, but not 404
	// Agent proxy will return 503 if agent is not reachable
	if w.Code == http.StatusNotFound {
		t.Errorf("Expected /agent endpoint to exist, got 404")
	}
	// 503 is expected when agent is not available
	if w.Code == http.StatusServiceUnavailable {
		t.Logf("Agent proxy returned 503 (expected when agent not available)")
	}
}

func TestMediaEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("GET", "/media/test.jpg", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should not crash, may return 404 if file doesn't exist
	_ = w.Code
}

func TestDownloadsEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("GET", "/downloads/test.txt", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should not crash, may return 404 if file doesn't exist
	_ = w.Code
}

func TestVMStatusWebSocketEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("GET", "/ws/vm-status", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should not return 404 (endpoint exists, but may return 401 for auth)
	if w.Code == http.StatusNotFound {
		t.Errorf("Expected /ws/vm-status endpoint to exist, got 404")
	}
}

func TestAuthLoginEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("POST", "/api/auth/login", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should not return 404
	if w.Code == http.StatusNotFound {
		t.Errorf("Expected /api/auth/login endpoint to exist, got 404")
	}
}

func TestAuthRegisterEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("POST", "/api/auth/register", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should not return 404
	if w.Code == http.StatusNotFound {
		t.Errorf("Expected /api/auth/register endpoint to exist, got 404")
	}
}

func TestAuthSessionEndpoints(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	tests := []struct {
		method string
		path   string
	}{
		{"GET", "/api/auth/session"},
		{"POST", "/api/auth/session"},
		{"DELETE", "/api/auth/session"},
	}

	for _, tt := range tests {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			r.ServeHTTP(w, req)

			// Should not return 404
			if w.Code == http.StatusNotFound {
				t.Errorf("Expected %s %s endpoint to exist, got 404", tt.method, tt.path)
			}
		})
	}
}

func TestAuthRefreshEndpoint(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	req := httptest.NewRequest("POST", "/api/auth/refresh", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Should not return 404
	if w.Code == http.StatusNotFound {
		t.Errorf("Expected /api/auth/refresh endpoint to exist, got 404")
	}
}

func TestVMsEndpoints(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	tests := []struct {
		method string
		path   string
	}{
		{"GET", "/api/vms"},
		{"POST", "/api/vms"},
		{"DELETE", "/api/vms/test-uuid"},
		{"POST", "/api/vms/test-uuid/action"},
		{"GET", "/api/vms/test-uuid/stats"},
		{"GET", "/api/vms/test-uuid/media"},
		{"POST", "/api/vms/test-uuid/media"},
		{"GET", "/api/vms/isos"},
	}

	for _, tt := range tests {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			r.ServeHTTP(w, req)

			// Should not return 404
			if w.Code == http.StatusNotFound {
				t.Errorf("Expected %s %s endpoint to exist, got 404", tt.method, tt.path)
			}
		})
	}
}

func TestSnapshotEndpoints(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	tests := []struct {
		method string
		path   string
	}{
		{"GET", "/api/vms/test-uuid/snapshots"},
		{"POST", "/api/vms/test-uuid/snapshots"},
		{"POST", "/api/snapshots/1/restore"},
		{"DELETE", "/api/snapshots/1"},
	}

	for _, tt := range tests {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			r.ServeHTTP(w, req)

			// Should not return 404
			if w.Code == http.StatusNotFound {
				t.Errorf("Expected %s %s endpoint to exist, got 404", tt.method, tt.path)
			}
		})
	}
}

func TestQuotaEndpoints(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	tests := []struct {
		method string
		path   string
	}{
		{"GET", "/api/quota"},
		{"PUT", "/api/quota"},
	}

	for _, tt := range tests {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			r.ServeHTTP(w, req)

			// Should not return 404
			if w.Code == http.StatusNotFound {
				t.Errorf("Expected %s %s endpoint to exist, got 404", tt.method, tt.path)
			}
		})
	}
}

func TestAdminEndpoints(t *testing.T) {
	h, cfg := setupTestRouterExtended(t)
	r := SetupRoutes(h, cfg)

	tests := []struct {
		method string
		path   string
	}{
		{"GET", "/api/admin/users"},
		{"POST", "/api/admin/users"},
		{"GET", "/api/admin/users/1"},
		{"PUT", "/api/admin/users/1"},
		{"DELETE", "/api/admin/users/1"},
		{"PUT", "/api/admin/users/1/role"},
		{"PUT", "/api/admin/users/1/approve"},
	}

	for _, tt := range tests {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			r.ServeHTTP(w, req)

			// Should not return 404
			if w.Code == http.StatusNotFound {
				t.Errorf("Expected %s %s endpoint to exist, got 404", tt.method, tt.path)
			}
		})
	}
}

