package alerting

import (
	"context"
	"testing"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func setupTestLogger(t *testing.T) *zap.Logger {
	config := zap.NewDevelopmentConfig()
	config.Level = zap.NewAtomicLevelAt(zapcore.DebugLevel)
	logger, err := config.Build()
	if err != nil {
		t.Fatalf("Failed to create test logger: %v", err)
	}
	return logger
}

func TestNewManager(t *testing.T) {
	logger := setupTestLogger(t)
	manager := NewManager(logger)
	
	if manager == nil {
		t.Error("NewManager() returned nil")
	}
	if manager.logger == nil {
		t.Error("NewManager() logger is nil")
	}
	if manager.channels == nil {
		t.Error("NewManager() channels is nil")
	}
	if manager.dedupWindow == 0 {
		t.Error("NewManager() dedupWindow should be > 0")
	}
}

func TestManager_RegisterChannel(t *testing.T) {
	logger := setupTestLogger(t)
	manager := NewManager(logger)
	
	// Create a mock channel
	mockChannel := &mockChannel{name: "test-channel"}
	manager.RegisterChannel(mockChannel)
	
	if len(manager.channels) != 1 {
		t.Errorf("RegisterChannel() channels length = %d, want 1", len(manager.channels))
	}
}

func TestManager_SendAlert(t *testing.T) {
	logger := setupTestLogger(t)
	manager := NewManager(logger)
	
	// Create a mock channel
	mockChannel := &mockChannel{name: "test-channel"}
	manager.RegisterChannel(mockChannel)
	
	ctx := context.Background()
	err := manager.SendAlert(ctx, "Test Alert", "Test message", "info", "test-service", "test-component", nil, nil)
	if err != nil {
		t.Errorf("SendAlert() error = %v", err)
	}
}

func TestManager_Send(t *testing.T) {
	logger := setupTestLogger(t)
	manager := NewManager(logger)
	
	// Create a mock channel
	mockChannel := &mockChannel{name: "test-channel"}
	manager.RegisterChannel(mockChannel)
	
	alert := Alert{
		Title:     "Test Alert",
		Message:   "Test message",
		Severity:  SeverityInfo,
		Service:   "test-service",
		Component: "test-component",
		Timestamp: time.Now(),
	}
	
	ctx := context.Background()
	err := manager.Send(ctx, alert)
	if err != nil {
		t.Errorf("Send() error = %v", err)
	}
}

func TestManager_Deduplication(t *testing.T) {
	logger := setupTestLogger(t)
	manager := NewManager(logger)
	
	// Create a mock channel
	mockChannel := &mockChannel{name: "test-channel"}
	manager.RegisterChannel(mockChannel)
	
	alert := Alert{
		Title:     "Duplicate Alert",
		Message:   "Test message",
		Severity:  SeverityInfo,
		Service:   "test-service",
		Component: "test-component",
		Timestamp: time.Now(),
	}
	
	ctx := context.Background()
	
	// Send first alert
	err := manager.Send(ctx, alert)
	if err != nil {
		t.Errorf("Send() error = %v", err)
	}
	
	// Send duplicate alert (should be deduplicated)
	err = manager.Send(ctx, alert)
	if err != nil {
		t.Errorf("Send() error = %v", err)
	}
	
	// Mock channel should only receive one alert
	if mockChannel.sendCount != 1 {
		t.Errorf("Deduplication failed: sendCount = %d, want 1", mockChannel.sendCount)
	}
}

func TestManager_SendAlert_WithMetadata(t *testing.T) {
	logger := setupTestLogger(t)
	manager := NewManager(logger)
	
	// Create a mock channel
	mockChannel := &mockChannel{name: "test-channel"}
	manager.RegisterChannel(mockChannel)
	
	metadata := map[string]interface{}{
		"key1": "value1",
		"key2": 123,
	}
	tags := []string{"tag1", "tag2"}
	
	ctx := context.Background()
	err := manager.SendAlert(ctx, "Test Alert", "Test message", "warning", "test-service", "test-component", metadata, tags)
	if err != nil {
		t.Errorf("SendAlert() error = %v", err)
	}
}

// mockChannel is a test implementation of Channel interface
type mockChannel struct {
	name      string
	sendCount int
	lastAlert Alert
}

func (m *mockChannel) Send(ctx context.Context, alert Alert) error {
	m.sendCount++
	m.lastAlert = alert
	return nil
}

func (m *mockChannel) Name() string {
	return m.name
}

