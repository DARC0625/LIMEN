// Package middleware provides beta access control middleware.
package middleware

import (
	"net/http"

	"github.com/DARC0625/LIMEN/backend/internal/auth"
	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/errors"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"go.uber.org/zap"
)

// BetaAccess creates a middleware that requires beta access permission.
// This middleware checks if the user has BetaAccess flag set to true.
// Admin users always have beta access.
// Note: This middleware should be used after Auth middleware.
func BetaAccess(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get user ID from context (set by Auth middleware)
			userID, ok := GetUserID(r.Context())
			if !ok {
				errors.WriteUnauthorized(w, "Authentication required")
				return
			}

			// Get role from context
			role, ok := GetRole(r.Context())
			if !ok {
				// Try to get from token
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

			// Admin users always have beta access
			if role == string(models.RoleAdmin) {
				next.ServeHTTP(w, r)
				return
			}

			// Check beta access from token claims (faster, no DB query)
			authHeader := r.Header.Get("Authorization")
			if tokenString, err := auth.ExtractTokenFromHeader(authHeader); err == nil {
				if claims, err := auth.ValidateToken(tokenString, cfg.JWTSecret); err == nil {
					if claims.BetaAccess {
						next.ServeHTTP(w, r)
						return
					}
				}
			}

			// No beta access
			logger.Log.Warn("Beta access denied",
				zap.Uint("user_id", userID),
				zap.String("path", r.URL.Path),
				zap.String("method", r.Method))
			errors.WriteForbidden(w, "Beta access required. Please contact administrator.")
		})
	}
}

