package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/DARC0625/LIMEN/backend/internal/errors"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/middleware"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"go.uber.org/zap"
)

type UpdateQuotaRequest struct {
	MaxVMs    *int `json:"max_vms,omitempty"`
	MaxCPU    *int `json:"max_cpu,omitempty"`
	MaxMemory *int `json:"max_memory,omitempty"`
}

type QuotaUsage struct {
	Quota models.ResourceQuota `json:"quota"`
	Usage struct {
		VMs    int `json:"vms"`
		CPU    int `json:"cpu"`
		Memory int `json:"memory"`
	} `json:"usage"`
}

// HandleGetQuota handles getting quota information for the current user.
func (h *Handler) HandleGetQuota(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	// Get user ID from context (for authentication, but quota is system-wide)
	_, ok := middleware.GetUserID(r.Context())
	if !ok {
		errors.WriteUnauthorized(w, "Authentication required")
		return
	}

	// Get or create system-wide quota (shared by all users)
	quota, err := models.GetOrCreateQuota(h.DB)
	if err != nil {
		logger.Log.Error("Failed to get quota", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	// Get current usage - system-wide (all users' VMs)
	var allVMs []models.VM
	if err := h.DB.Find(&allVMs).Error; err != nil {
		logger.Log.Error("Failed to get VMs", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	var usage QuotaUsage
	usage.Quota = *quota
	usage.Usage.VMs = len(allVMs) // Total VM count across all users (including stopped)
	
	// Only count Running VMs for CPU and Memory usage (system-wide)
	for _, vm := range allVMs {
		if vm.Status == models.VMStatusRunning {
			usage.Usage.CPU += vm.CPU
			usage.Usage.Memory += vm.Memory
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(usage)
}

// HandleUpdateQuota handles updating quota for a user (admin only).
func (h *Handler) HandleUpdateQuota(w http.ResponseWriter, r *http.Request) {
	if r.Method != "PUT" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	// Get user ID from context - only admin can update system-wide quota
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		errors.WriteUnauthorized(w, "Authentication required")
		return
	}

	// Check if user is admin using role from context
	role, ok := middleware.GetRole(r.Context())
	if !ok || role != string(models.RoleAdmin) {
		// Fallback: check if userID is 1 (for backward compatibility)
		if userID != 1 {
			errors.WriteForbidden(w, "Only admin can update system quota")
			return
		}
	}

	// Parse request body
	var req UpdateQuotaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errors.WriteBadRequest(w, "Invalid request body", err)
		return
	}

	// Get or create system-wide quota
	quota, err := models.GetOrCreateQuota(h.DB)
	if err != nil {
		logger.Log.Error("Failed to get quota", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	// Update quota fields
	if req.MaxCPU != nil {
		quota.MaxCPU = *req.MaxCPU
		// MaxVMs must equal MaxCPU
		quota.MaxVMs = quota.MaxCPU
	}
	if req.MaxMemory != nil {
		quota.MaxMemory = *req.MaxMemory
	}
	// MaxVMs is automatically set to MaxCPU, so ignore if explicitly set
	if req.MaxVMs != nil {
		// If MaxVMs is set, ignore it and use MaxCPU instead
		logger.Log.Warn("MaxVMs update ignored - it is automatically set to MaxCPU", zap.Int("requested", *req.MaxVMs))
	}

	// Validate quota values
	if quota.MaxVMs < 0 || quota.MaxCPU < 0 || quota.MaxMemory < 0 {
		errors.WriteBadRequest(w, "Quota values must be non-negative", nil)
		return
	}

	// Save quota
	if err := h.DB.Save(quota).Error; err != nil {
		logger.Log.Error("Failed to update quota", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	logger.Log.Info("System quota updated", zap.Int("max_cpu", quota.MaxCPU), zap.Int("max_vms", quota.MaxVMs), zap.Int("max_memory", quota.MaxMemory))
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(quota)
}

