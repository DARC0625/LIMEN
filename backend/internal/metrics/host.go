// Package metrics provides host resource metrics collection.
package metrics

import (
	"os"
	"runtime"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
	"go.uber.org/zap"
)

var (
	hostMetricsOnce sync.Once
	hostMetricsStop chan struct{}
)

// StartHostMetricsCollection starts periodic collection of host resource metrics.
func StartHostMetricsCollection(logger *zap.Logger) {
	hostMetricsOnce.Do(func() {
		hostMetricsStop = make(chan struct{})
		go collectHostMetricsLoop(logger)
	})
}

// StopHostMetricsCollection stops host metrics collection.
func StopHostMetricsCollection() {
	if hostMetricsStop != nil {
		close(hostMetricsStop)
		hostMetricsStop = nil
	}
}

// collectHostMetricsLoop periodically collects host resource metrics.
func collectHostMetricsLoop(logger *zap.Logger) {
	ticker := time.NewTicker(30 * time.Second) // Collect every 30 seconds
	defer ticker.Stop()

	// Initial collection
	collectHostMetrics(logger)

	for {
		select {
		case <-ticker.C:
			collectHostMetrics(logger)
		case <-hostMetricsStop:
			return
		}
	}
}

// collectHostMetrics collects current host resource metrics.
func collectHostMetrics(log *zap.Logger) {
	// CPU usage
	cpuPercent, err := cpu.Percent(time.Second, false)
	if err != nil {
		log.Warn("Failed to collect CPU metrics", zap.Error(err))
	} else if len(cpuPercent) > 0 {
		HostCPUUsage.Set(cpuPercent[0])
	}

	// Memory usage
	memInfo, err := mem.VirtualMemory()
	if err != nil {
		log.Warn("Failed to collect memory metrics", zap.Error(err))
	} else {
		HostMemoryUsage.Set(memInfo.UsedPercent)
	}

	// Disk usage (root filesystem)
	diskInfo, err := disk.Usage("/")
	if err != nil {
		log.Warn("Failed to collect disk metrics", zap.Error(err))
	} else {
		HostDiskUsage.Set(diskInfo.UsedPercent)
	}
}

// GetHostMetrics returns current host metrics (for testing/debugging).
func GetHostMetrics() (cpuPercent, memPercent, diskPercent float64, err error) {
	// CPU
	cpuPercentages, err := cpu.Percent(time.Second, false)
	if err != nil {
		return 0, 0, 0, err
	}
	if len(cpuPercentages) > 0 {
		cpuPercent = cpuPercentages[0]
	}

	// Memory
	memInfo, err := mem.VirtualMemory()
	if err != nil {
		return cpuPercent, 0, 0, err
	}
	memPercent = memInfo.UsedPercent

	// Disk
	diskInfo, err := disk.Usage("/")
	if err != nil {
		return cpuPercent, memPercent, 0, err
	}
	diskPercent = diskInfo.UsedPercent

	return cpuPercent, memPercent, diskPercent, nil
}

// GetHostInfo returns basic host information.
func GetHostInfo() (hostname string, osInfo string, err error) {
	hostname, err = os.Hostname()
	if err != nil {
		return "", "", err
	}

	osInfo = runtime.GOOS + "/" + runtime.GOARCH
	return hostname, osInfo, nil
}
