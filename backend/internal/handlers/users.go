package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/DARC0625/LIMEN/backend/internal/auth"
	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/errors"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/middleware"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/gorilla/mux"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// UserResponse represents a user in API responses (without password)
type UserResponse struct {
	ID        uint   `json:"id"`
	UUID      string `json:"uuid"`
	Username  string `json:"username"`
	Role      string `json:"role"`
	Approved  bool   `json:"approved"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// UserWithStats includes user information with resource usage statistics
type UserWithStats struct {
	UserResponse
	VMCount      int `json:"vm_count"`
	TotalCPU     int `json:"total_cpu"`
	TotalMemory  int `json:"total_memory"` // in MB
}

// CreateUserRequest represents a request to create a new user
type CreateUserRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"` // "admin" or "user"
}

// UpdateUserRequest represents a request to update a user
type UpdateUserRequest struct {
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
	Role     string `json:"role,omitempty"`
}

// UpdateUserRoleRequest represents a request to update user role
type UpdateUserRoleRequest struct {
	Role string `json:"role"` // "admin" or "user"
}

// HandleListUsers handles GET /api/admin/users - List all users
func (h *Handler) HandleListUsers(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	var users []models.User
	if err := h.DB.Find(&users).Error; err != nil {
		logger.Log.Error("Failed to fetch users", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	// Get resource usage for each user
	usersWithStats := make([]UserWithStats, 0, len(users))
	for _, user := range users {
		stats := UserWithStats{
			UserResponse: UserResponse{
				ID:        user.ID,
				UUID:      user.UUID,
				Username:  user.Username,
				Role:      string(user.Role),
				Approved:  user.Approved,
				CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
				UpdatedAt: user.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
			},
		}

		// Count VMs and calculate resource usage
		var vms []models.VM
		if err := h.DB.Where("owner_id = ?", user.ID).Find(&vms).Error; err == nil {
			stats.VMCount = len(vms)
			for _, vm := range vms {
				stats.TotalCPU += vm.CPU
				stats.TotalMemory += vm.Memory
			}
		}

		usersWithStats = append(usersWithStats, stats)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(usersWithStats)
}

// HandleGetUser handles GET /api/admin/users/{id} - Get user details
func (h *Handler) HandleGetUser(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	vars := mux.Vars(r)
	userID, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		errors.WriteBadRequest(w, "Invalid user ID", err)
		return
	}

	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			errors.WriteNotFound(w, "User not found")
		} else {
			logger.Log.Error("Failed to fetch user", zap.Error(err))
			errors.WriteInternalError(w, err, false)
		}
		return
	}

	// Get user's VMs
	var vms []models.VM
	h.DB.Where("owner_id = ?", user.ID).Find(&vms)

	response := struct {
		UserResponse
		VMs []models.VM `json:"vms"`
	}{
		UserResponse: UserResponse{
			ID:        user.ID,
			UUID:      user.UUID,
			Username:  user.Username,
			Role:      string(user.Role),
			Approved:  user.Approved,
			CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			UpdatedAt: user.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		},
		VMs: vms,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// HandleCreateUser handles POST /api/admin/users - Create a new user
func (h *Handler) HandleCreateUser(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errors.WriteBadRequest(w, "Invalid request body", err)
		return
	}

	// Validate input
	if req.Username == "" || len(req.Username) < 3 {
		errors.WriteBadRequest(w, "Username must be at least 3 characters", nil)
		return
	}
	if req.Password == "" || len(req.Password) < 6 {
		errors.WriteBadRequest(w, "Password must be at least 6 characters", nil)
		return
	}

	// Validate role
	role := models.UserRole(req.Role)
	if req.Role == "" {
		role = models.RoleUser // Default to user
	} else if !role.IsValid() {
		errors.WriteBadRequest(w, "Invalid role. Must be 'admin' or 'user'", nil)
		return
	}

	// Check if user already exists
	var existingUser models.User
	if err := h.DB.Where("username = ?", req.Username).First(&existingUser).Error; err == nil {
		errors.WriteBadRequest(w, "Username already exists", nil)
		return
	}

	// Hash password
	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		logger.Log.Error("Failed to hash password", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	// Create user (Admin-created users are auto-approved)
	user := models.User{
		Username: req.Username,
		Password: hashedPassword,
		Role:     role,
		Approved: true, // Admin-created users are auto-approved
	}

	if err := h.DB.Create(&user).Error; err != nil {
		logger.Log.Error("Failed to create user", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	logger.Log.Info("User created by admin", zap.String("username", user.Username), zap.String("role", string(user.Role)))

	response := UserResponse{
		ID:        user.ID,
		UUID:      user.UUID,
		Username:  user.Username,
		Role:      string(user.Role),
		Approved:  user.Approved,
		CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt: user.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// HandleUpdateUser handles PUT /api/admin/users/{id} - Update user
func (h *Handler) HandleUpdateUser(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	vars := mux.Vars(r)
	userID, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		errors.WriteBadRequest(w, "Invalid user ID", err)
		return
	}

	var req UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errors.WriteBadRequest(w, "Invalid request body", err)
		return
	}

	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			errors.WriteNotFound(w, "User not found")
		} else {
			logger.Log.Error("Failed to fetch user", zap.Error(err))
			errors.WriteInternalError(w, err, false)
		}
		return
	}

	// Update username if provided
	if req.Username != "" {
		if len(req.Username) < 3 {
			errors.WriteBadRequest(w, "Username must be at least 3 characters", nil)
			return
		}
		// Check if new username is already taken by another user
		var existingUser models.User
		if err := h.DB.Where("username = ? AND id != ?", req.Username, userID).First(&existingUser).Error; err == nil {
			errors.WriteBadRequest(w, "Username already exists", nil)
			return
		}
		user.Username = req.Username
	}

	// Update password if provided
	if req.Password != "" {
		if len(req.Password) < 6 {
			errors.WriteBadRequest(w, "Password must be at least 6 characters", nil)
			return
		}
		hashedPassword, err := auth.HashPassword(req.Password)
		if err != nil {
			logger.Log.Error("Failed to hash password", zap.Error(err))
			errors.WriteInternalError(w, err, false)
			return
		}
		user.Password = hashedPassword
	}

	// Update role if provided
	if req.Role != "" {
		role := models.UserRole(req.Role)
		if !role.IsValid() {
			errors.WriteBadRequest(w, "Invalid role. Must be 'admin' or 'user'", nil)
			return
		}
		user.Role = role
	}

	if err := h.DB.Save(&user).Error; err != nil {
		logger.Log.Error("Failed to update user", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	logger.Log.Info("User updated by admin", zap.Uint("user_id", user.ID), zap.String("username", user.Username))

	response := UserResponse{
		ID:        user.ID,
		Username:  user.Username,
		Role:      string(user.Role),
		Approved:  user.Approved,
		CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt: user.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// HandleDeleteUser handles DELETE /api/admin/users/{id} - Delete user (soft delete)
func (h *Handler) HandleDeleteUser(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	vars := mux.Vars(r)
	userID, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		errors.WriteBadRequest(w, "Invalid user ID", err)
		return
	}

	// Prevent deleting yourself
	currentUserID, ok := middleware.GetUserID(r.Context())
	if ok && currentUserID == uint(userID) {
		errors.WriteBadRequest(w, "Cannot delete your own account", nil)
		return
	}

	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			errors.WriteNotFound(w, "User not found")
		} else {
			logger.Log.Error("Failed to fetch user", zap.Error(err))
			errors.WriteInternalError(w, err, false)
		}
		return
	}

	// Soft delete
	if err := h.DB.Delete(&user).Error; err != nil {
		logger.Log.Error("Failed to delete user", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	logger.Log.Info("User deleted by admin", zap.Uint("user_id", user.ID), zap.String("username", user.Username))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNoContent)
}

// HandleUpdateUserRole handles PUT /api/admin/users/{id}/role - Update user role
func (h *Handler) HandleUpdateUserRole(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	vars := mux.Vars(r)
	userID, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		errors.WriteBadRequest(w, "Invalid user ID", err)
		return
	}

	var req UpdateUserRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errors.WriteBadRequest(w, "Invalid request body", err)
		return
	}

	role := models.UserRole(req.Role)
	if !role.IsValid() {
		errors.WriteBadRequest(w, "Invalid role. Must be 'admin' or 'user'", nil)
		return
	}

	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			errors.WriteNotFound(w, "User not found")
		} else {
			logger.Log.Error("Failed to fetch user", zap.Error(err))
			errors.WriteInternalError(w, err, false)
		}
		return
	}

	user.Role = role
	if err := h.DB.Save(&user).Error; err != nil {
		logger.Log.Error("Failed to update user role", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	logger.Log.Info("User role updated by admin", zap.Uint("user_id", user.ID), zap.String("username", user.Username), zap.String("new_role", string(role)))

	response := UserResponse{
		ID:        user.ID,
		Username:  user.Username,
		Role:      string(user.Role),
		Approved:  user.Approved,
		CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt: user.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// HandleApproveUser handles PUT /api/admin/users/{id}/approve - Approve user
func (h *Handler) HandleApproveUser(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	vars := mux.Vars(r)
	userID, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		errors.WriteBadRequest(w, "Invalid user ID", err)
		return
	}

	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			errors.WriteNotFound(w, "User not found")
		} else {
			logger.Log.Error("Failed to fetch user", zap.Error(err))
			errors.WriteInternalError(w, err, false)
		}
		return
	}

	user.Approved = true
	if err := h.DB.Save(&user).Error; err != nil {
		logger.Log.Error("Failed to approve user", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	logger.Log.Info("User approved by admin", zap.Uint("user_id", user.ID), zap.String("username", user.Username))

	response := UserResponse{
		ID:        user.ID,
		Username:  user.Username,
		Role:      string(user.Role),
		Approved:  user.Approved,
		CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt: user.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

