package channels

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/alerting"
	"go.uber.org/zap"
)

// WebhookChannel sends alerts to a webhook URL (e.g., Slack, Discord).
type WebhookChannel struct {
	url     string
	client  *http.Client
	logger  *zap.Logger
	timeout time.Duration
}

// WebhookPayload represents the payload sent to webhook.
type WebhookPayload struct {
	Title     string                 `json:"title"`
	Message   string                 `json:"message"`
	Severity  string                 `json:"severity"`
	Service   string                 `json:"service"`
	Component string                 `json:"component"`
	Timestamp string                 `json:"timestamp"`
	Tags      []string               `json:"tags,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// NewWebhookChannel creates a new webhook channel.
func NewWebhookChannel(url string, logger *zap.Logger) *WebhookChannel {
	return &WebhookChannel{
		url:     url,
		logger:  logger,
		timeout: 10 * time.Second,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SetTimeout sets the HTTP client timeout.
func (c *WebhookChannel) SetTimeout(timeout time.Duration) {
	c.timeout = timeout
	c.client.Timeout = timeout
}

// Name returns the channel name.
func (c *WebhookChannel) Name() string {
	return "webhook"
}

// Send sends an alert to the webhook URL.
func (c *WebhookChannel) Send(ctx context.Context, alert alerting.Alert) error {
	if c.url == "" {
		return fmt.Errorf("webhook URL not configured")
	}

	payload := WebhookPayload{
		Title:     alert.Title,
		Message:   alert.Message,
		Severity:  string(alert.Severity),
		Service:   alert.Service,
		Component: alert.Component,
		Timestamp: alert.Timestamp.Format(time.RFC3339),
		Tags:      alert.Tags,
		Metadata:  alert.Metadata,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}

	c.logger.Debug("Alert sent to webhook",
		zap.String("url", c.url),
		zap.String("title", alert.Title))

	return nil
}




