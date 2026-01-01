// Package middleware provides HTTP middleware functions.
package middleware

import (
	"compress/gzip"
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/metrics"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type contextKey string

const RequestIDKey contextKey = "request_id"

// CORS handles Cross-Origin Resource Sharing headers.
func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			originAllowed := isOriginAllowed(origin, allowedOrigins)

			// Check if origin is allowed (empty list => no CORS)
			if originAllowed {
				// If "*" is in allowedOrigins, set "*" instead of specific origin
				allowAll := false
				for _, allowed := range allowedOrigins {
					if allowed == "*" {
						allowAll = true
						break
					}
				}
				if allowAll {
					// Note: Cannot use "*" with Access-Control-Allow-Credentials: true
					// If credentials are required, must specify exact origin
					// For now, use the request origin if "*" is configured
					if origin != "" {
						w.Header().Set("Access-Control-Allow-Origin", origin)
					} else {
						w.Header().Set("Access-Control-Allow-Origin", "*")
					}
				} else {
					w.Header().Set("Access-Control-Allow-Origin", origin)
				}
			}

			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token")
			// IMPORTANT: Access-Control-Allow-Credentials must be "true" for cookies to work
			// When this is set, Access-Control-Allow-Origin cannot be "*" - must be specific origin
			w.Header().Set("Access-Control-Allow-Credentials", "true")

			if r.Method == "OPTIONS" {
				if !originAllowed {
					logger.Log.Warn("CORS preflight blocked",
						zap.String("origin", origin),
						zap.String("path", r.URL.Path))
				} else {
					logger.Log.Debug("CORS preflight allowed",
						zap.String("origin", origin),
						zap.String("path", r.URL.Path))
				}
				w.WriteHeader(http.StatusOK)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// isOriginAllowed checks if the given origin is in the allowed origins list.
// Supports "*" as a wildcard to allow all origins.
func isOriginAllowed(origin string, allowedOrigins []string) bool {
	if origin == "" {
		return false
	}
	if len(allowedOrigins) == 0 {
		return false
	}
	for _, allowed := range allowedOrigins {
		if allowed == "*" {
			return true
		}
		if allowed == origin {
			return true
		}
	}
	return false
}

// RequestID adds a unique request ID to each request.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}

		ctx := context.WithValue(r.Context(), RequestIDKey, requestID)
		w.Header().Set("X-Request-ID", requestID)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// Logging logs HTTP requests with structured logging.
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Wrap ResponseWriter to capture status code
		wrapped := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
			bytesWritten:   0,
		}

		next.ServeHTTP(wrapped, r)

		duration := time.Since(start)

		// Get request ID from context
		requestID := GetRequestID(r.Context())

		// Update Prometheus metrics
		statusStr := fmt.Sprintf("%d", wrapped.statusCode)
		metrics.HTTPRequestsTotal.WithLabelValues(r.Method, r.URL.Path, statusStr).Inc()
		metrics.HTTPRequestDuration.WithLabelValues(r.Method, r.URL.Path).Observe(duration.Seconds())

		userID, _ := GetUserID(r.Context())
		username, _ := GetUsername(r.Context())

		// Use appropriate log level based on status code
		logFields := []zap.Field{
			zap.String("method", r.Method),
			zap.String("path", r.URL.Path),
			zap.String("query", r.URL.RawQuery),
			zap.Int("status", wrapped.statusCode),
			zap.Duration("duration", duration),
			zap.Int64("bytes_out", wrapped.bytesWritten),
			zap.Int64("content_length", r.ContentLength),
			zap.String("request_id", requestID),
			zap.String("remote_addr", r.RemoteAddr),
			zap.String("xff", r.Header.Get("X-Forwarded-For")),
			zap.String("host", r.Host),
			zap.String("referer", r.Referer()),
			zap.String("user_agent", r.Header.Get("User-Agent")),
			zap.Uint("user_id", userID),
			zap.String("username", username),
		}

		// Log with appropriate level based on status code
		if wrapped.statusCode >= 500 {
			// Server errors - ERROR level
			logger.Log.Error("HTTP request - server error", logFields...)
		} else if wrapped.statusCode >= 400 {
			// Client errors - WARN level (but not 404s for static assets or health checks)
			if wrapped.statusCode != 404 || (!strings.HasPrefix(r.URL.Path, "/static/") && r.URL.Path != "/api/health") {
				logger.Log.Warn("HTTP request - client error", logFields...)
			} else {
				// 404 for static assets or health checks - DEBUG level to reduce noise
				logger.Log.Debug("HTTP request", logFields...)
			}
		} else {
			// Success - DEBUG level for health checks, INFO for others
			if r.URL.Path == "/api/health" || r.URL.Path == "/api/health_proxy" {
				logger.Log.Debug("HTTP request", logFields...)
			} else {
				logger.Log.Info("HTTP request", logFields...)
			}
		}
	})
}

// AlertManager interface for sending alerts (to avoid circular dependency).
type AlertManager interface {
	SendAlert(ctx context.Context, title, message, severity, service, component string, metadata map[string]interface{}, tags []string) error
}

var globalAlertManager AlertManager

// SetAlertManager sets the global alert manager for middleware.
func SetAlertManager(manager AlertManager) {
	globalAlertManager = manager
}

// Recovery recovers from panics and returns a 500 error.
func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				requestID := GetRequestID(r.Context())
				logger.Log.Error("Panic recovered",
					zap.Any("error", err),
					zap.String("path", r.URL.Path),
					zap.String("method", r.Method),
					zap.String("request_id", requestID),
				)

				// Send alert if alerting is enabled
				if globalAlertManager != nil {
					ctx := r.Context()
					metadata := map[string]interface{}{
						"path":       r.URL.Path,
						"method":     r.Method,
						"request_id": requestID,
					}
					tags := []string{"panic", "error"}
					globalAlertManager.SendAlert(ctx, "Panic Recovered", fmt.Sprintf("Panic occurred: %v", err), "critical", "limen", "http", metadata, tags)
				}

				http.Error(w, "Internal server error", http.StatusInternalServerError)
			}
		}()

		next.ServeHTTP(w, r)
	})
}

// SecurityHeaders adds security-related HTTP headers to responses.
func SecurityHeaders(isHTTPS bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Check if request is HTTPS (via X-Forwarded-Proto header from reverse proxy or direct TLS)
			// This is more accurate than just checking port, as HTTPS is often terminated at reverse proxy
			proto := r.Header.Get("X-Forwarded-Proto")
			isSecure := isHTTPS || proto == "https" || r.TLS != nil

			// Prevent MIME type sniffing
			w.Header().Set("X-Content-Type-Options", "nosniff")

			// Prevent clickjacking attacks
			w.Header().Set("X-Frame-Options", "DENY")

			// Enable XSS protection (legacy, but still useful for older browsers)
			w.Header().Set("X-XSS-Protection", "1; mode=block")

			// Referrer policy - control referrer information
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

			// Permissions Policy (formerly Feature-Policy)
			// Restrict access to browser features
			w.Header().Set("Permissions-Policy",
				"geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()")

			// Content Security Policy
			// Allow same-origin, HTTPS connections, and WebSocket connections
			// Note: 'unsafe-inline' and 'unsafe-eval' are needed for Swagger UI
			// In production, consider removing these if Swagger UI is not needed
			csp := "default-src 'self'; " +
				"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; " + // Swagger UI requires unpkg.com
				"style-src 'self' 'unsafe-inline' https://unpkg.com; " + // Swagger UI styles
				"img-src 'self' data: https:; " +
				"font-src 'self' data: https://unpkg.com; " +
				"connect-src 'self' ws: wss:; " + // Allow WebSocket connections
				"frame-ancestors 'none'; " +
				"base-uri 'self'; " +
				"form-action 'self'; " +
				"object-src 'none'; " + // Prevent object/embed/applet
				"upgrade-insecure-requests;" // Upgrade HTTP to HTTPS
			w.Header().Set("Content-Security-Policy", csp)

			// Strict Transport Security (HSTS) - only if HTTPS
			if isSecure {
				// 1 year, includeSubDomains, preload
				w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
			}

			next.ServeHTTP(w, r)
		})
	}
}

// GetRequestID retrieves the request ID from context.
func GetRequestID(ctx context.Context) string {
	if id, ok := ctx.Value(RequestIDKey).(string); ok {
		return id
	}
	return ""
}

// responseWriter wraps http.ResponseWriter to capture status code.
type responseWriter struct {
	http.ResponseWriter
	statusCode   int
	bytesWritten int64
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	n, err := rw.ResponseWriter.Write(b)
	rw.bytesWritten += int64(n)
	return n, err
}

// Compression adds gzip compression to HTTP responses.
// It compresses responses for clients that support gzip encoding.
func Compression(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if client accepts gzip encoding
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}

		// Skip compression for WebSocket connections
		if r.Header.Get("Upgrade") == "websocket" {
			next.ServeHTTP(w, r)
			return
		}

		// Skip compression for already compressed content
		if strings.Contains(r.URL.Path, ".gz") || strings.Contains(r.URL.Path, ".zip") {
			next.ServeHTTP(w, r)
			return
		}

		// Create gzip writer
		gz := gzip.NewWriter(w)
		defer gz.Close()

		// Set headers
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Set("Vary", "Accept-Encoding")

		// Wrap ResponseWriter to capture written bytes
		wrapped := &compressedResponseWriter{
			ResponseWriter: w,
			gzipWriter:     gz,
		}

		next.ServeHTTP(wrapped, r)
	})
}

// compressedResponseWriter wraps http.ResponseWriter with gzip compression.
type compressedResponseWriter struct {
	http.ResponseWriter
	gzipWriter *gzip.Writer
}

func (cw *compressedResponseWriter) Write(b []byte) (int, error) {
	return cw.gzipWriter.Write(b)
}

func (cw *compressedResponseWriter) WriteHeader(code int) {
	cw.ResponseWriter.WriteHeader(code)
}
