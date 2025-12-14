package handlers

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

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
	DB                   *gorm.DB
	VMService            *vm.VMService
	VMStatusBroadcaster  *VMStatusBroadcaster
}

func NewHandler(db *gorm.DB, vmService *vm.VMService) *Handler {
	broadcaster := NewVMStatusBroadcaster()
	go broadcaster.Run()
	return &Handler{
		DB:                  db,
		VMService:           vmService,
		VMStatusBroadcaster: broadcaster,
	}
}

func (h *Handler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	dbStatus := "connected"
	sqlDB, err := h.DB.DB()
	if err != nil || sqlDB.Ping() != nil {
		dbStatus = "disconnected"
	}

	libvirtStatus := "disconnected"
	if h.VMService != nil && h.VMService.IsAlive() {
		libvirtStatus = "connected"
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

func (h *Handler) HandleVMs(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		var vms []models.VM
		if err := h.DB.Find(&vms).Error; err != nil {
			logger.Log.Error("Failed to fetch VMs", zap.Error(err))
			errors.WriteInternalError(w, err, false)
			return
		}
		
		// Sync VM statuses from libvirt to ensure accuracy
		for i := range vms {
			if err := h.VMService.SyncVMStatus(&vms[i]); err != nil {
				logger.Log.Warn("Failed to sync VM status", zap.String("vm_name", vms[i].Name), zap.Error(err))
				// Continue even if sync fails for one VM
			}
		}
		
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(vms); err != nil {
			logger.Log.Error("Failed to encode VMs response", zap.Error(err))
		}
	} else if r.Method == "POST" {
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

		if err := h.VMService.CreateVM(req.Name, req.Memory, req.CPU, req.OSType); err != nil {
			logger.Log.Error("Failed to create VM", zap.Error(err), zap.String("vm_name", req.Name))
			errors.WriteInternalError(w, err, false)
			return
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
			errors.WriteInternalError(w, err, false)
			return
		}

		if err := quota.CheckQuota(h.DB, req.CPU, req.Memory); err != nil {
			if quotaErr, ok := err.(*models.QuotaError); ok {
				errors.WriteBadRequest(w, quotaErr.Error(), nil)
			} else {
				errors.WriteInternalError(w, err, false)
			}
			return
		}

		newVM := models.VM{
			Name:    req.Name,
			CPU:     req.CPU,
			Memory:  req.Memory,
			OSType:  req.OSType,
			Status:  models.VMStatusRunning,
			OwnerID: userID,
		}

		if err := h.DB.Create(&newVM).Error; err != nil {
			logger.Log.Error("Failed to save VM to DB", zap.Error(err), zap.String("vm_name", req.Name))
			errors.WriteInternalError(w, fmt.Errorf("VM created but failed to save to DB"), false)
			return
		}

		// Update metrics
		metrics.VMCreateTotal.Inc()
		if err := h.UpdateMetrics(); err != nil {
			logger.Log.Warn("Failed to update metrics", zap.Error(err))
		}

		logger.Log.Info("VM created successfully", zap.String("vm_name", req.Name), zap.Int("cpu", req.CPU), zap.Int("memory", req.Memory), zap.String("os_type", req.OSType))
		
		// Broadcast VM update via WebSocket
		h.VMStatusBroadcaster.BroadcastVMUpdate(newVM)
		
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		if err := json.NewEncoder(w).Encode(newVM); err != nil {
			logger.Log.Error("Failed to encode VM response", zap.Error(err))
		}
	} else {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
	}
}

type VMActionRequest struct {
	Action string `json:"action"`
	CPU    int    `json:"cpu,omitempty"`
	Memory int    `json:"memory,omitempty"`
}

func (h *Handler) HandleVMAction(w http.ResponseWriter, r *http.Request) {
	// Get VM ID from URL path variable (set by mux router)
	vars := mux.Vars(r)
	idStr, ok := vars["id"]
	if !ok {
		errors.WriteBadRequest(w, "VM ID is required", nil)
		return
	}
	
	id, err := strconv.Atoi(idStr)
	if err != nil {
		errors.WriteBadRequest(w, "Invalid VM ID", err)
		return
	}

	var req VMActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errors.WriteBadRequest(w, "Invalid request body", err)
		return
	}

	var vmRec models.VM
	if err := h.DB.First(&vmRec, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			errors.WriteNotFound(w, "VM")
		} else {
			logger.Log.Error("Failed to find VM", zap.Error(err), zap.Int("vm_id", id))
			errors.WriteInternalError(w, err, false)
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
			errors.WriteInternalError(w, err, false)
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
				errors.WriteInternalError(w, err, false)
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
				errors.WriteInternalError(w, err, false)
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
			errors.WriteInternalError(w, err, false)
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
			"vm_id":   id,
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
			errors.WriteInternalError(w, err, false)
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

// newWebSocketUpgrader creates a WebSocket upgrader.
// Note: Origin validation is handled by CORS middleware.
func (h *Handler) newWebSocketUpgrader() websocket.Upgrader {
	return websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			// Origin validation is handled by CORS middleware
			// For WebSocket, we allow all origins if CORS middleware passed
			return true
		},
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}
}

func (h *Handler) HandleVNC(w http.ResponseWriter, r *http.Request) {
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

	// If token is provided, validate it (optional for now, but recommended)
	// For now, we'll allow connections but log them
	if token != "" {
		// Token validation could be added here if needed
		tokenPrefix := token
		if len(token) > 10 {
			tokenPrefix = token[:10]
		}
		logger.Log.Info("VNC connection with token", zap.String("token_prefix", tokenPrefix))
	}

	upgrader := h.newWebSocketUpgrader()
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Log.Error("WebSocket upgrade failed", zap.Error(err), zap.String("path", r.URL.Path), zap.String("query", r.URL.RawQuery))
		return
	}
	defer ws.Close()
	
	logger.Log.Info("WebSocket connection upgraded successfully", zap.String("path", r.URL.Path))

	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		logger.Log.Warn("VNC connection attempt without VM ID")
		ws.WriteMessage(websocket.TextMessage, []byte("VM ID is required"))
		return
	}

	id, err := strconv.Atoi(idStr)
	if err != nil {
		logger.Log.Warn("Invalid VM ID in VNC request", zap.String("id", idStr), zap.Error(err))
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Invalid VM ID: %s", idStr)))
		return
	}
	
	logger.Log.Info("VNC connection request", zap.Int("vm_id", id))

	var vmRec models.VM
	if err := h.DB.First(&vmRec, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			logger.Log.Warn("VM not found for VNC connection", zap.Int("vm_id", id))
			ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("VM not found: %d", id)))
		} else {
			logger.Log.Error("Failed to find VM for VNC", zap.Error(err), zap.Int("vm_id", id))
			ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Failed to find VM: %v", err)))
		}
		return
	}
	
	logger.Log.Info("VM found for VNC", zap.String("vm_name", vmRec.Name), zap.String("status", string(vmRec.Status)))

	// Check if VM is running
	if vmRec.Status != models.VMStatusRunning {
		logger.Log.Warn("VNC connection attempt to non-running VM", zap.String("vm_name", vmRec.Name), zap.String("status", string(vmRec.Status)))
		// Send error message to client before closing
		ws.WriteMessage(websocket.TextMessage, []byte("VM is not running. Please start the VM first."))
		return
	}

	vncPort, err := h.VMService.GetVNCPort(vmRec.Name)
	if err != nil {
		logger.Log.Error("Failed to get VNC port", zap.Error(err), zap.String("vm_name", vmRec.Name))
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Failed to get VNC port: %v", err)))
		return
	}

	targetAddr := fmt.Sprintf("localhost:%s", vncPort)
	conn, err := net.Dial("tcp", targetAddr)
	if err != nil {
		logger.Log.Error("Failed to connect to VNC server", zap.Error(err), zap.String("address", targetAddr))
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Failed to connect to VNC server: %v", err)))
		return
	}
	defer conn.Close()

	logger.Log.Info("VNC connection established", zap.String("vm_name", vmRec.Name), zap.String("port", vncPort))

	errc := make(chan error, 2)

	go func() {
		for {
			_, message, err := ws.ReadMessage()
			if err != nil {
				errc <- err
				return
			}
			if _, err := conn.Write(message); err != nil {
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
				errc <- err
				return
			}
			if err := ws.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
				errc <- err
				return
			}
		}
	}()

	<-errc
}

