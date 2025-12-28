package alerting

import (
	"context"
	"fmt"
	"os"
	"syscall"
)

// Rule defines an alert rule.
type Rule interface {
	Check(ctx context.Context) (*Alert, error)
	Name() string
	Interval() int // Check interval in seconds
}

// DiskSpaceRule checks disk space usage.
type DiskSpaceRule struct {
	manager          *Manager
	path             string
	thresholdPercent float64 // Alert if usage exceeds this percentage
}

// NewDiskSpaceRule creates a new disk space rule.
func NewDiskSpaceRule(manager *Manager, path string, thresholdPercent float64) *DiskSpaceRule {
	return &DiskSpaceRule{
		manager:          manager,
		path:             path,
		thresholdPercent: thresholdPercent,
	}
}

// Name returns the rule name.
func (r *DiskSpaceRule) Name() string {
	return "disk_space"
}

// Interval returns the check interval.
func (r *DiskSpaceRule) Interval() int {
	return 60 // Check every minute
}

// Check checks disk space usage.
func (r *DiskSpaceRule) Check(ctx context.Context) (*Alert, error) {
	var stat syscall.Statfs_t
	err := syscall.Statfs(r.path, &stat)
	if err != nil {
		return nil, fmt.Errorf("failed to stat filesystem: %w", err)
	}

	// Calculate usage percentage
	total := stat.Blocks * uint64(stat.Bsize)
	available := stat.Bavail * uint64(stat.Bsize)
	used := total - available
	usagePercent := float64(used) / float64(total) * 100

	if usagePercent >= r.thresholdPercent {
		alert := &Alert{
			Title:     "Disk Space Usage High",
			Message:   fmt.Sprintf("Disk usage on %s is %.2f%%, exceeding threshold of %.2f%%", r.path, usagePercent, r.thresholdPercent),
			Severity:  SeverityWarning,
			Service:   "limen",
			Component: "filesystem",
			Metadata: map[string]interface{}{
				"path":            r.path,
				"usage_percent":   usagePercent,
				"threshold":       r.thresholdPercent,
				"total_bytes":     total,
				"available_bytes": available,
				"used_bytes":      used,
			},
			Tags: []string{"disk", "resource"},
		}

		if usagePercent >= 95 {
			alert.Severity = SeverityCritical
		} else if usagePercent >= 90 {
			alert.Severity = SeverityError
		}

		return alert, nil
	}

	return nil, nil
}

// MemoryRule checks memory usage.
type MemoryRule struct {
	manager          *Manager
	thresholdPercent float64
}

// NewMemoryRule creates a new memory rule.
func NewMemoryRule(manager *Manager, thresholdPercent float64) *MemoryRule {
	return &MemoryRule{
		manager:          manager,
		thresholdPercent: thresholdPercent,
	}
}

// Name returns the rule name.
func (r *MemoryRule) Name() string {
	return "memory"
}

// Interval returns the check interval.
func (r *MemoryRule) Interval() int {
	return 60 // Check every minute
}

// Check checks memory usage.
func (r *MemoryRule) Check(ctx context.Context) (*Alert, error) {
	var info syscall.Sysinfo_t
	err := syscall.Sysinfo(&info)
	if err != nil {
		return nil, fmt.Errorf("failed to get system info: %w", err)
	}

	totalRAM := info.Totalram * uint64(info.Unit)
	freeRAM := info.Freeram * uint64(info.Unit)
	usedRAM := totalRAM - freeRAM
	usagePercent := float64(usedRAM) / float64(totalRAM) * 100

	if usagePercent >= r.thresholdPercent {
		alert := &Alert{
			Title:     "Memory Usage High",
			Message:   fmt.Sprintf("Memory usage is %.2f%%, exceeding threshold of %.2f%%", usagePercent, r.thresholdPercent),
			Severity:  SeverityWarning,
			Service:   "limen",
			Component: "system",
			Metadata: map[string]interface{}{
				"usage_percent": usagePercent,
				"threshold":     r.thresholdPercent,
				"total_bytes":   totalRAM,
				"free_bytes":    freeRAM,
				"used_bytes":    usedRAM,
			},
			Tags: []string{"memory", "resource"},
		}

		if usagePercent >= 95 {
			alert.Severity = SeverityCritical
		} else if usagePercent >= 90 {
			alert.Severity = SeverityError
		}

		return alert, nil
	}

	return nil, nil
}

// ProcessAliveRule checks if a critical process is running.
type ProcessAliveRule struct {
	manager     *Manager
	processName string
	pidFile     string
}

// NewProcessAliveRule creates a new process alive rule.
func NewProcessAliveRule(manager *Manager, processName, pidFile string) *ProcessAliveRule {
	return &ProcessAliveRule{
		manager:     manager,
		processName: processName,
		pidFile:     pidFile,
	}
}

// Name returns the rule name.
func (r *ProcessAliveRule) Name() string {
	return "process_alive"
}

// Interval returns the check interval.
func (r *ProcessAliveRule) Interval() int {
	return 30 // Check every 30 seconds
}

// Check checks if the process is alive.
func (r *ProcessAliveRule) Check(ctx context.Context) (*Alert, error) {
	if r.pidFile == "" {
		return nil, nil
	}

	// Check if PID file exists
	_, err := os.Stat(r.pidFile)
	if err != nil {
		if os.IsNotExist(err) {
			alert := &Alert{
				Title:     fmt.Sprintf("Process %s Not Running", r.processName),
				Message:   fmt.Sprintf("PID file %s does not exist. Process %s may have crashed.", r.pidFile, r.processName),
				Severity:  SeverityCritical,
				Service:   "limen",
				Component: "process",
				Metadata: map[string]interface{}{
					"process_name": r.processName,
					"pid_file":     r.pidFile,
				},
				Tags: []string{"process", "availability"},
			}
			return alert, nil
		}
		return nil, fmt.Errorf("failed to stat PID file: %w", err)
	}

	return nil, nil
}




