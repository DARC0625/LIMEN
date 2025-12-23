// Package alerting provides alerting functionality for LIMEN.
package alerting

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Severity represents the severity level of an alert.
type Severity string

const (
	SeverityInfo     Severity = "info"
	SeverityWarning  Severity = "warning"
	SeverityError    Severity = "error"
	SeverityCritical Severity = "critical"
)

// Alert represents an alert notification.
type Alert struct {
	Title       string
	Message     string
	Severity    Severity
	Service     string
	Component   string
	Timestamp   time.Time
	Metadata    map[string]interface{}
	Tags        []string
}

// Channel defines the interface for alert channels.
type Channel interface {
	Send(ctx context.Context, alert Alert) error
	Name() string
}

// Manager manages alert channels and routing.
type Manager struct {
	channels []Channel
	logger   *zap.Logger
	mu       sync.RWMutex
	
	// Deduplication: prevent duplicate alerts within time window
	dedupWindow time.Duration
	recentAlerts map[string]time.Time
	dedupMu      sync.Mutex
}

// SendAlert sends an alert with individual parameters (for middleware compatibility).
func (m *Manager) SendAlert(ctx context.Context, title, message, severity, service, component string, metadata map[string]interface{}, tags []string) error {
	alert := Alert{
		Title:     title,
		Message:   message,
		Severity:  Severity(severity),
		Service:   service,
		Component: component,
		Metadata:  metadata,
		Tags:      tags,
	}
	return m.Send(ctx, alert)
}

// NewManager creates a new alert manager.
func NewManager(logger *zap.Logger) *Manager {
	return &Manager{
		channels:    make([]Channel, 0),
		logger:      logger,
		dedupWindow: 5 * time.Minute, // Default: 5 minutes deduplication window
		recentAlerts: make(map[string]time.Time),
	}
}

// RegisterChannel registers an alert channel.
func (m *Manager) RegisterChannel(channel Channel) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.channels = append(m.channels, channel)
	m.logger.Info("Alert channel registered", zap.String("channel", channel.Name()))
}

// Send sends an alert to all registered channels.
func (m *Manager) Send(ctx context.Context, alert Alert) error {
	if alert.Timestamp.IsZero() {
		alert.Timestamp = time.Now()
	}
	
	// Deduplication check
	if m.isDuplicate(alert) {
		m.logger.Debug("Alert deduplicated", 
			zap.String("title", alert.Title),
			zap.String("severity", string(alert.Severity)))
		return nil
	}
	
	m.mu.RLock()
	channels := make([]Channel, len(m.channels))
	copy(channels, m.channels)
	m.mu.RUnlock()
	
	// Send to all channels in parallel
	var wg sync.WaitGroup
	errors := make(chan error, len(channels))
	
	for _, channel := range channels {
		wg.Add(1)
		go func(ch Channel) {
			defer wg.Done()
			if err := ch.Send(ctx, alert); err != nil {
				m.logger.Error("Failed to send alert",
					zap.String("channel", ch.Name()),
					zap.Error(err))
				errors <- err
			}
		}(channel)
	}
	
	wg.Wait()
	close(errors)
	
	// Check for errors
	hasError := false
	for err := range errors {
		if err != nil {
			hasError = true
		}
	}
	
	if hasError {
		return fmt.Errorf("some alert channels failed")
	}
	
	return nil
}

// isDuplicate checks if an alert is a duplicate within the deduplication window.
func (m *Manager) isDuplicate(alert Alert) bool {
	m.dedupMu.Lock()
	defer m.dedupMu.Unlock()
	
	// Create deduplication key from title and component
	key := fmt.Sprintf("%s:%s:%s", alert.Service, alert.Component, alert.Title)
	
	lastSent, exists := m.recentAlerts[key]
	if !exists {
		m.recentAlerts[key] = alert.Timestamp
		return false
	}
	
	// Check if within deduplication window
	if time.Since(lastSent) < m.dedupWindow {
		return true
	}
	
	// Update timestamp
	m.recentAlerts[key] = alert.Timestamp
	return false
}

// SetDedupWindow sets the deduplication time window.
func (m *Manager) SetDedupWindow(duration time.Duration) {
	m.dedupMu.Lock()
	defer m.dedupMu.Unlock()
	m.dedupWindow = duration
}

// ClearDedupCache clears the deduplication cache (useful for testing).
func (m *Manager) ClearDedupCache() {
	m.dedupMu.Lock()
	defer m.dedupMu.Unlock()
	m.recentAlerts = make(map[string]time.Time)
}

