package alerting

import (
	"context"
	"testing"
	"time"

	"go.uber.org/zap/zaptest"
)

func TestManager_SetDedupWindow(t *testing.T) {
	logger := zaptest.NewLogger(t)
	manager := NewManager(logger)

	// Test setting deduplication window
	newWindow := 10 * time.Minute
	manager.SetDedupWindow(newWindow)

	if manager.dedupWindow != newWindow {
		t.Errorf("SetDedupWindow() dedupWindow = %v, want %v", manager.dedupWindow, newWindow)
	}
}

func TestManager_ClearDedupCache(t *testing.T) {
	logger := zaptest.NewLogger(t)
	manager := NewManager(logger)

	// Create an alert and send it (will be added to dedup cache)
	alert := Alert{
		Title:     "Test Alert",
		Message:   "Test message",
		Severity:  SeverityInfo,
		Service:   "test-service",
		Component: "test-component",
		Timestamp: time.Now(),
	}

	// Send alert to populate dedup cache
	manager.Send(context.Background(), alert)

	// Verify cache has entry
	manager.dedupMu.Lock()
	cacheSize := len(manager.recentAlerts)
	manager.dedupMu.Unlock()

	if cacheSize == 0 {
		t.Error("Expected dedup cache to have entries after sending alert")
	}

	// Clear cache
	manager.ClearDedupCache()

	// Verify cache is empty
	manager.dedupMu.Lock()
	cacheSizeAfter := len(manager.recentAlerts)
	manager.dedupMu.Unlock()

	if cacheSizeAfter != 0 {
		t.Errorf("Expected dedup cache to be empty after ClearDedupCache(), got %d entries", cacheSizeAfter)
	}
}

func TestManager_Send_Deduplication(t *testing.T) {
	logger := zaptest.NewLogger(t)
	manager := NewManager(logger)

	// Set a short deduplication window for testing
	manager.SetDedupWindow(1 * time.Second)

	alert := Alert{
		Title:     "Test Alert",
		Message:   "Test message",
		Severity:  SeverityInfo,
		Service:   "test-service",
		Component: "test-component",
		Timestamp: time.Now(),
	}

	// Send first alert
	err1 := manager.Send(context.Background(), alert)
	if err1 != nil {
		t.Errorf("First Send() error = %v", err1)
	}

	// Send duplicate alert immediately (should be deduplicated)
	err2 := manager.Send(context.Background(), alert)
	if err2 != nil {
		t.Errorf("Second Send() error = %v", err2)
	}

	// Wait for deduplication window to expire
	time.Sleep(2 * time.Second)

	// Send alert again after window expires (should not be deduplicated)
	err3 := manager.Send(context.Background(), alert)
	if err3 != nil {
		t.Errorf("Third Send() after window expired error = %v", err3)
	}
}

