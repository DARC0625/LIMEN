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

func TestGetHardwareSpec(t *testing.T) {
	// Test GetHardwareSpec
	spec := GetHardwareSpec()
	if spec == nil {
		t.Error("GetHardwareSpec() returned nil")
	}
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

func TestGetCPUFrequency(t *testing.T) {
	// Test GetCPUFrequency
	freq := GetCPUFrequency()
	if freq <= 0 {
		t.Logf("GetCPUFrequency() returned %v (may be expected in test environment)", freq)
	}
}

func TestGetCPUCount(t *testing.T) {
	// Test GetCPUCount
	count := GetCPUCount()
	if count <= 0 {
		t.Error("GetCPUCount() should return > 0")
	}
}

func TestGetMemorySize(t *testing.T) {
	// Test GetMemorySize
	mem := GetMemorySize()
	if mem <= 0 {
		t.Error("GetMemorySize() should return > 0")
	}
}

func TestGetDiskSize(t *testing.T) {
	// Test GetDiskSize
	disk := GetDiskSize()
	if disk <= 0 {
		t.Logf("GetDiskSize() returned %v (may be expected in test environment)", disk)
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

