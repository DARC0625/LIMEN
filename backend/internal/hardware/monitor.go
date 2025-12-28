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

// StartMonitor starts periodic hardware specification monitoring.
// Checks for hardware changes every 5 minutes and updates security configuration.
func StartMonitor(interval time.Duration) {
	if monitorRunning {
		logger.Log.Warn("Hardware monitor already running")
		return
	}

	monitorRunning = true
	monitorStop = make(chan struct{})

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		logger.Log.Info("Hardware monitor started",
			zap.Duration("interval", interval),
		)

		for {
			select {
			case <-ticker.C:
				// Detect and update hardware specification
				newSpec, err := UpdateSpec()
				if err != nil {
					logger.Log.Warn("Failed to update hardware specification", zap.Error(err))
					continue
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

			case <-monitorStop:
				logger.Log.Info("Hardware monitor stopped")
				monitorRunning = false
				return
			}
		}
	}()
}

// StopMonitor stops the hardware monitoring.
func StopMonitor() {
	if !monitorRunning {
		return
	}

	close(monitorStop)
	monitorRunning = false
}
