package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/audit"
	"github.com/DARC0625/LIMEN/backend/internal/auth"
	"github.com/DARC0625/LIMEN/backend/internal/cache"
	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/errors"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/metrics"
	"github.com/DARC0625/LIMEN/backend/internal/middleware"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/DARC0625/LIMEN/backend/internal/session"
	"github.com/DARC0625/LIMEN/backend/internal/validator"
	"github.com/DARC0625/LIMEN/backend/internal/vm"
	"github.com/go-chi/chi/v5"
	"nhooyr.io/websocket"
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
	Cache               *cache.InMemoryCache // Cache for frequently accessed data
}

func NewHandler(db *gorm.DB, vmService *vm.VMService, cfg *config.Config) *Handler {
	broadcaster := NewVMStatusBroadcaster()
	go broadcaster.Run()
	
	// Initialize cache with optimized TTL for 10+ concurrent users:
	// 3 minutes for VM lists (balance between freshness and load reduction)
	vmCache := cache.NewInMemoryCache(3 * time.Minute)
	
	return &Handler{
		DB:                  db,
		VMService:           vmService,
		VMStatusBroadcaster: broadcaster,
		Config:              cfg,
		Cache:               vmCache,
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
	// Use direct encoding for simple responses (no pooling needed for small responses)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"time":    time.Now().Format(time.RFC3339),
		"db":      dbStatus,
		"libvirt": libvirtStatus,
	})
}

type CreateVMRequest struct {
	Name         string `json:"name" example:"my-vm" binding:"required"` // VM name (unique)
	CPU          int    `json:"cpu" example:"4" binding:"required,min=1"` // Number of CPU cores (minimum 1, no maximum limit)
	Memory       int    `json:"memory" example:"4096" binding:"required,min=1024"` // Memory in MB (minimum 1024MB/1GB)
	OSType       string `json:"os_type" example:"ubuntu" binding:"required"` // OS type (must exist in VMImage table)
	GraphicsType string `json:"graphics_type,omitempty" example:"vnc"` // Graphics type (vnc, spice, none). Auto-enabled for GUI OS if not specified.
	VNCEnabled   *bool  `json:"vnc_enabled,omitempty" example:"true"` // Enable VNC graphics. Auto-enabled for GUI OS if not specified.
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
		// Check cache first
		cacheKey := "vms:list"
		if cached, found := h.Cache.Get(cacheKey); found {
			metrics.CacheHits.WithLabelValues("vm_list").Inc()
			vms := cached.([]models.VM)
			w.Header().Set("Content-Type", "application/json")
			if err := json.NewEncoder(w).Encode(vms); err != nil {
				logger.Log.Error("Failed to encode cached VMs response", zap.Error(err))
			}
			return
		}
		metrics.CacheMisses.WithLabelValues("vm_list").Inc()

		var vms []models.VM
		// Optimized: Use Select to fetch only necessary fields for better performance
		startTime := time.Now()
		if err := h.DB.Select("id", "uuid", "name", "status", "cpu", "memory", "owner_id", "created_at", "updated_at").Find(&vms).Error; err != nil {
			metrics.DatabaseQueryDuration.WithLabelValues("select").Observe(time.Since(startTime).Seconds())
			metrics.DatabaseQueryTotal.WithLabelValues("select", "error").Inc()
			logger.Log.Error("Failed to fetch VMs", zap.Error(err))
			errors.WriteInternalError(w, err, cfg.Env == "development")
			return
		}
		metrics.DatabaseQueryDuration.WithLabelValues("select").Observe(time.Since(startTime).Seconds())
		metrics.DatabaseQueryTotal.WithLabelValues("select", "success").Inc()

		// Optimized: Skip libvirt sync for cached responses to reduce load
		// Only sync if not from cache and VMService is available
		// Sync VM statuses from libvirt to ensure accuracy (if VMService is available)
		// Optimized for 10+ concurrent users: Higher concurrency for faster response
		if h.VMService != nil && len(vms) > 0 {
			// Use goroutines for parallel status sync (optimized for concurrent users)
			// Add context with timeout to prevent goroutines from running indefinitely
			syncCtx, syncCancel := context.WithTimeout(r.Context(), 10*time.Second) // Increased for concurrent users
			defer syncCancel()
			
			const maxConcurrency = 8 // Increased for 10+ concurrent users (was 3)
			sem := make(chan struct{}, maxConcurrency)
			var wg sync.WaitGroup
			
			// Wait for all goroutines with timeout
			done := make(chan struct{})
			
			for i := range vms {
				// Check if context is cancelled before starting new goroutine
				select {
				case <-syncCtx.Done():
					// Timeout reached, skip remaining syncs
					goto syncComplete
				default:
				}
				
				wg.Add(1)
				go func(idx int) {
					defer wg.Done()
					
					// Check context before acquiring semaphore
					select {
					case <-syncCtx.Done():
						return
					case sem <- struct{}{}:
						defer func() { <-sem }() // Release semaphore
					}
					
					// Check context again before sync
					select {
					case <-syncCtx.Done():
						return
					default:
						if err := h.VMService.SyncVMStatus(&vms[idx]); err != nil {
							// Only log in development
							if h.Config.Env == "development" {
								logger.Log.Debug("Failed to sync VM status", zap.String("vm_name", vms[idx].Name), zap.Error(err))
							}
							// Continue even if sync fails for one VM
						}
					}
				}(i)
			}
			
			go func() {
				wg.Wait()
				close(done)
			}()
			
			select {
			case <-done:
				// All goroutines completed
			case <-syncCtx.Done():
				// Timeout - don't log warning in production
				if h.Config.Env == "development" {
					logger.Log.Debug("VM status sync timed out, some syncs may be incomplete")
				}
			}
			
			syncComplete:
			wg.Wait()
		}

		// Cache the result
		h.Cache.Set(cacheKey, vms)
		metrics.CacheSize.WithLabelValues("vm_list").Set(float64(h.Cache.Size()))

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

		// Check beta access (admin always has access)
		role, _ := middleware.GetRole(r.Context())
		if role != string(models.RoleAdmin) {
			// Check beta access from token
			authHeader := r.Header.Get("Authorization")
			if tokenString, err := auth.ExtractTokenFromHeader(authHeader); err == nil {
				if claims, err := auth.ValidateToken(tokenString, h.Config.JWTSecret); err == nil {
					if !claims.BetaAccess {
						logger.Log.Warn("VM creation denied - beta access required",
							zap.Uint("user_id", userID),
							zap.String("vm_name", req.Name))
						errors.WriteForbidden(w, "Beta access required to create VMs. Please contact administrator.")
						return
					}
				} else {
					// Fallback: check database
					var user models.User
					if err := h.DB.Select("id", "beta_access", "role").Where("id = ?", userID).First(&user).Error; err == nil {
						if user.Role != models.RoleAdmin && !user.BetaAccess {
							logger.Log.Warn("VM creation denied - beta access required",
								zap.Uint("user_id", userID),
								zap.String("vm_name", req.Name))
							errors.WriteForbidden(w, "Beta access required to create VMs. Please contact administrator.")
							return
						}
					}
				}
			} else {
				// Fallback: check database
				var user models.User
				if err := h.DB.Select("id", "beta_access", "role").Where("id = ?", userID).First(&user).Error; err == nil {
					if user.Role != models.RoleAdmin && !user.BetaAccess {
						logger.Log.Warn("VM creation denied - beta access required",
							zap.Uint("user_id", userID),
							zap.String("vm_name", req.Name))
						errors.WriteForbidden(w, "Beta access required to create VMs. Please contact administrator.")
						return
					}
				}
			}
		}

		// VM creation rate limit disabled - allow immediate VM creation
		// No cooldown period between VM creations

		// Check user-specific quota
		userQuota, err := models.GetOrCreateUserQuota(h.DB, userID)
		if err != nil {
			logger.Log.Error("Failed to get user quota", zap.Error(err))
			errors.WriteInternalError(w, err, cfg.Env == "development")
			return
		}

		// Check individual VM resource limits
		if err := userQuota.CheckVMResourceLimits(req.CPU, req.Memory); err != nil {
			logger.Log.Warn("VM resource limits exceeded",
				zap.Uint("user_id", userID),
				zap.String("vm_name", req.Name),
				zap.Error(err))
			// Increment quota denied metric
			if quotaErr, ok := err.(*models.QuotaError); ok {
				metrics.VMQuotaDeniedTotal.WithLabelValues(quotaErr.Resource, fmt.Sprintf("%d", userID)).Inc()
			} else {
				metrics.VMQuotaDeniedTotal.WithLabelValues("VM_ResourceLimits", fmt.Sprintf("%d", userID)).Inc()
			}
			errors.WriteBadRequest(w, err.Error(), nil)
			return
		}

		// Check user quota (total resources)
		diskSize := 20 // Default disk size in GB
		if err := userQuota.CheckUserQuota(h.DB, req.CPU, req.Memory, diskSize); err != nil {
			if quotaErr, ok := err.(*models.QuotaError); ok {
				logger.Log.Warn("User quota exceeded",
					zap.Uint("user_id", userID),
					zap.String("vm_name", req.Name),
					zap.String("resource", quotaErr.Resource))
				// Increment quota denied metric
				metrics.VMQuotaDeniedTotal.WithLabelValues(quotaErr.Resource, fmt.Sprintf("%d", userID)).Inc()
				errors.WriteBadRequest(w, quotaErr.Error(), nil)
			} else {
				errors.WriteInternalError(w, err, cfg.Env == "development")
			}
			return
		}

		// Check system-wide resource quota (after user quota check)
		quota, err := models.GetOrCreateQuota(h.DB)
		if err != nil {
			logger.Log.Error("Failed to get quota", zap.Error(err))
			errors.WriteInternalError(w, err, cfg.Env == "development")
			return
		}

		if err := quota.CheckQuota(h.DB, req.CPU, req.Memory); err != nil {
			if quotaErr, ok := err.(*models.QuotaError); ok {
				// Increment quota denied metric
				metrics.VMQuotaDeniedTotal.WithLabelValues(quotaErr.Resource, fmt.Sprintf("%d", userID)).Inc()
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

		// Determine VNC graphics settings
		// GUI OS types that should have VNC enabled by default
		guiOSTypes := []string{"ubuntu-desktop", "kali", "windows", "windows10", "windows11"}
		isGUIOs := false
		for _, guiType := range guiOSTypes {
			if strings.Contains(strings.ToLower(req.OSType), strings.ToLower(guiType)) {
				isGUIOs = true
				break
			}
		}

		// Determine if VNC should be enabled
		enableVNC := false
		if req.VNCEnabled != nil {
			enableVNC = *req.VNCEnabled
		} else if isGUIOs {
			// Auto-enable VNC for GUI OS if not explicitly set
			enableVNC = true
			logger.Log.Info("Auto-enabling VNC for GUI OS", zap.String("os_type", req.OSType), zap.String("vm_name", req.Name))
		}

		// Determine graphics type
		graphicsType := req.GraphicsType
		if graphicsType == "" {
			if enableVNC {
				graphicsType = "vnc"
			} else {
				graphicsType = "none"
			}
		}

		if err := h.VMService.CreateVM(req.Name, req.Memory, req.CPU, req.OSType, newVM.UUID, graphicsType, enableVNC); err != nil {
			tx.Rollback()
			logger.Log.Error("Failed to create VM in libvirt", zap.Error(err), zap.String("vm_name", req.Name), zap.String("uuid", newVM.UUID))
			// Audit log: VM creation failure
			audit.LogVMCreate(r.Context(), userID, newVM.ID, newVM.UUID, req.Name, false, err.Error())
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

		// Wait for VM to fully start and VNC to initialize with generous timeout
		// VNC port assignment can take variable time depending on system load
		// Using 60 second timeout for flexibility
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		
		ready := false
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		
		for !ready {
			select {
			case <-ctx.Done():
				logger.Log.Warn("Timeout waiting for VM to be ready (60s exceeded)", zap.String("vm_name", req.Name))
				break
			case <-ticker.C:
				if status, err := h.VMService.GetVMStatusFromLibvirt(req.Name); err == nil && status == models.VMStatusRunning {
					ready = true
					break
				}
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
					// Wait for VM to start with generous timeout (30 seconds)
					ctx2, cancel2 := context.WithTimeout(context.Background(), 30*time.Second)
					defer cancel2()
					
					ticker2 := time.NewTicker(500 * time.Millisecond)
					defer ticker2.Stop()
					
					vmStarted := false
					for !vmStarted {
						select {
						case <-ctx2.Done():
							logger.Log.Warn("Timeout waiting for VM to start (30s exceeded)", zap.String("vm_name", req.Name))
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

		// Invalidate cache
		h.Cache.Delete("vms:list")
		metrics.CacheSize.WithLabelValues("vm_list").Set(float64(h.Cache.Size()))

		// Update metrics
		metrics.VMCreateTotal.Inc()
		if err := h.UpdateMetrics(); err != nil {
			logger.Log.Warn("Failed to update metrics", zap.Error(err))
		}

		logger.Log.Info("VM created successfully", zap.String("vm_name", req.Name), zap.String("uuid", newVM.UUID), zap.Int("cpu", req.CPU), zap.Int("memory", req.Memory), zap.String("os_type", req.OSType), zap.String("status", string(newVM.Status)))

		// Audit log: VM creation success
		audit.LogVMCreate(r.Context(), userID, newVM.ID, newVM.UUID, req.Name, true, "")

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
	Action string `json:"action" example:"start"` // Valid actions: start, stop, delete, update
	CPU    int    `json:"cpu,omitempty" example:"4"` // Required for update action
	Memory int    `json:"memory,omitempty" example:"4096"` // Required for update action (in MB)
}

// HandleVMAction handles VM actions (start, stop, delete, update)
// @Summary Perform VM action
// @Description Execute an action on a VM (start, stop, delete, or update resources)
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
	// Get user ID from context
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		userID = 0 // Fallback for unauthenticated requests (should not happen)
	}

	// Get VM UUID from URL path variable (set by chi router)
	uuidStr := chi.URLParam(r, "uuid")
	if uuidStr == "" {
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

	// Check if VMService is available for actions that require it
	if h.VMService == nil && (action == models.VMActionStart || action == models.VMActionStop) {
		errors.WriteInternalError(w, fmt.Errorf("VM service is not available"), h.Config.Env == "development")
		return
	}

	// Track action duration
	actionStartTime := time.Now()
	actionSuccess := false
	defer func() {
		duration := time.Since(actionStartTime).Seconds()
		metrics.VMActionDuration.WithLabelValues(string(action)).Observe(duration)
		if actionSuccess {
			metrics.VMActionTotal.WithLabelValues(string(action), "success").Inc()
		} else {
			metrics.VMActionTotal.WithLabelValues(string(action), "error").Inc()
		}
	}()

	switch action {
	case models.VMActionStart:
		if err := h.VMService.StartVM(vmRec.Name); err != nil {
			logger.Log.Error("Failed to start VM", zap.Error(err), zap.String("vm_name", vmRec.Name))
			audit.LogVMStart(r.Context(), userID, vmRec.UUID, false)
			errors.WriteInternalError(w, err, h.Config.Env == "development")
			return
		}
		// Verify actual VM status from libvirt after starting
		actualStatus, err := h.VMService.GetVMStatusFromLibvirt(vmRec.Name)
		if err != nil {
			logger.Log.Warn("Failed to verify VM status after start", zap.String("vm_name", vmRec.Name), zap.Error(err))
			// Still set to running if StartVM succeeded, but log the warning
			vmRec.Status = models.VMStatusRunning
		} else {
			// Use actual status from libvirt
			vmRec.Status = actualStatus
			if actualStatus != models.VMStatusRunning {
				logger.Log.Warn("VM start command succeeded but VM is not running", 
					zap.String("vm_name", vmRec.Name), 
					zap.String("actual_status", string(actualStatus)))
			}
		}
		actionSuccess = true
		logger.Log.Info("VM started", zap.String("vm_name", vmRec.Name), zap.String("status", string(vmRec.Status)))
		audit.LogVMStart(r.Context(), userID, vmRec.UUID, vmRec.Status == models.VMStatusRunning)
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
			actionSuccess = true
			logger.Log.Info("VM stopped", zap.String("vm_name", vmRec.Name))
			h.VMStatusBroadcaster.BroadcastVMUpdate(vmRec)
		} else if actualStatus == models.VMStatusStopped {
			// VM is already stopped, just sync the status
			vmRec.Status = models.VMStatusStopped
			// Save here and skip the save after switch (to avoid double save)
			if err := h.DB.Save(&vmRec).Error; err != nil {
				logger.Log.Error("Failed to save VM status", zap.Error(err))
				actionSuccess = false
				errors.WriteInternalError(w, err, h.Config.Env == "development")
				return
			}
			actionSuccess = true
			h.VMStatusBroadcaster.BroadcastVMUpdate(vmRec)
			logger.Log.Info("VM was already stopped, status synced", zap.String("vm_name", vmRec.Name))
			// Skip the DB.Save after switch since we already saved here
			// Set a flag or use a different approach - actually, we can just return early
			// But we need to send response, so we'll let it fall through but skip the save
		} else {
			// VM is running, stop it
			if err := h.VMService.StopVM(vmRec.Name); err != nil {
				logger.Log.Error("Failed to stop VM", zap.Error(err), zap.String("vm_name", vmRec.Name))
				errors.WriteInternalError(w, err, h.Config.Env == "development")
				return
			}
			vmRec.Status = models.VMStatusStopped
			actionSuccess = true
			logger.Log.Info("VM stopped", zap.String("vm_name", vmRec.Name))
			audit.LogVMStop(r.Context(), userID, vmRec.UUID, true)
			// Broadcast VM update via WebSocket
			h.VMStatusBroadcaster.BroadcastVMUpdate(vmRec)
		}
	case models.VMActionDelete:
		if err := h.VMService.DeleteVM(vmRec.Name); err != nil {
			logger.Log.Error("Failed to delete VM", zap.Error(err), zap.String("vm_name", vmRec.Name))
			audit.LogVMDelete(r.Context(), userID, vmRec.UUID, false)
			errors.WriteInternalError(w, err, h.Config.Env == "development")
			return
		}
		// DB deletion is handled inside VMService.DeleteVM with Unscoped()
		actionSuccess = true
		logger.Log.Info("VM deleted", zap.String("vm_name", vmRec.Name))
		audit.LogVMDelete(r.Context(), userID, vmRec.UUID, true)

		// Invalidate cache
		h.Cache.Delete("vms:list")
		metrics.CacheSize.WithLabelValues("vm_list").Set(float64(h.Cache.Size()))

		// Broadcast VM deletion via WebSocket (send updated list)
		// Optimized: Only fetch necessary fields for broadcast
		var allVMs []models.VM
		if err := h.DB.Select("id", "uuid", "name", "status", "cpu", "memory").Find(&allVMs).Error; err == nil {
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
		if h.VMService == nil {
			errors.WriteInternalError(w, fmt.Errorf("VM service is not available"), h.Config.Env == "development")
			return
		}
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
		actionSuccess = true
		logger.Log.Info("VM updated", zap.String("vm_name", vmRec.Name), zap.Int("cpu", req.CPU), zap.Int("memory", req.Memory))
		// Broadcast VM update via WebSocket
		h.VMStatusBroadcaster.BroadcastVMUpdate(vmRec)
	default:
		// Invalid action - should not reach here if validation is correct
		// But handle gracefully if it does
		if err := validator.ValidateVMAction(req.Action); err != nil {
			// Validation failed - action is invalid, mark as error
			actionSuccess = false
			errors.WriteBadRequest(w, err.Error(), err)
			return
		}
		// If validation passed but action is not in switch cases, it's an unexpected state
		actionSuccess = false
		errors.WriteBadRequest(w, fmt.Sprintf("Unsupported action: %s", req.Action), nil)
		return
	}

	// Save VM state (only if action was successful and we didn't return early)
	// Note: VMActionDelete returns early, so this won't execute for delete
	if err := h.DB.Save(&vmRec).Error; err != nil {
		logger.Log.Error("Failed to save VM", zap.Error(err), zap.String("vm_name", vmRec.Name))
		// Mark action as failed if save fails
		actionSuccess = false
		errors.WriteInternalError(w, err, h.Config.Env == "development")
		return
	}

	// If we reach here, action was successful (actionSuccess was set in the switch cases)
	// Ensure actionSuccess is true for successful completion
	if !actionSuccess {
		// This shouldn't happen, but set it to true if we successfully saved
		actionSuccess = true
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
	uuidStr := chi.URLParam(r, "uuid")
	if uuidStr == "" {
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

	// Check if VMService is available
	if h.VMService == nil {
		errors.WriteInternalError(w, fmt.Errorf("VM service is not available"), h.Config.Env == "development")
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

	// Invalidate cache
	h.Cache.Delete("vms:list")
	metrics.CacheSize.WithLabelValues("vm_list").Set(float64(h.Cache.Size()))

		// Broadcast VM deletion via WebSocket (send updated list)
		// Optimized: Only fetch necessary fields for broadcast
		var allVMs []models.VM
		if err := h.DB.Select("id", "uuid", "name", "status", "cpu", "memory").Find(&allVMs).Error; err == nil {
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

// acceptWebSocket accepts a WebSocket connection with origin validation.
// Origin validation uses the same CORS configuration as HTTP requests.
func (h *Handler) acceptWebSocket(w http.ResponseWriter, r *http.Request) (*websocket.Conn, error) {
	origin := r.Header.Get("Origin")
	
	// If origin is empty (e.g., removed by proxy), try to extract from Referer header
	if origin == "" {
		referer := r.Header.Get("Referer")
		if referer != "" {
			// Extract origin from referer URL
			if refererURL, err := url.Parse(referer); err == nil {
				origin = refererURL.Scheme + "://" + refererURL.Host
				logger.Log.Debug("Extracted origin from Referer header",
					zap.String("origin", origin),
					zap.String("referer", referer))
			}
		}
	}
	
	// If still empty and we have allowed origins configured, check if we're behind a proxy
	// In production behind a trusted proxy (like Envoy), we may allow empty origin
	// if the request comes from a trusted source
	if origin == "" && len(h.Config.AllowedOrigins) > 0 {
		// Check if request is from a trusted proxy/internal network
		// For VNC connections, we rely on authentication instead of origin validation
		// when behind a proxy that strips Origin headers
		logger.Log.Debug("WebSocket request with empty origin, checking if behind trusted proxy",
			zap.String("host", r.Host),
			zap.String("remote_addr", r.RemoteAddr),
			zap.String("x-forwarded-for", r.Header.Get("X-Forwarded-For")))
		
		// If we have authentication (token/cookie), allow empty origin for proxy scenarios
		// This is safe because authentication is still required
		_, hasRefreshTokenErr := r.Cookie("refresh_token")
		hasRefreshToken := hasRefreshTokenErr == nil
		hasAuth := r.URL.Query().Get("token") != "" ||
			r.Header.Get("Authorization") != "" ||
			hasRefreshToken
		
		if hasAuth {
			logger.Log.Info("Allowing WebSocket with empty origin due to authentication and proxy scenario",
				zap.String("path", r.URL.Path),
				zap.String("remote_addr", r.RemoteAddr))
			origin = "*" // Set to wildcard to bypass origin check
		}
	}
	
	allowed := h.isOriginAllowed(origin)
	if !allowed {
		logger.Log.Warn("WebSocket origin not allowed",
			zap.String("origin", origin),
			zap.String("path", r.URL.Path),
			zap.String("remote_addr", r.RemoteAddr),
			zap.String("host", r.Host),
			zap.String("referer", r.Header.Get("Referer")),
			zap.Strings("allowed_origins", h.Config.AllowedOrigins))
		return nil, fmt.Errorf("origin not allowed: %s", origin)
	}

	// nhooyr.io/websocket options
	// Build origin patterns that match both protocol and domain
	// nhooyr.io/websocket requires patterns like "https://limen.kr" or "limen.kr"
	originPatterns := make([]string, 0, len(h.Config.AllowedOrigins)*2)
	for _, allowedOrigin := range h.Config.AllowedOrigins {
		// Add as-is (may already have protocol)
		originPatterns = append(originPatterns, allowedOrigin)
		// Also add without protocol if it has one
		if strings.HasPrefix(allowedOrigin, "https://") {
			originPatterns = append(originPatterns, strings.TrimPrefix(allowedOrigin, "https://"))
		} else if strings.HasPrefix(allowedOrigin, "http://") {
			originPatterns = append(originPatterns, strings.TrimPrefix(allowedOrigin, "http://"))
		} else {
			// If no protocol, add with https://
			originPatterns = append(originPatterns, "https://"+allowedOrigin)
		}
	}
	
	opts := &websocket.AcceptOptions{
		OriginPatterns: originPatterns,
		CompressionMode: websocket.CompressionContextTakeover, // Enable compression
	}

	// Handle proxy scenarios where Connection header might be missing
	// If Upgrade header exists but Connection is missing, it's likely a proxy issue
	upgradeHeader := r.Header.Get("Upgrade")
	connectionHeader := r.Header.Get("Connection")
	
	if upgradeHeader == "websocket" && connectionHeader == "" {
		// Proxy stripped Connection header, but Upgrade header exists
		// Manually set Connection header for WebSocket library
		r.Header.Set("Connection", "Upgrade")
		logger.Log.Debug("Restored Connection header for WebSocket upgrade",
			zap.String("path", r.URL.Path),
			zap.String("upgrade", upgradeHeader))
	}

	conn, err := websocket.Accept(w, r, opts)
	if err != nil {
		return nil, err
	}

	// Set read limit (8KB buffer)
	conn.SetReadLimit(8192)

	return conn, nil
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

	// Check if this is a WebSocket upgrade request
	// Some proxies may strip Connection/Upgrade headers, so also check path pattern
	isWebSocketRequest := r.Header.Get("Upgrade") == "websocket" ||
		strings.ToLower(r.Header.Get("Connection")) == "upgrade" ||
		strings.Contains(strings.ToLower(r.Header.Get("Connection")), "upgrade")
	
	// If not a WebSocket request (e.g., browser navigation), return appropriate response
	if !isWebSocketRequest && r.Method == "GET" {
		// This is likely a browser navigation to the VNC URL
		// Return 426 Upgrade Required to indicate WebSocket is required
		w.Header().Set("Upgrade", "websocket")
		w.Header().Set("Connection", "Upgrade")
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusUpgradeRequired) // 426
		w.Write([]byte("WebSocket connection required. Please use WebSocket client to connect."))
		return
	}

	// Only collect cookie info in development
	var cookieNames []string
	if h.Config.Env == "development" {
		allCookies := r.Cookies()
		cookieNames = make([]string, 0, len(allCookies))
		for _, c := range allCookies {
			cookieNames = append(cookieNames, c.Name)
		}
	}
	
	// Check beta access for VNC console (admin always has access)
	// Get user ID from token or cookie
	var userID uint
	var username string
	var role string
	var betaAccess bool
	
	// Try to get from token first
	token := r.URL.Query().Get("token")
	if token == "" {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			token = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}
	
	if token != "" {
		claims, err := auth.ValidateToken(token, h.Config.JWTSecret)
		if err == nil {
			userID = claims.UserID
			username = claims.Username
			role = claims.Role
			betaAccess = claims.BetaAccess
		}
	}
	
	// Fallback to refresh token cookie
	if userID == 0 {
		if cookie, err := r.Cookie("refresh_token"); err == nil {
			refreshClaims, err := auth.ValidateRefreshToken(cookie.Value, h.Config.JWTSecret)
			if err == nil {
				userID = refreshClaims.UserID
				username = refreshClaims.Username
				role = refreshClaims.Role
				betaAccess = refreshClaims.BetaAccess
			}
		}
	}
	
	// Check beta access (admin always has access)
	if role != string(models.RoleAdmin) && !betaAccess {
		// Fallback: check database
		if userID > 0 {
			var user models.User
			if err := h.DB.Select("id", "beta_access", "role").Where("id = ?", userID).First(&user).Error; err == nil {
				if user.Role != models.RoleAdmin && !user.BetaAccess {
					logger.Log.Warn("VNC console access denied - beta access required",
						zap.Uint("user_id", userID),
						zap.String("username", username))
					http.Error(w, `{"type":"error","error":"Beta access required to access console. Please contact administrator.","code":"BETA_ACCESS_REQUIRED"}`, http.StatusForbidden)
					return
				}
			}
		} else {
			// No user ID found, deny access
			logger.Log.Warn("VNC console access denied - authentication required")
			http.Error(w, `{"type":"error","error":"Authentication required","code":"AUTH_REQUIRED"}`, http.StatusUnauthorized)
			return
		}
	}

	// Only log detailed info in development or when there's an error
	if h.Config.Env == "development" {
		logger.Log.Debug("VNC WebSocket connection attempt",
			zap.String("remote_addr", r.RemoteAddr),
			zap.String("path", r.URL.Path))
	}

	// Verify authentication: Try multiple methods (query param, Authorization header, refresh token cookie)
	// Note: token variable already declared above for beta access check
	var claims *auth.Claims
	var err error

	// 1. Try query parameter (for backward compatibility) - token already set above
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	if token != "" {
		claims, err = auth.ValidateToken(token, h.Config.JWTSecret)
		if err == nil {
			logger.Log.Debug("VNC authentication via query parameter")
		}
	}

	// 2. Try Authorization header (preferred method from frontend)
	if token == "" || err != nil {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" {
			token, err = auth.ExtractTokenFromHeader(authHeader)
			if err == nil {
				claims, err = auth.ValidateToken(token, h.Config.JWTSecret)
				if err == nil {
					logger.Log.Debug("VNC authentication via Authorization header")
				}
			}
		}
	}

	// 3. Try refresh token cookie (for session-based auth)
	if token == "" || err != nil {
		if cookie, cookieErr := r.Cookie("refresh_token"); cookieErr == nil {
			// Only log in development
			if h.Config.Env == "development" {
				logger.Log.Debug("VNC: refresh_token cookie found, attempting authentication")
			}
			refreshClaims, refreshErr := auth.ValidateRefreshToken(cookie.Value, h.Config.JWTSecret)
			if refreshErr != nil {
				logger.Log.Warn("VNC: refresh token validation failed",
					zap.Error(refreshErr),
					zap.String("cookie_preview", cookie.Value[:min(20, len(cookie.Value))]+"..."))
			} else {
				sessionStore := auth.GetSessionStore()
				_, exists := sessionStore.GetSessionByRefreshToken(cookie.Value)
				if !exists {
					logger.Log.Warn("VNC: refresh token not found in session store",
						zap.Uint("user_id", refreshClaims.UserID))
				} else {
					// Generate new access token from refresh token
					token, err = auth.GenerateAccessToken(refreshClaims.UserID, refreshClaims.Username, refreshClaims.Role, refreshClaims.Approved, h.Config.JWTSecret)
					if err == nil {
						claims = &auth.Claims{
							UserID:   refreshClaims.UserID,
							Username: refreshClaims.Username,
							Role:     refreshClaims.Role,
							Approved: refreshClaims.Approved,
						}
						// Only log in development
						if h.Config.Env == "development" {
							logger.Log.Debug("VNC authentication via refresh token cookie - SUCCESS",
								zap.Uint("user_id", claims.UserID))
						}
					} else {
						logger.Log.Warn("VNC: failed to generate access token from refresh token",
							zap.Error(err))
					}
				}
			}
		} else {
			logger.Log.Debug("VNC: no refresh_token cookie found",
				zap.Error(cookieErr))
		}
	}

	// Token is REQUIRED for production security
	if token == "" || err != nil {
		logger.Log.Warn("VNC connection attempt without valid token",
			zap.String("remote_addr", r.RemoteAddr),
			zap.String("user_agent", r.Header.Get("User-Agent")),
			zap.String("referer", r.Header.Get("Referer")),
			zap.String("origin", r.Header.Get("Origin")),
			zap.Bool("has_auth_header", r.Header.Get("Authorization") != ""),
			zap.Bool("has_refresh_cookie", func() bool { _, err := r.Cookie("refresh_token"); return err == nil }()),
			zap.Error(err))
		http.Error(w, "Authentication token required", http.StatusUnauthorized)
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

	// Only log in development
	if h.Config.Env == "development" {
		logger.Log.Debug("VNC connection authenticated",
			zap.Uint("user_id", claims.UserID),
			zap.String("role", claims.Role))
	}

	// Only log in development
	if h.Config.Env == "development" {
		logger.Log.Debug("Attempting WebSocket upgrade",
			zap.String("path", r.URL.Path),
			zap.Uint("user_id", claims.UserID))
	}
	
	ws, err := h.acceptWebSocket(w, r)
	if err != nil {
		logger.Log.Error("WebSocket accept failed - DETAILED",
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
		http.Error(w, fmt.Sprintf("WebSocket accept failed: %v", err), http.StatusBadRequest)
		return
	}
	defer func() {
		// Only log in development
		if h.Config.Env == "development" {
			logger.Log.Debug("WebSocket connection closing",
				zap.String("vm_uuid", r.URL.Query().Get("id")),
				zap.Uint("user_id", claims.UserID))
		}
		ws.Close(websocket.StatusNormalClosure, "")
	}()
	
	// Only log in development
	if h.Config.Env == "development" {
		logger.Log.Debug("WebSocket accept SUCCESS",
			zap.String("path", r.URL.Path),
			zap.Uint("user_id", claims.UserID))
	}

	// Send initial connection status
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	if err := ws.Write(ctx, websocket.MessageText, []byte(`{"type":"status","message":"Connected, checking VM status..."}`)); err != nil {
		logger.Log.Warn("Failed to send initial status", 
			zap.Error(err),
			zap.Uint("user_id", claims.UserID),
			zap.String("username", claims.Username))
		return
	}
	
	logger.Log.Info("Initial status message sent successfully",
		zap.Uint("user_id", claims.UserID))

	logger.Log.Info("WebSocket connection upgraded successfully",
		zap.String("path", r.URL.Path),
		zap.String("query", r.URL.RawQuery),
		zap.String("remote_addr", r.RemoteAddr),
		zap.String("origin", r.Header.Get("Origin")),
		zap.Uint("user_id", claims.UserID),
		zap.String("username", claims.Username))

	// Get VM UUID from query parameter, path parameter, or URL path
	uuidStr := r.URL.Query().Get("id")
	if uuidStr == "" {
		uuidStr = r.URL.Query().Get("uuid")
	}
	if uuidStr == "" {
		// Try to extract from path (e.g., /vnc/{uuid})
		pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(pathParts) >= 2 && pathParts[0] == "vnc" {
			uuidStr = pathParts[1]
		}
		// Also try chi URL parameter if available
		if uuidStr == "" {
			uuidStr = chi.URLParam(r, "uuid")
		}
	}
	
	if uuidStr == "" {
		logger.Log.Warn("VNC connection attempt without VM UUID",
			zap.Uint("user_id", claims.UserID),
			zap.String("username", claims.Username),
			zap.String("path", r.URL.Path),
			zap.String("query", r.URL.RawQuery))
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel() // Ensure context is cancelled to prevent resource leak
		ws.Write(ctx, websocket.MessageText, []byte(`{"type":"error","error":"VM UUID is required","code":"MISSING_VM_UUID"}`))
		return
	}

	logger.Log.Info("VNC connection request", 
		zap.String("vm_uuid", uuidStr),
		zap.Uint("user_id", claims.UserID),
		zap.String("username", claims.Username))

	// Find VM by UUID only
	var vmRec models.VM
	if err := h.DB.Where("uuid = ?", uuidStr).First(&vmRec).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			logger.Log.Warn("VM not found for VNC connection",
				zap.String("uuid", uuidStr),
				zap.Uint("user_id", claims.UserID),
				zap.String("username", claims.Username))
			ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
			defer cancel() // Ensure context is cancelled to prevent resource leak
			ws.Write(ctx, websocket.MessageText, []byte(fmt.Sprintf(`{"type":"error","error":"VM not found","code":"VM_NOT_FOUND","vm_uuid":"%s"}`, uuidStr)))
		} else {
			logger.Log.Error("Failed to find VM for VNC",
				zap.Error(err),
				zap.String("uuid", uuidStr),
				zap.Uint("user_id", claims.UserID),
				zap.String("username", claims.Username))
			ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
			defer cancel() // Ensure context is cancelled to prevent resource leak
			ws.Write(ctx, websocket.MessageText, []byte(fmt.Sprintf(`{"type":"error","error":"Database error","code":"DB_ERROR","details":"%s"}`, err.Error())))
		}
		return
	}

	logger.Log.Info("VNC connection request", 
		zap.String("vm_uuid", uuidStr),
		zap.String("vm_name", vmRec.Name),
		zap.Int("vm_id", int(vmRec.ID)))

	// Only log in development
	if h.Config.Env == "development" {
		logger.Log.Debug("VM found for VNC", zap.String("vm_name", vmRec.Name), zap.String("status", string(vmRec.Status)))
	}

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
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		ws.Write(ctx, websocket.MessageText, []byte(`{"type":"status","message":"Starting VM..."}`))
		cancel()

		if err := h.VMService.StartVM(vmRec.Name); err != nil {
			logger.Log.Error("Failed to start VM for VNC connection",
				zap.Error(err),
				zap.String("vm_name", vmRec.Name),
				zap.Uint("user_id", claims.UserID))
			ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
			defer cancel() // Ensure context is cancelled to prevent resource leak
			ws.Write(ctx, websocket.MessageText, []byte(fmt.Sprintf(`{"type":"error","error":"Failed to start VM","code":"VM_START_FAILED","status":"%s","details":"%v"}`, vmRec.Status, err)))
			return
		}

		// Optimized: Use context with timeout instead of fixed sleep
		// Wait for VM to start and VNC to initialize (max 5 seconds)
		vmCtx, vmCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer vmCancel()
		
		ticker := time.NewTicker(500 * time.Millisecond)
		defer ticker.Stop()
		
		vmStarted := false
		for {
			select {
			case <-vmCtx.Done():
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
			errorCtx, errorCancel := context.WithTimeout(r.Context(), 5*time.Second)
			defer errorCancel() // Ensure context is cancelled to prevent resource leak
			ws.Write(errorCtx, websocket.MessageText, []byte(fmt.Sprintf(`{"type":"error","error":"VM is not running","code":"VM_NOT_RUNNING","status":"%s","message":"VM failed to start"}`, vmRec.Status)))
			return
		}

		logger.Log.Info("VM started successfully for VNC connection",
			zap.String("vm_name", vmRec.Name),
			zap.Uint("user_id", claims.UserID))
	}

	// Send status update
	portCtx, portCancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer portCancel() // Ensure context is cancelled to prevent resource leak
	ws.Write(portCtx, websocket.MessageText, []byte(`{"type":"status","message":"Getting VNC port..."}`))

	// Get VNC port with retry (GetVNCPort already has retry logic)
	vncPort, err := h.VMService.GetVNCPort(vmRec.Name)
	if err != nil {
		logger.Log.Error("Failed to get VNC port after retries",
			zap.Error(err),
			zap.String("vm_name", vmRec.Name),
			zap.String("vm_uuid", vmRec.UUID),
			zap.Uint("user_id", claims.UserID),
			zap.String("username", claims.Username))
		portErrorCtx, portErrorCancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer portErrorCancel() // Ensure context is cancelled to prevent resource leak
		ws.Write(portErrorCtx, websocket.MessageText, []byte(fmt.Sprintf(`{"type":"error","error":"Failed to get VNC port","code":"VNC_PORT_ERROR","details":"%v","message":"VNC port not available yet. Please wait a moment and try again."}`, err)))
		return
	}

	logger.Log.Info("VNC port retrieved successfully",
		zap.String("vm_name", vmRec.Name),
		zap.String("vnc_port", vncPort),
		zap.Uint("user_id", claims.UserID))

	// Send status update
	connectCtx, connectCancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer connectCancel() // Ensure context is cancelled to prevent resource leak
	ws.Write(connectCtx, websocket.MessageText, []byte(fmt.Sprintf(`{"type":"status","message":"Connecting to VNC server on port %s..."}`, vncPort)))

	targetAddr := fmt.Sprintf("localhost:%s", vncPort)

	// Try to connect to VNC server with timeout and retry
	var conn net.Conn
	maxConnectionRetries := 3
	connectionRetryDelay := 500 * time.Millisecond

	for i := 0; i < maxConnectionRetries; i++ {
		var err error
		dialer := &net.Dialer{
			Timeout:   3 * time.Second,
			KeepAlive: 30 * time.Second, // Enable TCP KeepAlive for VNC connections
		}
		conn, err = dialer.Dial("tcp", targetAddr)
		if err == nil {
			// Optimize TCP connection settings for VNC (low latency, high throughput)
			if tcpConn, ok := conn.(*net.TCPConn); ok {
				tcpConn.SetKeepAlive(true)
				tcpConn.SetKeepAlivePeriod(30 * time.Second)
				tcpConn.SetNoDelay(true) // Disable Nagle's algorithm for low latency
				// Set buffer sizes for better throughput
				tcpConn.SetReadBuffer(64 * 1024)  // 64KB read buffer
				tcpConn.SetWriteBuffer(64 * 1024) // 64KB write buffer
			}
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
		connectErrorCtx, connectErrorCancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer connectErrorCancel() // Ensure context is cancelled to prevent resource leak
		ws.Write(connectErrorCtx, websocket.MessageText, []byte(fmt.Sprintf(`{"type":"error","error":"Failed to connect to VNC server","code":"VNC_CONNECTION_FAILED","address":"%s","message":"VNC server not ready. Please wait a moment and try again."}`, targetAddr)))
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
	successCtx, successCancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer successCancel() // Ensure context is cancelled to prevent resource leak
	ws.Write(successCtx, websocket.MessageText, []byte(`{"type":"status","message":"VNC connection established, starting proxy..."}`))

	// Create console session
	sessionMgr := session.GetSessionManager()
	
	// Check reconnect limit
	if err := sessionMgr.CheckReconnectLimit(claims.UserID); err != nil {
		logger.Log.Warn("Reconnect limit exceeded",
			zap.Uint("user_id", claims.UserID),
			zap.String("username", claims.Username),
			zap.Error(err))
		ws.Write(successCtx, websocket.MessageText, []byte(fmt.Sprintf(`{"type":"error","error":"%s","code":"RECONNECT_LIMIT_EXCEEDED"}`, err.Error())))
		return
	}

	sessionID, err := sessionMgr.CreateSession(claims.UserID, vmRec.ID, vmRec.UUID, r.RemoteAddr, r.UserAgent())
	if err != nil {
		logger.Log.Warn("Failed to create console session",
			zap.Uint("user_id", claims.UserID),
			zap.String("username", claims.Username),
			zap.Error(err))
		ws.Write(successCtx, websocket.MessageText, []byte(fmt.Sprintf(`{"type":"error","error":"%s","code":"SESSION_CREATE_FAILED"}`, err.Error())))
		return
	}

	// Audit log: console session start
	audit.LogConsoleSessionStart(r.Context(), claims.UserID, sessionID, vmRec.UUID)

	// Get session for context
	sess, ok := sessionMgr.GetSession(sessionID)
	if !ok {
		logger.Log.Error("Session not found after creation", zap.String("session_id", sessionID))
		ws.Write(successCtx, websocket.MessageText, []byte(`{"type":"error","error":"Session not found","code":"SESSION_NOT_FOUND"}`))
		return
	}

	// Use session context for VNC connection
	errc := make(chan error, 2)
	vncCtx, vncCancel := context.WithCancel(sess.Context())
	defer func() {
		vncCancel()
		// End session when connection closes
		sessionMgr.EndSession(sessionID, "user_disconnect")
		// Audit log: console session end
		audit.LogConsoleSessionEnd(r.Context(), claims.UserID, sessionID, vmRec.UUID, "user_disconnect")
	}()

	go func() {
		defer vncCancel() // Cancel context when goroutine exits
		messageCount := 0
		for {
			select {
			case <-vncCtx.Done():
				return
			default:
			}

			_, message, err := ws.Read(vncCtx)
			if err != nil {
				// Only log non-normal closure errors
				closeStatus := websocket.CloseStatus(err)
				if closeStatus != websocket.StatusNormalClosure && closeStatus != websocket.StatusGoingAway {
					// Only log non-EOF errors
					if err.Error() != "EOF" {
						logger.Log.Warn("VNC WebSocket read error",
							zap.Error(err),
							zap.String("vm_uuid", vmRec.UUID),
							zap.Uint("user_id", claims.UserID))
					}
				}
				errc <- err
				return
			}
			messageCount++
			
			// Update session activity (every 100 messages to reduce DB load)
			if messageCount%100 == 0 {
				if err := sessionMgr.UpdateActivity(sessionID); err != nil {
					logger.Log.Warn("Failed to update session activity", zap.Error(err))
				}
			}
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
		defer vncCancel() // Cancel context when goroutine exits
		// Optimized: Use buffer pool to reduce memory allocations
		buf := vncBufferPool.Get().([]byte)
		defer vncBufferPool.Put(buf)
		
		readCount := int32(0)
		for {
			select {
			case <-vncCtx.Done():
				return
			default:
			}

			// Set read deadline to prevent blocking indefinitely
			// Optimized: Longer timeout for VNC data streams (can have variable delays)
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			n, err := conn.Read(buf)
			if err != nil {
				// Only log non-EOF errors
				if err.Error() != "EOF" {
					// Only log non-EOF errors
					if err.Error() != "EOF" {
						logger.Log.Warn("VNC TCP read error",
							zap.Error(err),
							zap.String("vm_uuid", vmRec.UUID),
							zap.Uint("user_id", claims.UserID))
					}
				}
				errc <- err
				return
			}
			count := atomic.AddInt32(&readCount, 1)
			
			// Update session activity (every 100 reads to reduce DB load)
			if count%100 == 0 {
				if err := sessionMgr.UpdateActivity(sessionID); err != nil {
					logger.Log.Warn("Failed to update session activity", zap.Error(err))
				}
			}
			
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
			// Optimized: Longer timeout for VNC WebSocket writes (network can be variable)
			writeCtx, writeCancel := context.WithTimeout(r.Context(), 60*time.Second)
			if err := ws.Write(writeCtx, websocket.MessageBinary, buf[:n]); err != nil {
				writeCancel()
				// Check if it's a close error - don't log as error if it's a normal closure
				closeStatus := websocket.CloseStatus(err)
				if closeStatus != websocket.StatusNormalClosure && closeStatus != websocket.StatusGoingAway {
					logger.Log.Error("VNC WebSocket write error",
						zap.Error(err),
						zap.String("vm_uuid", vmRec.UUID),
						zap.Uint("user_id", claims.UserID),
						zap.Int32("writes_completed", atomic.LoadInt32(&readCount)))
				}
				errc <- err
				return
			}
			writeCancel() // Always cancel context after use to prevent resource leak
		}
	}()

	// Wait for error from either goroutine
	err = <-errc
	
	// Close connections gracefully (ensure cleanup even on error)
	if conn != nil {
		if closeErr := conn.Close(); closeErr != nil {
			logger.Log.Debug("Error closing VNC TCP connection",
				zap.Error(closeErr),
				zap.String("vm_uuid", vmRec.UUID))
		}
	}
	
	// Send close message to WebSocket if not already closed
	closeStatus := websocket.CloseStatus(err)
	if err != nil && closeStatus != websocket.StatusNormalClosure && closeStatus != websocket.StatusGoingAway {
		// Try to send close frame
		ws.Close(websocket.StatusInternalError, "Connection closed")
	}
	
	// Log connection closure
	if err != nil && closeStatus != websocket.StatusNormalClosure && closeStatus != websocket.StatusGoingAway {
	// Only log actual errors, not normal closures
	if err != nil && err.Error() != "EOF" {
		logger.Log.Warn("VNC connection closed with error",
			zap.Error(err),
			zap.String("vm_uuid", vmRec.UUID),
			zap.Uint("user_id", claims.UserID))
	}
	} else {
	// Only log in development
	if h.Config.Env == "development" {
		logger.Log.Debug("VNC connection closed normally",
			zap.String("vm_uuid", vmRec.UUID),
			zap.Uint("user_id", claims.UserID))
	}
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
	uuidStr := chi.URLParam(r, "uuid")
	if uuidStr == "" {
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
		if h.VMService == nil {
			errors.WriteInternalError(w, fmt.Errorf("VM service is not available"), h.Config.Env == "development")
			return
		}

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
	if h.VMService == nil {
		errors.WriteInternalError(w, fmt.Errorf("VM service is not available"), h.Config.Env == "development")
		return
	}

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
	if h.VMService == nil {
		errors.WriteInternalError(w, fmt.Errorf("VM service is not available"), cfg.Env == "development")
		return
	}

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
