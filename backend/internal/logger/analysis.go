// Package logger provides log analysis and aggregation functionality.
package logger

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// LogEntry represents a single log entry for analysis.
type LogEntry struct {
	Timestamp time.Time              `json:"timestamp"`
	Level     string                 `json:"level"`
	Message   string                 `json:"message"`
	Caller    string                 `json:"caller,omitempty"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
}

// LogStats represents aggregated log statistics.
type LogStats struct {
	TotalEntries      int            `json:"total_entries"`
	ErrorCount        int            `json:"error_count"`
	WarningCount      int            `json:"warning_count"`
	InfoCount         int            `json:"info_count"`
	DebugCount        int            `json:"debug_count"`
	LevelDistribution map[string]int `json:"level_distribution"`
	TopErrors         []ErrorSummary `json:"top_errors"`
	TimeRange         TimeRange      `json:"time_range"`
}

// ErrorSummary represents a summary of error occurrences.
type ErrorSummary struct {
	Message   string `json:"message"`
	Count     int    `json:"count"`
	FirstSeen string `json:"first_seen"`
	LastSeen  string `json:"last_seen"`
}

// TimeRange represents a time range for log analysis.
type TimeRange struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// AnalyzeLogs analyzes log files and returns statistics.
func AnalyzeLogs(logDir string, since time.Duration) (*LogStats, error) {
	stats := &LogStats{
		LevelDistribution: make(map[string]int),
		TopErrors:         make([]ErrorSummary, 0),
		TimeRange: TimeRange{
			Start: time.Now().Add(-since),
			End:   time.Now(),
		},
	}

	errorMap := make(map[string]*ErrorSummary)

	// Walk through log files
	err := filepath.Walk(logDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Only process log files
		if info.IsDir() || !strings.HasSuffix(path, ".log") {
			return nil
		}

		// Skip files older than since
		if info.ModTime().Before(stats.TimeRange.Start) {
			return nil
		}

		// Read and analyze log file
		fileStats, err := analyzeLogFile(path, stats.TimeRange.Start, errorMap)
		if err != nil {
			return err
		}

		// Aggregate statistics
		stats.TotalEntries += fileStats.TotalEntries
		stats.ErrorCount += fileStats.ErrorCount
		stats.WarningCount += fileStats.WarningCount
		stats.InfoCount += fileStats.InfoCount
		stats.DebugCount += fileStats.DebugCount

		return nil
	})

	if err != nil {
		return nil, err
	}

	// Update level distribution
	stats.LevelDistribution["error"] = stats.ErrorCount
	stats.LevelDistribution["warn"] = stats.WarningCount
	stats.LevelDistribution["info"] = stats.InfoCount
	stats.LevelDistribution["debug"] = stats.DebugCount

	// Convert error map to slice and sort by count
	stats.TopErrors = convertErrorMapToSlice(errorMap)

	return stats, nil
}

// analyzeLogFile analyzes a single log file.
func analyzeLogFile(filePath string, since time.Time, errorMap map[string]*ErrorSummary) (*LogStats, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	stats := &LogStats{
		LevelDistribution: make(map[string]int),
	}

	decoder := json.NewDecoder(file)
	for {
		var entry LogEntry
		if err := decoder.Decode(&entry); err != nil {
			if err == io.EOF {
				break
			}
			// Skip malformed entries
			continue
		}

		// Skip entries outside time range
		if entry.Timestamp.Before(since) {
			continue
		}

		stats.TotalEntries++

		// Count by level
		switch strings.ToLower(entry.Level) {
		case "error":
			stats.ErrorCount++
			// Track error details
			if errorMap[entry.Message] == nil {
				errorMap[entry.Message] = &ErrorSummary{
					Message:   entry.Message,
					Count:     0,
					FirstSeen: entry.Timestamp.Format(time.RFC3339),
					LastSeen:  entry.Timestamp.Format(time.RFC3339),
				}
			}
			errorMap[entry.Message].Count++
			if entry.Timestamp.Format(time.RFC3339) > errorMap[entry.Message].LastSeen {
				errorMap[entry.Message].LastSeen = entry.Timestamp.Format(time.RFC3339)
			}
		case "warn", "warning":
			stats.WarningCount++
		case "info":
			stats.InfoCount++
		case "debug":
			stats.DebugCount++
		}
	}

	return stats, nil
}

// convertErrorMapToSlice converts error map to sorted slice.
func convertErrorMapToSlice(errorMap map[string]*ErrorSummary) []ErrorSummary {
	errors := make([]ErrorSummary, 0, len(errorMap))
	for _, summary := range errorMap {
		errors = append(errors, *summary)
	}

	// Sort by count (descending)
	for i := 0; i < len(errors)-1; i++ {
		for j := i + 1; j < len(errors); j++ {
			if errors[i].Count < errors[j].Count {
				errors[i], errors[j] = errors[j], errors[i]
			}
		}
	}

	// Return top 10
	if len(errors) > 10 {
		return errors[:10]
	}
	return errors
}

// SearchLogs searches for log entries matching the query.
func SearchLogs(logDir string, query string, since time.Duration, limit int) ([]LogEntry, error) {
	entries := make([]LogEntry, 0)
	cutoffTime := time.Now().Add(-since)

	err := filepath.Walk(logDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() || !strings.HasSuffix(path, ".log") {
			return nil
		}

		if info.ModTime().Before(cutoffTime) {
			return nil
		}

		fileEntries, err := searchLogFile(path, query, cutoffTime, limit-len(entries))
		if err != nil {
			return err
		}

		entries = append(entries, fileEntries...)
		if len(entries) >= limit {
			return fmt.Errorf("limit reached")
		}

		return nil
	})

	if err != nil && err.Error() != "limit reached" {
		return nil, err
	}

	return entries, nil
}

// searchLogFile searches a single log file.
func searchLogFile(filePath string, query string, since time.Time, limit int) ([]LogEntry, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	entries := make([]LogEntry, 0)
	decoder := json.NewDecoder(file)

	for len(entries) < limit {
		var entry LogEntry
		if err := decoder.Decode(&entry); err != nil {
			if err == io.EOF {
				break
			}
			continue
		}

		if entry.Timestamp.Before(since) {
			continue
		}

		// Simple text search
		if strings.Contains(strings.ToLower(entry.Message), strings.ToLower(query)) ||
			strings.Contains(strings.ToLower(entry.Level), strings.ToLower(query)) {
			entries = append(entries, entry)
		}
	}

	return entries, nil
}

// FormatLogStats formats log statistics for display.
func FormatLogStats(stats *LogStats) string {
	var builder strings.Builder

	builder.WriteString("=== Log Statistics ===\n")
	builder.WriteString(fmt.Sprintf("Time Range: %s to %s\n",
		stats.TimeRange.Start.Format(time.RFC3339),
		stats.TimeRange.End.Format(time.RFC3339)))
	builder.WriteString(fmt.Sprintf("Total Entries: %d\n", stats.TotalEntries))
	builder.WriteString(fmt.Sprintf("Errors: %d\n", stats.ErrorCount))
	builder.WriteString(fmt.Sprintf("Warnings: %d\n", stats.WarningCount))
	builder.WriteString(fmt.Sprintf("Info: %d\n", stats.InfoCount))
	builder.WriteString(fmt.Sprintf("Debug: %d\n", stats.DebugCount))

	if len(stats.TopErrors) > 0 {
		builder.WriteString("\n=== Top Errors ===\n")
		for i, err := range stats.TopErrors {
			if i >= 10 {
				break
			}
			builder.WriteString(fmt.Sprintf("%d. %s (Count: %d, First: %s, Last: %s)\n",
				i+1, err.Message, err.Count, err.FirstSeen, err.LastSeen))
		}
	}

	return builder.String()
}
