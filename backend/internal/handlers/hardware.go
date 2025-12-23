package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/errors"
	"github.com/DARC0625/LIMEN/backend/internal/hardware"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"go.uber.org/zap"
)

// HandleHardwareSpec handles GET /api/hardware/spec - Get hardware specification.
// @Summary     Get hardware specification
// @Description Returns the current hardware specification of the server
// @Tags        Hardware
// @Accept      json
// @Produce     json
// @Success     200  {object}  hardware.Spec  "Hardware specification"
// @Failure     500  {object}  map[string]interface{}  "Internal server error"
// @Router      /hardware/spec [get]
func (h *Handler) HandleHardwareSpec(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	if r.Method != "GET" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	spec := hardware.GetCurrentSpec()
	if spec == nil {
		errors.WriteInternalError(w, nil, false)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(spec); err != nil {
		logger.Log.Error("Failed to encode hardware spec", zap.Error(err))
	}
}

// HandleHardwareSecurityConfig handles GET /api/hardware/security-config - Get optimal security configuration.
// @Summary     Get security configuration
// @Description Returns the optimal security configuration based on hardware capabilities
// @Tags        Hardware
// @Accept      json
// @Produce     json
// @Success     200  {object}  hardware.SecurityConfig  "Security configuration"
// @Router      /hardware/security-config [get]
func (h *Handler) HandleHardwareSecurityConfig(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	if r.Method != "GET" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	secConfig := hardware.GetOptimalSecurityConfig()

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(secConfig); err != nil {
		logger.Log.Error("Failed to encode security config", zap.Error(err))
	}
}

// HandleHardwareUpdate handles POST /api/hardware/update - Manually update hardware specification.
func (h *Handler) HandleHardwareUpdate(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	if r.Method != "POST" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	spec, err := hardware.UpdateSpec()
	if err != nil {
		logger.Log.Error("Failed to update hardware spec", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Hardware specification updated",
		"spec":    spec,
	})
}

