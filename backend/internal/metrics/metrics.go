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

	// VM operation metrics
	VMActionTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "vm_action_total",
			Help: "Total number of VM actions",
		},
		[]string{"action", "status"}, // action: start, stop, pause, resume, status: success, error
	)

	VMActionDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "vm_action_duration_seconds",
			Help:    "VM action duration in seconds",
			Buckets: []float64{0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0},
		},
		[]string{"action"},
	)

	// Database query metrics
	DatabaseQueryDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "database_query_duration_seconds",
			Help:    "Database query duration in seconds",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0},
		},
		[]string{"operation"}, // operation: select, insert, update, delete
	)

	DatabaseQueryTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "database_query_total",
			Help: "Total number of database queries",
		},
		[]string{"operation", "status"}, // status: success, error
	)

	// Cache metrics
	CacheHits = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_hits_total",
			Help: "Total number of cache hits",
		},
		[]string{"cache_type"},
	)

	CacheMisses = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_misses_total",
			Help: "Total number of cache misses",
		},
		[]string{"cache_type"},
	)

	CacheSize = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "cache_size",
			Help: "Current cache size",
		},
		[]string{"cache_type"},
	)

	// WebSocket metrics
	WebSocketConnections = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "websocket_connections",
			Help: "Current number of WebSocket connections",
		},
	)

	WebSocketMessagesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "websocket_messages_total",
			Help: "Total number of WebSocket messages",
		},
		[]string{"type"}, // type: sent, received
	)

	// API response time metrics
	APIResponseTime = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "api_response_time_seconds",
			Help:    "API response time in seconds",
			Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0},
		},
		[]string{"endpoint", "method"},
	)

	// Quota metrics
	VMQuotaDeniedTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "vm_quota_denied_total",
			Help: "Total number of VM creation requests denied due to quota limits",
		},
		[]string{"resource", "user_id"}, // resource: VMs, CPU, Memory, Disk
	)

	// Console session metrics
	ConsoleActiveSessions = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "console_active_sessions",
			Help: "Current number of active console sessions",
		},
	)

	// Authentication metrics
	AuthFailureTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "auth_failure_total",
			Help: "Total number of authentication failures",
		},
		[]string{"reason"}, // reason: invalid_credentials, token_expired, etc.
	)

	// Host resource metrics
	HostCPUUsage = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "host_cpu_usage_percent",
			Help: "Host CPU usage percentage",
		},
	)

	HostMemoryUsage = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "host_memory_usage_percent",
			Help: "Host memory usage percentage",
		},
	)

	HostDiskUsage = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "host_disk_usage_percent",
			Help: "Host disk usage percentage",
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
