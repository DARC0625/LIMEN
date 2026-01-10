package logger

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestAnalyzeLogs(t *testing.T) {
	Init("debug")

	tempDir := t.TempDir()
	logFile := filepath.Join(tempDir, "test.log")

	// Create a test log file
	f, err := os.Create(logFile)
	if err != nil {
		t.Fatalf("Failed to create test log file: %v", err)
	}
	f.WriteString(`{"level":"info","timestamp":"2026-01-01T00:00:00Z","message":"test message"}
{"level":"error","timestamp":"2026-01-01T00:00:01Z","message":"test error"}
`)
	f.Close()

	stats, err := AnalyzeLogs(tempDir, 1*time.Hour)
	if err != nil {
		t.Errorf("AnalyzeLogs() error = %v", err)
	}
	if stats == nil {
		t.Error("AnalyzeLogs() returned nil stats")
	}
}

func TestSearchLogs(t *testing.T) {
	Init("debug")

	tempDir := t.TempDir()
	logFile := filepath.Join(tempDir, "test.log")

	// Create a test log file
	f, err := os.Create(logFile)
	if err != nil {
		t.Fatalf("Failed to create test log file: %v", err)
	}
	f.WriteString(`{"level":"info","timestamp":"2026-01-01T00:00:00Z","message":"test message"}
{"level":"error","timestamp":"2026-01-01T00:00:01Z","message":"test error"}
`)
	f.Close()

	results, err := SearchLogs(tempDir, "test", 1*time.Hour, 100)
	if err != nil {
		t.Errorf("SearchLogs() error = %v", err)
	}
	if results == nil {
		t.Error("SearchLogs() returned nil results")
	}
}

func TestFormatLogStats(t *testing.T) {
	Init("debug")

	stats := &LogStats{
		TotalEntries:      100,
		ErrorCount:        10,
		WarningCount:      20,
		InfoCount:         70,
		LevelDistribution: map[string]int{"error": 10, "warn": 20, "info": 70},
		TimeRange: TimeRange{
			Start: time.Now().Add(-1 * time.Hour),
			End:   time.Now(),
		},
	}

	formatted := FormatLogStats(stats)
	if formatted == "" {
		t.Error("FormatLogStats() returned empty string")
	}
}
