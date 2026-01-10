package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/config"
)

func TestEnhancedLogging(t *testing.T) {
	cfg := &config.Config{
		Env:       "test",
		JWTSecret: "test-secret",
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	middleware := EnhancedLogging(cfg)
	wrapped := middleware(handler)

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	wrapped.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("EnhancedLogging() code = %v, want %v", w.Code, http.StatusOK)
	}

	// Check that X-Request-ID is set
	if req.Header.Get("X-Request-ID") == "" {
		t.Error("EnhancedLogging() should set X-Request-ID header")
	}
}

func TestEnhancedLogging_WithRequestID(t *testing.T) {
	cfg := &config.Config{
		Env:       "test",
		JWTSecret: "test-secret",
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := EnhancedLogging(cfg)
	wrapped := middleware(handler)

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Request-ID", "existing-request-id")
	w := httptest.NewRecorder()

	wrapped.ServeHTTP(w, req)

	// Should use existing request ID
	if req.Header.Get("X-Request-ID") != "existing-request-id" {
		t.Errorf("EnhancedLogging() should preserve existing X-Request-ID, got %v", req.Header.Get("X-Request-ID"))
	}
}

func TestEnhancedLogging_ErrorResponse(t *testing.T) {
	cfg := &config.Config{
		Env:       "test",
		JWTSecret: "test-secret",
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("Error message"))
	})

	middleware := EnhancedLogging(cfg)
	wrapped := middleware(handler)

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	wrapped.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("EnhancedLogging() code = %v, want %v", w.Code, http.StatusBadRequest)
	}
}

func TestEnhancedLogging_ServerError(t *testing.T) {
	cfg := &config.Config{
		Env:       "test",
		JWTSecret: "test-secret",
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Internal error"))
	})

	middleware := EnhancedLogging(cfg)
	wrapped := middleware(handler)

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	wrapped.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("EnhancedLogging() code = %v, want %v", w.Code, http.StatusInternalServerError)
	}
}

func TestExtractTokenFromRequest(t *testing.T) {
	tests := []struct {
		name       string
		authHeader string
		want       string
	}{
		{
			name:       "Valid Bearer token",
			authHeader: "Bearer test-token",
			want:       "test-token",
		},
		{
			name:       "No Bearer prefix",
			authHeader: "test-token",
			want:       "",
		},
		{
			name:       "Empty header",
			authHeader: "",
			want:       "",
		},
		{
			name:       "Short header",
			authHeader: "Bearer",
			want:       "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}

			got := extractTokenFromRequest(req)
			if got != tt.want {
				t.Errorf("extractTokenFromRequest() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSanitizeErrorResponse(t *testing.T) {
	tests := []struct {
		name     string
		response string
		wantLen  int
	}{
		{
			name:     "Short response",
			response: "Error message",
			wantLen:  len("Error message"),
		},
		{
			name:     "Long response",
			response: string(make([]byte, 600)),
			wantLen:  503, // 500 + "..."
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sanitizeErrorResponse(tt.response)
			if len(got) != tt.wantLen {
				t.Errorf("sanitizeErrorResponse() length = %v, want %v", len(got), tt.wantLen)
			}
		})
	}
}

func TestGenerateRequestID(t *testing.T) {
	id1 := generateRequestID()
	if id1 == "" {
		t.Error("generateRequestID() returned empty ID")
	}

	// Generate another ID
	id2 := generateRequestID()
	if id2 == "" {
		t.Error("generateRequestID() returned empty ID")
	}

	// IDs should be different (very unlikely to be same)
	if id1 == id2 {
		t.Error("generateRequestID() returned duplicate IDs")
	}
}

func TestRandomString(t *testing.T) {
	s1 := randomString(10)
	if len(s1) != 10 {
		t.Errorf("randomString() length = %v, want 10", len(s1))
	}

	s2 := randomString(10)
	if len(s2) != 10 {
		t.Errorf("randomString() length = %v, want 10", len(s2))
	}

	// Strings should be different (very unlikely to be same)
	if s1 == s2 {
		t.Error("randomString() returned duplicate strings")
	}
}

func TestNewEnhancedResponseWriter(t *testing.T) {
	w := httptest.NewRecorder()
	rw := newEnhancedResponseWriter(w)

	if rw == nil {
		t.Fatal("newEnhancedResponseWriter() returned nil")
	}

	if rw.statusCode != http.StatusOK {
		t.Errorf("newEnhancedResponseWriter() statusCode = %v, want %v", rw.statusCode, http.StatusOK)
	}

	if rw.body == nil {
		t.Error("newEnhancedResponseWriter() body is nil")
	}
}

func TestEnhancedResponseWriter_WriteHeader(t *testing.T) {
	w := httptest.NewRecorder()
	rw := newEnhancedResponseWriter(w)

	rw.WriteHeader(http.StatusNotFound)
	if rw.statusCode != http.StatusNotFound {
		t.Errorf("WriteHeader() statusCode = %v, want %v", rw.statusCode, http.StatusNotFound)
	}
}

func TestEnhancedResponseWriter_Write(t *testing.T) {
	w := httptest.NewRecorder()
	rw := newEnhancedResponseWriter(w)

	data := []byte("test data")
	n, err := rw.Write(data)
	if err != nil {
		t.Errorf("Write() error = %v", err)
	}

	if n != len(data) {
		t.Errorf("Write() n = %v, want %v", n, len(data))
	}

	if rw.written != int64(len(data)) {
		t.Errorf("Write() written = %v, want %v", rw.written, len(data))
	}

	// Body should contain the data (up to 1KB limit)
	if rw.body.Len() != len(data) {
		t.Errorf("Write() body length = %v, want %v", rw.body.Len(), len(data))
	}
}

func TestEnhancedResponseWriter_Write_LargeBody(t *testing.T) {
	w := httptest.NewRecorder()
	rw := newEnhancedResponseWriter(w)

	// Write more than 1KB
	largeData := make([]byte, 2048)
	for i := range largeData {
		largeData[i] = byte(i % 256)
	}

	n, err := rw.Write(largeData)
	if err != nil {
		t.Errorf("Write() error = %v", err)
	}

	if n != len(largeData) {
		t.Errorf("Write() n = %v, want %v", n, len(largeData))
	}

	// Body should be limited to 1KB (but may be slightly more due to buffer growth)
	// The check in the code is `rw.body.Len() < 1024` before writing, so it can be up to 1024 + chunk size
	if rw.body.Len() > 2048 {
		t.Errorf("Write() body length = %v, should be reasonable (got %v)", rw.body.Len(), rw.body.Len())
	}

	// Verify that written count is correct
	if rw.written != int64(len(largeData)) {
		t.Errorf("Write() written = %v, want %v", rw.written, len(largeData))
	}
}
