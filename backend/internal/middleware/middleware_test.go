package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
)

func init() {
	// Initialize logger for tests
	if err := logger.Init("debug"); err != nil {
		panic(err)
	}
}

func TestCORS(t *testing.T) {
	tests := []struct {
		name           string
		allowedOrigins []string
		origin         string
		method         string
		wantAllow      bool
		wantHeader     string
	}{
		{
			name:           "Allowed origin",
			allowedOrigins: []string{"https://limen.kr"},
			origin:         "https://limen.kr",
			method:         "GET",
			wantAllow:      true,
			wantHeader:     "https://limen.kr",
		},
		{
			name:           "Disallowed origin",
			allowedOrigins: []string{"https://limen.kr"},
			origin:         "https://evil.com",
			method:         "GET",
			wantAllow:      false,
			wantHeader:     "",
		},
		{
			name:           "Wildcard allows all",
			allowedOrigins: []string{"*"},
			origin:         "https://any.com",
			method:         "GET",
			wantAllow:      true,
			wantHeader:     "https://any.com",
		},
		{
			name:           "Empty origins list",
			allowedOrigins: []string{},
			origin:         "https://limen.kr",
			method:         "GET",
			wantAllow:      false,
			wantHeader:     "",
		},
		{
			name:           "OPTIONS preflight",
			allowedOrigins: []string{"https://limen.kr"},
			origin:         "https://limen.kr",
			method:         "OPTIONS",
			wantAllow:      true,
			wantHeader:     "https://limen.kr",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})

			middleware := CORS(tt.allowedOrigins)
			wrapped := middleware(handler)

			req := httptest.NewRequest(tt.method, "/", nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}
			w := httptest.NewRecorder()

			wrapped.ServeHTTP(w, req)

			if tt.method == "OPTIONS" {
				if w.Code != http.StatusOK {
					t.Errorf("OPTIONS request code = %v, want %v", w.Code, http.StatusOK)
				}
			}

			allowOrigin := w.Header().Get("Access-Control-Allow-Origin")
			if tt.wantAllow {
				if allowOrigin == "" && tt.wantHeader != "" {
					t.Errorf("Access-Control-Allow-Origin header missing, want %v", tt.wantHeader)
				}
			} else {
				if allowOrigin != "" {
					t.Errorf("Access-Control-Allow-Origin = %v, want empty", allowOrigin)
				}
			}

			// Check CORS headers
			if w.Header().Get("Access-Control-Allow-Methods") == "" && tt.wantAllow {
				t.Error("Access-Control-Allow-Methods header missing")
			}
			if w.Header().Get("Access-Control-Allow-Headers") == "" && tt.wantAllow {
				t.Error("Access-Control-Allow-Headers header missing")
			}
			if w.Header().Get("Access-Control-Allow-Credentials") != "true" && tt.wantAllow {
				t.Error("Access-Control-Allow-Credentials should be true")
			}
		})
	}
}

func TestIsOriginAllowed(t *testing.T) {
	tests := []struct {
		name           string
		origin         string
		allowedOrigins []string
		want           bool
	}{
		{
			name:           "Exact match",
			origin:         "https://limen.kr",
			allowedOrigins: []string{"https://limen.kr"},
			want:           true,
		},
		{
			name:           "No match",
			origin:         "https://limen.kr",
			allowedOrigins: []string{"https://other.com"},
			want:           false,
		},
		{
			name:           "Wildcard allows all",
			origin:         "https://any.com",
			allowedOrigins: []string{"*"},
			want:           true,
		},
		{
			name:           "Empty origin",
			origin:         "",
			allowedOrigins: []string{"https://limen.kr"},
			want:           false,
		},
		{
			name:           "Empty allowed origins",
			origin:         "https://limen.kr",
			allowedOrigins: []string{},
			want:           false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isOriginAllowed(tt.origin, tt.allowedOrigins)
			if got != tt.want {
				t.Errorf("isOriginAllowed() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRequestID(t *testing.T) {
	tests := []struct {
		name        string
		headerValue string
		wantNew     bool
	}{
		{
			name:        "No existing request ID",
			headerValue: "",
			wantNew:     true,
		},
		{
			name:        "Existing request ID",
			headerValue: "test-request-id",
			wantNew:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requestID := GetRequestID(r.Context())
				if requestID == "" {
					t.Error("Request ID should be set in context")
				}
				if !tt.wantNew && requestID != tt.headerValue {
					t.Errorf("Request ID = %v, want %v", requestID, tt.headerValue)
				}
				w.WriteHeader(http.StatusOK)
			})

			wrapped := RequestID(handler)

			req := httptest.NewRequest("GET", "/", nil)
			if tt.headerValue != "" {
				req.Header.Set("X-Request-ID", tt.headerValue)
			}
			w := httptest.NewRecorder()

			wrapped.ServeHTTP(w, req)

			responseID := w.Header().Get("X-Request-ID")
			if responseID == "" {
				t.Error("X-Request-ID header should be set in response")
			}
		})
	}
}

func TestGetRequestID(t *testing.T) {
	tests := []struct {
		name   string
		ctx    context.Context
		want   string
		wantOk bool
	}{
		{
			name:   "With request ID",
			ctx:    context.WithValue(context.Background(), RequestIDKey, "test-id"),
			want:   "test-id",
			wantOk: true,
		},
		{
			name:   "Without request ID",
			ctx:    context.Background(),
			want:   "",
			wantOk: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := GetRequestID(tt.ctx)
			if got != tt.want {
				t.Errorf("GetRequestID() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestLogging(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	wrapped := Logging(handler)

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	wrapped.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Logging middleware code = %v, want %v", w.Code, http.StatusOK)
	}
}

func TestRecovery(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("test panic")
	})

	wrapped := Recovery(handler)

	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()

	// Should not panic
	wrapped.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("Recovery middleware code = %v, want %v", w.Code, http.StatusInternalServerError)
	}
}

func TestSecurityHeaders(t *testing.T) {
	tests := []struct {
		name     string
		isHTTPS  bool
		proto    string
		wantHSTS bool
	}{
		{
			name:     "HTTPS enabled",
			isHTTPS:  true,
			proto:    "",
			wantHSTS: true,
		},
		{
			name:     "HTTPS via X-Forwarded-Proto",
			isHTTPS:  false,
			proto:    "https",
			wantHSTS: true,
		},
		{
			name:     "HTTP",
			isHTTPS:  false,
			proto:    "http",
			wantHSTS: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})

			middleware := SecurityHeaders(tt.isHTTPS)
			wrapped := middleware(handler)

			req := httptest.NewRequest("GET", "/", nil)
			if tt.proto != "" {
				req.Header.Set("X-Forwarded-Proto", tt.proto)
			}
			w := httptest.NewRecorder()

			wrapped.ServeHTTP(w, req)

			// Check security headers
			if w.Header().Get("X-Content-Type-Options") != "nosniff" {
				t.Error("X-Content-Type-Options header missing")
			}
			if w.Header().Get("X-Frame-Options") != "DENY" {
				t.Error("X-Frame-Options header missing")
			}
			if w.Header().Get("X-XSS-Protection") != "1; mode=block" {
				t.Error("X-XSS-Protection header missing")
			}
			if w.Header().Get("Referrer-Policy") == "" {
				t.Error("Referrer-Policy header missing")
			}
			if w.Header().Get("Permissions-Policy") == "" {
				t.Error("Permissions-Policy header missing")
			}
			if w.Header().Get("Content-Security-Policy") == "" {
				t.Error("Content-Security-Policy header missing")
			}

			hsts := w.Header().Get("Strict-Transport-Security")
			if tt.wantHSTS {
				if hsts == "" {
					t.Error("Strict-Transport-Security header should be set for HTTPS")
				}
			} else {
				if hsts != "" {
					t.Error("Strict-Transport-Security header should not be set for HTTP")
				}
			}
		})
	}
}

func TestCompression(t *testing.T) {
	tests := []struct {
		name           string
		acceptEncoding string
		path           string
		upgrade        string
		wantCompressed bool
	}{
		{
			name:           "Accepts gzip",
			acceptEncoding: "gzip",
			path:           "/test",
			wantCompressed: true,
		},
		{
			name:           "No gzip support",
			acceptEncoding: "deflate",
			path:           "/test",
			wantCompressed: false,
		},
		{
			name:           "WebSocket connection",
			acceptEncoding: "gzip",
			path:           "/ws",
			upgrade:        "websocket",
			wantCompressed: false,
		},
		{
			name:           "Already compressed file",
			acceptEncoding: "gzip",
			path:           "/file.gz",
			wantCompressed: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("test content"))
			})

			wrapped := Compression(handler)

			req := httptest.NewRequest("GET", tt.path, nil)
			req.Header.Set("Accept-Encoding", tt.acceptEncoding)
			if tt.upgrade != "" {
				req.Header.Set("Upgrade", tt.upgrade)
			}
			w := httptest.NewRecorder()

			wrapped.ServeHTTP(w, req)

			contentEncoding := w.Header().Get("Content-Encoding")
			if tt.wantCompressed {
				if contentEncoding != "gzip" {
					t.Errorf("Content-Encoding = %v, want gzip", contentEncoding)
				}
			} else {
				if contentEncoding == "gzip" {
					t.Errorf("Content-Encoding should not be gzip, got %v", contentEncoding)
				}
			}
		})
	}
}

func TestResponseWriter(t *testing.T) {
	w := httptest.NewRecorder()
	rw := &responseWriter{
		ResponseWriter: w,
		statusCode:     http.StatusOK,
		bytesWritten:   0,
	}

	rw.WriteHeader(http.StatusNotFound)
	if rw.statusCode != http.StatusNotFound {
		t.Errorf("statusCode = %v, want %v", rw.statusCode, http.StatusNotFound)
	}

	data := []byte("test")
	n, err := rw.Write(data)
	if err != nil {
		t.Errorf("Write() error = %v", err)
	}
	if n != len(data) {
		t.Errorf("Write() n = %v, want %v", n, len(data))
	}
	if rw.bytesWritten != int64(len(data)) {
		t.Errorf("bytesWritten = %v, want %v", rw.bytesWritten, len(data))
	}
}

func TestAdmin(t *testing.T) {
	cfg := &config.Config{
		JWTSecret: "test-secret-key",
	}

	tests := []struct {
		name     string
		role     string
		hasToken bool
		wantCode int
	}{
		{
			name:     "Admin user",
			role:     "admin",
			hasToken: false,
			wantCode: http.StatusOK,
		},
		{
			name:     "Non-admin user",
			role:     "user",
			hasToken: false,
			wantCode: http.StatusForbidden,
		},
		{
			name:     "No role in context",
			role:     "",
			hasToken: false,
			wantCode: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})

			middleware := Admin(cfg)
			wrapped := middleware(handler)

			req := httptest.NewRequest("GET", "/", nil)
			if tt.role != "" {
				ctx := context.WithValue(req.Context(), RoleKey, tt.role)
				req = req.WithContext(ctx)
			}
			w := httptest.NewRecorder()

			wrapped.ServeHTTP(w, req)

			if w.Code != tt.wantCode {
				t.Errorf("Admin middleware code = %v, want %v", w.Code, tt.wantCode)
			}
		})
	}
}

func TestGetRole(t *testing.T) {
	tests := []struct {
		name   string
		ctx    context.Context
		want   string
		wantOk bool
	}{
		{
			name:   "With role",
			ctx:    context.WithValue(context.Background(), RoleKey, "admin"),
			want:   "admin",
			wantOk: true,
		},
		{
			name:   "Without role",
			ctx:    context.Background(),
			want:   "",
			wantOk: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := GetRole(tt.ctx)
			if got != tt.want {
				t.Errorf("GetRole() = %v, want %v", got, tt.want)
			}
			if ok != tt.wantOk {
				t.Errorf("GetRole() ok = %v, want %v", ok, tt.wantOk)
			}
		})
	}
}

func TestIsAdmin(t *testing.T) {
	tests := []struct {
		name string
		ctx  context.Context
		want bool
	}{
		{
			name: "Admin user",
			ctx:  context.WithValue(context.Background(), RoleKey, "admin"),
			want: true,
		},
		{
			name: "Non-admin user",
			ctx:  context.WithValue(context.Background(), RoleKey, "user"),
			want: false,
		},
		{
			name: "No role",
			ctx:  context.Background(),
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsAdmin(tt.ctx)
			if got != tt.want {
				t.Errorf("IsAdmin() = %v, want %v", got, tt.want)
			}
		})
	}
}
