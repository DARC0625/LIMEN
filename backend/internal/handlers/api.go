package handlers

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/auth"
	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/errors"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/metrics"
	"github.com/DARC0625/LIMEN/backend/internal/middleware"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/DARC0625/LIMEN/backend/internal/validator"
	"github.com/DARC0625/LIMEN/backend/internal/vm"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Handler struct {
	DB                  *gorm.DB
	VMService           *vm.VMService
	VMStatusBroadcaster *VMStatusBroadcaster
	Config              *config.Config
}

func NewHandler(db *gorm.DB, vmService *vm.VMService, cfg *config.Config) *Handler {
	broadcaster := NewVMStatusBroadcaster()
	go broadcaster.Run()
	return &Handler{
		DB:                  db,
		VMService:           vmService,
		VMStatusBroadcaster: broadcaster,
		Config:              cfg,
	}
}

func (h *Handler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	dbStatus := "connected"
	sqlDB, err := h.DB.DB()
	if err != nil || sqlDB.Ping() != nil {
		dbStatus = "disconnected"
	}

	libvirtStatus := "disconnected"
	if h.VMService != nil {
		// Try to check if libvirt connection is alive
		if h.VMService.IsAlive() {
			libvirtStatus = "connected"
		} else {
			// If connection is dead, try to reconnect
			// This is a best-effort check, don't fail the health check if reconnect fails
			logger.Log.Debug("Libvirt connection appears dead, attempting to verify")
			// Just report as disconnected, don't try to reconnect here (that should be handled elsewhere)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"time":    time.Now().Format(time.RFC3339),
		"db":      dbStatus,
		"libvirt": libvirtStatus,
	})
}

type CreateVMRequest struct {
	Name   string `json:"name"`
	CPU    int    `json:"cpu"`
	Memory int    `json:"memory"`
	OSType string `json:"os_type"`
}

func (h *Handler) HandleVMs(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	switch r.Method {
	case "GET":
		var vms []models.VM
		if err := h.DB.Find(&vms).Error; err != nil {
			logger.Log.Error("Failed to fetch VMs", zap.Error(err))
			errors.WriteInternalError(w, err, cfg.Env == "development")
			return
		}

		// Sync VM statuses from libvirt to ensure accuracy (if VMService is available)
		if h.VMService != nil {
			for i := range vms {
				if err := h.VMService.SyncVMStatus(&vms[i]); err != nil {
					logger.Log.Warn("Failed to sync VM status", zap.String("vm_name", vms[i].Name), zap.Error(err))
					// Continue even if sync fails for one VM
				}
			}
		} else {
			logger.Log.Warn("VMService is not available, skipping status sync")
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(vms); err != nil {
			logger.Log.Error("Failed to encode VMs response", zap.Error(err))
		}
	case "POST":
		var req CreateVMRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			errors.WriteBadRequest(w, "Invalid request body", err)
			return
		}

		// Validate input
		if err := validator.ValidateVMName(req.Name); err != nil {
			errors.WriteBadRequest(w, err.Error(), err)
			return
		}
		if err := validator.ValidateCPU(req.CPU); err != nil {
			errors.WriteBadRequest(w, err.Error(), err)
			return
		}
		if err := validator.ValidateMemory(req.Memory); err != nil {
			errors.WriteBadRequest(w, err.Error(), err)
			return
		}
		if err := validator.ValidateOSType(req.OSType); err != nil {
			errors.WriteBadRequest(w, err.Error(), err)
			return
		}

		// Clean up existing DB record (including soft-deleted) to avoid unique constraint violation
		var existingVM models.VM
		if err := h.DB.Unscoped().Where("name = ?", req.Name).First(&existingVM).Error; err == nil {
			logger.Log.Info("Cleaning up existing DB record", zap.String("vm_name", req.Name))
			h.DB.Unscoped().Delete(&existingVM)
		}

		// Get user ID from context (set by auth middleware)
		userID, ok := middleware.GetUserID(r.Context())
		if !ok {
			userID = 1 // Fallback to admin if not authenticated (for backward compatibility)
		}

		// Check system-wide resource quota
		quota, err := models.GetOrCreateQuota(h.DB)
		if err != nil {
			logger.Log.Error("Failed to get quota", zap.Error(err))
			errors.WriteInternalError(w, err, cfg.Env == "development")
			return
		}

		if err := quota.CheckQuota(h.DB, req.CPU, req.Memory); err != nil {
			if quotaErr, ok := err.(*models.QuotaError); ok {
				errors.WriteBadRequest(w, quotaErr.Error(), nil)
			} else {
				errors.WriteInternalError(w, err, cfg.Env == "development")
			}
			return
		}

		// Create VM record first to get UUID
		newVM := models.VM{
			Name:    req.Name,
			CPU:     req.CPU,
			Memory:  req.Memory,
			OSType:  req.OSType,
			Status:  models.VMStatusStopped, // Will be updated after libvirt creation
			OwnerID: userID,
		}

		if err := h.DB.Create(&newVM).Error; err != nil {
			logger.Log.Error("Failed to save VM to DB", zap.Error(err), zap.String("vm_name", req.Name))
			errors.WriteInternalError(w, fmt.Errorf("VM created but failed to save to DB"), h.Config.Env == "development")
			return
		}

		// Create VM in libvirt using UUID for disk path
		if h.VMService == nil {
			logger.Log.Error("VMService is not available, cannot create VM")
			// Clean up DB record
			h.DB.Delete(&newVM)
			errors.WriteInternalError(w, fmt.Errorf("VM service is not available"), cfg.Env == "development")
			return
		}

		if err := h.VMService.CreateVM(req.Name, req.Memory, req.CPU, req.OSType, newVM.UUID); err != nil {
			logger.Log.Error("Failed to create VM in libvirt", zap.Error(err), zap.String("vm_name", req.Name), zap.String("uuid", newVM.UUID))
			// Clean up DB record
			h.DB.Delete(&newVM)
			errors.WriteInternalError(w, err, cfg.Env == "development")
			return
		}

		// Wait for VM to fully start and VNC to initialize
		// VNC port assignment can take a few seconds
		time.Sleep(3 * time.Second)

		// Sync actual status from libvirt (VM should be running now)
		actualStatus, err := h.VMService.GetVMStatusFromLibvirt(req.Name)
		if err == nil {
			newVM.Status = actualStatus
			// If VM is not running, try to start it
			if actualStatus != models.VMStatusRunning {
				logger.Log.Warn("VM created but not running, attempting to start", zap.String("vm_name", req.Name))
				if startErr := h.VMService.StartVM(req.Name); startErr != nil {
					logger.Log.Error("Failed to start VM after creation", zap.Error(startErr), zap.String("vm_name", req.Name))
				} else {
					// Wait a moment for VM to start
					time.Sleep(1 * time.Second)
					// Re-check status
					if updatedStatus, err := h.VMService.GetVMStatusFromLibvirt(req.Name); err == nil {
						newVM.Status = updatedStatus
					}
				}
			}
			h.DB.Save(&newVM)
		} else {
			logger.Log.Warn("Failed to get VM status after creation", zap.Error(err), zap.String("vm_name", req.Name))
		}

		// Update metrics
		metrics.VMCreateTotal.Inc()
		if err := h.UpdateMetrics(); err != nil {
			logger.Log.Warn("Failed to update metrics", zap.Error(err))
		}

		logger.Log.Info("VM created successfully", zap.String("vm_name", req.Name), zap.String("uuid", newVM.UUID), zap.Int("cpu", req.CPU), zap.Int("memory", req.Memory), zap.String("os_type", req.OSType), zap.String("status", string(newVM.Status)))

		// Broadcast VM update via WebSocket
		h.VMStatusBroadcaster.BroadcastVMUpdate(newVM)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		if err := json.NewEncoder(w).Encode(newVM); err != nil {
			logger.Log.Error("Failed to encode VM response", zap.Error(err))
		}
	default:
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
	}
}

type VMActionRequest struct {
	Action string `json:"action"`
	CPU    int    `json:"cpu,omitempty"`
	Memory int    `json:"memory,omitempty"`
}

func (h *Handler) HandleVMAction(w http.ResponseWriter, r *http.Request) {
	// Get VM UUID from URL path variable (set by mux router)
	vars := mux.Vars(r)
	uuidStr, ok := vars["uuid"]
	if !ok {
		errors.WriteBadRequest(w, "VM UUID is required", nil)
		return
	}

	var req VMActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errors.WriteBadRequest(w, "Invalid request body", err)
		return
	}

	var vmRec models.VM
	if err := h.DB.Where("uuid = ?", uuidStr).First(&vmRec).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			errors.WriteNotFound(w, "VM")
		} else {
			logger.Log.Error("Failed to find VM", zap.Error(err), zap.String("vm_uuid", uuidStr))
			errors.WriteInternalError(w, err, h.Config.Env == "development")
		}
		return
	}

	action := models.VMAction(req.Action)
	if !action.IsValid() {
		errors.WriteBadRequest(w, fmt.Sprintf("Invalid action: %s. Valid actions: start, stop, delete, update", req.Action), nil)
		return
	}

	switch action {
	case models.VMActionStart:
		if err := h.VMService.StartVM(vmRec.Name); err != nil {
			logger.Log.Error("Failed to start VM", zap.Error(err), zap.String("vm_name", vmRec.Name))
			errors.WriteInternalError(w, err, h.Config.Env == "development")
			return
		}
		vmRec.Status = models.VMStatusRunning
		logger.Log.Info("VM started", zap.String("vm_name", vmRec.Name))
		// Broadcast VM update via WebSocket
		h.VMStatusBroadcaster.BroadcastVMUpdate(vmRec)
	case models.VMActionStop:
		// Check if VM is actually running before trying to stop
		actualStatus, err := h.VMService.GetVMStatusFromLibvirt(vmRec.Name)
		if err != nil {
			logger.Log.Warn("Failed to get VM status from libvirt", zap.String("vm_name", vmRec.Name), zap.Error(err))
			// Try to stop anyway
			if err := h.VMService.StopVM(vmRec.Name); err != nil {
				logger.Log.Error("Failed to stop VM", zap.Error(err), zap.String("vm_name", vmRec.Name))
				errors.WriteInternalError(w, err, h.Config.Env == "development")
				return
			}
			vmRec.Status = models.VMStatusStopped
			logger.Log.Info("VM stopped", zap.String("vm_name", vmRec.Name))
			h.VMStatusBroadcaster.BroadcastVMUpdate(vmRec)
		} else if actualStatus == models.VMStatusStopped {
			// VM is already stopped, just sync the status
			vmRec.Status = models.VMStatusStopped
			if err := h.DB.Save(&vmRec).Error; err != nil {
				logger.Log.Error("Failed to save VM status", zap.Error(err))
			}
			h.VMStatusBroadcaster.BroadcastVMUpdate(vmRec)
			logger.Log.Info("VM was already stopped, status synced", zap.String("vm_name", vmRec.Name))
		} else {
			// VM is running, stop it
			if err := h.VMService.StopVM(vmRec.Name); err != nil {
				logger.Log.Error("Failed to stop VM", zap.Error(err), zap.String("vm_name", vmRec.Name))
				errors.WriteInternalError(w, err, h.Config.Env == "development")
				return
			}
			vmRec.Status = models.VMStatusStopped
			logger.Log.Info("VM stopped", zap.String("vm_name", vmRec.Name))
			// Broadcast VM update via WebSocket
			h.VMStatusBroadcaster.BroadcastVMUpdate(vmRec)
		}
	case models.VMActionDelete:
		if err := h.VMService.DeleteVM(vmRec.Name); err != nil {
			logger.Log.Error("Failed to delete VM", zap.Error(err), zap.String("vm_name", vmRec.Name))
			errors.WriteInternalError(w, err, h.Config.Env == "development")
			return
		}
		// DB deletion is handled inside VMService.DeleteVM with Unscoped()
		logger.Log.Info("VM deleted", zap.String("vm_name", vmRec.Name))

		// Broadcast VM deletion via WebSocket (send updated list)
		var allVMs []models.VM
		if err := h.DB.Find(&allVMs).Error; err == nil {
			h.VMStatusBroadcaster.BroadcastVMList(allVMs)
		}

		// Update metrics
		metrics.VMDeleteTotal.Inc()
		if err := h.UpdateMetrics(); err != nil {
			logger.Log.Warn("Failed to update metrics", zap.Error(err))
		}

		// Return success response with JSON
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "VM deleted successfully",
			"vm_uuid": uuidStr,
		})
		return
	case models.VMActionUpdate:
		if req.CPU == 0 || req.Memory == 0 {
			errors.WriteBadRequest(w, "CPU and Memory are required for update", nil)
			return
		}
		if err := validator.ValidateCPU(req.CPU); err != nil {
			errors.WriteBadRequest(w, err.Error(), err)
			return
		}
		if err := validator.ValidateMemory(req.Memory); err != nil {
			errors.WriteBadRequest(w, err.Error(), err)
			return
		}
		if err := h.VMService.UpdateVM(vmRec.Name, req.Memory, req.CPU); err != nil {
			logger.Log.Error("Failed to update VM", zap.Error(err), zap.String("vm_name", vmRec.Name))
			errors.WriteInternalError(w, err, h.Config.Env == "development")
			return
		}
		vmRec.CPU = req.CPU
		vmRec.Memory = req.Memory
		logger.Log.Info("VM updated", zap.String("vm_name", vmRec.Name), zap.Int("cpu", req.CPU), zap.Int("memory", req.Memory))
		// Broadcast VM update via WebSocket
		h.VMStatusBroadcaster.BroadcastVMUpdate(vmRec)
	default:
		if err := validator.ValidateVMAction(req.Action); err != nil {
			errors.WriteBadRequest(w, err.Error(), err)
			return
		}
	}

	if err := h.DB.Save(&vmRec).Error; err != nil {
		logger.Log.Error("Failed to save VM", zap.Error(err), zap.String("vm_name", vmRec.Name))
		errors.WriteInternalError(w, err, false)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(vmRec); err != nil {
		logger.Log.Error("Failed to encode VM response", zap.Error(err))
	}
}

// HandleVMDelete handles DELETE /api/vms/{uuid} - Delete VM
func (h *Handler) HandleVMDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != "DELETE" {
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

	// Get role from context
	role, _ := middleware.GetRole(r.Context())

	// Find VM by UUID
	var vmRec models.VM
	if err := h.DB.Where("uuid = ?", uuidStr).First(&vmRec).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			errors.WriteNotFound(w, "VM not found")
		} else {
			logger.Log.Error("Failed to find VM", zap.Error(err), zap.String("vm_uuid", uuidStr))
			errors.WriteInternalError(w, err, h.Config.Env == "development")
		}
		return
	}

	// Check ownership (user must own the VM or be admin)
	if vmRec.OwnerID != userID && role != string(models.RoleAdmin) {
		errors.WriteForbidden(w, "You don't have permission to delete this VM")
		return
	}

	// Delete VM from libvirt
	if err := h.VMService.DeleteVM(vmRec.Name); err != nil {
		logger.Log.Error("Failed to delete VM", zap.Error(err), zap.String("vm_name", vmRec.Name), zap.String("vm_uuid", uuidStr))
		errors.WriteInternalError(w, err, h.Config.Env == "development")
		return
	}
	// DB deletion is handled inside VMService.DeleteVM with Unscoped()
	logger.Log.Info("VM deleted", zap.String("vm_name", vmRec.Name), zap.String("vm_uuid", uuidStr))

	// Broadcast VM deletion via WebSocket (send updated list)
	var allVMs []models.VM
	if err := h.DB.Find(&allVMs).Error; err == nil {
		h.VMStatusBroadcaster.BroadcastVMList(allVMs)
	}

	// Update metrics
	metrics.VMDeleteTotal.Inc()
	if err := h.UpdateMetrics(); err != nil {
		logger.Log.Warn("Failed to update metrics", zap.Error(err))
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "VM deleted successfully",
		"vm_uuid": uuidStr,
	})
}

// newWebSocketUpgrader creates a WebSocket upgrader.
// Origin validation uses the same CORS configuration as HTTP requests.
func (h *Handler) newWebSocketUpgrader() websocket.Upgrader {
	return websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			allowed := h.isOriginAllowed(origin)
			if !allowed {
				logger.Log.Warn("WebSocket origin not allowed",
					zap.String("origin", origin),
					zap.String("path", r.URL.Path),
					zap.Strings("allowed_origins", h.Config.AllowedOrigins))
			}
			return allowed
		},
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}
}

// isOriginAllowed checks if the given origin is in the allowed origins list.
// Supports "*" as a wildcard to allow all origins.
// Also handles trailing slash variations (https://limen.kr vs https://limen.kr/)
func (h *Handler) isOriginAllowed(origin string) bool {
	if origin == "" {
		return false
	}
	if len(h.Config.AllowedOrigins) == 0 {
		return false
	}
	
	// Normalize origin (remove trailing slash)
	normalizedOrigin := strings.TrimSuffix(origin, "/")
	
	for _, allowed := range h.Config.AllowedOrigins {
		if allowed == "*" {
			return true
		}
		// Normalize allowed origin (remove trailing slash)
		normalizedAllowed := strings.TrimSuffix(allowed, "/")
		if normalizedAllowed == normalizedOrigin {
			return true
		}
		// Also check exact match for backward compatibility
		if allowed == origin {
			return true
		}
	}
	return false
}

func (h *Handler) HandleVNC(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers for WebSocket (before authentication)
	origin := r.Header.Get("Origin")
	if h.isOriginAllowed(origin) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
	}

	// Handle OPTIONS preflight request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Log incoming WebSocket connection attempt
	logger.Log.Info("VNC WebSocket connection attempt",
		zap.String("remote_addr", r.RemoteAddr),
		zap.String("origin", origin),
		zap.String("user_agent", r.Header.Get("User-Agent")),
		zap.String("path", r.URL.Path),
		zap.String("query", r.URL.RawQuery))

	// Verify authentication via token in query parameter or header
	// WebSocket doesn't support custom headers easily, so we use query param
	token := r.URL.Query().Get("token")
	if token == "" {
		// Try Authorization header as fallback
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			token = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}

	// Token is REQUIRED for production security
	if token == "" {
		logger.Log.Warn("VNC connection attempt without token",
			zap.String("remote_addr", r.RemoteAddr),
			zap.String("user_agent", r.Header.Get("User-Agent")),
			zap.String("referer", r.Header.Get("Referer")),
			zap.String("origin", r.Header.Get("Origin")))
		http.Error(w, "Authentication token required", http.StatusUnauthorized)
		return
	}

	// Validate JWT token
	claims, err := auth.ValidateToken(token, h.Config.JWTSecret)
	if err != nil {
		tokenPrefix := token
		if len(token) > 20 {
			tokenPrefix = token[:20]
		}
		logger.Log.Warn("VNC connection with invalid token",
			zap.Error(err),
			zap.String("remote_addr", r.RemoteAddr),
			zap.String("user_agent", r.Header.Get("User-Agent")),
			zap.String("origin", r.Header.Get("Origin")),
			zap.String("token_prefix", tokenPrefix))
		http.Error(w, fmt.Sprintf("Invalid or expired token: %v", err), http.StatusUnauthorized)
		return
	}

	// Check if user is approved
	if !claims.Approved && claims.Role != "admin" {
		logger.Log.Warn("VNC connection attempt by unapproved user",
			zap.Uint("user_id", claims.UserID),
			zap.String("username", claims.Username))
		http.Error(w, "Account pending approval", http.StatusForbidden)
		return
	}

	logger.Log.Info("VNC connection authenticated",
		zap.Uint("user_id", claims.UserID),
		zap.String("username", claims.Username),
		zap.String("role", claims.Role))

	upgrader := h.newWebSocketUpgrader()
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Log.Error("WebSocket upgrade failed",
			zap.Error(err),
			zap.String("path", r.URL.Path),
			zap.String("query", r.URL.RawQuery),
			zap.String("remote_addr", r.RemoteAddr),
			zap.String("user_agent", r.Header.Get("User-Agent")),
			zap.String("origin", r.Header.Get("Origin")),
			zap.Uint("user_id", claims.UserID),
			zap.String("username", claims.Username))
		http.Error(w, fmt.Sprintf("WebSocket upgrade failed: %v", err), http.StatusBadRequest)
		return
	}
	defer ws.Close()

	// Send initial connection status
	ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
	if err := ws.WriteMessage(websocket.TextMessage, []byte(`{"type":"status","message":"Connected, checking VM status..."}`)); err != nil {
		logger.Log.Warn("Failed to send initial status", zap.Error(err))
		return
	}
	ws.SetWriteDeadline(time.Time{}) // Clear deadline

	logger.Log.Info("WebSocket connection upgraded successfully",
		zap.String("path", r.URL.Path),
		zap.Uint("user_id", claims.UserID),
		zap.String("username", claims.Username))

	// Get VM UUID from query parameter
	uuidStr := r.URL.Query().Get("id")
	if uuidStr == "" {
		logger.Log.Warn("VNC connection attempt without VM UUID",
			zap.Uint("user_id", claims.UserID),
			zap.String("username", claims.Username))
		ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
		ws.WriteMessage(websocket.TextMessage, []byte(`{"type":"error","error":"VM UUID is required","code":"MISSING_VM_UUID"}`))
		ws.SetWriteDeadline(time.Time{})
		return
	}

	// Find VM by UUID only
	var vmRec models.VM
	if err := h.DB.Where("uuid = ?", uuidStr).First(&vmRec).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			logger.Log.Warn("VM not found for VNC connection",
				zap.String("uuid", uuidStr),
				zap.Uint("user_id", claims.UserID),
				zap.String("username", claims.Username))
			ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
			ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"type":"error","error":"VM not found","code":"VM_NOT_FOUND","vm_uuid":"%s"}`, uuidStr)))
			ws.SetWriteDeadline(time.Time{})
		} else {
			logger.Log.Error("Failed to find VM for VNC",
				zap.Error(err),
				zap.String("uuid", uuidStr),
				zap.Uint("user_id", claims.UserID),
				zap.String("username", claims.Username))
			ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
			ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"type":"error","error":"Database error","code":"DB_ERROR","details":"%v"}`, err)))
			ws.SetWriteDeadline(time.Time{})
		}
		return
	}

	logger.Log.Info("VNC connection request", zap.String("vm_uuid", vmRec.UUID), zap.String("vm_name", vmRec.Name), zap.Int("vm_id", int(vmRec.ID)))

	logger.Log.Info("VM found for VNC", zap.String("vm_name", vmRec.Name), zap.String("status", string(vmRec.Status)))

	// Sync VM status from libvirt to ensure accuracy
	actualStatus, err := h.VMService.GetVMStatusFromLibvirt(vmRec.Name)
	if err != nil {
		logger.Log.Warn("Failed to get VM status from libvirt", zap.String("vm_name", vmRec.Name), zap.Error(err))
	} else {
		// Update DB status if different
		if actualStatus != vmRec.Status {
			vmRec.Status = actualStatus
			h.DB.Save(&vmRec)
		}
	}

	// Check if VM is running, if not try to start it
	if vmRec.Status != models.VMStatusRunning {
		logger.Log.Info("VM is not running, attempting to start for VNC connection",
			zap.String("vm_name", vmRec.Name),
			zap.String("vm_uuid", vmRec.UUID),
			zap.String("status", string(vmRec.Status)),
			zap.Uint("user_id", claims.UserID),
			zap.String("username", claims.Username))

		// Try to start the VM
		ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
		ws.WriteMessage(websocket.TextMessage, []byte(`{"type":"status","message":"Starting VM..."}`))
		ws.SetWriteDeadline(time.Time{})

		if err := h.VMService.StartVM(vmRec.Name); err != nil {
			logger.Log.Error("Failed to start VM for VNC connection",
				zap.Error(err),
				zap.String("vm_name", vmRec.Name),
				zap.Uint("user_id", claims.UserID))
			ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
			ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"type":"error","error":"Failed to start VM","code":"VM_START_FAILED","status":"%s","details":"%v"}`, vmRec.Status, err)))
			ws.SetWriteDeadline(time.Time{})
			return
		}

		// Wait for VM to start and VNC to initialize
		// VNC port assignment can take a few seconds
		time.Sleep(3 * time.Second)

		// Re-check status
		if updatedStatus, err := h.VMService.GetVMStatusFromLibvirt(vmRec.Name); err == nil {
			vmRec.Status = updatedStatus
			h.DB.Save(&vmRec)
		}

		// If still not running, return error
		if vmRec.Status != models.VMStatusRunning {
			logger.Log.Warn("VM failed to start after attempt",
				zap.String("vm_name", vmRec.Name),
				zap.String("status", string(vmRec.Status)),
				zap.Uint("user_id", claims.UserID))
			ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
			ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"type":"error","error":"VM is not running","code":"VM_NOT_RUNNING","status":"%s","message":"VM failed to start"}`, vmRec.Status)))
			ws.SetWriteDeadline(time.Time{})
			return
		}

		logger.Log.Info("VM started successfully for VNC connection",
			zap.String("vm_name", vmRec.Name),
			zap.Uint("user_id", claims.UserID))
	}

	// Send status update
	ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
	ws.WriteMessage(websocket.TextMessage, []byte(`{"type":"status","message":"Getting VNC port..."}`))
	ws.SetWriteDeadline(time.Time{})

	// Get VNC port with retry (GetVNCPort already has retry logic)
	vncPort, err := h.VMService.GetVNCPort(vmRec.Name)
	if err != nil {
		logger.Log.Error("Failed to get VNC port after retries",
			zap.Error(err),
			zap.String("vm_name", vmRec.Name),
			zap.String("vm_uuid", vmRec.UUID),
			zap.Uint("user_id", claims.UserID),
			zap.String("username", claims.Username))
		ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"type":"error","error":"Failed to get VNC port","code":"VNC_PORT_ERROR","details":"%v","message":"VNC port not available yet. Please wait a moment and try again."}`, err)))
		ws.SetWriteDeadline(time.Time{})
		return
	}

	logger.Log.Info("VNC port retrieved successfully",
		zap.String("vm_name", vmRec.Name),
		zap.String("vnc_port", vncPort),
		zap.Uint("user_id", claims.UserID))

	// Send status update
	ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
	ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"type":"status","message":"Connecting to VNC server on port %s..."}`, vncPort)))
	ws.SetWriteDeadline(time.Time{})

	targetAddr := fmt.Sprintf("localhost:%s", vncPort)

	// Try to connect to VNC server with timeout and retry
	var conn net.Conn
	maxConnectionRetries := 3
	connectionRetryDelay := 500 * time.Millisecond

	for i := 0; i < maxConnectionRetries; i++ {
		var err error
		conn, err = net.DialTimeout("tcp", targetAddr, 3*time.Second)
		if err == nil {
			break
		}

		if i < maxConnectionRetries-1 {
			logger.Log.Debug("VNC connection attempt failed, retrying",
				zap.String("address", targetAddr),
				zap.Int("attempt", i+1),
				zap.Error(err))
			time.Sleep(connectionRetryDelay)
		}
	}

	if conn == nil {
		logger.Log.Error("Failed to connect to VNC server after retries",
			zap.String("address", targetAddr),
			zap.String("vm_name", vmRec.Name),
			zap.String("vm_uuid", vmRec.UUID),
			zap.String("vnc_port", vncPort),
			zap.Uint("user_id", claims.UserID),
			zap.String("username", claims.Username))
		ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"type":"error","error":"Failed to connect to VNC server","code":"VNC_CONNECTION_FAILED","address":"%s","message":"VNC server not ready. Please wait a moment and try again."}`, targetAddr)))
		ws.SetWriteDeadline(time.Time{})
		return
	}
	defer conn.Close()

	logger.Log.Info("VNC connection established",
		zap.String("vm_name", vmRec.Name),
		zap.String("vm_uuid", vmRec.UUID),
		zap.String("vnc_port", vncPort),
		zap.String("target_address", targetAddr),
		zap.Uint("user_id", claims.UserID),
		zap.String("username", claims.Username))

	// Send success status
	ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
	ws.WriteMessage(websocket.TextMessage, []byte(`{"type":"status","message":"VNC connection established, starting proxy..."}`))
	ws.SetWriteDeadline(time.Time{})

	errc := make(chan error, 2)

	go func() {
		for {
			_, message, err := ws.ReadMessage()
			if err != nil {
				logger.Log.Debug("VNC WebSocket read error",
					zap.Error(err),
					zap.String("vm_uuid", vmRec.UUID),
					zap.Uint("user_id", claims.UserID))
				errc <- err
				return
			}
			if _, err := conn.Write(message); err != nil {
				logger.Log.Error("VNC TCP write error",
					zap.Error(err),
					zap.String("vm_uuid", vmRec.UUID),
					zap.Uint("user_id", claims.UserID))
				errc <- err
				return
			}
		}
	}()

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := conn.Read(buf)
			if err != nil {
				logger.Log.Debug("VNC TCP read error",
					zap.Error(err),
					zap.String("vm_uuid", vmRec.UUID),
					zap.Uint("user_id", claims.UserID))
				errc <- err
				return
			}
			if err := ws.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
				logger.Log.Error("VNC WebSocket write error",
					zap.Error(err),
					zap.String("vm_uuid", vmRec.UUID),
					zap.Uint("user_id", claims.UserID))
				errc <- err
				return
			}
		}
	}()

	err = <-errc
	logger.Log.Info("VNC connection closed",
		zap.Error(err),
		zap.String("vm_uuid", vmRec.UUID),
		zap.Uint("user_id", claims.UserID),
		zap.String("username", claims.Username))
}
