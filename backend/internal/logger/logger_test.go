package logger

import (
	"os"
	"testing"
)

func TestInit(t *testing.T) {
	tests := []struct {
		name  string
		level string
	}{
		{"debug level", "debug"},
		{"info level", "info"},
		{"warn level", "warn"},
		{"error level", "error"},
		{"invalid level", "invalid"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := Init(tt.level)
			if err != nil {
				t.Errorf("Init() error = %v", err)
			}
			if Log == nil {
				t.Error("Init() Log is nil")
			}
		})
	}
}

func TestInitWithRotation(t *testing.T) {
	// Test with empty directory (console logging)
	err := InitWithRotation("info", "")
	if err != nil {
		t.Errorf("InitWithRotation() with empty dir error = %v", err)
	}
	if Log == nil {
		t.Error("InitWithRotation() Log is nil")
	}

	// Test with directory (file rotation)
	tempDir := t.TempDir()
	err = InitWithRotation("debug", tempDir)
	if err != nil {
		t.Errorf("InitWithRotation() with dir error = %v", err)
	}
	if Log == nil {
		t.Error("InitWithRotation() Log is nil")
	}
}

func TestSync(t *testing.T) {
	Init("info")
	// Should not panic
	Sync()
}

func TestGetLogDir(t *testing.T) {
	// Test default
	Init("info")
	dir := GetLogDir()
	if dir != "./logs" {
		t.Errorf("GetLogDir() = %v, want ./logs", dir)
	}

	// Test with custom directory
	tempDir := t.TempDir()
	SetLogDir(tempDir)
	dir = GetLogDir()
	if dir != tempDir {
		t.Errorf("GetLogDir() = %v, want %v", dir, tempDir)
	}
}

func TestSetLogDir(t *testing.T) {
	Init("info")
	tempDir := t.TempDir()

	SetLogDir(tempDir)

	// Verify directory was created
	if _, err := os.Stat(tempDir); os.IsNotExist(err) {
		t.Errorf("SetLogDir() directory was not created: %v", err)
	}

	// Verify GetLogDir returns the set directory
	dir := GetLogDir()
	if dir != tempDir {
		t.Errorf("GetLogDir() = %v, want %v", dir, tempDir)
	}
}

func TestSetLogDir_InvalidPath(t *testing.T) {
	Init("info")

	// Try to set invalid path (should not panic, just log error)
	invalidPath := "/root/invalid/path/that/should/not/exist"
	SetLogDir(invalidPath)

	// Should not crash
	dir := GetLogDir()
	if dir == "" {
		t.Error("GetLogDir() should return a value even with invalid path")
	}
}
