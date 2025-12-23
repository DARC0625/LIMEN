package middleware

import (
	"context"
	"net/http"

	"github.com/DARC0625/LIMEN/backend/internal/auth"
	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/errors"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"go.uber.org/zap"
)

const RoleKey contextKey = "role"

// Admin creates a middleware that requires admin role.
// Note: This middleware assumes Auth middleware has already validated the token
// and added user info to context. It only checks if the user has admin role.
func Admin(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get role from context (set by Auth middleware)
			role, ok := GetRole(r.Context())
			if !ok {
				// If role is not in context, try to get it from token as fallback
				authHeader := r.Header.Get("Authorization")
				tokenString, err := auth.ExtractTokenFromHeader(authHeader)
				if err != nil {
					errors.WriteUnauthorized(w, "Authentication required")
					return
				}

				claims, err := auth.ValidateToken(tokenString, cfg.JWTSecret)
				if err != nil {
					errors.WriteUnauthorized(w, "Invalid token")
					return
				}
				role = claims.Role
			}

			// Check if user is admin
			if role != string(models.RoleAdmin) {
				logger.Log.Warn("Admin access denied",
					zap.String("role", role))
				errors.WriteForbidden(w, "Admin access required")
				return
			}

			// User is admin, proceed
			next.ServeHTTP(w, r)
		})
	}
}

// GetRole retrieves the user role from context.
func GetRole(ctx context.Context) (string, bool) {
	role, ok := ctx.Value(RoleKey).(string)
	return role, ok
}

// IsAdmin checks if the user in context is an admin.
func IsAdmin(ctx context.Context) bool {
	role, ok := GetRole(ctx)
	if !ok {
		return false
	}
	return role == string(models.RoleAdmin)
}
