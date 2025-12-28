// Package hardware provides security configuration based on hardware capabilities.
package hardware

import (
	"github.com/DARC0625/LIMEN/backend/internal/crypto"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"go.uber.org/zap"
)

func init() {
	// Register hardware security config getter with crypto package
	crypto.SetHardwareSecurityConfig(getCryptoSecurityConfig)
}

// getCryptoSecurityConfig returns security config in crypto package format.
func getCryptoSecurityConfig() *crypto.SecurityConfigFromHardware {
	secConfig := GetOptimalSecurityConfig()
	return &crypto.SecurityConfigFromHardware{
		Argon2idConfig: secConfig.Argon2idConfig,
	}
}

// SecurityConfig represents optimized security configuration based on hardware.
type SecurityConfig struct {
	// Argon2id configuration optimized for this hardware
	Argon2idConfig crypto.Argon2idConfig

	// Preferred encryption algorithm based on hardware acceleration
	PreferredEncryption string // "chacha20" or "aes-gcm"

	// Use hardware RNG if available
	UseHardwareRNG bool

	// Enable hardware acceleration for crypto operations
	EnableHardwareAccel bool
}

// GetOptimalSecurityConfig returns optimal security configuration based on hardware.
func GetOptimalSecurityConfig() *SecurityConfig {
	spec := GetCurrentSpec()
	if spec == nil {
		// Default configuration if spec not available
		return getDefaultSecurityConfig()
	}

	config := &SecurityConfig{}

	// Optimize Argon2id based on available memory
	config.Argon2idConfig = optimizeArgon2idForHardware(spec)

	// Choose encryption algorithm based on hardware acceleration
	if spec.CPU.HasAES && spec.Security.HasAESAccel {
		config.PreferredEncryption = "aes-gcm"
		config.EnableHardwareAccel = true
		logger.Log.Info("Using AES-GCM with hardware acceleration",
			zap.String("cpu", spec.CPU.Model),
			zap.Bool("has_aes", spec.CPU.HasAES),
		)
	} else {
		config.PreferredEncryption = "chacha20"
		config.EnableHardwareAccel = false
		logger.Log.Info("Using ChaCha20-Poly1305 (no AES hardware acceleration)",
			zap.String("cpu", spec.CPU.Model),
		)
	}

	// Use hardware RNG if available
	config.UseHardwareRNG = spec.CPU.HasRDSEED || spec.CPU.HasRDRAND
	if config.UseHardwareRNG {
		logger.Log.Info("Hardware RNG available",
			zap.Bool("rdseed", spec.CPU.HasRDSEED),
			zap.Bool("rdrand", spec.CPU.HasRDRAND),
		)
	}

	return config
}

// optimizeArgon2idForHardware optimizes Argon2id parameters based on hardware.
func optimizeArgon2idForHardware(spec *Spec) crypto.Argon2idConfig {
	config := crypto.DefaultArgon2idConfig()

	// Adjust memory based on available RAM
	// Use more memory if available (better security)
	// But don't exceed 25% of available memory
	maxMemoryKB := uint32(spec.Memory.AvailableGB * 1024 * 1024 * 0.25) // 25% of available

	if maxMemoryKB > 65536 { // More than 64MB available
		config.Memory = 65536 // Use 64MB (good balance)
	} else if maxMemoryKB > 32768 { // More than 32MB available
		config.Memory = 32768 // Use 32MB
	} else if maxMemoryKB > 16384 { // More than 16MB available
		config.Memory = 16384 // Use 16MB
	} else {
		config.Memory = 8192 // Use 8MB (minimum)
	}

	// Adjust parallelism based on CPU cores
	// Use up to 4 threads (optimal for Argon2id)
	if spec.CPU.Cores >= 4 {
		config.Parallelism = 4
	} else if spec.CPU.Cores >= 2 {
		config.Parallelism = uint8(spec.CPU.Cores)
	} else {
		config.Parallelism = 1
	}

	// Adjust iterations based on CPU performance
	// Faster CPUs can handle more iterations
	if spec.CPU.FrequencyMHz > 3000 { // High frequency CPU
		config.Iterations = 3 // Default
	} else if spec.CPU.FrequencyMHz > 2000 { // Medium frequency CPU
		config.Iterations = 3 // Default
	} else { // Lower frequency CPU
		config.Iterations = 2 // Reduce iterations for slower CPUs
	}

	logger.Log.Info("Optimized Argon2id configuration",
		zap.Uint32("memory_kb", config.Memory),
		zap.Uint32("iterations", config.Iterations),
		zap.Uint8("parallelism", config.Parallelism),
		zap.Float64("cpu_freq_mhz", spec.CPU.FrequencyMHz),
		zap.Int("cpu_cores", spec.CPU.Cores),
	)

	return config
}

// getDefaultSecurityConfig returns default security configuration.
func getDefaultSecurityConfig() *SecurityConfig {
	return &SecurityConfig{
		Argon2idConfig:      crypto.DefaultArgon2idConfig(),
		PreferredEncryption: "chacha20",
		UseHardwareRNG:      false,
		EnableHardwareAccel: false,
	}
}

// ValidateHardwareSecurity validates that hardware meets security requirements.
func ValidateHardwareSecurity() []string {
	var warnings []string
	spec := GetCurrentSpec()
	if spec == nil {
		warnings = append(warnings, "Hardware specification not available")
		return warnings
	}

	// Check for hardware RNG
	if !spec.CPU.HasRDRAND && !spec.CPU.HasRDSEED {
		warnings = append(warnings, "No hardware RNG available - using software RNG")
	}

	// Check for AES acceleration
	if !spec.CPU.HasAES {
		warnings = append(warnings, "No AES-NI instruction set - using ChaCha20-Poly1305")
	}

	// Check for TPM
	if !spec.Security.TPM {
		warnings = append(warnings, "TPM not detected - hardware-backed security features unavailable")
	}

	// Check for Secure Boot
	if !spec.Security.SecureBoot {
		warnings = append(warnings, "Secure Boot not enabled - boot security reduced")
	}

	// Check for SMEP/SMAP
	if !spec.CPU.HasSMEP {
		warnings = append(warnings, "SMEP not available - kernel security reduced")
	}
	if !spec.CPU.HasSMAP {
		warnings = append(warnings, "SMAP not available - kernel security reduced")
	}

	// Check ASLR
	if spec.Security.ASLR < 2 {
		warnings = append(warnings, "ASLR not fully enabled - memory security reduced")
	}

	return warnings
}
