// Package hardware provides hardware monitoring and automatic re-detection.
package hardware

import (
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"go.uber.org/zap"
)

var (
	monitorRunning bool
	monitorStop    chan struct{}
)

// CheckHardwareChanges checks for hardware changes and updates security configuration if needed.
// Event-driven: Called on-demand when hardware check is needed (e.g., server startup, manual trigger).
func CheckHardwareChanges() error {
	// Detect and update hardware specification
	newSpec, err := UpdateSpec()
	if err != nil {
		return err
	}

	// Get current spec for comparison
	oldSpec := GetCurrentSpec()
	if oldSpec != nil && oldSpec.Hash != newSpec.Hash {
		logger.Log.Info("Hardware specification changed - security configuration updated",
			zap.String("old_hash", oldSpec.Hash),
			zap.String("new_hash", newSpec.Hash),
			zap.String("cpu", newSpec.CPU.Model),
			zap.Int("cores", newSpec.CPU.Cores),
			zap.Float64("memory_gb", newSpec.Memory.TotalGB),
		)

		// Update security configuration
		secConfig := GetOptimalSecurityConfig()
		logger.Log.Info("Security configuration re-optimized",
			zap.String("encryption", secConfig.PreferredEncryption),
			zap.Uint32("argon2id_memory_kb", secConfig.Argon2idConfig.Memory),
			zap.Uint32("argon2id_iterations", secConfig.Argon2idConfig.Iterations),
			zap.Uint8("argon2id_parallelism", secConfig.Argon2idConfig.Parallelism),
			zap.Bool("hardware_rng", secConfig.UseHardwareRNG),
			zap.Bool("hardware_accel", secConfig.EnableHardwareAccel),
		)

		// Validate hardware security
		warnings := ValidateHardwareSecurity()
		for _, warning := range warnings {
			logger.Log.Warn("Hardware security warning", zap.String("warning", warning))
		}
	}

	return nil
}

// StartMonitor is deprecated - use CheckHardwareChanges() for event-driven checks.
// Kept for backward compatibility but does nothing (event-driven approach).
func StartMonitor(interval time.Duration) {
	logger.Log.Info("Hardware monitoring is now event-driven - use CheckHardwareChanges() when needed",
		zap.String("note", "Periodic monitoring disabled for efficiency"))
	monitorRunning = false
}

// StopMonitor stops the hardware monitoring.
func StopMonitor() {
	if !monitorRunning {
		return
	}

	close(monitorStop)
	monitorRunning = false
}
