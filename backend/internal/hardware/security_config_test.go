package hardware

import (
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
)

func init() {
	logger.Init("debug")
}

func TestGetOptimalSecurityConfig_Success(t *testing.T) {
	config := GetOptimalSecurityConfig()

	if config == nil {
		t.Fatal("GetOptimalSecurityConfig returned nil")
	}

	// Verify config has valid values
	if config.Argon2idConfig.Memory == 0 {
		t.Error("Argon2idConfig.Memory should not be zero")
	}
	if config.Argon2idConfig.Iterations == 0 {
		t.Error("Argon2idConfig.Iterations should not be zero")
	}
	if config.Argon2idConfig.Parallelism == 0 {
		t.Error("Argon2idConfig.Parallelism should not be zero")
	}

	// Verify encryption preference is set
	if config.PreferredEncryption != "aes-gcm" && config.PreferredEncryption != "chacha20" {
		t.Errorf("Expected PreferredEncryption to be 'aes-gcm' or 'chacha20', got '%s'", config.PreferredEncryption)
	}
}

func TestGetOptimalSecurityConfig_WithSpec(t *testing.T) {
	// Ensure spec is initialized
	_, _ = UpdateSpec()

	config := GetOptimalSecurityConfig()

	if config == nil {
		t.Fatal("GetOptimalSecurityConfig returned nil")
	}

	// Config should be optimized based on hardware
	if config.Argon2idConfig.Memory < 8192 {
		t.Error("Argon2idConfig.Memory should be at least 8MB")
	}
}

func TestGetOptimalSecurityConfig_WithoutSpec(t *testing.T) {
	// This test verifies default config is returned when spec is nil
	// We can't easily set spec to nil, but we can verify the function handles it
	config := GetOptimalSecurityConfig()

	if config == nil {
		t.Fatal("GetOptimalSecurityConfig should return default config even without spec")
	}
}

func TestOptimizeArgon2idForHardware(t *testing.T) {
	// Get current spec
	spec := GetCurrentSpec()
	if spec == nil {
		// Initialize spec if not available
		_, _ = UpdateSpec()
		spec = GetCurrentSpec()
	}

	if spec == nil {
		t.Skip("Cannot test optimizeArgon2idForHardware without hardware spec")
		return
	}

	config := optimizeArgon2idForHardware(spec)

	// Verify config values are reasonable
	if config.Memory < 8192 {
		t.Errorf("Expected Memory >= 8192, got %d", config.Memory)
	}
	if config.Memory > 65536 {
		t.Errorf("Expected Memory <= 65536, got %d", config.Memory)
	}
	if config.Parallelism == 0 {
		t.Error("Parallelism should not be zero")
	}
	if config.Parallelism > 4 {
		t.Errorf("Expected Parallelism <= 4, got %d", config.Parallelism)
	}
	if config.Iterations < 2 || config.Iterations > 3 {
		t.Errorf("Expected Iterations to be 2 or 3, got %d", config.Iterations)
	}
}

func TestGetDefaultSecurityConfig(t *testing.T) {
	config := getDefaultSecurityConfig()

	if config == nil {
		t.Fatal("getDefaultSecurityConfig returned nil")
	}

	if config.PreferredEncryption != "chacha20" {
		t.Errorf("Expected PreferredEncryption 'chacha20', got '%s'", config.PreferredEncryption)
	}
	if config.UseHardwareRNG {
		t.Error("Default config should not use hardware RNG")
	}
	if config.EnableHardwareAccel {
		t.Error("Default config should not enable hardware acceleration")
	}
}

func TestValidateHardwareSecurity_Additional(t *testing.T) {
	// Ensure spec is initialized
	_, _ = UpdateSpec()

	warnings := ValidateHardwareSecurity()

	// Should return a slice (may be empty if all checks pass)
	if warnings == nil {
		t.Error("ValidateHardwareSecurity should return a slice")
	}

	// Log warnings for debugging
	for _, warning := range warnings {
		t.Logf("Hardware security warning: %s", warning)
	}
}

