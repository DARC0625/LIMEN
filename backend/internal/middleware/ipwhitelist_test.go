package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIPWhitelist_EmptyWhitelist(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := IPWhitelist([]string{})
	wrapped := middleware(handler)

	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	w := httptest.NewRecorder()

	wrapped.ServeHTTP(w, req)

	// Empty whitelist should allow all
	if w.Code != http.StatusOK {
		t.Errorf("IPWhitelist() empty whitelist code = %v, want %v", w.Code, http.StatusOK)
	}
}

func TestIPWhitelist_SingleIP(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := IPWhitelist([]string{"192.168.1.1"})
	wrapped := middleware(handler)

	tests := []struct {
		name       string
		remoteAddr string
		wantCode   int
	}{
		{
			name:       "Allowed IP",
			remoteAddr: "192.168.1.1:12345",
			wantCode:   http.StatusOK,
		},
		{
			name:       "Disallowed IP",
			remoteAddr: "192.168.1.2:12345",
			wantCode:   http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			req.RemoteAddr = tt.remoteAddr
			w := httptest.NewRecorder()

			wrapped.ServeHTTP(w, req)

			if w.Code != tt.wantCode {
				t.Errorf("IPWhitelist() code = %v, want %v", w.Code, tt.wantCode)
			}
		})
	}
}

func TestIPWhitelist_CIDR(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := IPWhitelist([]string{"192.168.1.0/24"})
	wrapped := middleware(handler)

	tests := []struct {
		name       string
		remoteAddr string
		wantCode   int
	}{
		{
			name:       "IP in CIDR range",
			remoteAddr: "192.168.1.100:12345",
			wantCode:   http.StatusOK,
		},
		{
			name:       "IP outside CIDR range",
			remoteAddr: "192.168.2.1:12345",
			wantCode:   http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			req.RemoteAddr = tt.remoteAddr
			w := httptest.NewRecorder()

			wrapped.ServeHTTP(w, req)

			if w.Code != tt.wantCode {
				t.Errorf("IPWhitelist() code = %v, want %v", w.Code, tt.wantCode)
			}
		})
	}
}

func TestIPWhitelist_MultipleIPs(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := IPWhitelist([]string{"192.168.1.1", "192.168.1.2"})
	wrapped := middleware(handler)

	tests := []struct {
		name       string
		remoteAddr string
		wantCode   int
	}{
		{
			name:       "First allowed IP",
			remoteAddr: "192.168.1.1:12345",
			wantCode:   http.StatusOK,
		},
		{
			name:       "Second allowed IP",
			remoteAddr: "192.168.1.2:12345",
			wantCode:   http.StatusOK,
		},
		{
			name:       "Disallowed IP",
			remoteAddr: "192.168.1.3:12345",
			wantCode:   http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			req.RemoteAddr = tt.remoteAddr
			w := httptest.NewRecorder()

			wrapped.ServeHTTP(w, req)

			if w.Code != tt.wantCode {
				t.Errorf("IPWhitelist() code = %v, want %v", w.Code, tt.wantCode)
			}
		})
	}
}

func TestIPWhitelist_InvalidIP(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := IPWhitelist([]string{"192.168.1.1"})
	wrapped := middleware(handler)

	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "invalid-ip"
	w := httptest.NewRecorder()

	wrapped.ServeHTTP(w, req)

	// Invalid IP should be forbidden
	if w.Code != http.StatusForbidden {
		t.Errorf("IPWhitelist() invalid IP code = %v, want %v", w.Code, http.StatusForbidden)
	}
}

func TestIPWhitelist_XForwardedFor(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := IPWhitelist([]string{"192.168.1.1"})
	wrapped := middleware(handler)

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Forwarded-For", "192.168.1.1")
	req.RemoteAddr = "10.0.0.1:12345"
	w := httptest.NewRecorder()

	wrapped.ServeHTTP(w, req)

	// Should use X-Forwarded-For IP
	if w.Code != http.StatusOK {
		t.Errorf("IPWhitelist() X-Forwarded-For code = %v, want %v", w.Code, http.StatusOK)
	}
}

func TestIPWhitelist_InvalidCIDR(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// Invalid CIDR should be logged but not cause panic
	middleware := IPWhitelist([]string{"invalid-cidr", "192.168.1.1"})
	wrapped := middleware(handler)

	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	w := httptest.NewRecorder()

	wrapped.ServeHTTP(w, req)

	// Valid IP should still work
	if w.Code != http.StatusOK {
		t.Errorf("IPWhitelist() with invalid CIDR code = %v, want %v", w.Code, http.StatusOK)
	}
}

func TestIPWhitelist_EmptyString(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// Empty strings should be ignored
	middleware := IPWhitelist([]string{"", "192.168.1.1", "  "})
	wrapped := middleware(handler)

	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	w := httptest.NewRecorder()

	wrapped.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("IPWhitelist() with empty strings code = %v, want %v", w.Code, http.StatusOK)
	}
}
