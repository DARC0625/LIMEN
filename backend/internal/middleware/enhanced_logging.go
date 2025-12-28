// Package middleware provides enhanced logging middleware with full context.
// All requests and responses are logged with machine-readable structure.
package middleware

import (
	"bytes"
	"net/http"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/auth"
	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"go.uber.org/zap"
)

// responseWriter wraps http.ResponseWriter to capture response data.
type enhancedResponseWriter struct {
	http.ResponseWriter
	statusCode int
	body       *bytes.Buffer
	written    int64
}

func newEnhancedResponseWriter(w http.ResponseWriter) *enhancedResponseWriter {
	return &enhancedResponseWriter{
		ResponseWriter: w,
		statusCode:     http.StatusOK,
		body:           &bytes.Buffer{},
	}
}

func (rw *enhancedResponseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *enhancedResponseWriter) Write(b []byte) (int, error) {
	rw.written += int64(len(b))
	// Also write to buffer for logging (limit size to prevent memory issues)
	if rw.body.Len() < 1024 { // Only capture first 1KB
		rw.body.Write(b)
	}
	return rw.ResponseWriter.Write(b)
}

// EnhancedLogging provides comprehensive request/response logging with full context.
// Logs are structured for machine parsing and analysis.
func EnhancedLogging(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Extract request context
			requestID := r.Header.Get("X-Request-ID")
			if requestID == "" {
				requestID = generateRequestID()
				r.Header.Set("X-Request-ID", requestID)
			}

			// Extract user context from token (if available)
			userID := uint(0)
			username := ""
			if token := extractTokenFromRequest(r); token != "" {
				var claims *auth.Claims
				var err error
				if cfg.JWTEd25519PrivateKey != "" {
					claims, err = auth.ValidateToken(token, cfg.JWTEd25519PrivateKey)
				} else {
					claims, err = auth.ValidateToken(token, cfg.JWTSecret)
				}
				if err == nil && claims != nil {
					userID = claims.UserID
					username = claims.Username
				}
			}

			// Create logging context
			logCtx := logger.LogContext{
				Timestamp:   start,
				RequestID:   requestID,
				UserID:      userID,
				Username:    username,
				IP:          logger.GetClientIP(r),
				UserAgent:   r.UserAgent(),
				Method:      r.Method,
				Path:        r.URL.Path,
				Service:     "limen-backend",
				Component:   "api",
				Environment: cfg.Env,
			}

			// Wrap response writer to capture response
			rw := newEnhancedResponseWriter(w)

			// Log request start
			logger.LogRequest(logCtx, "Request started",
				zap.String("query", r.URL.RawQuery),
				zap.String("content_type", r.Header.Get("Content-Type")),
				zap.String("content_length", r.Header.Get("Content-Length")),
			)

			// Process request
			next.ServeHTTP(rw, r)

			// Calculate duration
			duration := time.Since(start)
			logCtx.Duration = duration.Milliseconds()
			logCtx.StatusCode = rw.statusCode
			logCtx.ResponseSize = rw.written

			// Determine log level based on status code
			var logFunc func(string, ...zap.Field)
			if rw.statusCode >= 500 {
				logFunc = logger.Log.Error
				logCtx.ErrorType = "server_error"
			} else if rw.statusCode >= 400 {
				logFunc = logger.Log.Warn
				logCtx.ErrorType = "client_error"
			} else {
				logFunc = logger.Log.Info
			}

			// Log response
			fields := []zap.Field{
				zap.String("request_id", requestID),
				zap.String("method", r.Method),
				zap.String("path", r.URL.Path),
				zap.Int("status_code", rw.statusCode),
				zap.Int64("duration_ms", duration.Milliseconds()),
				zap.Int64("response_size_bytes", rw.written),
			}

			if userID > 0 {
				fields = append(fields, zap.Uint("user_id", userID), zap.String("username", username))
			}

			if rw.statusCode >= 400 && rw.body.Len() > 0 {
				// Log error response body (sanitized)
				fields = append(fields, zap.String("error_response", sanitizeErrorResponse(rw.body.String())))
			}

			logFunc("Request completed", fields...)
		})
	}
}

// extractTokenFromRequest extracts JWT token from request.
func extractTokenFromRequest(r *http.Request) string {
	// Check Authorization header
	authHeader := r.Header.Get("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		return authHeader[7:]
	}
	return ""
}

// sanitizeErrorResponse sanitizes error response for logging.
func sanitizeErrorResponse(response string) string {
	// Limit length
	if len(response) > 500 {
		return response[:500] + "..."
	}
	return response
}

// generateRequestID generates a unique request ID.
func generateRequestID() string {
	return time.Now().Format("20060102150405") + "-" + randomString(8)
}

// randomString generates a random string.
func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(b)
}
