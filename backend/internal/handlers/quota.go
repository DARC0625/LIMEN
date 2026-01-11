package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/DARC0625/LIMEN/backend/internal/auth"
	"github.com/DARC0625/LIMEN/backend/internal/config"
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

// HandleGetQuotaHTTP is the standard HTTP handler wrapper for HandleGetQuota.
// This maintains compatibility with router and test code that expects standard HTTP handler signature.
// Updated for workflow testing.
func (h *Handler) HandleGetQuotaHTTP(w http.ResponseWriter, r *http.Request) {
	h.HandleGetQuota(w, r, h.Config)
}

// HandleGetQuota handles getting quota information for the current user.
// Uses session-based authentication (refresh_token cookie) similar to /api/auth/session
func (h *Handler) HandleGetQuota(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	if r.Method != "GET" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	// Try to get user ID from context first (if Auth middleware already authenticated)
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		// Fallback: Authenticate via refresh_token cookie (session-based)
		// Use common function to ensure consistent security checks
		cookie, err := r.Cookie("refresh_token")
		if err != nil {
			// No cookie
			logger.Log.Debug("Quota endpoint authentication failed",
				zap.String("path", r.URL.Path),
				zap.String("remote_addr", r.RemoteAddr),
				zap.String("reason", string(auth.ReasonMissingCookie)),
				zap.Error(err))
			errors.WriteUnauthorized(w, "Authentication required")
			return
		}

		refreshToken := strings.TrimSpace(cookie.Value)
		if refreshToken == "" {
			// Empty token
			logger.Log.Debug("Quota endpoint authentication failed",
				zap.String("path", r.URL.Path),
				zap.String("remote_addr", r.RemoteAddr),
				zap.String("reason", string(auth.ReasonEmptyToken)))
			errors.WriteUnauthorized(w, "Authentication required")
			return
		}

		var authErr error
		userID, _, ok, authErr = auth.ResolveUserFromRefreshToken(refreshToken, cfg.JWTSecret)
		if !ok {
			// Security: Log authentication failures with reason for monitoring
			logger.Log.Debug("Quota endpoint authentication failed",
				zap.String("path", r.URL.Path),
				zap.String("remote_addr", r.RemoteAddr),
				zap.String("reason", string(auth.Reason(authErr))),
				zap.Error(authErr))
			errors.WriteUnauthorized(w, "Authentication required")
			return
		}

		logger.Log.Debug("Authenticated quota request via refresh token cookie",
			zap.String("path", r.URL.Path),
			zap.Uint("user_id", userID))
	}

	// Get or create system-wide quota (shared by all users)
	quota, err := models.GetOrCreateQuota(h.DB)
	if err != nil {
		logger.Log.Error("Failed to get quota", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	// Get current usage - system-wide (all users' VMs)
	// Optimized: Only fetch necessary fields (status, cpu, memory) for quota calculation
	var allVMs []models.VM
	if err := h.DB.Select("status", "cpu", "memory").Find(&allVMs).Error; err != nil {
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
