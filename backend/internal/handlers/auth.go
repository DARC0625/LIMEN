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
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"` // Omitted from JSON, sent via cookie
	ExpiresIn    int    `json:"expires_in"`              // Access token expiry in seconds (900 = 15 minutes)
	TokenType    string `json:"token_type"`              // "Bearer"
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

	// Find user (optimized: only fetch necessary fields for authentication)
	var user models.User
	if err := h.DB.Select("id", "username", "password", "role", "approved").Where("username = ?", req.Username).First(&user).Error; err != nil {
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
			"ip":         r.RemoteAddr,
			"user_agent": r.UserAgent(),
		})

		// Log security event with full context
		logCtx := logger.LogContext{
			Timestamp:  time.Now(),
			RequestID:  r.Header.Get("X-Request-ID"),
			UserID:     user.ID,
			Username:   user.Username,
			IP:         r.RemoteAddr,
			UserAgent:  r.UserAgent(),
			Method:     r.Method,
			Path:       r.URL.Path,
			Service:    "limen-backend",
			Component:  "auth",
			Action:     "login_failed",
			Resource:   "user",
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
		"ip":         r.RemoteAddr,
		"user_agent": r.UserAgent(),
	})

	// Log business event with full context
	logCtx := logger.LogContext{
		Timestamp:  time.Now(),
		RequestID:  r.Header.Get("X-Request-ID"),
		UserID:     user.ID,
		Username:   user.Username,
		IP:         r.RemoteAddr,
		UserAgent:  r.UserAgent(),
		Method:     r.Method,
		Path:       r.URL.Path,
		Service:    "limen-backend",
		Component:  "auth",
		Action:     "login",
		Resource:   "user",
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

	// Generate tokens with role and approval status
	role := string(user.Role)
	if role == "" {
		role = string(models.RoleUser) // Default to user if role is empty
	}
	// Only generate token if user is approved (admin users are always approved)
	approved := user.Approved || user.Role == models.RoleAdmin

	// Generate Access Token (15 minutes)
	accessToken, err := auth.GenerateAccessToken(user.ID, user.Username, role, approved, cfg.JWTSecret)
	if err != nil {
		logger.Log.Error("Failed to generate access token", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	// Generate Refresh Token (7 days)
	refreshToken, tokenID, err := auth.GenerateRefreshToken(user.ID, user.Username, role, approved, cfg.JWTSecret)
	if err != nil {
		logger.Log.Error("Failed to generate refresh token", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	// Generate CSRF Token
	csrfToken, err := security.GenerateCSRFToken()
	if err != nil {
		logger.Log.Error("Failed to generate CSRF token", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	// Create session with tokens
	sessionStore := auth.GetSessionStore()
	refreshExpiresAt := time.Now().Add(7 * 24 * time.Hour) // 7 days
	session, err := sessionStore.CreateSession(accessToken, refreshToken, tokenID, csrfToken, user.ID, user.Username, role, refreshExpiresAt)
	if err != nil {
		logger.Log.Error("Failed to create session", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	// Set Refresh Token cookie
	isHTTPS := r.Header.Get("X-Forwarded-Proto") == "https" || r.TLS != nil
	refreshCookie := &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode, // Lax for cross-domain compatibility while maintaining CSRF protection
		Path:     "/",
		MaxAge:   604800, // 7 days in seconds
		Domain:   "",     // Empty domain allows cookie to be sent to any subdomain (e.g., limen.kr)
	}
	if isHTTPS {
		refreshCookie.Secure = true
	}
	http.SetCookie(w, refreshCookie)
	
	logger.Log.Info("Refresh token cookie set",
		zap.String("username", user.Username),
		zap.Bool("secure", isHTTPS),
		zap.String("same_site", "Lax"),
		zap.String("domain", refreshCookie.Domain),
		zap.String("path", refreshCookie.Path))

	// Set CSRF Token cookie (for client-side access)
	csrfCookie := &http.Cookie{
		Name:     "csrf_token",
		Value:    csrfToken,
		HttpOnly: false, // JavaScript needs access for X-CSRF-Token header
		SameSite: http.SameSiteLaxMode, // Changed to Lax for consistency
		Path:     "/",
		MaxAge:   604800, // 7 days
		Domain:   "",     // Empty domain allows cookie to be sent to any subdomain
	}
	if isHTTPS {
		csrfCookie.Secure = true
	}
	http.SetCookie(w, csrfCookie)

	// Prepare response (Refresh Token is sent via cookie, not in body)
	response := LoginResponse{
		AccessToken: accessToken,
		ExpiresIn:   900,      // 15 minutes in seconds
		TokenType:   "Bearer",
	}

	logger.Log.Info("User logged in",
		zap.String("username", user.Username),
		zap.String("session_id", session.ID))

	// Log cookie settings for debugging
	logger.Log.Info("Login response cookies",
		zap.String("username", user.Username),
		zap.Bool("refresh_cookie_set", refreshCookie != nil),
		zap.Bool("csrf_cookie_set", csrfCookie != nil),
		zap.Bool("is_https", isHTTPS),
		zap.String("origin", r.Header.Get("Origin")),
		zap.String("referer", r.Header.Get("Referer")))

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

// SessionResponse represents a session status response.
type SessionResponse struct {
	Valid       bool   `json:"valid"`
	AccessToken string `json:"access_token,omitempty"`
	Reason      string `json:"reason,omitempty"`
	User        *struct {
		ID       uint   `json:"id"`
		Username string `json:"username"`
		Role     string `json:"role"`
	} `json:"user,omitempty"`
}

// CreateSessionRequest represents a request to create a session.
type CreateSessionRequest struct {
	AccessToken  string `json:"access_token,omitempty"`
	RefreshToken string `json:"refresh_token,omitempty"`
}

// RefreshTokenRequest represents a request to refresh access token.
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token,omitempty"` // Optional if sent via cookie
}

// RefreshTokenResponse represents a refresh token response.
type RefreshTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"` // Only if rotation is enabled
	ExpiresIn    int    `json:"expires_in"`              // Access token expiry in seconds
}

// HandleGetSession handles GET /api/auth/session - Get current session status.
// @Summary     Get session status
// @Description Returns the current session status from refresh token cookie
// @Tags        Authentication
// @Accept      json
// @Produce     json
// @Param       X-CSRF-Token header string true "CSRF Token"
// @Success     200  {object}  SessionResponse  "Session valid"
// @Failure     401  {object}  SessionResponse  "Session invalid or expired"
// @Failure     403  {object}  map[string]interface{}  "CSRF token missing or invalid"
// @Router      /auth/session [get]
func (h *Handler) HandleGetSession(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	if r.Method != "GET" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	// CSRF Token validation (optional for GET requests, but recommended)
	// GET /api/auth/session is a read operation, so CSRF is optional but recommended
	csrfToken := r.Header.Get("X-CSRF-Token")
	if csrfToken == "" {
		// Try to get from cookie as fallback
		if cookie, err := r.Cookie("csrf_token"); err == nil {
			csrfToken = cookie.Value
		}
	}
	
	// Log request for debugging (passive monitoring - no blocking)
	hasRefreshToken := false
	if _, err := r.Cookie("refresh_token"); err == nil {
		hasRefreshToken = true
	}
	logger.Log.Info("GET /api/auth/session request",
		zap.String("remote_addr", r.RemoteAddr),
		zap.String("origin", r.Header.Get("Origin")),
		zap.String("referer", r.Header.Get("Referer")),
		zap.Bool("has_refresh_token_cookie", hasRefreshToken),
		zap.Bool("has_csrf_token", csrfToken != ""),
		zap.String("user_agent", r.Header.Get("User-Agent")))

	// Get refresh token from cookie
	refreshToken := ""
	if cookie, err := r.Cookie("refresh_token"); err == nil {
		refreshToken = cookie.Value
	}

	// If no refresh token, try Authorization header (backward compatibility)
	if refreshToken == "" {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" {
			// Return 401 - no refresh token but has access token
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(SessionResponse{
				Valid:  false,
				Reason: "세션이 만료되었습니다.",
			})
			return
		}

		// No refresh token and no access token
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(SessionResponse{
			Valid:  false,
			Reason: "세션이 만료되었습니다.",
		})
		return
	}

	// Validate refresh token
	refreshClaims, err := auth.ValidateRefreshToken(refreshToken, cfg.JWTSecret)
	if err != nil {
		// Passive monitoring: Log invalid refresh token attempts (for security awareness)
		logger.Log.Warn("Invalid refresh token in session check",
			zap.Error(err),
			zap.String("remote_addr", r.RemoteAddr),
			zap.String("origin", r.Header.Get("Origin")),
			zap.String("user_agent", r.Header.Get("User-Agent")))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(SessionResponse{
			Valid:  false,
			Reason: "세션이 만료되었습니다.",
		})
		return
	}

	// Get session from store by refresh token
	sessionStore := auth.GetSessionStore()
	session, exists := sessionStore.GetSessionByRefreshToken(refreshToken)
	if !exists {
		// Passive monitoring: Log session not found (for security awareness)
		logger.Log.Warn("Session not found in store",
			zap.String("remote_addr", r.RemoteAddr),
			zap.String("origin", r.Header.Get("Origin")),
			zap.Uint("user_id", refreshClaims.UserID),
			zap.String("username", refreshClaims.Username))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(SessionResponse{
			Valid:  false,
			Reason: "세션이 만료되었습니다.",
		})
		return
	}

	// Validate CSRF token if provided (optional for GET, but recommended)
	// Passive monitoring: Log CSRF validation failures (for security awareness)
	if csrfToken != "" && !sessionStore.ValidateCSRFToken(session.ID, csrfToken) {
		logger.Log.Warn("Invalid CSRF token in session check",
			zap.String("session_id", session.ID),
			zap.String("remote_addr", r.RemoteAddr),
			zap.String("origin", r.Header.Get("Origin")),
			zap.Uint("user_id", session.UserID),
			zap.String("provided_csrf", csrfToken[:min(10, len(csrfToken))]+"..."),
			zap.String("expected_csrf", session.CSRFToken[:min(10, len(session.CSRFToken))]+"..."))
		// For GET requests, we don't block - just log (passive monitoring)
		// GET /api/auth/session is a read operation, so CSRF validation failure should not block
		// However, we log it for security awareness
		// Continue to return session info even if CSRF token is invalid (for GET requests only)
	}

	// Generate new access token (refresh it)
	newAccessToken, err := auth.GenerateAccessToken(session.UserID, session.Username, session.Role, refreshClaims.Approved, cfg.JWTSecret)
	if err != nil {
		logger.Log.Error("Failed to generate access token", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	// Update session with new access token
	sessionStore.UpdateSessionTokens(session.ID, newAccessToken, "", "")

	// Session is valid
	response := SessionResponse{
		Valid:       true,
		AccessToken: newAccessToken,
		User: &struct {
			ID       uint   `json:"id"`
			Username string `json:"username"`
			Role     string `json:"role"`
		}{
			ID:       session.UserID,
			Username: session.Username,
			Role:     session.Role,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// HandleCreateSession handles POST /api/auth/session - Create a new session.
// @Summary     Create session
// @Description Creates a new session from access token and refresh token, sets refresh token cookie
// @Tags        Authentication
// @Accept      json
// @Produce     json
// @Param       tokens body CreateSessionRequest true "Access token and refresh token"
// @Param       X-CSRF-Token header string true "CSRF Token"
// @Success     200  {object}  map[string]interface{}  "Session created"
// @Failure     400  {object}  map[string]interface{}  "Invalid request"
// @Failure     401  {object}  map[string]interface{}  "Invalid token"
// @Failure     403  {object}  map[string]interface{}  "CSRF token missing or invalid"
// @Router      /auth/session [post]
func (h *Handler) HandleCreateSession(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	if r.Method != "POST" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	// CSRF Token validation
	csrfToken := r.Header.Get("X-CSRF-Token")
	if csrfToken == "" {
		errors.WriteForbidden(w, "CSRF token required")
		return
	}

	var req CreateSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errors.WriteBadRequest(w, "Invalid request body", err)
		return
	}

	// Validate access token
	accessClaims, err := auth.ValidateToken(req.AccessToken, cfg.JWTSecret)
	if err != nil {
		logger.Log.Warn("Invalid access token for session creation", zap.Error(err))
		errors.WriteUnauthorized(w, "Invalid access token")
		return
	}

	// Validate refresh token
	refreshClaims, err := auth.ValidateRefreshToken(req.RefreshToken, cfg.JWTSecret)
	if err != nil {
		logger.Log.Warn("Invalid refresh token for session creation", zap.Error(err))
		errors.WriteUnauthorized(w, "Invalid refresh token")
		return
	}

	// Verify tokens belong to same user
	if accessClaims.UserID != refreshClaims.UserID {
		errors.WriteUnauthorized(w, "Token mismatch")
		return
	}

	// Check if user is approved
	if !refreshClaims.Approved && refreshClaims.Role != "admin" {
		errors.WriteForbidden(w, "Account pending approval")
		return
	}

	// Create session with tokens
	sessionStore := auth.GetSessionStore()
	refreshExpiresAt := time.Now().Add(7 * 24 * time.Hour) // 7 days
	session, err := sessionStore.CreateSession(req.AccessToken, req.RefreshToken, refreshClaims.TokenID, csrfToken, refreshClaims.UserID, refreshClaims.Username, refreshClaims.Role, refreshExpiresAt)
	if err != nil {
		logger.Log.Error("Failed to create session", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	// Set Refresh Token cookie
	isHTTPS := r.Header.Get("X-Forwarded-Proto") == "https" || r.TLS != nil
	refreshCookie := &http.Cookie{
		Name:     "refresh_token",
		Value:    req.RefreshToken,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode, // Lax for cross-domain compatibility
		Path:     "/",
		MaxAge:   604800, // 7 days
		Domain:   "",     // Empty domain allows cookie to be sent to any subdomain
	}
	if isHTTPS {
		refreshCookie.Secure = true
	}
	http.SetCookie(w, refreshCookie)

	// Set CSRF Token cookie
	csrfCookie := &http.Cookie{
		Name:     "csrf_token",
		Value:    csrfToken,
		HttpOnly: false,
		SameSite: http.SameSiteLaxMode, // Lax for cross-domain compatibility
		Path:     "/",
		MaxAge:   604800, // 7 days
		Domain:   "",     // Empty domain allows cookie to be sent to any subdomain
	}
	if isHTTPS {
		csrfCookie.Secure = true
	}
	http.SetCookie(w, csrfCookie)

	logger.Log.Info("Session created",
		zap.String("session_id", session.ID),
		zap.Uint("user_id", refreshClaims.UserID),
		zap.String("username", refreshClaims.Username))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Session created successfully",
	})
}

// HandleDeleteSession handles DELETE /api/auth/session - Delete current session.
// @Summary     Delete session
// @Description Deletes the current session and clears refresh token cookie
// @Tags        Authentication
// @Accept      json
// @Produce     json
// @Param       X-CSRF-Token header string true "CSRF Token"
// @Success     200  {object}  map[string]interface{}  "Session deleted"
// @Failure     403  {object}  map[string]interface{}  "CSRF token missing or invalid"
// @Router      /auth/session [delete]
func (h *Handler) HandleDeleteSession(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	if r.Method != "DELETE" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	// CSRF Token validation
	csrfToken := r.Header.Get("X-CSRF-Token")
	if csrfToken == "" {
		// Try to get from cookie as fallback
		if cookie, err := r.Cookie("csrf_token"); err == nil {
			csrfToken = cookie.Value
		}
	}

	// Get refresh token from cookie
	refreshToken := ""
	if cookie, err := r.Cookie("refresh_token"); err == nil {
		refreshToken = cookie.Value
	}

	// Delete session from store
	if refreshToken != "" {
		sessionStore := auth.GetSessionStore()
		session, exists := sessionStore.GetSessionByRefreshToken(refreshToken)
		if exists {
			// Validate CSRF token if provided
			if csrfToken != "" && !sessionStore.ValidateCSRFToken(session.ID, csrfToken) {
				logger.Log.Warn("Invalid CSRF token for session deletion", zap.String("session_id", session.ID))
				errors.WriteForbidden(w, "Invalid CSRF token")
				return
			}
			sessionStore.DeleteSession(session.ID)
		}
	}

	// Delete refresh token cookie
	isHTTPS := r.Header.Get("X-Forwarded-Proto") == "https" || r.TLS != nil
	refreshCookie := &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode, // Lax for cross-domain compatibility
		Path:     "/",
		MaxAge:   -1, // Delete immediately
		Domain:   "", // Empty domain allows cookie to be sent to any subdomain
	}
	if isHTTPS {
		refreshCookie.Secure = true
	}
	http.SetCookie(w, refreshCookie)

	// Delete CSRF token cookie
	csrfCookie := &http.Cookie{
		Name:     "csrf_token",
		Value:    "",
		HttpOnly: false,
		SameSite: http.SameSiteLaxMode, // Lax for cross-domain compatibility
		Path:     "/",
		MaxAge:   -1,
		Domain:   "", // Empty domain allows cookie to be sent to any subdomain
	}
	if isHTTPS {
		csrfCookie.Secure = true
	}
	http.SetCookie(w, csrfCookie)

	logger.Log.Info("Session deleted", zap.String("refresh_token", refreshToken[:min(10, len(refreshToken))]+"..."))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Session deleted successfully",
	})
}

// HandleRefreshToken handles POST /api/auth/refresh - Refresh access token.
// @Summary     Refresh access token
// @Description Refreshes the access token using refresh token from cookie or body
// @Tags        Authentication
// @Accept      json
// @Produce     json
// @Param       refresh_token body RefreshTokenRequest false "Refresh token (optional if sent via cookie)"
// @Success     200  {object}  RefreshTokenResponse  "Token refreshed"
// @Failure     401  {object}  map[string]interface{}  "Invalid or expired refresh token"
// @Router      /auth/refresh [post]
func (h *Handler) HandleRefreshToken(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	if r.Method != "POST" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	// Get refresh token from cookie first, then from body
	refreshToken := ""
	if cookie, err := r.Cookie("refresh_token"); err == nil {
		refreshToken = cookie.Value
	}

	// If not in cookie, try body
	if refreshToken == "" {
		var req RefreshTokenRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil && req.RefreshToken != "" {
			refreshToken = req.RefreshToken
		}
	}

	if refreshToken == "" {
		errors.WriteUnauthorized(w, "Refresh token required")
		return
	}

	// Validate refresh token
	refreshClaims, err := auth.ValidateRefreshToken(refreshToken, cfg.JWTSecret)
	if err != nil {
		logger.Log.Warn("Invalid refresh token", zap.Error(err))
		errors.WriteUnauthorized(w, "Invalid or expired refresh token")
		return
	}

	// Get session from store
	sessionStore := auth.GetSessionStore()
	session, exists := sessionStore.GetSessionByRefreshToken(refreshToken)
	if !exists {
		errors.WriteUnauthorized(w, "Invalid or expired refresh token")
		return
	}

	// Generate new access token
	newAccessToken, err := auth.GenerateAccessToken(refreshClaims.UserID, refreshClaims.Username, refreshClaims.Role, refreshClaims.Approved, cfg.JWTSecret)
	if err != nil {
		logger.Log.Error("Failed to generate access token", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	// Token Rotation: Generate new refresh token and invalidate old one
	newRefreshToken, newTokenID, err := auth.GenerateRefreshToken(refreshClaims.UserID, refreshClaims.Username, refreshClaims.Role, refreshClaims.Approved, cfg.JWTSecret)
	if err != nil {
		logger.Log.Error("Failed to generate refresh token", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	// Update session with new tokens (rotation)
	refreshExpiresAt := time.Now().Add(7 * 24 * time.Hour) // 7 days
	sessionStore.UpdateSessionTokens(session.ID, newAccessToken, newRefreshToken, newTokenID)
	session.RefreshToken = newRefreshToken
	session.TokenID = newTokenID
	session.ExpiresAt = refreshExpiresAt

	// Set new refresh token cookie
	isHTTPS := r.Header.Get("X-Forwarded-Proto") == "https" || r.TLS != nil
	refreshCookie := &http.Cookie{
		Name:     "refresh_token",
		Value:    newRefreshToken,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode, // Lax for cross-domain compatibility
		Path:     "/",
		MaxAge:   604800, // 7 days
		Domain:   "",     // Empty domain allows cookie to be sent to any subdomain
	}
	if isHTTPS {
		refreshCookie.Secure = true
	}
	http.SetCookie(w, refreshCookie)

	// Prepare response
	response := RefreshTokenResponse{
		AccessToken: newAccessToken,
		ExpiresIn:   900, // 15 minutes
	}

	logger.Log.Info("Access token refreshed",
		zap.Uint("user_id", refreshClaims.UserID),
		zap.String("username", refreshClaims.Username))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
