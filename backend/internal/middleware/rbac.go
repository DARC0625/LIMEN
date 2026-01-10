// Package middleware provides RBAC (Role-Based Access Control) guards.
package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/DARC0625/LIMEN/backend/internal/errors"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"gorm.io/gorm"
)

// RequireRole creates a middleware that requires a specific role.
func RequireRole(requiredRole string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := GetRole(r.Context())
			if !ok || role != requiredRole {
				errors.WriteForbidden(w, "Insufficient permissions")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireAdmin creates a middleware that requires admin role.
func RequireAdmin() func(http.Handler) http.Handler {
	return RequireRole(string(models.RoleAdmin))
}

// RequireBetaAccess creates a middleware that requires beta access.
func RequireBetaAccess() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := GetUserID(r.Context())
			if !ok {
				errors.WriteUnauthorized(w, "Authentication required")
				return
			}

			// Check beta access from context or database
			betaAccess, _ := GetBetaAccess(r.Context())
			if !betaAccess {
				// Fallback: check database
				db, ok := r.Context().Value("db").(*gorm.DB)
				if ok && db != nil {
					var user models.User
					if err := db.Select("beta_access", "role").Where("id = ?", userID).First(&user).Error; err == nil {
						if user.Role != models.RoleAdmin && !user.BetaAccess {
							errors.WriteForbidden(w, "Beta access required")
							return
						}
					}
				} else {
					errors.WriteForbidden(w, "Beta access required")
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireVMOwnership creates a middleware that requires VM ownership or admin role.
// VM UUID must be in the URL path parameter "uuid".
func RequireVMOwnership(db *gorm.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := GetUserID(r.Context())
			if !ok {
				errors.WriteUnauthorized(w, "Authentication required")
				return
			}

			role, _ := GetRole(r.Context())

			// Get VM UUID from URL path (chi router format: {uuid})
			// Try multiple methods to get UUID
			uuid := ""
			if r.URL.Path != "" {
				// Extract from path like /api/vms/{uuid}/...
				parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/vms/"), "/")
				if len(parts) > 0 && parts[0] != "" {
					uuid = parts[0]
				}
			}

			// Fallback to query parameter
			if uuid == "" {
				uuid = r.URL.Query().Get("uuid")
			}

			if uuid == "" {
				errors.WriteBadRequest(w, "VM UUID is required", nil)
				return
			}

			// Check VM ownership
			var vm models.VM
			if err := db.Select("owner_id").Where("uuid = ?", uuid).First(&vm).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					errors.WriteNotFound(w, "VM not found")
				} else {
					errors.WriteInternalError(w, err, false)
				}
				return
			}

			// Allow if user owns the VM or is admin
			if vm.OwnerID != userID && role != string(models.RoleAdmin) {
				errors.WriteForbidden(w, "You don't have permission to access this resource")
				return
			}

			// Store VM in context for downstream handlers
			ctx := context.WithValue(r.Context(), "vm", &vm)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetVMFromContext retrieves VM from request context (set by RequireVMOwnership).
func GetVMFromContext(ctx context.Context) (*models.VM, bool) {
	vm, ok := ctx.Value("vm").(*models.VM)
	return vm, ok
}
