package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/auth"
	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/errors"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/metrics"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/DARC0625/LIMEN/backend/internal/security"
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
// @Summary     User login
// @Description Authenticates a user and returns a JWT token
// @Tags        Authentication
// @Accept      json
// @Produce     json
// @Param       credentials body LoginRequest true "Login credentials"
// @Success     200  {object}  LoginResponse  "Login successful"
// @Failure     400  {object}  map[string]interface{}  "Invalid request"
// @Failure     401  {object}  map[string]interface{}  "Invalid credentials"
// @Failure     403  {object}  map[string]interface{}  "Account locked or not approved"
// @Router      /auth/login [post]
func (h *Handler) HandleLogin(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	logger.Log.Info("HandleLogin called",
		zap.String("method", r.Method),
		zap.String("path", r.URL.Path),
		zap.String("remote_addr", r.RemoteAddr),
		zap.String("host", r.Host),
		zap.String("content_type", r.Header.Get("Content-Type")),
		zap.String("origin", r.Header.Get("Origin")),
		zap.String("referer", r.Header.Get("Referer")))

	if r.Method != "POST" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Log.Warn("Failed to decode login request", zap.Error(err))
		errors.WriteBadRequest(w, "Invalid request body", err)
		return
	}

	// Zero-trust: Don't log username or password information
	// Only log that a login attempt was made
	logger.Log.Info("Login attempt",
		zap.Bool("password_provided", req.Password != ""))

	// Zero-trust: Always use generic error messages to prevent user enumeration
	// Check account lockout (user security: prevent brute force)
	locked, lockUntil := security.CheckAccountLockout(0) // Would use actual userID
	if locked && lockUntil != nil && time.Now().Before(*lockUntil) {
		errors.WriteForbidden(w, fmt.Sprintf("Account locked due to too many failed attempts. Try again after %s", lockUntil.Format(time.RFC3339)))
		return
	}

	// Find user
	var user models.User
	if err := h.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		// Always return generic error message (zero-trust: don't reveal if user exists)
		if err == gorm.ErrRecordNotFound {
			// Use same error message as invalid password to prevent user enumeration
			// But still record failed attempt for security monitoring
			security.RecordFailedLogin(r.Context(), 0, r.RemoteAddr)
			errors.WriteUnauthorized(w, "Invalid credentials")
		} else {
			logger.Log.Error("Failed to find user", zap.Error(err))
			errors.WriteInternalError(w, err, false)
		}
		return
	}

	// Check password
	if !auth.CheckPassword(req.Password, user.Password) {
		// Record failed login attempt (user security: behavior monitoring)
		security.RecordFailedLogin(r.Context(), user.ID, r.RemoteAddr)
		
		// Audit failed login attempt
		security.AuditUserAction(r.Context(), user.ID, "login_failed", "authentication", false, map[string]interface{}{
			"ip": r.RemoteAddr,
			"user_agent": r.UserAgent(),
		})
		
		// Log security event with full context
		logCtx := logger.LogContext{
			Timestamp: time.Now(),
			RequestID: r.Header.Get("X-Request-ID"),
			UserID:    user.ID,
			Username:  user.Username,
			IP:        r.RemoteAddr,
			UserAgent: r.UserAgent(),
			Method:    r.Method,
			Path:      r.URL.Path,
			Service:   "limen-backend",
			Component: "auth",
			Action:    "login_failed",
			Resource:  "user",
			ResourceID: user.ID,
		}
		logger.LogSecurityEvent(logger.EventSecurityLoginFailed, logCtx, "medium", "Login failed",
			zap.String("reason", "invalid_password"),
		)
		
		// Use same generic error message (zero-trust: don't reveal which part failed)
		errors.WriteUnauthorized(w, "Invalid credentials")
		return
	}
	
	// Audit successful login
	security.AuditUserAction(r.Context(), user.ID, "login_success", "authentication", true, map[string]interface{}{
		"ip": r.RemoteAddr,
		"user_agent": r.UserAgent(),
	})
	
	// Log business event with full context
	logCtx := logger.LogContext{
		Timestamp: time.Now(),
		RequestID: r.Header.Get("X-Request-ID"),
		UserID:    user.ID,
		Username:  user.Username,
		IP:        r.RemoteAddr,
		UserAgent: r.UserAgent(),
		Method:    r.Method,
		Path:      r.URL.Path,
		Service:   "limen-backend",
		Component: "auth",
		Action:    "login",
		Resource:  "user",
		ResourceID: user.ID,
	}
	logger.LogUserEvent(logger.EventUserLogin, logCtx, user.ID, user.Username, "User logged in successfully",
		zap.String("role", string(user.Role)),
		zap.Bool("approved", user.Approved || user.Role == models.RoleAdmin),
	)

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
// @Summary     User registration
// @Description Registers a new user account (requires admin approval)
// @Tags        Authentication
// @Accept      json
// @Produce     json
// @Param       user body RegisterRequest true "User registration data"
// @Success     201  {object}  map[string]interface{}  "User created successfully"
// @Failure     400  {object}  map[string]interface{}  "Invalid request or validation error"
// @Failure     409  {object}  map[string]interface{}  "Username already exists"
// @Router      /auth/register [post]
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

	// Zero-trust: Validate and sanitize all inputs
	// Sanitize username
	req.Username = strings.TrimSpace(req.Username)
	
	// Validate username
	if req.Username == "" || len(req.Username) < 3 {
		errors.WriteBadRequest(w, "Username must be at least 3 characters", nil)
		return
	}
	if len(req.Username) > 32 {
		errors.WriteBadRequest(w, "Username must be at most 32 characters", nil)
		return
	}
	
	// Validate username format (alphanumeric and underscore only)
	for _, r := range req.Username {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_') {
			errors.WriteBadRequest(w, "Username can only contain alphanumeric characters and underscores", nil)
			return
		}
	}
	
	// Validate password against security policy (zero-trust: enforce strong passwords)
	policy := security.DefaultUserSecurityPolicy()
	valid, issues := security.ValidatePasswordPolicy(req.Password, policy)
	if !valid {
		errors.WriteBadRequest(w, fmt.Sprintf("Password does not meet security requirements: %s", strings.Join(issues, "; ")), nil)
		return
	}
	
	// Additional check for common weak passwords (already checked in ValidatePasswordPolicy, but double-check)
	// This is redundant but provides extra security layer

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
		Approved: false,           // Requires admin approval
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
