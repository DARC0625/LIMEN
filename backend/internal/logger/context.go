// Package logger provides enhanced logging context for machine-readable logs.
// All logs are structured to be easily parsed and analyzed by automated systems.
package logger

import (
	"net"
	"net/http"
	"time"

	"go.uber.org/zap"
)

// LogContext represents a structured logging context.
// This ensures all logs have consistent, machine-readable structure.
type LogContext struct {
	// Request context
	RequestID   string `json:"request_id,omitempty"`
	UserID      uint   `json:"user_id,omitempty"`
	Username    string `json:"username,omitempty"`
	IP          string `json:"ip,omitempty"`
	UserAgent   string `json:"user_agent,omitempty"`
	Method      string `json:"method,omitempty"`
	Path        string `json:"path,omitempty"`
	StatusCode  int    `json:"status_code,omitempty"`
	Duration    int64  `json:"duration_ms,omitempty"` // Duration in milliseconds

	// Business context
	VMID        uint   `json:"vm_id,omitempty"`
	VMName      string `json:"vm_name,omitempty"`
	Action      string `json:"action,omitempty"`      // Business action: create, delete, start, stop, etc.
	Resource    string `json:"resource,omitempty"`    // Resource type: vm, user, snapshot, etc.
	ResourceID  uint   `json:"resource_id,omitempty"` // Resource identifier

	// Security context
	SecurityEvent string `json:"security_event,omitempty"` // security_event: login_failed, rate_limit, etc.
	ThreatLevel   string `json:"threat_level,omitempty"` // threat_level: low, medium, high, critical

	// Performance context
	DBQueryTime  int64 `json:"db_query_time_ms,omitempty"`
	CacheHit     bool  `json:"cache_hit,omitempty"`
	ResponseSize int64 `json:"response_size_bytes,omitempty"`

	// Error context
	ErrorType    string `json:"error_type,omitempty"`    // error_type: validation, database, network, etc.
	ErrorCode    string `json:"error_code,omitempty"`    // error_code: E001, E002, etc.
	ErrorMessage string `json:"error_message,omitempty"` // Sanitized error message

	// System context
	Component    string `json:"component,omitempty"`    // component: api, vm, auth, etc.
	Service      string `json:"service,omitempty"`       // service: limen-backend
	Version      string `json:"version,omitempty"`       // Application version
	Environment  string `json:"environment,omitempty"`   // environment: production, development

	// Timestamp (always included)
	Timestamp time.Time `json:"timestamp"`
}

// WithContext creates a logger with enhanced context.
func WithContext(ctx LogContext) *zap.Logger {
	fields := []zap.Field{
		zap.Time("timestamp", ctx.Timestamp),
	}

	if ctx.RequestID != "" {
		fields = append(fields, zap.String("request_id", ctx.RequestID))
	}
	if ctx.UserID > 0 {
		fields = append(fields, zap.Uint("user_id", ctx.UserID))
	}
	if ctx.Username != "" {
		fields = append(fields, zap.String("username", ctx.Username))
	}
	if ctx.IP != "" {
		fields = append(fields, zap.String("ip", ctx.IP))
	}
	if ctx.UserAgent != "" {
		fields = append(fields, zap.String("user_agent", ctx.UserAgent))
	}
	if ctx.Method != "" {
		fields = append(fields, zap.String("method", ctx.Method))
	}
	if ctx.Path != "" {
		fields = append(fields, zap.String("path", ctx.Path))
	}
	if ctx.StatusCode > 0 {
		fields = append(fields, zap.Int("status_code", ctx.StatusCode))
	}
	if ctx.Duration > 0 {
		fields = append(fields, zap.Int64("duration_ms", ctx.Duration))
	}
	if ctx.VMID > 0 {
		fields = append(fields, zap.Uint("vm_id", ctx.VMID))
	}
	if ctx.VMName != "" {
		fields = append(fields, zap.String("vm_name", ctx.VMName))
	}
	if ctx.Action != "" {
		fields = append(fields, zap.String("action", ctx.Action))
	}
	if ctx.Resource != "" {
		fields = append(fields, zap.String("resource", ctx.Resource))
	}
	if ctx.ResourceID > 0 {
		fields = append(fields, zap.Uint("resource_id", ctx.ResourceID))
	}
	if ctx.SecurityEvent != "" {
		fields = append(fields, zap.String("security_event", ctx.SecurityEvent))
	}
	if ctx.ThreatLevel != "" {
		fields = append(fields, zap.String("threat_level", ctx.ThreatLevel))
	}
	if ctx.DBQueryTime > 0 {
		fields = append(fields, zap.Int64("db_query_time_ms", ctx.DBQueryTime))
	}
	if ctx.CacheHit {
		fields = append(fields, zap.Bool("cache_hit", ctx.CacheHit))
	}
	if ctx.ResponseSize > 0 {
		fields = append(fields, zap.Int64("response_size_bytes", ctx.ResponseSize))
	}
	if ctx.ErrorType != "" {
		fields = append(fields, zap.String("error_type", ctx.ErrorType))
	}
	if ctx.ErrorCode != "" {
		fields = append(fields, zap.String("error_code", ctx.ErrorCode))
	}
	if ctx.ErrorMessage != "" {
		fields = append(fields, zap.String("error_message", ctx.ErrorMessage))
	}
	if ctx.Component != "" {
		fields = append(fields, zap.String("component", ctx.Component))
	}
	if ctx.Service != "" {
		fields = append(fields, zap.String("service", ctx.Service))
	}
	if ctx.Version != "" {
		fields = append(fields, zap.String("version", ctx.Version))
	}
	if ctx.Environment != "" {
		fields = append(fields, zap.String("environment", ctx.Environment))
	}

	return Log.With(fields...)
}

// LogRequest logs an HTTP request with full context.
func LogRequest(ctx LogContext, message string, fields ...zap.Field) {
	if ctx.Timestamp.IsZero() {
		ctx.Timestamp = time.Now()
	}
	WithContext(ctx).Info(message, fields...)
}

// LogResponse logs an HTTP response with full context.
func LogResponse(ctx LogContext, message string, fields ...zap.Field) {
	if ctx.Timestamp.IsZero() {
		ctx.Timestamp = time.Now()
	}
	WithContext(ctx).Info(message, fields...)
}

// LogError logs an error with full context.
func LogError(ctx LogContext, message string, err error, fields ...zap.Field) {
	if ctx.Timestamp.IsZero() {
		ctx.Timestamp = time.Now()
	}
	logger := WithContext(ctx)
	if err != nil {
		fields = append(fields, zap.Error(err))
	}
	logger.Error(message, fields...)
}

// ExtractContextFromRequest extracts logging context from HTTP request.
func ExtractContextFromRequest(r *http.Request, userID uint, username string) LogContext {
	ctx := LogContext{
		Timestamp: time.Now(),
		RequestID: r.Header.Get("X-Request-ID"),
		UserID:    userID,
		Username:  username,
		IP:        GetClientIP(r),
		UserAgent: r.UserAgent(),
		Method:    r.Method,
		Path:      r.URL.Path,
		Service:   "limen-backend",
		Component: "api",
	}

	return ctx
}

// GetClientIP extracts the client IP from the request.
func GetClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (for reverse proxy)
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		return forwarded
	}
	// Check X-Real-IP header
	if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		return realIP
	}
	// Fallback to RemoteAddr
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	return ip
}

