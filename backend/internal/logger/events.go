// Package logger provides standardized event logging for business logic.
// All business events are logged with consistent structure for machine analysis.
package logger

import (
	"time"

	"go.uber.org/zap"
)

// EventType represents the type of business event.
type EventType string

const (
	// VM Events
	EventVMCreate   EventType = "vm.create"
	EventVMStart    EventType = "vm.start"
	EventVMStop     EventType = "vm.stop"
	EventVMDelete   EventType = "vm.delete"
	EventVMUpdate   EventType = "vm.update"
	EventVMSnapshot EventType = "vm.snapshot"
	EventVMRestore  EventType = "vm.restore"
	EventVMResize   EventType = "vm.resize"

	// User Events
	EventUserCreate     EventType = "user.create"
	EventUserUpdate     EventType = "user.update"
	EventUserDelete     EventType = "user.delete"
	EventUserLogin      EventType = "user.login"
	EventUserLogout     EventType = "user.logout"
	EventUserApprove    EventType = "user.approve"
	EventUserRoleChange EventType = "user.role_change"

	// Security Events
	EventSecurityLoginFailed    EventType = "security.login_failed"
	EventSecurityRateLimit      EventType = "security.rate_limit"
	EventSecurityIPBlocked      EventType = "security.ip_blocked"
	EventSecurityUnauthorized   EventType = "security.unauthorized"
	EventSecurityPasswordChange EventType = "security.password_change"

	// System Events
	EventSystemStartup      EventType = "system.startup"
	EventSystemShutdown     EventType = "system.shutdown"
	EventSystemConfigChange EventType = "system.config_change"
	EventSystemBackup       EventType = "system.backup"
	EventSystemRestore      EventType = "system.restore"

	// Performance Events
	EventPerformanceSlowQuery EventType = "performance.slow_query"
	EventPerformanceHighLoad  EventType = "performance.high_load"
	EventPerformanceCacheMiss EventType = "performance.cache_miss"
)

// LogEvent logs a business event with full context.
func LogEvent(eventType EventType, logCtx LogContext, message string, fields ...zap.Field) {
	if logCtx.Timestamp.IsZero() {
		logCtx.Timestamp = time.Now()
	}

	// Add event type to context
	allFields := []zap.Field{
		zap.String("event_type", string(eventType)),
		zap.Time("timestamp", logCtx.Timestamp),
	}

	// Add context fields
	if logCtx.RequestID != "" {
		allFields = append(allFields, zap.String("request_id", logCtx.RequestID))
	}
	if logCtx.UserID > 0 {
		allFields = append(allFields, zap.Uint("user_id", logCtx.UserID))
	}
	if logCtx.Username != "" {
		allFields = append(allFields, zap.String("username", logCtx.Username))
	}
	if logCtx.IP != "" {
		allFields = append(allFields, zap.String("ip", logCtx.IP))
	}
	if logCtx.VMID > 0 {
		allFields = append(allFields, zap.Uint("vm_id", logCtx.VMID))
	}
	if logCtx.VMName != "" {
		allFields = append(allFields, zap.String("vm_name", logCtx.VMName))
	}
	if logCtx.Action != "" {
		allFields = append(allFields, zap.String("action", logCtx.Action))
	}
	if logCtx.Resource != "" {
		allFields = append(allFields, zap.String("resource", logCtx.Resource))
	}
	if logCtx.ResourceID > 0 {
		allFields = append(allFields, zap.Uint("resource_id", logCtx.ResourceID))
	}
	if logCtx.Duration > 0 {
		allFields = append(allFields, zap.Int64("duration_ms", logCtx.Duration))
	}
	if logCtx.ErrorType != "" {
		allFields = append(allFields, zap.String("error_type", logCtx.ErrorType))
	}
	if logCtx.ErrorCode != "" {
		allFields = append(allFields, zap.String("error_code", logCtx.ErrorCode))
	}
	if logCtx.Component != "" {
		allFields = append(allFields, zap.String("component", logCtx.Component))
	}
	if logCtx.Service != "" {
		allFields = append(allFields, zap.String("service", logCtx.Service))
	}

	// Add custom fields
	allFields = append(allFields, fields...)

	// Determine log level based on event type
	switch {
	case isSecurityEvent(eventType):
		Log.Warn(message, allFields...)
	case isErrorEvent(eventType):
		Log.Error(message, allFields...)
	case isPerformanceEvent(eventType):
		Log.Warn(message, allFields...)
	default:
		Log.Info(message, allFields...)
	}
}

// isSecurityEvent checks if event is security-related.
func isSecurityEvent(eventType EventType) bool {
	return len(eventType) > 9 && eventType[:9] == "security."
}

// isErrorEvent checks if event is error-related.
func isErrorEvent(eventType EventType) bool {
	return len(eventType) > 6 && eventType[:6] == "error."
}

// isPerformanceEvent checks if event is performance-related.
func isPerformanceEvent(eventType EventType) bool {
	return len(eventType) > 12 && eventType[:12] == "performance."
}

// LogVMEvent logs a VM-related event.
func LogVMEvent(eventType EventType, logCtx LogContext, vmID uint, vmName string, message string, fields ...zap.Field) {
	logCtx.VMID = vmID
	logCtx.VMName = vmName
	logCtx.Resource = "vm"
	logCtx.ResourceID = vmID
	LogEvent(eventType, logCtx, message, fields...)
}

// LogUserEvent logs a user-related event.
func LogUserEvent(eventType EventType, logCtx LogContext, userID uint, username string, message string, fields ...zap.Field) {
	logCtx.UserID = userID
	logCtx.Username = username
	logCtx.Resource = "user"
	logCtx.ResourceID = userID
	LogEvent(eventType, logCtx, message, fields...)
}

// LogSecurityEvent logs a security-related event.
func LogSecurityEvent(eventType EventType, logCtx LogContext, threatLevel string, message string, fields ...zap.Field) {
	logCtx.SecurityEvent = string(eventType)
	logCtx.ThreatLevel = threatLevel
	logCtx.Resource = "security"
	LogEvent(eventType, logCtx, message, fields...)
}

// LogPerformanceEvent logs a performance-related event.
func LogPerformanceEvent(eventType EventType, logCtx LogContext, component string, duration int64, message string, fields ...zap.Field) {
	logCtx.Component = component
	logCtx.Duration = duration
	logCtx.Resource = "performance"
	LogEvent(eventType, logCtx, message, fields...)
}


