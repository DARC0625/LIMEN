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

// Auth creates an authentication middleware that validates JWT tokens.
func Auth(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip authentication for public endpoints
			if isPublicEndpoint(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}

			// Extract token from Authorization header
			authHeader := r.Header.Get("Authorization")
			tokenString, err := auth.ExtractTokenFromHeader(authHeader)
			if err != nil {
				errors.WriteUnauthorized(w, "Authentication required")
				return
			}

			// Validate token
			claims, err := auth.ValidateToken(tokenString, cfg.JWTSecret)
			if err != nil {
				if err == auth.ErrTokenExpired {
					errors.WriteUnauthorized(w, "Token expired")
				} else {
					errors.WriteUnauthorized(w, "Invalid token")
				}
				logger.Log.Warn("Authentication failed", zap.Error(err), zap.String("path", r.URL.Path))
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

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// isPublicEndpoint checks if the endpoint is public (doesn't require authentication).
func isPublicEndpoint(path string) bool {
	publicPaths := []string{
		"/api/health",
		"/api/auth/login",
		"/api/auth/register",
		"/ws/vnc", // WebSocket endpoints need special handling
	}

	for _, publicPath := range publicPaths {
		if path == publicPath || strings.HasPrefix(path, publicPath+"/") {
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

