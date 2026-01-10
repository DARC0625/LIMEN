package channels

import (
	"context"
	"testing"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/alerting"
	"go.uber.org/zap/zaptest"
)

func TestNewLogChannel(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewLogChannel(logger)

	if channel == nil {
		t.Fatal("NewLogChannel returned nil")
	}

	if channel.logger == nil {
		t.Error("LogChannel logger is nil")
	}
}

func TestLogChannel_Name(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewLogChannel(logger)

	if channel.Name() != "log" {
		t.Errorf("Expected name 'log', got '%s'", channel.Name())
	}
}

func TestLogChannel_Send_Info(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewLogChannel(logger)

	alert := alerting.Alert{
		Title:     "Test Alert",
		Message:   "Test message",
		Severity:  alerting.SeverityInfo,
		Service:   "test-service",
		Component: "test-component",
		Timestamp: time.Now(),
	}

	err := channel.Send(context.Background(), alert)
	if err != nil {
		t.Errorf("Send returned error: %v", err)
	}
}

func TestLogChannel_Send_Warning(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewLogChannel(logger)

	alert := alerting.Alert{
		Title:     "Test Alert",
		Message:   "Test message",
		Severity:  alerting.SeverityWarning,
		Service:   "test-service",
		Component: "test-component",
		Timestamp: time.Now(),
	}

	err := channel.Send(context.Background(), alert)
	if err != nil {
		t.Errorf("Send returned error: %v", err)
	}
}

func TestLogChannel_Send_Error(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewLogChannel(logger)

	alert := alerting.Alert{
		Title:     "Test Alert",
		Message:   "Test message",
		Severity:  alerting.SeverityError,
		Service:   "test-service",
		Component: "test-component",
		Timestamp: time.Now(),
	}

	err := channel.Send(context.Background(), alert)
	if err != nil {
		t.Errorf("Send returned error: %v", err)
	}
}

func TestLogChannel_Send_Critical(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewLogChannel(logger)

	alert := alerting.Alert{
		Title:     "Test Alert",
		Message:   "Test message",
		Severity:  alerting.SeverityCritical,
		Service:   "test-service",
		Component: "test-component",
		Timestamp: time.Now(),
	}

	err := channel.Send(context.Background(), alert)
	if err != nil {
		t.Errorf("Send returned error: %v", err)
	}
}

func TestLogChannel_Send_WithTags(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewLogChannel(logger)

	alert := alerting.Alert{
		Title:     "Test Alert",
		Message:   "Test message",
		Severity:  alerting.SeverityInfo,
		Service:   "test-service",
		Component: "test-component",
		Timestamp: time.Now(),
		Tags:      []string{"tag1", "tag2"},
	}

	err := channel.Send(context.Background(), alert)
	if err != nil {
		t.Errorf("Send returned error: %v", err)
	}
}

func TestLogChannel_Send_WithMetadata(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewLogChannel(logger)

	alert := alerting.Alert{
		Title:     "Test Alert",
		Message:   "Test message",
		Severity:  alerting.SeverityInfo,
		Service:   "test-service",
		Component: "test-component",
		Timestamp: time.Now(),
		Metadata: map[string]interface{}{
			"key1": "value1",
			"key2": 123,
			"key3": true,
		},
	}

	err := channel.Send(context.Background(), alert)
	if err != nil {
		t.Errorf("Send returned error: %v", err)
	}
}

func TestLogChannel_Send_WithTagsAndMetadata(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewLogChannel(logger)

	alert := alerting.Alert{
		Title:     "Test Alert",
		Message:   "Test message",
		Severity:  alerting.SeverityWarning,
		Service:   "test-service",
		Component: "test-component",
		Timestamp: time.Now(),
		Tags:      []string{"tag1", "tag2"},
		Metadata: map[string]interface{}{
			"key1": "value1",
			"key2": 123,
		},
	}

	err := channel.Send(context.Background(), alert)
	if err != nil {
		t.Errorf("Send returned error: %v", err)
	}
}
