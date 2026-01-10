package channels

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/alerting"
	"go.uber.org/zap/zaptest"
)

func TestNewWebhookChannel(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewWebhookChannel("https://example.com/webhook", logger)

	if channel == nil {
		t.Fatal("NewWebhookChannel returned nil")
	}

	if channel.url != "https://example.com/webhook" {
		t.Errorf("Expected url 'https://example.com/webhook', got '%s'", channel.url)
	}

	if channel.timeout != 10*time.Second {
		t.Errorf("Expected timeout 10s, got %v", channel.timeout)
	}

	if channel.client == nil {
		t.Error("WebhookChannel client is nil")
	}
}

func TestWebhookChannel_SetTimeout(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewWebhookChannel("https://example.com/webhook", logger)

	newTimeout := 5 * time.Second
	channel.SetTimeout(newTimeout)

	if channel.timeout != newTimeout {
		t.Errorf("Expected timeout %v, got %v", newTimeout, channel.timeout)
	}

	if channel.client.Timeout != newTimeout {
		t.Errorf("Expected client timeout %v, got %v", newTimeout, channel.client.Timeout)
	}
}

func TestWebhookChannel_Name(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewWebhookChannel("https://example.com/webhook", logger)

	if channel.Name() != "webhook" {
		t.Errorf("Expected name 'webhook', got '%s'", channel.Name())
	}
}

func TestWebhookChannel_Send_NotConfigured(t *testing.T) {
	logger := zaptest.NewLogger(t)
	channel := NewWebhookChannel("", logger)

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
		t.Error("Expected error when webhook URL is not configured")
	}

	if err.Error() != "webhook URL not configured" {
		t.Errorf("Expected error 'webhook URL not configured', got '%s'", err.Error())
	}
}

func TestWebhookChannel_Send_Success(t *testing.T) {
	logger := zaptest.NewLogger(t)

	// Create a test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("Expected POST method, got %s", r.Method)
		}

		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Expected Content-Type 'application/json', got '%s'", r.Header.Get("Content-Type"))
		}

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	channel := NewWebhookChannel(server.URL, logger)

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

func TestWebhookChannel_Send_WithTags(t *testing.T) {
	logger := zaptest.NewLogger(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	channel := NewWebhookChannel(server.URL, logger)

	alert := alerting.Alert{
		Title:     "Test Alert",
		Message:   "Test message",
		Severity:  alerting.SeverityWarning,
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

func TestWebhookChannel_Send_WithMetadata(t *testing.T) {
	logger := zaptest.NewLogger(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	channel := NewWebhookChannel(server.URL, logger)

	alert := alerting.Alert{
		Title:     "Test Alert",
		Message:   "Test message",
		Severity:  alerting.SeverityError,
		Service:   "test-service",
		Component: "test-component",
		Timestamp: time.Now(),
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

func TestWebhookChannel_Send_ErrorStatus(t *testing.T) {
	logger := zaptest.NewLogger(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	channel := NewWebhookChannel(server.URL, logger)

	alert := alerting.Alert{
		Title:     "Test Alert",
		Message:   "Test message",
		Severity:  alerting.SeverityCritical,
		Service:   "test-service",
		Component: "test-component",
		Timestamp: time.Now(),
	}

	err := channel.Send(context.Background(), alert)
	if err == nil {
		t.Error("Expected error when webhook returns error status")
	}

	if err.Error() != "webhook returned status 500" {
		t.Errorf("Expected error 'webhook returned status 500', got '%s'", err.Error())
	}
}

func TestWebhookChannel_Send_ContextTimeout(t *testing.T) {
	logger := zaptest.NewLogger(t)

	// Create a server that delays response
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(2 * time.Second)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	channel := NewWebhookChannel(server.URL, logger)
	channel.SetTimeout(100 * time.Millisecond) // Set short timeout

	alert := alerting.Alert{
		Title:     "Test Alert",
		Message:   "Test message",
		Severity:  alerting.SeverityInfo,
		Service:   "test-service",
		Component: "test-component",
		Timestamp: time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	err := channel.Send(ctx, alert)
	if err == nil {
		t.Error("Expected error when context times out")
	}
}
