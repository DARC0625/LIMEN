package logger

import (
	"testing"
	"time"
)

func TestLogEvent(t *testing.T) {
	Init("debug")

	tests := []struct {
		name      string
		eventType EventType
		logCtx    LogContext
	}{
		{"VM event", EventVMCreate, LogContext{Component: "vm", Service: "limen-backend", Timestamp: time.Now()}},
		{"User event", EventUserLogin, LogContext{Component: "auth", Service: "limen-backend", Timestamp: time.Now()}},
		{"Security event", EventSecurityLoginFailed, LogContext{Component: "security", Service: "limen-backend", Timestamp: time.Now()}},
		{"Performance event", EventPerformanceSlowQuery, LogContext{Component: "database", Service: "limen-backend", Timestamp: time.Now()}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			LogEvent(tt.eventType, tt.logCtx, "test message")
			// Should not panic
		})
	}
}

func TestLogVMEvent(t *testing.T) {
	Init("debug")

	logCtx := LogContext{
		Timestamp: time.Now(),
		Component: "vm",
		Service:   "limen-backend",
	}
	LogVMEvent(EventVMCreate, logCtx, 1, "test-vm", "VM created")
	// Should not panic
}

func TestLogUserEvent(t *testing.T) {
	Init("debug")

	logCtx := LogContext{
		Timestamp: time.Now(),
		Component: "auth",
		Service:   "limen-backend",
	}
	LogUserEvent(EventUserLogin, logCtx, 1, "admin", "User logged in")
	// Should not panic
}

func TestLogSecurityEvent(t *testing.T) {
	Init("debug")

	logCtx := LogContext{
		Timestamp: time.Now(),
		Component: "security",
		Service:   "limen-backend",
	}
	LogSecurityEvent(EventSecurityLoginFailed, logCtx, "medium", "Unauthorized access attempt")
	// Should not panic
}

func TestLogPerformanceEvent(t *testing.T) {
	Init("debug")

	logCtx := LogContext{
		Timestamp: time.Now(),
		Component: "database",
		Service:   "limen-backend",
	}
	LogPerformanceEvent(EventPerformanceSlowQuery, logCtx, "database", 5000, "SELECT query took 5s")
	// Should not panic
}

func TestIsSecurityEvent(t *testing.T) {
	tests := []struct {
		name      string
		eventType EventType
		expected  bool
	}{
		{"security event", EventSecurityLoginFailed, true},
		{"non-security event", EventVMCreate, false},
		{"user event", EventUserLogin, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isSecurityEvent(tt.eventType)
			if result != tt.expected {
				t.Errorf("isSecurityEvent(%v) = %v, want %v", tt.eventType, result, tt.expected)
			}
		})
	}
}

func TestIsErrorEvent(t *testing.T) {
	// Note: There's no error event type defined, so this will always return false
	// But we can test the function exists and works
	tests := []struct {
		name      string
		eventType EventType
		expected  bool
	}{
		{"non-error event", EventVMCreate, false},
		{"user event", EventUserLogin, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isErrorEvent(tt.eventType)
			if result != tt.expected {
				t.Errorf("isErrorEvent(%v) = %v, want %v", tt.eventType, result, tt.expected)
			}
		})
	}
}

func TestIsPerformanceEvent(t *testing.T) {
	tests := []struct {
		name      string
		eventType EventType
		expected  bool
	}{
		{"performance event", EventPerformanceSlowQuery, true},
		{"non-performance event", EventVMCreate, false},
		{"user event", EventUserLogin, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isPerformanceEvent(tt.eventType)
			if result != tt.expected {
				t.Errorf("isPerformanceEvent(%v) = %v, want %v", tt.eventType, result, tt.expected)
			}
		})
	}
}
