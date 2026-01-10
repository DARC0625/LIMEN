package metrics

import (
	"testing"
)

func TestUpdateVMMetrics(t *testing.T) {
	// Test UpdateVMMetrics function
	vmCountByStatus := map[string]int{
		"running": 5,
		"stopped": 3,
	}
	cpuByStatus := map[string]int{
		"running": 20,
		"stopped": 0,
	}
	memoryByStatus := map[string]int{
		"running": 40960,
		"stopped": 0,
	}

	UpdateVMMetrics(vmCountByStatus, cpuByStatus, memoryByStatus)
	// Should not panic
}

func TestMetricsVariables(t *testing.T) {
	// Test that metrics variables are initialized
	if HTTPRequestsTotal == nil {
		t.Error("HTTPRequestsTotal should not be nil")
	}
	if HTTPRequestDuration == nil {
		t.Error("HTTPRequestDuration should not be nil")
	}
	if VMTotal == nil {
		t.Error("VMTotal should not be nil")
	}
	if VMCPUUsage == nil {
		t.Error("VMCPUUsage should not be nil")
	}
	if VMMemoryUsage == nil {
		t.Error("VMMemoryUsage should not be nil")
	}
	if VMCreateTotal == nil {
		t.Error("VMCreateTotal should not be nil")
	}
	if VMDeleteTotal == nil {
		t.Error("VMDeleteTotal should not be nil")
	}
	if UserTotal == nil {
		t.Error("UserTotal should not be nil")
	}
	if UserLoginTotal == nil {
		t.Error("UserLoginTotal should not be nil")
	}
	if DatabaseConnections == nil {
		t.Error("DatabaseConnections should not be nil")
	}
	if LibvirtConnectionStatus == nil {
		t.Error("LibvirtConnectionStatus should not be nil")
	}
}

func TestUpdateVMMetrics_EmptyMaps(t *testing.T) {
	// Test with empty maps
	UpdateVMMetrics(map[string]int{}, map[string]int{}, map[string]int{})
	// Should not panic
}

func TestUpdateVMMetrics_MultipleStatuses(t *testing.T) {
	// Test with multiple statuses
	vmCountByStatus := map[string]int{
		"running": 2,
		"stopped": 1,
		"paused":  1,
	}
	cpuByStatus := map[string]int{
		"running": 8,
		"stopped": 0,
		"paused":  0,
	}
	memoryByStatus := map[string]int{
		"running": 16384,
		"stopped": 0,
		"paused":  0,
	}

	UpdateVMMetrics(vmCountByStatus, cpuByStatus, memoryByStatus)
	// Should not panic
}
