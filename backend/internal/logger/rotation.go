// Package logger provides log rotation and management functionality.
package logger

import (
	"os"
	"path/filepath"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

// RotationConfig holds configuration for log rotation.
type RotationConfig struct {
	Filename   string // Log file path
	MaxSize    int    // Maximum size in megabytes before rotation
	MaxBackups int    // Maximum number of old log files to retain
	MaxAge     int    // Maximum number of days to retain old log files
	Compress   bool   // Compress rotated log files
	LocalTime  bool   // Use local time for timestamps
}

// DefaultRotationConfig returns a default log rotation configuration.
func DefaultRotationConfig(logDir string) RotationConfig {
	return RotationConfig{
		Filename:   filepath.Join(logDir, "limen.log"),
		MaxSize:    100,  // 100MB
		MaxBackups: 10,   // Keep 10 backup files
		MaxAge:     30,   // Keep logs for 30 days
		Compress:   true, // Compress old logs
		LocalTime:  true,
	}
}

// NewRotatingFileCore creates a zapcore.Core with log rotation.
func NewRotatingFileCore(config RotationConfig, level zapcore.Level) zapcore.Core {
	// Ensure log directory exists
	dir := filepath.Dir(config.Filename)
	if err := os.MkdirAll(dir, 0755); err != nil {
		panic("Failed to create log directory: " + err.Error())
	}

	// Create lumberjack logger for rotation
	writer := &lumberjack.Logger{
		Filename:   config.Filename,
		MaxSize:    config.MaxSize,
		MaxBackups: config.MaxBackups,
		MaxAge:     config.MaxAge,
		Compress:   config.Compress,
		LocalTime:  config.LocalTime,
	}

	// Create encoder config
	encoderConfig := zap.NewProductionEncoderConfig()
	encoderConfig.TimeKey = "timestamp"
	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	encoderConfig.EncodeLevel = zapcore.LowercaseLevelEncoder
	encoderConfig.MessageKey = "message"
	encoderConfig.LevelKey = "level"
	encoderConfig.CallerKey = "caller"
	encoderConfig.StacktraceKey = "stacktrace"

	// Create encoder
	encoder := zapcore.NewJSONEncoder(encoderConfig)

	// Create core
	core := zapcore.NewCore(encoder, zapcore.AddSync(writer), level)

	return core
}

// NewMultiCore creates a zapcore.Core that writes to both file and console.
func NewMultiCore(fileCore zapcore.Core, consoleCore zapcore.Core) zapcore.Core {
	return zapcore.NewTee(fileCore, consoleCore)
}

// SetupRotation initializes log rotation for the application.
func SetupRotation(logDir string, level zapcore.Level) (*zap.Logger, error) {
	// File rotation config
	rotationConfig := DefaultRotationConfig(logDir)
	fileCore := NewRotatingFileCore(rotationConfig, level)

	// Console core (for development)
	consoleEncoderConfig := zap.NewDevelopmentEncoderConfig()
	consoleEncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	consoleEncoder := zapcore.NewConsoleEncoder(consoleEncoderConfig)
	consoleCore := zapcore.NewCore(consoleEncoder, zapcore.AddSync(os.Stdout), level)

	// Combine both cores
	core := NewMultiCore(fileCore, consoleCore)

	// Create logger with options
	logger := zap.New(core,
		zap.AddCaller(),
		zap.AddStacktrace(zapcore.ErrorLevel),
		zap.AddCallerSkip(1),
	)

	return logger, nil
}

// CleanupOldLogs removes log files older than the specified age.
func CleanupOldLogs(logDir string, maxAgeDays int) error {
	cutoffTime := time.Now().AddDate(0, 0, -maxAgeDays)

	return filepath.Walk(logDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories
		if info.IsDir() {
			return nil
		}

		// Check if file is a log file
		if filepath.Ext(path) != ".log" && filepath.Ext(path) != ".gz" {
			return nil
		}

		// Check if file is older than cutoff
		if info.ModTime().Before(cutoffTime) {
			if err := os.Remove(path); err != nil {
				return err
			}
		}

		return nil
	})
}






