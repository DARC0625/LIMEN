package channels

import (
	"context"
	"testing"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/alerting"
	"go.uber.org/zap/zaptest"
)

func TestNewEmailChannel(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewEmailChannel(
		"smtp.example.com",
		587,
		"user@example.com",
		"password",
		"from@example.com",
		[]string{"to@example.com"},
		logger,
	)

	if channel == nil {
		t.Fatal("NewEmailChannel returned nil")
	}

	if channel.smtpHost != "smtp.example.com" {
		t.Errorf("Expected smtpHost 'smtp.example.com', got '%s'", channel.smtpHost)
	}

	if channel.smtpPort != 587 {
		t.Errorf("Expected smtpPort 587, got %d", channel.smtpPort)
	}

	if len(channel.to) != 1 || channel.to[0] != "to@example.com" {
		t.Errorf("Expected to ['to@example.com'], got %v", channel.to)
	}
}

func TestEmailChannel_Name(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewEmailChannel("", 0, "", "", "", nil, logger)

	if channel.Name() != "email" {
		t.Errorf("Expected name 'email', got '%s'", channel.Name())
	}
}

func TestEmailChannel_Send_NotConfigured(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewEmailChannel("", 0, "", "", "", nil, logger)

	alert := alerting.Alert{
		Title:     "Test Alert",
		Message:   "Test message",
		Severity:  alerting.SeverityInfo,
		Service:   "test-service",
		Component: "test-component",
		Timestamp: time.Now(),
	}

	err := channel.Send(context.Background(), alert)
	if err == nil {
		t.Error("Expected error when email channel is not configured")
	}

	if err.Error() != "email channel not configured" {
		t.Errorf("Expected error 'email channel not configured', got '%s'", err.Error())
	}
}

func TestEmailChannel_Send_EmptyTo(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewEmailChannel("smtp.example.com", 587, "user", "pass", "from@example.com", []string{}, logger)

	alert := alerting.Alert{
		Title:     "Test Alert",
		Message:   "Test message",
		Severity:  alerting.SeverityInfo,
		Service:   "test-service",
		Component: "test-component",
		Timestamp: time.Now(),
	}

	err := channel.Send(context.Background(), alert)
	if err == nil {
		t.Error("Expected error when 'to' list is empty")
	}
}

func TestEmailChannel_Send_WithTagsAndMetadata(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewEmailChannel(
		"smtp.example.com",
		587,
		"user@example.com",
		"password",
		"from@example.com",
		[]string{"to@example.com"},
		logger,
	)

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

	// This will fail because we don't have a real SMTP server, but we can test the error handling
	err := channel.Send(context.Background(), alert)
	if err == nil {
		t.Error("Expected error when sending email (no SMTP server)")
	}

	// Verify the error is about sending email, not configuration
	if err.Error() == "email channel not configured" {
		t.Error("Expected SMTP send error, got configuration error")
	}
}

