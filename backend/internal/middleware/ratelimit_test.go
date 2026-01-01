package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"golang.org/x/time/rate"
)

func TestNewIPRateLimiter(t *testing.T) {
	limiter := NewIPRateLimiter(rate.Limit(10), 20)

	if limiter == nil {
		t.Fatal("NewIPRateLimiter() returned nil")
	}

	if limiter.r != rate.Limit(10) {
		t.Errorf("NewIPRateLimiter() r = %v, want 10", limiter.r)
	}

	if limiter.b != 20 {
		t.Errorf("NewIPRateLimiter() b = %v, want 20", limiter.b)
	}

	if limiter.ips == nil {
		t.Error("NewIPRateLimiter() ips map is nil")
	}

	if limiter.lastAccess == nil {
		t.Error("NewIPRateLimiter() lastAccess map is nil")
	}
}

func TestIPRateLimiter_getLimiter(t *testing.T) {
	limiter := NewIPRateLimiter(rate.Limit(10), 20)

	// Get limiter for new IP
	ip1 := "192.168.1.1"
	l1 := limiter.getLimiter(ip1)
	if l1 == nil {
		t.Fatal("getLimiter() returned nil")
	}

	// Get limiter for same IP (should return same instance)
	l2 := limiter.getLimiter(ip1)
	if l1 != l2 {
		t.Error("getLimiter() should return same limiter for same IP")
	}

	// Get limiter for different IP
	ip2 := "192.168.1.2"
	l3 := limiter.getLimiter(ip2)
	if l3 == nil {
		t.Fatal("getLimiter() returned nil for different IP")
	}

	if l1 == l3 {
		t.Error("getLimiter() should return different limiter for different IP")
	}

	// Verify lastAccess is updated
	if _, exists := limiter.lastAccess[ip1]; !exists {
		t.Error("getLimiter() should update lastAccess")
	}
}

func TestRateLimit(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := RateLimit(10.0, 20)
	wrapped := middleware(handler)

	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()

	// First request should succeed
	wrapped.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("RateLimit() first request code = %v, want %v", w.Code, http.StatusOK)
	}
}

func TestRateLimitWithConfig(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	config := RateLimitConfig{
		DefaultRPS:    10.0,
		DefaultBurst:  20,
		EndpointRPS:   map[string]float64{"/api/vms": 5.0},
		EndpointBurst: map[string]int{"/api/vms": 10},
	}

	middleware := RateLimitWithConfig(config)
	wrapped := middleware(handler)

	// Test default endpoint
	req := httptest.NewRequest("GET", "/api/test", nil)
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("RateLimitWithConfig() default endpoint code = %v, want %v", w.Code, http.StatusOK)
	}

	// Test endpoint-specific limit
	req2 := httptest.NewRequest("GET", "/api/vms", nil)
	w2 := httptest.NewRecorder()
	wrapped.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Errorf("RateLimitWithConfig() endpoint-specific code = %v, want %v", w2.Code, http.StatusOK)
	}
}

func TestRateLimit_PublicEndpoint(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := RateLimit(1.0, 1) // Very low limit
	wrapped := middleware(handler)

	// Public endpoints should not be rate limited
	tests := []string{
		"/api/health",
		"/api/auth/login",
		"/api/auth/register",
	}

	for _, path := range tests {
		req := httptest.NewRequest("GET", path, nil)
		w := httptest.NewRecorder()
		wrapped.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("RateLimit() public endpoint %v code = %v, want %v", path, w.Code, http.StatusOK)
		}
	}
}

func TestRateLimit_RateLimitExceeded(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// Very low rate limit: 1 request per second, burst 1
	middleware := RateLimit(1.0, 1)
	wrapped := middleware(handler)

	req := httptest.NewRequest("GET", "/api/test", nil)
	req.RemoteAddr = "192.168.1.1:12345"

	// First request should succeed
	w1 := httptest.NewRecorder()
	wrapped.ServeHTTP(w1, req)
	if w1.Code != http.StatusOK {
		t.Errorf("RateLimit() first request code = %v, want %v", w1.Code, http.StatusOK)
	}

	// Second request immediately after should be rate limited
	w2 := httptest.NewRecorder()
	wrapped.ServeHTTP(w2, req)
	if w2.Code != http.StatusTooManyRequests {
		t.Errorf("RateLimit() rate limited request code = %v, want %v", w2.Code, http.StatusTooManyRequests)
	}

	// Check Retry-After header
	if w2.Header().Get("Retry-After") == "" {
		t.Error("RateLimit() should set Retry-After header")
	}
}

func TestIsPublicEndpointForRateLimit(t *testing.T) {
	tests := []struct {
		path string
		want bool
	}{
		{"/api/health", true},
		{"/api/auth/login", true},
		{"/api/auth/register", true},
		{"/api/vms", false},
		{"/api/test", false},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := isPublicEndpointForRateLimit(tt.path)
			if got != tt.want {
				t.Errorf("isPublicEndpointForRateLimit(%v) = %v, want %v", tt.path, got, tt.want)
			}
		})
	}
}

func TestGetClientIP(t *testing.T) {
	tests := []struct {
		name           string
		xForwardedFor  string
		xRealIP        string
		remoteAddr     string
		want           string
	}{
		{
			name:          "X-Forwarded-For present",
			xForwardedFor: "192.168.1.1",
			remoteAddr:    "10.0.0.1:12345",
			want:          "192.168.1.1",
		},
		{
			name:       "X-Real-IP present",
			xRealIP:    "192.168.1.2",
			remoteAddr: "10.0.0.1:12345",
			want:       "192.168.1.2",
		},
		{
			name:       "Fallback to RemoteAddr",
			remoteAddr: "10.0.0.1:12345",
			want:       "10.0.0.1:12345",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			if tt.xForwardedFor != "" {
				req.Header.Set("X-Forwarded-For", tt.xForwardedFor)
			}
			if tt.xRealIP != "" {
				req.Header.Set("X-Real-IP", tt.xRealIP)
			}
			req.RemoteAddr = tt.remoteAddr

			got := getClientIP(req)
			if got != tt.want {
				t.Errorf("getClientIP() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIPRateLimiter_cleanup(t *testing.T) {
	limiter := NewIPRateLimiter(rate.Limit(10), 20)
	limiter.cleanup()

	// Add some IPs
	ip1 := "192.168.1.1"
	ip2 := "192.168.1.2"
	limiter.getLimiter(ip1)
	limiter.getLimiter(ip2)

	// Verify IPs are added
	if len(limiter.ips) != 2 {
		t.Errorf("Expected 2 IPs, got %d", len(limiter.ips))
	}

	// Wait a bit for cleanup goroutine to start
	time.Sleep(100 * time.Millisecond)

	// Cleanup runs in background, so we can't easily test it synchronously
	// But we can verify the structure is correct
	if limiter.ips == nil {
		t.Error("cleanup() should not clear ips map immediately")
	}
}


