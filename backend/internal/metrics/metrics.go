// Package metrics provides Prometheus metrics for the application.
package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// HTTP metrics
	HTTPRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "endpoint", "status"},
	)

	HTTPRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "endpoint"},
	)

	// VM metrics
	VMTotal = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "vm_total",
			Help: "Total number of VMs",
		},
		[]string{"status"},
	)

	VMCPUUsage = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "vm_cpu_cores",
			Help: "Total CPU cores allocated to VMs",
		},
		[]string{"status"},
	)

	VMMemoryUsage = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "vm_memory_mb",
			Help: "Total memory allocated to VMs in MB",
		},
		[]string{"status"},
	)

	VMCreateTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "vm_create_total",
			Help: "Total number of VMs created",
		},
	)

	VMDeleteTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "vm_delete_total",
			Help: "Total number of VMs deleted",
		},
	)

	VMSnapshotTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "vm_snapshot_total",
			Help: "Total number of snapshots created",
		},
	)

	VMSnapshotRestoreTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "vm_snapshot_restore_total",
			Help: "Total number of snapshots restored",
		},
	)

	// User metrics
	UserTotal = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "user_total",
			Help: "Total number of users",
		},
	)

	UserLoginTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "user_login_total",
			Help: "Total number of user logins",
		},
	)

	// Database metrics
	DatabaseConnections = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "database_connections",
			Help: "Number of database connections",
		},
	)

	// Libvirt metrics
	LibvirtConnectionStatus = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "libvirt_connection_status",
			Help: "Libvirt connection status (1 = connected, 0 = disconnected)",
		},
	)
)

// UpdateVMMetrics updates VM-related metrics based on current state.
func UpdateVMMetrics(vmCountByStatus map[string]int, cpuByStatus map[string]int, memoryByStatus map[string]int) {
	// Reset all metrics
	VMTotal.Reset()
	VMCPUUsage.Reset()
	VMMemoryUsage.Reset()

	// Update metrics
	for status, count := range vmCountByStatus {
		VMTotal.WithLabelValues(status).Set(float64(count))
	}
	for status, cpu := range cpuByStatus {
		VMCPUUsage.WithLabelValues(status).Set(float64(cpu))
	}
	for status, memory := range memoryByStatus {
		VMMemoryUsage.WithLabelValues(status).Set(float64(memory))
	}
}


