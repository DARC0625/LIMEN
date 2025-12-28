package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/DARC0625/LIMEN/backend/internal/errors"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/middleware"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/gorilla/mux"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// HandleVMStats handles getting VM resource usage statistics
func (h *Handler) HandleVMStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	// Get VM UUID from URL path variable
	vars := mux.Vars(r)
	uuidStr, ok := vars["uuid"]
	if !ok {
		errors.WriteBadRequest(w, "VM UUID is required", nil)
		return
	}

	// Get user ID from context
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		errors.WriteUnauthorized(w, "Authentication required")
		return
	}

	// Find VM by UUID
	var vmRec models.VM
	if err := h.DB.Where("uuid = ?", uuidStr).First(&vmRec).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			errors.WriteNotFound(w, "VM")
		} else {
			logger.Log.Error("Failed to find VM", zap.Error(err), zap.String("vm_uuid", uuidStr))
			errors.WriteInternalError(w, err, false)
		}
		return
	}

	// Check if user owns the VM (or is admin)
	role, _ := middleware.GetRole(r.Context())
	if vmRec.OwnerID != userID && role != string(models.RoleAdmin) {
		errors.WriteForbidden(w, "Access denied")
		return
	}

	// Get VM stats
	stats, err := h.VMService.GetVMStats(vmRec.Name)
	if err != nil {
		logger.Log.Error("Failed to get VM stats", zap.Error(err), zap.String("vm_name", vmRec.Name))
		errors.WriteInternalError(w, err, false)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(stats); err != nil {
		logger.Log.Error("Failed to encode VM stats response", zap.Error(err))
	}
}
