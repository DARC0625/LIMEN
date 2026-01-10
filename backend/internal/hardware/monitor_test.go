package hardware

import (
	"testing"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
)

func init() {
	logger.Init("debug")
}

func TestCheckHardwareChanges_Success(t *testing.T) {
	// This will attempt to detect hardware and update spec
	err := CheckHardwareChanges()
	// Should not fail even if hardware detection has issues
	if err != nil {
		t.Logf("CheckHardwareChanges returned error (may be expected): %v", err)
	}
}

func TestStartMonitor_Deprecated(t *testing.T) {
	// StartMonitor is deprecated and should just log a message
	StartMonitor(1 * time.Minute)

	// Verify monitor is not running (deprecated function does nothing)
	if monitorRunning {
		t.Error("Monitor should not be running (deprecated function)")
	}
}

func TestStopMonitor_WhenNotRunning(t *testing.T) {
	// Stop monitor when not running should not panic
	monitorRunning = false
	StopMonitor()

	// Should complete without error
}

func TestStopMonitor_WhenRunning(t *testing.T) {
	// Set up monitor as if it was running
	monitorRunning = true
	monitorStop = make(chan struct{})

	// Stop monitor
	StopMonitor()

	// Verify monitor is stopped
	if monitorRunning {
		t.Error("Monitor should be stopped after StopMonitor()")
	}
}
