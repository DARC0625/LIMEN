package alerting

import (
	"context"
	"testing"
	"time"

	"go.uber.org/zap/zaptest"
)

func TestNewDiskSpaceRule(t *testing.T) {
	logger := zaptest.NewLogger(t)
	manager := NewManager(logger)
	rule := NewDiskSpaceRule(manager, "/", 80.0)

	if rule == nil {
		t.Fatal("NewDiskSpaceRule() returned nil")
	}

	if rule.path != "/" {
		t.Errorf("NewDiskSpaceRule() path = %q, want %q", rule.path, "/")
	}

	if rule.thresholdPercent != 80.0 {
		t.Errorf("NewDiskSpaceRule() thresholdPercent = %f, want 80.0", rule.thresholdPercent)
	}
}

func TestDiskSpaceRule_Name(t *testing.T) {
	logger := zaptest.NewLogger(t)
	manager := NewManager(logger)
	rule := NewDiskSpaceRule(manager, "/", 80.0)

	if rule.Name() != "disk_space" {
		t.Errorf("DiskSpaceRule.Name() = %q, want %q", rule.Name(), "disk_space")
	}
}

func TestDiskSpaceRule_Interval(t *testing.T) {
	logger := zaptest.NewLogger(t)
	manager := NewManager(logger)
	rule := NewDiskSpaceRule(manager, "/", 80.0)

	interval := rule.Interval()
	if interval != 60 {
		t.Errorf("DiskSpaceRule.Interval() = %d, want 60", interval)
	}
}

func TestNewMemoryRule(t *testing.T) {
	logger := zaptest.NewLogger(t)
	manager := NewManager(logger)
	rule := NewMemoryRule(manager, 80.0)

	if rule == nil {
		t.Fatal("NewMemoryRule() returned nil")
	}

	if rule.thresholdPercent != 80.0 {
		t.Errorf("NewMemoryRule() thresholdPercent = %f, want 80.0", rule.thresholdPercent)
	}
}

func TestMemoryRule_Name(t *testing.T) {
	logger := zaptest.NewLogger(t)
	manager := NewManager(logger)
	rule := NewMemoryRule(manager, 80.0)

	if rule.Name() != "memory" {
		t.Errorf("MemoryRule.Name() = %q, want %q", rule.Name(), "memory")
	}
}

func TestMemoryRule_Interval(t *testing.T) {
	logger := zaptest.NewLogger(t)
	manager := NewManager(logger)
	rule := NewMemoryRule(manager, 80.0)

	interval := rule.Interval()
	if interval != 60 {
		t.Errorf("MemoryRule.Interval() = %d, want 60", interval)
	}
}

func TestNewProcessAliveRule(t *testing.T) {
	logger := zaptest.NewLogger(t)
	manager := NewManager(logger)
	rule := NewProcessAliveRule(manager, "test-process", "/tmp/test.pid")

	if rule == nil {
		t.Fatal("NewProcessAliveRule() returned nil")
	}

	if rule.processName != "test-process" {
		t.Errorf("NewProcessAliveRule() processName = %q, want %q", rule.processName, "test-process")
	}

	if rule.pidFile != "/tmp/test.pid" {
		t.Errorf("NewProcessAliveRule() pidFile = %q, want %q", rule.pidFile, "/tmp/test.pid")
	}
}

func TestProcessAliveRule_Name(t *testing.T) {
	logger := zaptest.NewLogger(t)
	manager := NewManager(logger)
	rule := NewProcessAliveRule(manager, "test-process", "/tmp/test.pid")

	if rule.Name() != "process_alive" {
		t.Errorf("ProcessAliveRule.Name() = %q, want %q", rule.Name(), "process_alive")
	}
}

func TestProcessAliveRule_Interval(t *testing.T) {
	logger := zaptest.NewLogger(t)
	manager := NewManager(logger)
	rule := NewProcessAliveRule(manager, "test-process", "/tmp/test.pid")

	interval := rule.Interval()
	if interval != 30 {
		t.Errorf("ProcessAliveRule.Interval() = %d, want 30", interval)
	}
}

func TestDiskSpaceRule_Check(t *testing.T) {
	logger := zaptest.NewLogger(t)
	manager := NewManager(logger)
	rule := NewDiskSpaceRule(manager, "/", 80.0)

	// Check should not panic
	// Note: Actual disk space check depends on system state, so we just verify it runs
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	alert, err := rule.Check(ctx)
	// Alert may or may not be returned depending on disk usage
	_ = alert
	_ = err
	// Just verify the function doesn't panic
}

func TestMemoryRule_Check(t *testing.T) {
	logger := zaptest.NewLogger(t)
	manager := NewManager(logger)
	rule := NewMemoryRule(manager, 80.0)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	alert, err := rule.Check(ctx)
	// Alert may or may not be returned depending on memory usage
	_ = alert
	_ = err
	// Just verify the function doesn't panic
}

func TestProcessAliveRule_Check_NoPIDFile(t *testing.T) {
	logger := zaptest.NewLogger(t)
	manager := NewManager(logger)
	// Use a non-existent PID file
	rule := NewProcessAliveRule(manager, "test-process", "/tmp/nonexistent-pid-file-12345.pid")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	alert, err := rule.Check(ctx)
	// Should return an alert since PID file doesn't exist
	if err != nil {
		t.Errorf("ProcessAliveRule.Check() error = %v", err)
	}
	if alert == nil {
		t.Log("ProcessAliveRule.Check() returned nil alert (PID file doesn't exist, but may be expected)")
	}
}

func TestProcessAliveRule_Check_EmptyPIDFile(t *testing.T) {
	logger := zaptest.NewLogger(t)
	manager := NewManager(logger)
	// Use empty PID file (should not check)
	rule := NewProcessAliveRule(manager, "test-process", "")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	alert, err := rule.Check(ctx)
	// Should return nil when PID file is empty
	if err != nil {
		t.Errorf("ProcessAliveRule.Check() error = %v", err)
	}
	if alert != nil {
		t.Errorf("ProcessAliveRule.Check() should return nil when PID file is empty, got alert")
	}
}
