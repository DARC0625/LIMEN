package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/config"
)

func TestIsPublicEndpoint(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		expected bool
	}{
		{"health check", "/api/health", true},
		{"login", "/api/auth/login", true},
		{"register", "/api/auth/register", true},
		{"session get", "/api/auth/session", true},
		{"session post", "/api/auth/session", true},
		{"session delete", "/api/auth/session", true},
		{"refresh token", "/api/auth/refresh", true},
		{"vnc websocket", "/ws/vnc", true},
		{"vnc endpoint", "/vnc", true},
		{"vnc with uuid", "/vnc/12345678-1234-1234-1234-123456789abc", true},
		{"private endpoint", "/api/vms", false},
		{"admin endpoint", "/api/admin/users", false},
		{"root", "/", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsPublicEndpoint(tt.path)
			if result != tt.expected {
				t.Errorf("IsPublicEndpoint(%q) = %v, want %v", tt.path, result, tt.expected)
			}
		})
	}
}

func TestGetUserID(t *testing.T) {
	// Test with user ID in context
	ctx := context.WithValue(context.Background(), UserIDKey, uint(123))

	userID, ok := GetUserID(ctx)
	if !ok {
		t.Error("GetUserID() should return true when user ID is in context")
	}
	if userID != 123 {
		t.Errorf("GetUserID() = %d, want 123", userID)
	}

	// Test without user ID in context
	ctx2 := context.Background()
	_, ok2 := GetUserID(ctx2)
	if ok2 {
		t.Error("GetUserID() should return false when user ID is not in context")
	}
}

func TestGetUsername(t *testing.T) {
	// Test with username in context
	ctx := context.WithValue(context.Background(), UsernameKey, "testuser")

	username, ok := GetUsername(ctx)
	if !ok {
		t.Error("GetUsername() should return true when username is in context")
	}
	if username != "testuser" {
		t.Errorf("GetUsername() = %q, want 'testuser'", username)
	}

	// Test without username in context
	ctx2 := context.Background()
	_, ok2 := GetUsername(ctx2)
	if ok2 {
		t.Error("GetUsername() should return false when username is not in context")
	}
}

func TestAuth_Middleware(t *testing.T) {
	cfg := &config.Config{
		JWTSecret: "test-secret-key-for-testing-only-very-long-key",
	}

	middleware := Auth(cfg)
	if middleware == nil {
		t.Fatal("Auth() returned nil middleware")
	}

	// Test that it returns a function
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	wrapped := middleware(handler)
	if wrapped == nil {
		t.Fatal("Auth middleware returned nil handler")
	}
}

func TestAuth_PublicEndpoint(t *testing.T) {
	cfg := &config.Config{
		JWTSecret: "test-secret-key-for-testing-only-very-long-key",
	}

	middleware := Auth(cfg)
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	wrapped := middleware(handler)

	// Public endpoints should not require authentication
	tests := []string{
		"/api/health",
		"/api/auth/login",
		"/api/auth/register",
	}

	for _, path := range tests {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest("GET", path, nil)
			w := httptest.NewRecorder()

			wrapped.ServeHTTP(w, req)

			// Should not return 401 (unauthorized)
			if w.Code == http.StatusUnauthorized {
				t.Errorf("Public endpoint %s should not require authentication, got 401", path)
			}
		})
	}
}
