// Package router provides HTTP routing configuration.
package router

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/handlers"
	limenMiddleware "github.com/DARC0625/LIMEN/backend/internal/middleware"
	"github.com/go-chi/chi/v5"
	httpSwagger "github.com/swaggo/http-swagger"
)

// SetupRoutes configures all HTTP routes and returns a router.
func SetupRoutes(h *handlers.Handler, cfg *config.Config) *chi.Mux {
	r := chi.NewRouter()

	// API routes
	api := chi.NewRouter()
	r.Mount("/api", api)

	// Public endpoints (no authentication required)
	api.Get("/health", h.HandleHealth)
	api.Get("/health_proxy", h.HandleHealth) // Health check proxy endpoint (for Next.js rewrites)
	api.Get("/metrics", h.HandleMetrics)     // Prometheus metrics endpoint
	api.Post("/public/waitlist", func(w http.ResponseWriter, r *http.Request) {
		h.HandleWaitlist(w, r, cfg)
	}) // Public waitlist registration (no auth required)

	// Swagger documentation endpoints
	// http-swagger handles /swagger/doc.json automatically
	r.Mount("/swagger/", httpSwagger.WrapHandler)
	r.Get("/swagger", h.HandleSwaggerUI) // Swagger UI (outside /api prefix)
	r.Get("/docs", h.HandleSwaggerUI)    // Alternative path for Swagger UI

	// Hardware specification endpoints (public for monitoring)
	api.Get("/hardware/spec", func(w http.ResponseWriter, r *http.Request) {
		h.HandleHardwareSpec(w, r, cfg)
	})
	api.Get("/hardware/security-config", func(w http.ResponseWriter, r *http.Request) {
		h.HandleHardwareSecurityConfig(w, r, cfg)
	})

	// Security chain endpoints (public for monitoring)
	api.Get("/security/chain", func(w http.ResponseWriter, r *http.Request) {
		h.HandleSecurityChain(w, r, cfg)
	})
	api.Get("/security/chain/report", func(w http.ResponseWriter, r *http.Request) {
		h.HandleSecurityChainReport(w, r, cfg)
	})
	api.Get("/security/weakest-link", func(w http.ResponseWriter, r *http.Request) {
		h.HandleWeakestLink(w, r, cfg)
	})

	// Log analysis endpoints (public for monitoring)
	api.Get("/logs/stats", func(w http.ResponseWriter, r *http.Request) {
		h.HandleLogStats(w, r, cfg)
	})
	api.Get("/logs/search", func(w http.ResponseWriter, r *http.Request) {
		h.HandleLogSearch(w, r, cfg)
	})

	// RAG endpoints (public for documentation access)
	api.Get("/rag/search", h.HandleRAGSearch)
	api.Get("/rag/documents", h.HandleRAGListDocuments)
	api.Get("/rag/categories", h.HandleRAGCategories)
	api.Get("/rag/document", h.HandleRAGGetDocument) // Path is passed as query parameter
	api.Post("/auth/login", func(w http.ResponseWriter, r *http.Request) {
		h.HandleLogin(w, r, cfg)
	})
	api.Post("/auth/register", func(w http.ResponseWriter, r *http.Request) {
		h.HandleRegister(w, r, cfg)
	})

	// Session management endpoints (public - no authentication required)
	api.Get("/auth/session", func(w http.ResponseWriter, r *http.Request) {
		h.HandleGetSession(w, r, cfg)
	})
	api.Post("/auth/session", func(w http.ResponseWriter, r *http.Request) {
		h.HandleCreateSession(w, r, cfg)
	})
	api.Delete("/auth/session", func(w http.ResponseWriter, r *http.Request) {
		h.HandleDeleteSession(w, r, cfg)
	})

	// Token refresh endpoint (public - no authentication required)
	api.Post("/auth/refresh", func(w http.ResponseWriter, r *http.Request) {
		h.HandleRefreshToken(w, r, cfg)
	})

	// Admin-only endpoints for user management
	// IMPORTANT: Register these BEFORE other protected endpoints to ensure proper matching
	// These routes require authentication (via main.go Auth middleware) and admin role
	adminMiddleware := limenMiddleware.Admin(cfg)

	// IP whitelist for admin endpoints (if configured)
	adminIPWhitelist := limenMiddleware.IPWhitelist(cfg.AdminIPWhitelist)

	// User management endpoints - register directly on main router (not subrouter)
	// This ensures the route is matched correctly
	// Apply IP whitelist first, then admin middleware
	r.With(adminIPWhitelist, adminMiddleware).Get("/api/admin/users", func(w http.ResponseWriter, r *http.Request) {
		h.HandleListUsers(w, r, cfg)
	})

	r.With(adminIPWhitelist, adminMiddleware).Post("/api/admin/users", func(w http.ResponseWriter, r *http.Request) {
		h.HandleCreateUser(w, r, cfg)
	})

	r.With(adminIPWhitelist, adminMiddleware).Get("/api/admin/users/{id}", func(w http.ResponseWriter, r *http.Request) {
		h.HandleGetUser(w, r, cfg)
	})

	r.With(adminIPWhitelist, adminMiddleware).Put("/api/admin/users/{id}", func(w http.ResponseWriter, r *http.Request) {
		h.HandleUpdateUser(w, r, cfg)
	})

	r.With(adminIPWhitelist, adminMiddleware).Delete("/api/admin/users/{id}", func(w http.ResponseWriter, r *http.Request) {
		h.HandleDeleteUser(w, r, cfg)
	})

	r.With(adminIPWhitelist, adminMiddleware).Put("/api/admin/users/{id}/role", func(w http.ResponseWriter, r *http.Request) {
		h.HandleUpdateUserRole(w, r, cfg)
	})

	r.With(adminIPWhitelist, adminMiddleware).Put("/api/admin/users/{id}/approve", func(w http.ResponseWriter, r *http.Request) {
		h.HandleApproveUser(w, r, cfg)
	})

	r.With(adminIPWhitelist, adminMiddleware).Put("/api/admin/users/{id}/beta-access", func(w http.ResponseWriter, r *http.Request) {
		h.HandleBetaAccess(w, r, cfg)
	})

	// Protected endpoints (authentication required)
	// Use UUID pattern: 8-4-4-4-12 hexadecimal characters
	api.Get("/vms", func(w http.ResponseWriter, r *http.Request) {
		h.HandleVMs(w, r, cfg)
	})
	api.Post("/vms", func(w http.ResponseWriter, r *http.Request) {
		h.HandleVMs(w, r, cfg)
	})
	api.Delete("/vms/{uuid}", h.HandleVMDelete)
	api.Post("/vms/{uuid}/action", h.HandleVMAction)
	api.Get("/vms/{uuid}/stats", h.HandleVMStats)
	api.Get("/vms/{uuid}/console", h.HandleVMConsole)
	api.Get("/vms/{uuid}/media", h.HandleVMMedia)
	api.Post("/vms/{uuid}/media", h.HandleVMMedia)
	api.Get("/vms/{uuid}/boot-order", h.HandleGetVMBootOrder)
	api.Post("/vms/{uuid}/boot-order", h.HandleVMBootOrder)
	api.Post("/vms/{uuid}/finalize-install", h.HandleFinalizeInstall)
	api.Get("/vms/isos", func(w http.ResponseWriter, r *http.Request) {
		h.HandleListISOs(w, r, cfg)
	})

	// Snapshot endpoints
	api.Get("/vms/{uuid}/snapshots", h.HandleListSnapshots)
	api.Post("/vms/{uuid}/snapshots", h.HandleCreateSnapshot)
	api.Post("/snapshots/{snapshot_id}/restore", h.HandleRestoreSnapshot)
	api.Delete("/snapshots/{snapshot_id}", h.HandleDeleteSnapshot)

	// Quota endpoints (system-wide, shared by all users)
	api.Get("/quota", h.HandleGetQuota)
	// Admin-only endpoint for updating quota
	api.With(adminMiddleware).Put("/quota", h.HandleUpdateQuota)

	// WebSocket routes (must be before middleware to avoid ResponseWriter wrapping)
	// These routes need direct access to http.Hijacker for WebSocket upgrade
	// IMPORTANT: More specific routes must be registered first
	r.Get("/vnc/{uuid}", h.HandleVNC) // VNC WebSocket with UUID in path (most specific - register first)
	r.Get("/ws/vnc", h.HandleVNC)
	r.Get("/vnc", h.HandleVNC) // Alternative path for VNC WebSocket (for Envoy compatibility)
	r.Get("/ws/vm-status", func(w http.ResponseWriter, r *http.Request) {
		h.HandleVMStatusWebSocket(w, r, cfg)
	})

	// Static file serving (must be before middleware to avoid authentication)
	fs := http.FileServer(http.Dir("./uploads"))
	r.Mount("/downloads/", http.StripPrefix("/downloads/", fs))

	// Handle /media requests
	// If it's a static file request (e.g., images, icons), serve from uploads/media directory
	// If the file doesn't exist, return 404 (frontend should handle this gracefully)
	mediaFS := http.FileServer(http.Dir("./uploads/media"))
	r.Mount("/media/", http.StripPrefix("/media/", mediaFS))

	// Agent reverse proxy (/agent/* -> http://127.0.0.1:9000)
	agentTarget, err := url.Parse("http://127.0.0.1:9000")
	if err != nil {
		// If URL parsing fails, log error but continue (agent proxy will return errors)
		panic("Failed to parse agent target URL: " + err.Error())
	}
	agentProxy := httputil.NewSingleHostReverseProxy(agentTarget)
	agentProxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		// Return 503 Service Unavailable when agent is not reachable
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(`{"error":"agent unavailable","message":"Agent service is not reachable"}`))
	}
	r.Mount("/agent/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Update request for proxy
		r.Host = agentTarget.Host
		r.URL.Scheme = agentTarget.Scheme
		r.URL.Host = agentTarget.Host
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/agent")
		if r.URL.Path == "" {
			r.URL.Path = "/"
		}

		// Forward the request to agent
		agentProxy.ServeHTTP(w, r)
	}))

	return r
}
