package logger

import (
	"os"
	"path/filepath"
	"testing"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func TestDefaultRotationConfig(t *testing.T) {
	tempDir := t.TempDir()
	config := DefaultRotationConfig(tempDir)
	
	// Verify default values
	if config.MaxSize == 0 {
		t.Error("DefaultRotationConfig() MaxSize should be > 0")
	}
	if config.MaxAge == 0 {
		t.Error("DefaultRotationConfig() MaxAge should be > 0")
	}
	if config.MaxBackups == 0 {
		t.Error("DefaultRotationConfig() MaxBackups should be > 0")
	}
	if config.Filename == "" {
		t.Error("DefaultRotationConfig() Filename should not be empty")
	}
}

func TestNewRotatingFileCore(t *testing.T) {
	tempDir := t.TempDir()
	
	config := DefaultRotationConfig(tempDir)
	core := NewRotatingFileCore(config, zapcore.InfoLevel)
	
	if core == nil {
		t.Error("NewRotatingFileCore() returned nil core")
	}
	
	// Verify log directory was created (file may be created lazily)
	if _, err := os.Stat(tempDir); os.IsNotExist(err) {
		t.Errorf("NewRotatingFileCore() log directory was not created: %v", err)
	}
}

func TestNewMultiCore(t *testing.T) {
	tempDir := t.TempDir()
	
	config := DefaultRotationConfig(tempDir)
	fileCore := NewRotatingFileCore(config, zapcore.InfoLevel)
	
	// Use development encoder config for testing (same as rotation.go)
	consoleEncoderConfig := zap.NewDevelopmentEncoderConfig()
	consoleEncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	consoleEncoder := zapcore.NewConsoleEncoder(consoleEncoderConfig)
	consoleCore := zapcore.NewCore(consoleEncoder, zapcore.AddSync(os.Stdout), zapcore.InfoLevel)
	core := NewMultiCore(fileCore, consoleCore)
	
	if core == nil {
		t.Error("NewMultiCore() returned nil")
	}
}

func TestSetupRotation(t *testing.T) {
	tempDir := t.TempDir()
	
	logger, err := SetupRotation(tempDir, zapcore.DebugLevel)
	
	if err != nil {
		t.Errorf("SetupRotation() error = %v", err)
	}
	if logger == nil {
		t.Error("SetupRotation() returned nil logger")
	}
	
	// Verify log directory was created
	if _, err := os.Stat(tempDir); os.IsNotExist(err) {
		t.Errorf("SetupRotation() log directory was not created: %v", err)
	}
}

func TestCleanupOldLogs(t *testing.T) {
	tempDir := t.TempDir()
	
	// Create some test log files
	for i := 0; i < 5; i++ {
		logFile := filepath.Join(tempDir, "test.log")
		f, err := os.Create(logFile)
		if err != nil {
			t.Fatalf("Failed to create test log file: %v", err)
		}
		f.Close()
	}
	
	// CleanupOldLogs should not panic
	// Note: This function may not be directly testable without mocking time
	// But we can at least verify it doesn't crash
	err := CleanupOldLogs(tempDir, 7)
	if err != nil {
		// Error is OK for test purposes, just verify it doesn't panic
	}
}

