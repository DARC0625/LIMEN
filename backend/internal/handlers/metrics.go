package handlers

import (
	"net/http"

	"github.com/DARC0625/LIMEN/backend/internal/metrics"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// HandleMetrics serves Prometheus metrics endpoint.
func (h *Handler) HandleMetrics(w http.ResponseWriter, r *http.Request) {
	promhttp.Handler().ServeHTTP(w, r)
}

// UpdateMetrics updates all metrics based on current database state.
func (h *Handler) UpdateMetrics() error {
	// Update VM metrics
	var vms []models.VM
	if err := h.DB.Find(&vms).Error; err != nil {
		return err
	}

	vmCountByStatus := make(map[string]int)
	cpuByStatus := make(map[string]int)
	memoryByStatus := make(map[string]int)

	for _, vm := range vms {
		status := string(vm.Status)
		vmCountByStatus[status]++
		cpuByStatus[status] += vm.CPU
		memoryByStatus[status] += vm.Memory
	}

	// Update metrics
	metrics.UpdateVMMetrics(vmCountByStatus, cpuByStatus, memoryByStatus)

	// Update user count
	var userCount int64
	if err := h.DB.Model(&models.User{}).Count(&userCount).Error; err != nil {
		return err
	}
	metrics.UserTotal.Set(float64(userCount))

	return nil
}
