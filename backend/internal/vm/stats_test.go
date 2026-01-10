//go:build libvirt && extended
// +build libvirt,extended

package vm

import (
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
)

func init() {
	logger.Init("debug")
}

func TestVMStats_Structure(t *testing.T) {
	// Test VMStats struct fields
	stats := &VMStats{
		CPUUsagePercent:    50.5,
		MemoryUsedMB:       1024,
		MemoryTotalMB:      2048,
		MemoryUsagePercent: 50.0,
		Timestamp:          1234567890,
	}

	if stats.CPUUsagePercent != 50.5 {
		t.Errorf("Expected CPUUsagePercent 50.5, got %f", stats.CPUUsagePercent)
	}
	if stats.MemoryUsedMB != 1024 {
		t.Errorf("Expected MemoryUsedMB 1024, got %d", stats.MemoryUsedMB)
	}
	if stats.MemoryTotalMB != 2048 {
		t.Errorf("Expected MemoryTotalMB 2048, got %d", stats.MemoryTotalMB)
	}
	if stats.MemoryUsagePercent != 50.0 {
		t.Errorf("Expected MemoryUsagePercent 50.0, got %f", stats.MemoryUsagePercent)
	}
	if stats.Timestamp != 1234567890 {
		t.Errorf("Expected Timestamp 1234567890, got %d", stats.Timestamp)
	}
}

func TestVMStats_MemoryUsageCalculation(t *testing.T) {
	// Test memory usage percentage calculation
	stats := &VMStats{
		MemoryUsedMB:  512,
		MemoryTotalMB: 1024,
	}

	expectedPercent := (float64(stats.MemoryUsedMB) / float64(stats.MemoryTotalMB)) * 100
	if expectedPercent != 50.0 {
		t.Errorf("Expected memory usage 50%%, got %f%%", expectedPercent)
	}
}

func TestVMStats_ZeroValues(t *testing.T) {
	// Test VMStats with zero values
	stats := &VMStats{}

	if stats.CPUUsagePercent != 0 {
		t.Errorf("Expected CPUUsagePercent 0, got %f", stats.CPUUsagePercent)
	}
	if stats.MemoryUsedMB != 0 {
		t.Errorf("Expected MemoryUsedMB 0, got %d", stats.MemoryUsedMB)
	}
	if stats.MemoryTotalMB != 0 {
		t.Errorf("Expected MemoryTotalMB 0, got %d", stats.MemoryTotalMB)
	}
	if stats.MemoryUsagePercent != 0 {
		t.Errorf("Expected MemoryUsagePercent 0, got %f", stats.MemoryUsagePercent)
	}
	if stats.Timestamp != 0 {
		t.Errorf("Expected Timestamp 0, got %d", stats.Timestamp)
	}
}

func TestVMStats_EdgeCases(t *testing.T) {
	// Test edge cases for memory usage
	tests := []struct {
		name        string
		usedMB      uint64
		totalMB     uint64
		expectedPct float64
	}{
		{"Zero total", 0, 0, 0},
		{"Zero used", 0, 1024, 0},
		{"Full usage", 1024, 1024, 100.0},
		{"Half usage", 512, 1024, 50.0},
		{"Quarter usage", 256, 1024, 25.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stats := &VMStats{
				MemoryUsedMB:  tt.usedMB,
				MemoryTotalMB: tt.totalMB,
			}
			if tt.totalMB > 0 {
				stats.MemoryUsagePercent = (float64(stats.MemoryUsedMB) / float64(stats.MemoryTotalMB)) * 100
			}
			if stats.MemoryUsagePercent != tt.expectedPct {
				t.Errorf("Expected memory usage %f%%, got %f%%", tt.expectedPct, stats.MemoryUsagePercent)
			}
		})
	}
}
