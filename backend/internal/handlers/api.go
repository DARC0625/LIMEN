package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
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

// Buffer pool for VNC connections to reduce memory allocations
var vncBufferPool = sync.Pool{
	New: func() interface{} {
		// 32KB buffer for VNC screen updates
		return make([]byte, 32768)
	},
}

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

// HandleHealth handles health check endpoint
// @Summary Health check
// @Description Returns the health status of the backend service including database and libvirt connections
// @Tags system
// @Accept json
// @Produce json
// @Success 200 {object} map[string]string "Service health status" example({"status":"ok","db":"connected","libvirt":"connected","time":"2025-12-29T23:15:32+09:00"})
// @Router /health [get]
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
	Name   string `json:"name" example:"my-vm" binding:"required"` // VM name (unique)
	CPU    int    `json:"cpu" example:"4" binding:"required,min=1,max=32"` // Number of CPU cores (1-32)
	Memory int    `json:"memory" example:"4096" binding:"required,min=512"` // Memory in MB (minimum 512MB)
	OSType string `json:"os_type" example:"ubuntu" binding:"required"` // OS type (must exist in VMImage table)
}

// HandleVMs handles VM list and creation
// @Summary List or create VMs
// @Description Get list of all VMs or create a new VM. For POST, requires valid OS type in VMImage table.
// @Tags vms
// @Accept json
// @Produce json
// @Param request body CreateVMRequest false "VM creation request (for POST only)"
// @Success 200 {array} models.VM "List of VMs (for GET)"
// @Success 201 {object} models.VM "VM created successfully (for POST)"
// @Failure 400 {object} map[string]interface{} "Invalid request (invalid parameters, OS type not found, etc.)"
// @Failure 401 {object} map[string]interface{} "Unauthorized - missing or invalid JWT token"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Security BearerAuth
// @Router /vms [get]
// @Router /vms [post]
func (h *Handler) HandleVMs(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	switch r.Method {
	case "GET":
		var vms []models.VM
		// Optimized: Use Select to fetch only necessary fields for better performance
		if err := h.DB.Select("id", "uuid", "name", "status", "cpu", "memory", "owner_id", "created_at", "updated_at").Find(&vms).Error; err != nil {
			logger.Log.Error("Failed to fetch VMs", zap.Error(err))
			errors.WriteInternalError(w, err, cfg.Env == "development")
			return
		}

		// Sync VM statuses from libvirt to ensure accuracy (if VMService is available)
		// Optimized: Only sync if there are VMs and VMService is available
		if h.VMService != nil && len(vms) > 0 {
			// Use goroutines for parallel status sync (limited concurrency)
			const maxConcurrency = 5
			sem := make(chan struct{}, maxConcurrency)
			var wg sync.WaitGroup
			
			for i := range vms {
				wg.Add(1)
				go func(idx int) {
					defer wg.Done()
					sem <- struct{}{} // Acquire semaphore
					defer func() { <-sem }() // Release semaphore
					
					if err := h.VMService.SyncVMStatus(&vms[idx]); err != nil {
						logger.Log.Debug("Failed to sync VM status", zap.String("vm_name", vms[idx].Name), zap.Error(err))
						// Continue even if sync fails for one VM
					}
				}(i)
			}
			wg.Wait()
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

		// Optimized: Use transaction to ensure atomicity between DB and libvirt operations
		// Create VM record first to get UUID
		newVM := models.VM{
			Name:    req.Name,
			CPU:     req.CPU,
			Memory:  req.Memory,
			OSType:  req.OSType,
			Status:  models.VMStatusStopped, // Will be updated after libvirt creation
			OwnerID: userID,
		}

		// Use transaction to ensure atomicity
		tx := h.DB.Begin()
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
			}
		}()

		if err := tx.Create(&newVM).Error; err != nil {
			tx.Rollback()
			logger.Log.Error("Failed to save VM to DB", zap.Error(err), zap.String("vm_name", req.Name))
			errors.WriteInternalError(w, fmt.Errorf("VM created but failed to save to DB"), h.Config.Env == "development")
			return
		}

		// Create VM in libvirt using UUID for disk path
		if h.VMService == nil {
			tx.Rollback()
			logger.Log.Error("VMService is not available, cannot create VM")
			errors.WriteInternalError(w, fmt.Errorf("VM service is not available"), cfg.Env == "development")
			return
		}

		if err := h.VMService.CreateVM(req.Name, req.Memory, req.CPU, req.OSType, newVM.UUID); err != nil {
			tx.Rollback()
			logger.Log.Error("Failed to create VM in libvirt", zap.Error(err), zap.String("vm_name", req.Name), zap.String("uuid", newVM.UUID))
			errors.WriteInternalError(w, err, cfg.Env == "development")
			return
		}

		// Commit transaction only after successful libvirt creation
		if err := tx.Commit().Error; err != nil {
			logger.Log.Error("Failed to commit VM creation transaction", zap.Error(err))
			// Try to cleanup libvirt domain
			if delErr := h.VMService.DeleteVM(req.Name); delErr != nil {
				logger.Log.Warn("Failed to cleanup libvirt domain after transaction failure", zap.Error(delErr))
			}
			errors.WriteInternalError(w, err, cfg.Env == "development")
			return
		}

		// Optimized: Use context with timeout instead of fixed sleep
		// Wait for VM to fully start and VNC to initialize
		// VNC port assignment can take a few seconds
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		
		// Poll for VM to be ready with timeout
		ready := false
		for i := 0; i < 10; i++ {
			select {
			case <-ctx.Done():
				logger.Log.Warn("Timeout waiting for VM to be ready", zap.String("vm_name", req.Name))
				break
			default:
				if status, err := h.VMService.GetVMStatusFromLibvirt(req.Name); err == nil && status == models.VMStatusRunning {
					ready = true
					break
				}
				time.Sleep(1 * time.Second)
			}
			if ready {
				break
			}
		}

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
					// Optimized: Use context with timeout instead of fixed sleep
					// Wait for VM to start (max 3 seconds)
					ctx2, cancel2 := context.WithTimeout(context.Background(), 3*time.Second)
					ticker2 := time.NewTicker(500 * time.Millisecond)
					defer ticker2.Stop()
					defer cancel2()
					
					vmStarted := false
					for {
						select {
						case <-ctx2.Done():
							break
						case <-ticker2.C:
							if updatedStatus, err := h.VMService.GetVMStatusFromLibvirt(req.Name); err == nil {
								newVM.Status = updatedStatus
								if updatedStatus == models.VMStatusRunning {
									vmStarted = true
									break
								}
							}
						}
						if vmStarted {
							break
						}
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
	Action string `json:"action" example:"start"` // Valid actions: start, stop, restart, delete, update
	CPU    int    `json:"cpu,omitempty" example:"4"` // Required for update action
	Memory int    `json:"memory,omitempty" example:"4096"` // Required for update action (in MB)
}

// HandleVMAction handles VM actions (start, stop, restart, delete, update)
// @Summary Perform VM action
// @Description Execute an action on a VM (start, stop, restart, delete, or update resources)
// @Tags vms
// @Accept json
// @Produce json
// @Param uuid path string true "VM UUID" format(uuid)
// @Param request body VMActionRequest true "Action request"
// @Success 200 {object} map[string]interface{} "Action completed successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request"
// @Failure 404 {object} map[string]interface{} "VM not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Security BearerAuth
// @Router /vms/{uuid}/action [post]
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
		errors.WriteBadRequest(w, fmt.Sprintf("Invalid action: %s. Valid actions: start, stop, restart, delete, update", req.Action), nil)
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
	case models.VMActionRestart:
		// Restart VM (stop and start)
		// Media is NOT automatically detached - user must manually detach if needed
		if err := h.VMService.RestartVM(vmRec.Name); err != nil {
			logger.Log.Error("Failed to restart VM", zap.Error(err), zap.String("vm_name", vmRec.Name))
			errors.WriteInternalError(w, err, h.Config.Env == "development")
			return
		}
		vmRec.Status = models.VMStatusRunning
		logger.Log.Info("VM restarted", zap.String("vm_name", vmRec.Name))
		// Broadcast VM update via WebSocket
		h.VMStatusBroadcaster.BroadcastVMUpdate(vmRec)
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
				logger.Log.Warn("WebSocket origin not allowed - CheckOrigin returning false (will cause 403)",
					zap.String("origin", origin),
					zap.String("path", r.URL.Path),
					zap.String("remote_addr", r.RemoteAddr),
					zap.String("host", r.Host),
					zap.Strings("allowed_origins", h.Config.AllowedOrigins))
			}
			// Removed verbose logging for allowed origins to reduce log noise
			return allowed
		},
		ReadBufferSize:  8192,  // Increased from 1024 for better performance
		WriteBufferSize: 8192,  // Increased from 1024 for better performance
		EnableCompression: true, // Enable compression for better bandwidth usage
	}
}

// isOriginAllowed checks if the given origin is in the allowed origins list.
// Supports "*" as a wildcard to allow all origins.
// Also handles trailing slash variations (https://limen.kr vs https://limen.kr/)
// Also handles protocol variations (https://limen.kr vs limen.kr)
func (h *Handler) isOriginAllowed(origin string) bool {
	if origin == "" {
		return false
	}
	if len(h.Config.AllowedOrigins) == 0 {
		return false
	}
	
	// Normalize origin (remove trailing slash and protocol)
	normalizedOrigin := strings.TrimSuffix(origin, "/")
	// Remove protocol if present
	normalizedOrigin = strings.TrimPrefix(normalizedOrigin, "https://")
	normalizedOrigin = strings.TrimPrefix(normalizedOrigin, "http://")
	
	for _, allowed := range h.Config.AllowedOrigins {
		if allowed == "*" {
			return true
		}
		// Normalize allowed origin (remove trailing slash and protocol)
		normalizedAllowed := strings.TrimSuffix(allowed, "/")
		normalizedAllowed = strings.TrimPrefix(normalizedAllowed, "https://")
		normalizedAllowed = strings.TrimPrefix(normalizedAllowed, "http://")
		
		// Check normalized match (without protocol)
		if normalizedAllowed == normalizedOrigin {
			return true
		}
		// Also check exact match for backward compatibility
		if allowed == origin {
			return true
		}
		// Also check with protocol variations
		if strings.TrimSuffix(allowed, "/") == strings.TrimSuffix(origin, "/") {
			return true
		}
	}
	return false
}

// HandleVNC handles VNC WebSocket connections
// @Summary Connect to VM via VNC
// @Description Establish a WebSocket connection to VM's VNC console. Requires VM UUID and JWT token as query parameters.
// @Description The connection will proxy VNC protocol data between the WebSocket client and the VM's VNC server.
// @Tags vms
// @Accept json
// @Produce json
// @Param id query string true "VM UUID" format(uuid) example(12345678-1234-1234-1234-123456789abc)
// @Param token query string true "JWT authentication token" example(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)
// @Success 101 "Switching Protocols" "WebSocket connection established"
// @Failure 400 {object} map[string]interface{} "Invalid request (missing parameters, invalid UUID format)"
// @Failure 401 {object} map[string]interface{} "Unauthorized - invalid or missing token"
// @Failure 403 {object} map[string]interface{} "Forbidden - account not approved"
// @Failure 404 {object} map[string]interface{} "VM not found"
// @Failure 500 {object} map[string]interface{} "Internal server error (VM not running, VNC port not available)"
// @Router /ws/vnc [get]
// @Router /vnc [get]
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

	// Log incoming WebSocket connection attempt with ALL headers for debugging
	logger.Log.Info("VNC WebSocket connection attempt - DETAILED",
		zap.String("remote_addr", r.RemoteAddr),
		zap.String("origin", origin),
		zap.String("user_agent", r.Header.Get("User-Agent")),
		zap.String("path", r.URL.Path),
		zap.String("full_url", r.URL.String()),
		zap.String("query", r.URL.RawQuery),
		zap.String("upgrade", r.Header.Get("Upgrade")),
		zap.String("connection", r.Header.Get("Connection")),
		zap.String("method", r.Method),
		zap.String("host", r.Host),
		zap.String("referer", r.Header.Get("Referer")),
		zap.Strings("allowed_origins", h.Config.AllowedOrigins))

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

	logger.Log.Info("Attempting WebSocket upgrade",
		zap.String("path", r.URL.Path),
		zap.String("origin", origin),
		zap.Uint("user_id", claims.UserID),
		zap.String("username", claims.Username))
	
	upgrader := h.newWebSocketUpgrader()
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Log.Error("WebSocket upgrade failed - DETAILED",
			zap.Error(err),
			zap.String("path", r.URL.Path),
			zap.String("query", r.URL.RawQuery),
			zap.String("remote_addr", r.RemoteAddr),
			zap.String("user_agent", r.Header.Get("User-Agent")),
			zap.String("origin", r.Header.Get("Origin")),
			zap.String("upgrade_header", r.Header.Get("Upgrade")),
			zap.String("connection_header", r.Header.Get("Connection")),
			zap.Uint("user_id", claims.UserID),
			zap.String("username", claims.Username),
			zap.String("error_type", fmt.Sprintf("%T", err)))
		http.Error(w, fmt.Sprintf("WebSocket upgrade failed: %v", err), http.StatusBadRequest)
		return
	}
	defer func() {
		logger.Log.Info("WebSocket connection closing",
			zap.String("vm_uuid", r.URL.Query().Get("id")),
			zap.Uint("user_id", claims.UserID))
		ws.Close()
	}()
	
	logger.Log.Info("WebSocket upgrade SUCCESS",
		zap.String("path", r.URL.Path),
		zap.Uint("user_id", claims.UserID),
		zap.String("username", claims.Username))

	// Send initial connection status
	ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
	if err := ws.WriteMessage(websocket.TextMessage, []byte(`{"type":"status","message":"Connected, checking VM status..."}`)); err != nil {
		logger.Log.Warn("Failed to send initial status", 
			zap.Error(err),
			zap.Uint("user_id", claims.UserID),
			zap.String("username", claims.Username))
		return
	}
	ws.SetWriteDeadline(time.Time{}) // Clear deadline
	
	logger.Log.Info("Initial status message sent successfully",
		zap.Uint("user_id", claims.UserID))

	logger.Log.Info("WebSocket connection upgraded successfully",
		zap.String("path", r.URL.Path),
		zap.String("query", r.URL.RawQuery),
		zap.String("remote_addr", r.RemoteAddr),
		zap.String("origin", r.Header.Get("Origin")),
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
			ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"type":"error","error":"Database error","code":"DB_ERROR","details":"%s"}`, err.Error())))
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

		// Optimized: Use context with timeout instead of fixed sleep
		// Wait for VM to start and VNC to initialize (max 5 seconds)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		
		ticker := time.NewTicker(500 * time.Millisecond)
		defer ticker.Stop()
		
		vmStarted := false
		for {
			select {
			case <-ctx.Done():
				logger.Log.Warn("Timeout waiting for VM to start", zap.String("vm_name", vmRec.Name))
				break
			case <-ticker.C:
				if updatedStatus, err := h.VMService.GetVMStatusFromLibvirt(vmRec.Name); err == nil {
					vmRec.Status = updatedStatus
					h.DB.Save(&vmRec)
					if updatedStatus == models.VMStatusRunning {
						vmStarted = true
						break
					}
				}
			}
			if vmStarted {
				break
			}
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
		messageCount := 0
		for {
			_, message, err := ws.ReadMessage()
			if err != nil {
				// Only log non-normal closure errors
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
					logger.Log.Info("VNC WebSocket read error",
						zap.Error(err),
						zap.String("vm_uuid", vmRec.UUID),
						zap.Uint("user_id", claims.UserID),
						zap.Int("messages_received", messageCount))
				}
				errc <- err
				return
			}
			messageCount++
			// Reduced logging: only log first message and every 1000th message
			if messageCount == 1 {
				logger.Log.Debug("VNC WebSocket -> TCP (first message)",
					zap.Int("bytes", len(message)),
					zap.String("vm_uuid", vmRec.UUID))
			} else if messageCount%1000 == 0 {
				logger.Log.Debug("VNC WebSocket -> TCP",
					zap.Int("bytes", len(message)),
					zap.Int("message_count", messageCount),
					zap.String("vm_uuid", vmRec.UUID))
			}
			if _, err := conn.Write(message); err != nil {
				logger.Log.Error("VNC TCP write error",
					zap.Error(err),
					zap.String("vm_uuid", vmRec.UUID),
					zap.Uint("user_id", claims.UserID),
					zap.Int("messages_sent", messageCount))
				errc <- err
				return
			}
		}
	}()

	go func() {
		// Optimized: Use buffer pool to reduce memory allocations
		buf := vncBufferPool.Get().([]byte)
		defer vncBufferPool.Put(buf)
		
		readCount := int32(0)
		for {
			n, err := conn.Read(buf)
			if err != nil {
				// Only log non-EOF errors
				if err.Error() != "EOF" {
					logger.Log.Info("VNC TCP read error",
						zap.Error(err),
						zap.String("vm_uuid", vmRec.UUID),
						zap.Uint("user_id", claims.UserID),
						zap.Int32("reads_completed", atomic.LoadInt32(&readCount)))
				}
				errc <- err
				return
			}
			count := atomic.AddInt32(&readCount, 1)
			// Reduced logging: only log first read and every 1000th read
			if count == 1 {
				logger.Log.Debug("VNC TCP -> WebSocket (first read)",
					zap.Int("bytes", n),
					zap.String("vm_uuid", vmRec.UUID))
			} else if count%1000 == 0 {
				logger.Log.Debug("VNC TCP -> WebSocket",
					zap.Int("bytes", n),
					zap.Int32("read_count", count),
					zap.String("vm_uuid", vmRec.UUID))
			}
			ws.SetWriteDeadline(time.Now().Add(30 * time.Second)) // Set write deadline for each message
			if err := ws.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
				// Check if it's a close error - don't log as error if it's a normal closure
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
					logger.Log.Error("VNC WebSocket write error",
						zap.Error(err),
						zap.String("vm_uuid", vmRec.UUID),
						zap.Uint("user_id", claims.UserID),
						zap.Int32("writes_completed", atomic.LoadInt32(&readCount)))
				}
				errc <- err
				return
			}
			ws.SetWriteDeadline(time.Time{}) // Clear deadline after successful write
		}
	}()

	// Wait for error from either goroutine
	err = <-errc
	
	// Close connections gracefully
	if conn != nil {
		conn.Close()
	}
	
	// Send close message to WebSocket if not already closed
	if err != nil && !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
		// Try to send close frame
		closeMsg := websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "Connection closed")
		ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
		ws.WriteMessage(websocket.CloseMessage, closeMsg)
		ws.SetWriteDeadline(time.Time{})
	}
	
	// Log connection closure
	if err != nil && !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
		logger.Log.Info("VNC connection closed with error",
			zap.Error(err),
			zap.String("vm_uuid", vmRec.UUID),
			zap.Uint("user_id", claims.UserID),
			zap.String("username", claims.Username))
	} else {
		logger.Log.Info("VNC connection closed normally",
			zap.String("vm_uuid", vmRec.UUID),
			zap.Uint("user_id", claims.UserID),
			zap.String("username", claims.Username))
	}
}

// HandleVMMedia handles media (ISO/CDROM) attach/detach operations
// @Summary Attach or detach VM media
// @Description Attach or detach ISO/CDROM media from a VM
// @Tags vms
// @Accept json
// @Produce json
// @Param uuid path string true "VM UUID" format(uuid)
// @Param request body object true "Media operation request" example({"action":"detach"}) example({"action":"attach","iso_path":"/path/to/iso"})
// HandleVMMedia handles both GET (query current media) and POST (attach/detach media) requests
// @Summary Get or manage VM media
// @Description GET: Get currently attached media. POST: Attach or detach media
// @Tags vms
// @Accept json
// @Produce json
// @Param uuid path string true "VM UUID"
// @Param action body string false "Action: attach or detach (POST only)"
// @Param iso_path body string false "ISO file path (required for attach)"
// @Success 200 {object} map[string]interface{} "Media information or operation result"
// @Failure 400 {object} map[string]interface{} "Invalid request"
// @Failure 404 {object} map[string]interface{} "VM not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Security BearerAuth
// @Router /vms/{uuid}/media [get,post]
func (h *Handler) HandleVMMedia(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	uuidStr, ok := vars["uuid"]
	if !ok {
		errors.WriteBadRequest(w, "VM UUID is required", nil)
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

	// Handle GET request - return current media information
	if r.Method == "GET" {
		mediaPath, err := h.VMService.GetCurrentMedia(vmRec.Name)
		if err != nil {
			// Check if error is "no CDROM device" - return empty media instead of error
			if strings.Contains(err.Error(), "no CDROM device") {
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(map[string]interface{}{
					"vm_uuid":    uuidStr,
					"media_path": "",
					"attached":   false,
					"message":    "No CDROM device found in VM configuration",
				})
				return
			}
			logger.Log.Error("Failed to get current media", zap.Error(err), zap.String("vm_name", vmRec.Name))
			errors.WriteInternalError(w, err, h.Config.Env == "development")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"vm_uuid":    uuidStr,
			"media_path": mediaPath,
			"attached":   mediaPath != "",
		})
		return
	}

	// Handle POST request - attach or detach media
	var req struct {
		Action  string `json:"action" example:"detach"` // "attach" or "detach"
		ISOPath string `json:"iso_path,omitempty" example:"/path/to/ubuntu.iso"` // Required for attach action
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errors.WriteBadRequest(w, "Invalid request body", err)
		return
	}

	switch req.Action {
	case "detach":
		// Get current media path before detaching for response
		currentMediaPath, _ := h.VMService.GetCurrentMedia(vmRec.Name)
		
		if err := h.VMService.DetachMedia(vmRec.Name); err != nil {
			logger.Log.Error("Failed to detach media", zap.Error(err), zap.String("vm_name", vmRec.Name))
			errors.WriteInternalError(w, err, h.Config.Env == "development")
			return
		}
		logger.Log.Info("Media detached (disabled)", zap.String("vm_name", vmRec.Name), zap.String("previous_iso_path", currentMediaPath))
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Media disabled successfully. You can reattach it later.",
			"vm_uuid": uuidStr,
			"previous_media_path": currentMediaPath,
		})
	case "attach":
		if req.ISOPath == "" {
			errors.WriteBadRequest(w, "ISO path is required for attach", nil)
			return
		}
		if err := h.VMService.AttachMedia(vmRec.Name, req.ISOPath); err != nil {
			logger.Log.Error("Failed to attach media", zap.Error(err), zap.String("vm_name", vmRec.Name))
			errors.WriteInternalError(w, err, h.Config.Env == "development")
			return
		}
		logger.Log.Info("Media attached", zap.String("vm_name", vmRec.Name), zap.String("iso_path", req.ISOPath))
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Media attached successfully",
			"vm_uuid": uuidStr,
			"iso_path": req.ISOPath,
		})
	default:
		errors.WriteBadRequest(w, fmt.Sprintf("Invalid action: %s. Valid actions: attach, detach", req.Action), nil)
	}
}

// HandleListISOs returns a list of available ISO files
// @Summary List available ISO files
// @Description Get a list of all available ISO files in the ISO directory
// @Tags vms
// @Produce json
// @Success 200 {object} map[string]interface{} "List of ISO files"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Security BearerAuth
// @Router /vms/isos [get]
func (h *Handler) HandleListISOs(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	isos, err := h.VMService.ListISOs()
	if err != nil {
		logger.Log.Error("Failed to list ISOs", zap.Error(err))
		errors.WriteInternalError(w, err, cfg.Env == "development")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"isos":  isos,
		"count": len(isos),
	})
}
