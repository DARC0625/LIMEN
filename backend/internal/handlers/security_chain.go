package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/errors"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/security"
	"go.uber.org/zap"
)

// HandleSecurityChain handles GET /api/security/chain - Get security chain status.
// @Summary     Get security chain status
// @Description Returns the current security chain status including hardware, software, network, and user security
// @Tags        Security
// @Accept      json
// @Produce     json
// @Success     200  {object}  security.SecurityChain  "Security chain status"
// @Failure     500  {object}  map[string]interface{}  "Internal server error"
// @Router      /security/chain [get]
func (h *Handler) HandleSecurityChain(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	if r.Method != "GET" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	chain := security.GetCurrentChain()
	if chain == nil {
		// Validate chain if not available
		var err error
		chain, err = security.ValidateSecurityChain(r.Context())
		if err != nil {
			logger.Log.Error("Failed to validate security chain", zap.Error(err))
			errors.WriteInternalError(w, err, false)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(chain); err != nil {
		logger.Log.Error("Failed to encode security chain", zap.Error(err))
	}
}

// HandleSecurityChainReport handles GET /api/security/chain/report - Get security chain report.
func (h *Handler) HandleSecurityChainReport(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	if r.Method != "GET" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	chain := security.GetCurrentChain()
	if chain == nil {
		var err error
		chain, err = security.ValidateSecurityChain(r.Context())
		if err != nil {
			logger.Log.Error("Failed to validate security chain", zap.Error(err))
			errors.WriteInternalError(w, err, false)
			return
		}
	}

	report := security.FormatSecurityChainReport(chain)
	
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(report))
}

// HandleWeakestLink handles GET /api/security/weakest-link - Get the weakest link in security chain.
func (h *Handler) HandleWeakestLink(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	if r.Method != "GET" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	weakestLink := security.GetWeakestLink()
	if weakestLink == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "No weak links detected",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(weakestLink); err != nil {
		logger.Log.Error("Failed to encode weakest link", zap.Error(err))
	}
}

