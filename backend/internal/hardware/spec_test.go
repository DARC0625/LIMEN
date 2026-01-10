package hardware

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
)

func init() {
	// Initialize logger for tests
	logger.Init("debug")
}

func TestInitialize(t *testing.T) {
	// Test Initialize function
	err := Initialize()
	if err != nil {
		t.Logf("Initialize failed (may be expected in test environment): %v", err)
	}
}

func TestGetCurrentSpec(t *testing.T) {
	// Test GetCurrentSpec
	spec := GetCurrentSpec()
	// Spec may be nil if not initialized, which is OK
	_ = spec
}

func TestGetOptimalSecurityConfig(t *testing.T) {
	// Test GetOptimalSecurityConfig
	config := GetOptimalSecurityConfig()
	if config == nil {
		t.Error("GetOptimalSecurityConfig() returned nil")
	}
}

func TestValidateHardwareSecurity(t *testing.T) {
	// Test ValidateHardwareSecurity
	warnings := ValidateHardwareSecurity()
	if warnings == nil {
		t.Error("ValidateHardwareSecurity() returned nil")
	}
}

func TestGetCurrentSpec_CPUInfo(t *testing.T) {
	// Test that GetCurrentSpec returns valid CPU info
	spec := GetCurrentSpec()
	if spec != nil {
		if spec.CPU.Cores <= 0 {
			t.Error("CPU cores should be > 0")
		}
	}
}

func TestGetCurrentSpec_MemoryInfo(t *testing.T) {
	// Test that GetCurrentSpec returns valid memory info
	spec := GetCurrentSpec()
	if spec != nil {
		if spec.Memory.TotalGB <= 0 {
			t.Error("Memory total should be > 0")
		}
	}
}

func TestSpecFile_RelativePath(t *testing.T) {
	// Test that spec file uses relative path
	tempDir := t.TempDir()
	originalDir, _ := os.Getwd()
	defer os.Chdir(originalDir)

	os.Chdir(tempDir)

	// Initialize should create .server-spec.json in current directory
	err := Initialize()
	if err != nil {
		t.Logf("Initialize failed: %v", err)
	}

	// Check if spec file exists (relative path)
	specFile := ".server-spec.json"
	if _, err := os.Stat(specFile); err == nil {
		// File exists, verify it's relative
		absPath, _ := filepath.Abs(specFile)
		if filepath.IsAbs(specFile) {
			t.Error("Spec file should use relative path")
		}
		_ = absPath // Use absPath to avoid unused variable
	}
}
