// Package middleware provides authentication middleware.
package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/DARC0625/LIMEN/backend/internal/auth"
	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/errors"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"go.uber.org/zap"
)

const UserIDKey contextKey = "user_id"
const UsernameKey contextKey = "username"
const BetaAccessKey contextKey = "beta_access"

// Auth creates an authentication middleware that validates JWT tokens.
func Auth(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Fix path if Envoy rewrites incorrectly (missing slashes)
			originalPath := r.URL.Path
			fixed := false

			// Fix common Envoy rewrite issues
			pathFixes := map[string]string{
				"/apiauth/":        "/api/auth/",
				"/apiquota":        "/api/quota",
				"/apivms":          "/api/vms",
				"/apihealth_proxy": "/api/health_proxy",
				"/apiadmin/":       "/api/admin/",
			}

			for wrong, correct := range pathFixes {
				if strings.HasPrefix(originalPath, wrong) {
					r.URL.Path = strings.Replace(originalPath, wrong, correct, 1)
					fixed = true
					break
				}
			}

			// Also handle paths that start with /api but missing slash after /api
			if !fixed && strings.HasPrefix(originalPath, "/api") && len(originalPath) > 4 {
				// Check if /api is followed by a letter (missing slash)
				if originalPath[4] >= 'a' && originalPath[4] <= 'z' {
					// Insert slash after /api
					r.URL.Path = "/api/" + originalPath[4:]
					fixed = true
				}
			}

			if fixed {
				logger.Log.Info("Fixed path from Envoy rewrite",
					zap.String("original", originalPath),
					zap.String("fixed", r.URL.Path))
			}

			// Skip authentication for public endpoints
			if IsPublicEndpoint(r.URL.Path) {
				logger.Log.Debug("Public endpoint accessed - allowing",
					zap.String("path", r.URL.Path),
					zap.String("method", r.Method))
				next.ServeHTTP(w, r)
				return
			}

			// Try to get access token from Authorization header first, then refresh token from cookie
			var tokenString string
			var claims *auth.Claims
			var err error

			// 1. Try Authorization header (Access Token)
			authHeader := r.Header.Get("Authorization")
			tokenString, err = auth.ExtractTokenFromHeader(authHeader)
			if err == nil {
				claims, err = auth.ValidateToken(tokenString, cfg.JWTSecret)
				if err == nil {
					logger.Log.Debug("Authenticated via Authorization header",
						zap.String("path", r.URL.Path),
						zap.Uint("user_id", claims.UserID))
				}
			}

			// 2. Fallback to refresh token cookie (validate and generate new access token)
			if tokenString == "" || err != nil {
				if cookie, err := r.Cookie("refresh_token"); err == nil {
					refreshToken := cookie.Value
					logger.Log.Debug("Attempting authentication via refresh token cookie",
						zap.String("path", r.URL.Path))

					refreshClaims, refreshErr := auth.ValidateRefreshToken(refreshToken, cfg.JWTSecret)
					if refreshErr != nil {
						logger.Log.Debug("Refresh token validation failed",
							zap.String("path", r.URL.Path),
							zap.Error(refreshErr))
					} else {
						// Get session to verify refresh token is valid
						sessionStore := auth.GetSessionStore()
						session, exists := sessionStore.GetSessionByRefreshToken(refreshToken)
						if !exists {
							logger.Log.Warn("Refresh token not found in session store",
								zap.String("path", r.URL.Path),
								zap.Uint("user_id", refreshClaims.UserID))
						} else {
							// Generate new access token from refresh token
							tokenString, err = auth.GenerateAccessToken(refreshClaims.UserID, refreshClaims.Username, refreshClaims.Role, refreshClaims.Approved, cfg.JWTSecret)
							if err == nil {
								// Create claims from refresh token
								claims = &auth.Claims{
									UserID:   refreshClaims.UserID,
									Username: refreshClaims.Username,
									Role:     refreshClaims.Role,
									Approved: refreshClaims.Approved,
								}
								// Update session with new access token
								sessionStore.UpdateSessionTokens(session.ID, tokenString, "", "")
								logger.Log.Debug("Authenticated via refresh token cookie",
									zap.String("path", r.URL.Path),
									zap.Uint("user_id", claims.UserID))
							} else {
								logger.Log.Warn("Failed to generate access token from refresh token",
									zap.String("path", r.URL.Path),
									zap.Error(err))
							}
						}
					}
				} else {
					logger.Log.Debug("No refresh_token cookie found",
						zap.String("path", r.URL.Path))
				}
			}

			// If both methods failed, return 401
			if tokenString == "" || err != nil {
				logger.Log.Warn("Auth middleware - no valid token found, returning 401",
					zap.String("path", r.URL.Path),
					zap.String("method", r.Method),
					zap.Error(err))
				errors.WriteUnauthorized(w, "Authentication required")
				return
			}

			// Check if user is approved (admin users are always approved)
			// This is a critical security check - unapproved users should not access the system
			if !claims.Approved && claims.Role != "admin" {
				logger.Log.Warn("Unapproved user attempted access",
					zap.Uint("user_id", claims.UserID),
					zap.String("username", claims.Username),
					zap.String("path", r.URL.Path))
				errors.WriteForbidden(w, "Account pending approval. Please wait for admin approval.")
				return
			}

			// Add user info to context
			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, UsernameKey, claims.Username)
			ctx = context.WithValue(ctx, RoleKey, claims.Role)
			ctx = context.WithValue(ctx, BetaAccessKey, claims.BetaAccess)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// IsPublicEndpoint checks if the endpoint is public (doesn't require authentication).
// This function is exported so it can be used in main.go to skip authentication middleware.
func IsPublicEndpoint(path string) bool {
	// Normalize path - handle missing slashes
	normalizedPath := path
	if !strings.HasPrefix(normalizedPath, "/") {
		normalizedPath = "/" + normalizedPath
	}

	publicPaths := []string{
		"/api/health",
		"/api/health_proxy", // Health check proxy endpoint
		"/api/metrics",      // Prometheus metrics endpoint (public)
		"/api/auth/login",
		"/api/auth/register",
		"/api/auth/session",    // Session management endpoints (GET, POST, DELETE)
		"/api/auth/refresh",    // Token refresh endpoint
		"/api/public/waitlist", // Public waitlist registration (no auth required)
		"/agent",               // Agent reverse-proxy path (public metrics)
		"/apiauth/login",       // Handle Envoy rewrite issue
		"/apiauth/register",    // Handle Envoy rewrite issue
		"/ws/vnc",              // WebSocket endpoints need special handling
		"/vnc",                 // VNC WebSocket endpoint (with or without UUID)
		"/vnc/",                // VNC WebSocket endpoint with UUID in path
	}

	for _, publicPath := range publicPaths {
		// Exact match
		if normalizedPath == publicPath {
			return true
		}
		// Prefix match (e.g., /api/auth/session matches /api/auth/session)
		if strings.HasPrefix(normalizedPath, publicPath+"/") {
			return true
		}
		// Also check without leading slash (for paths like "api/auth/session")
		if len(publicPath) > 1 && strings.HasPrefix(normalizedPath, publicPath[1:]) {
			return true
		}
	}

	return false
}

// GetUserID retrieves the user ID from context.
func GetUserID(ctx context.Context) (uint, bool) {
	userID, ok := ctx.Value(UserIDKey).(uint)
	return userID, ok
}

// GetUsername retrieves the username from context.
func GetUsername(ctx context.Context) (string, bool) {
	username, ok := ctx.Value(UsernameKey).(string)
	return username, ok
}

// GetBetaAccess retrieves the beta access flag from context.
func GetBetaAccess(ctx context.Context) (bool, bool) {
	betaAccess, ok := ctx.Value(BetaAccessKey).(bool)
	return betaAccess, ok
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
