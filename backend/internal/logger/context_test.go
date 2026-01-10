package logger

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestWithContext(t *testing.T) {
	Init("debug")

	logCtx := LogContext{
		RequestID: "test-request-id",
		IP:        "192.168.1.1",
		UserAgent: "test-user-agent",
		Timestamp: time.Now(),
	}

	logger := WithContext(logCtx)

	if logger == nil {
		t.Error("WithContext() returned nil")
	}
}

func TestLogRequest(t *testing.T) {
	Init("debug")

	req := httptest.NewRequest("GET", "/api/test", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	req.Header.Set("User-Agent", "test-agent")

	logCtx := ExtractContextFromRequest(req, 1, "testuser")
	LogRequest(logCtx, "test request message")
	// Should not panic
}

func TestLogResponse(t *testing.T) {
	Init("debug")

	req := httptest.NewRequest("GET", "/api/test", nil)

	logCtx := ExtractContextFromRequest(req, 1, "testuser")
	logCtx.StatusCode = 200
	logCtx.ResponseSize = 1024
	LogResponse(logCtx, "test response message")
	// Should not panic
}

func TestLogError(t *testing.T) {
	Init("debug")

	req := httptest.NewRequest("GET", "/api/test", nil)

	logCtx := ExtractContextFromRequest(req, 1, "testuser")
	LogError(logCtx, "test error message", nil)
	// Should not panic
}

func TestExtractContextFromRequest(t *testing.T) {
	Init("debug")

	tests := []struct {
		name     string
		request  *http.Request
		userID   uint
		username string
	}{
		{
			name: "basic request",
			request: func() *http.Request {
				req := httptest.NewRequest("GET", "/api/test", nil)
				req.RemoteAddr = "192.168.1.1:12345"
				return req
			}(),
			userID:   1,
			username: "testuser",
		},
		{
			name: "request with X-Forwarded-For",
			request: func() *http.Request {
				req := httptest.NewRequest("GET", "/api/test", nil)
				req.Header.Set("X-Forwarded-For", "10.0.0.1")
				return req
			}(),
			userID:   1,
			username: "testuser",
		},
		{
			name: "request with X-Real-IP",
			request: func() *http.Request {
				req := httptest.NewRequest("GET", "/api/test", nil)
				req.Header.Set("X-Real-IP", "10.0.0.2")
				return req
			}(),
			userID:   1,
			username: "testuser",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := ExtractContextFromRequest(tt.request, tt.userID, tt.username)
			if ctx.RequestID == "" && tt.request.Header.Get("X-Request-ID") == "" {
				// RequestID is optional, so this is OK
			}
			if ctx.Method == "" {
				t.Error("ExtractContextFromRequest() Method should not be empty")
			}
			if ctx.Path == "" {
				t.Error("ExtractContextFromRequest() Path should not be empty")
			}
		})
	}
}

func TestGetClientIP(t *testing.T) {
	Init("debug")

	tests := []struct {
		name     string
		request  *http.Request
		expected string
	}{
		{
			name: "X-Forwarded-For present",
			request: func() *http.Request {
				req := httptest.NewRequest("GET", "/api/test", nil)
				req.Header.Set("X-Forwarded-For", "10.0.0.1")
				return req
			}(),
			expected: "10.0.0.1",
		},
		{
			name: "X-Real-IP present",
			request: func() *http.Request {
				req := httptest.NewRequest("GET", "/api/test", nil)
				req.Header.Set("X-Real-IP", "10.0.0.2")
				return req
			}(),
			expected: "10.0.0.2",
		},
		{
			name: "fallback to RemoteAddr",
			request: func() *http.Request {
				req := httptest.NewRequest("GET", "/api/test", nil)
				req.RemoteAddr = "192.168.1.1:12345"
				return req
			}(),
			expected: "192.168.1.1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ip := GetClientIP(tt.request)
			if ip != tt.expected {
				t.Errorf("GetClientIP() = %v, want %v", ip, tt.expected)
			}
		})
	}
}
