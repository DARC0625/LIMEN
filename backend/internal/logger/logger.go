// Package logger provides structured logging functionality using zap.
package logger

import (
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var Log *zap.Logger
var logDir string

// Init initializes the logger with the specified level.
// Level should be one of: debug, info, warn, error
// If logDir is provided, enables file rotation. Otherwise, logs to console only.
func Init(level string) error {
	return InitWithRotation(level, "")
}

// InitWithRotation initializes the logger with log rotation support.
func InitWithRotation(level string, dir string) error {
	logDir = dir

	var zapLevel zapcore.Level
	if err := zapLevel.UnmarshalText([]byte(level)); err != nil {
		zapLevel = zapcore.InfoLevel
	}

	// If log directory is provided, use file rotation
	if dir != "" {
		var err error
		Log, err = SetupRotation(dir, zapLevel)
		if err != nil {
			return err
		}
		return nil
	}

	// Otherwise, use console logging
	config := zap.NewProductionConfig()
	config.Level = zap.NewAtomicLevelAt(zapLevel)
	config.EncoderConfig.TimeKey = "timestamp"
	config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	config.EncoderConfig.MessageKey = "message"
	config.EncoderConfig.LevelKey = "level"
	config.EncoderConfig.CallerKey = "caller"

	var err error
	Log, err = config.Build()
	if err != nil {
		return err
	}

	return nil
}

// Sync flushes any buffered log entries.
func Sync() {
	if Log != nil {
		_ = Log.Sync()
	}
}

// GetLogDir returns the current log directory.
func GetLogDir() string {
	if logDir != "" {
		return logDir
	}
	// Default to /var/log/limen if not set
	return "/var/log/limen"
}

// SetLogDir sets the log directory.
func SetLogDir(dir string) {
	logDir = dir
	// Ensure directory exists
	if err := os.MkdirAll(dir, 0755); err != nil {
		if Log != nil {
			Log.Error("Failed to create log directory", zap.String("dir", dir), zap.Error(err))
		}
	}
}
