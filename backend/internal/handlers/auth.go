package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/auth"
	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/errors"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/metrics"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	User      struct {
		ID       uint   `json:"id"`
		Username string `json:"username"`
	} `json:"user"`
}

type RegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// HandleLogin handles user login and returns a JWT token.
func (h *Handler) HandleLogin(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	if r.Method != "POST" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errors.WriteBadRequest(w, "Invalid request body", err)
		return
	}

	// Find user
	var user models.User
	if err := h.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			errors.WriteUnauthorized(w, "Invalid credentials")
		} else {
			logger.Log.Error("Failed to find user", zap.Error(err))
			errors.WriteInternalError(w, err, false)
		}
		return
	}

	// Check password
	if !auth.CheckPassword(req.Password, user.Password) {
		errors.WriteUnauthorized(w, "Invalid credentials")
		return
	}

	// Check if user is approved (admin users are always approved)
	if !user.Approved && user.Role != models.RoleAdmin {
		errors.WriteForbidden(w, "Account pending approval. Please wait for admin approval.")
		return
	}

	// Generate token with role and approval status
	role := string(user.Role)
	if role == "" {
		role = string(models.RoleUser) // Default to user if role is empty
	}
	// Only generate token if user is approved (admin users are always approved)
	approved := user.Approved || user.Role == models.RoleAdmin
	token, err := auth.GenerateTokenWithApproval(user.ID, user.Username, role, approved, cfg.JWTSecret, 24)
	if err != nil {
		logger.Log.Error("Failed to generate token", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	// Prepare response
	response := LoginResponse{
		Token:     token,
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}
	response.User.ID = user.ID
	response.User.Username = user.Username

	logger.Log.Info("User logged in", zap.String("username", user.Username))
	
	// Update metrics
	metrics.UserLoginTotal.Inc()
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// HandleRegister handles user registration.
func (h *Handler) HandleRegister(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	if r.Method != "POST" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	var req RegisterRequest
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

	// Create user with default role (not approved, requires admin approval)
	user := models.User{
		Username: req.Username,
		Password: hashedPassword,
		Role:     models.RoleUser, // Default role for new users
		Approved: false,            // Requires admin approval
	}

	if err := h.DB.Create(&user).Error; err != nil {
		logger.Log.Error("Failed to create user", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	logger.Log.Info("User registered", zap.String("username", user.Username))
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":       user.ID,
		"username": user.Username,
		"message":  "User created successfully",
	})
}

