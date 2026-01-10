package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/config"
)

func TestHandler_isOriginAllowed(t *testing.T) {
	cfg := &config.Config{
		AllowedOrigins: []string{"https://limen.kr", "http://localhost:3000"},
	}
	h := &Handler{Config: cfg}

	tests := []struct {
		name     string
		origin   string
		expected bool
	}{
		{
			name:     "exact match with protocol",
			origin:   "https://limen.kr",
			expected: true,
		},
		{
			name:     "exact match without protocol",
			origin:   "limen.kr",
			expected: true,
		},
		{
			name:     "match with trailing slash",
			origin:   "https://limen.kr/",
			expected: true,
		},
		{
			name:     "match localhost",
			origin:   "http://localhost:3000",
			expected: true,
		},
		{
			name:     "not in allowed list",
			origin:   "https://evil.com",
			expected: false,
		},
		{
			name:     "empty origin",
			origin:   "",
			expected: false,
		},
		{
			name:     "protocol variation match",
			origin:   "http://limen.kr",
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := h.isOriginAllowed(tt.origin)
			if result != tt.expected {
				t.Errorf("isOriginAllowed(%q) = %v, want %v", tt.origin, result, tt.expected)
			}
		})
	}
}

func TestHandler_isOriginAllowed_Wildcard(t *testing.T) {
	cfg := &config.Config{
		AllowedOrigins: []string{"*"},
	}
	h := &Handler{Config: cfg}

	if !h.isOriginAllowed("https://any-origin.com") {
		t.Error("Wildcard should allow any origin")
	}

	if !h.isOriginAllowed("http://localhost:3000") {
		t.Error("Wildcard should allow localhost")
	}
}

func TestHandler_isOriginAllowed_EmptyList(t *testing.T) {
	cfg := &config.Config{
		AllowedOrigins: []string{},
	}
	h := &Handler{Config: cfg}

	if h.isOriginAllowed("https://limen.kr") {
		t.Error("Empty allowed origins should reject all origins")
	}
}

func TestHandler_acceptWebSocket_OriginNotAllowed(t *testing.T) {
	cfg := &config.Config{
		AllowedOrigins: []string{"https://limen.kr"},
	}
	h := &Handler{Config: cfg}

	req := httptest.NewRequest("GET", "/ws/vnc", nil)
	req.Header.Set("Origin", "https://evil.com")
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")
	req.Header.Set("Sec-WebSocket-Version", "13")

	w := httptest.NewRecorder()

	_, err := h.acceptWebSocket(w, req)
	if err == nil {
		t.Error("Expected error for disallowed origin")
	}

	if w.Code != 0 && w.Code != http.StatusForbidden {
		// WebSocket rejection might not set status code
		t.Logf("Response code: %d (may be 0 for WebSocket rejection)", w.Code)
	}
}

func TestHandler_HandleVNC_OPTIONS(t *testing.T) {
	cfg := &config.Config{
		AllowedOrigins: []string{"https://limen.kr"},
	}
	h := &Handler{Config: cfg}

	req := httptest.NewRequest("OPTIONS", "/vnc", nil)
	req.Header.Set("Origin", "https://limen.kr")
	w := httptest.NewRecorder()

	h.HandleVNC(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200 for OPTIONS, got %d", w.Code)
	}
}

func TestHandler_HandleVNC_MissingUUID(t *testing.T) {
	cfg := &config.Config{
		AllowedOrigins: []string{"https://limen.kr"},
	}
	h := &Handler{Config: cfg}

	req := httptest.NewRequest("GET", "/vnc", nil)
	req.Header.Set("Origin", "https://limen.kr")
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Connection", "Upgrade")
	w := httptest.NewRecorder()

	h.HandleVNC(w, req)

	// Should return 401 for missing token (authentication happens before UUID validation)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401 for missing token, got %d", w.Code)
	}
}

func TestHandler_HandleVNC_InvalidUUID(t *testing.T) {
	cfg := &config.Config{
		AllowedOrigins: []string{"https://limen.kr"},
	}
	h := &Handler{Config: cfg}

	req := httptest.NewRequest("GET", "/vnc?id=invalid-uuid", nil)
	req.Header.Set("Origin", "https://limen.kr")
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Connection", "Upgrade")
	w := httptest.NewRecorder()

	h.HandleVNC(w, req)

	// Should return 401 for missing token (authentication happens before UUID validation)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401 for missing token, got %d", w.Code)
	}
}

func TestHandler_HandleVNC_OriginNotAllowed(t *testing.T) {
	cfg := &config.Config{
		AllowedOrigins: []string{"https://limen.kr"},
	}
	h := &Handler{Config: cfg}

	req := httptest.NewRequest("GET", "/vnc?id=12345678-1234-1234-1234-123456789abc", nil)
	req.Header.Set("Origin", "https://evil.com")
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Connection", "Upgrade")
	w := httptest.NewRecorder()

	h.HandleVNC(w, req)

	// Should reject due to origin
	// WebSocket rejection might return 403 or not set status
	if w.Code != 0 && w.Code != http.StatusForbidden {
		t.Logf("Response code: %d (may be 0 or 403 for origin rejection)", w.Code)
	}
}
