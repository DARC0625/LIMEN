// Package router provides HTTP routing configuration.
package router

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/handlers"
	"github.com/DARC0625/LIMEN/backend/internal/middleware"
	"github.com/gorilla/mux"
	httpSwagger "github.com/swaggo/http-swagger"
)

// SetupRoutes configures all HTTP routes and returns a router.
func SetupRoutes(h *handlers.Handler, cfg *config.Config) *mux.Router {
	r := mux.NewRouter()

	// API routes
	api := r.PathPrefix("/api").Subrouter()

	// Public endpoints (no authentication required)
	api.HandleFunc("/health", h.HandleHealth).Methods("GET")
	api.HandleFunc("/health_proxy", h.HandleHealth).Methods("GET") // Health check proxy endpoint (for Next.js rewrites)
	api.HandleFunc("/metrics", h.HandleMetrics).Methods("GET")     // Prometheus metrics endpoint

	// Swagger documentation endpoints
	// http-swagger handles /swagger/doc.json automatically
	r.PathPrefix("/swagger/").Handler(httpSwagger.WrapHandler)
	r.HandleFunc("/swagger", h.HandleSwaggerUI).Methods("GET") // Swagger UI (outside /api prefix)
	r.HandleFunc("/docs", h.HandleSwaggerUI).Methods("GET")    // Alternative path for Swagger UI

	// Hardware specification endpoints (public for monitoring)
	api.HandleFunc("/hardware/spec", func(w http.ResponseWriter, r *http.Request) {
		h.HandleHardwareSpec(w, r, cfg)
	}).Methods("GET")
	api.HandleFunc("/hardware/security-config", func(w http.ResponseWriter, r *http.Request) {
		h.HandleHardwareSecurityConfig(w, r, cfg)
	}).Methods("GET")

	// Security chain endpoints (public for monitoring)
	api.HandleFunc("/security/chain", func(w http.ResponseWriter, r *http.Request) {
		h.HandleSecurityChain(w, r, cfg)
	}).Methods("GET")
	api.HandleFunc("/security/chain/report", func(w http.ResponseWriter, r *http.Request) {
		h.HandleSecurityChainReport(w, r, cfg)
	}).Methods("GET")
	api.HandleFunc("/security/weakest-link", func(w http.ResponseWriter, r *http.Request) {
		h.HandleWeakestLink(w, r, cfg)
	}).Methods("GET")

	// Log analysis endpoints (public for monitoring)
	api.HandleFunc("/logs/stats", func(w http.ResponseWriter, r *http.Request) {
		h.HandleLogStats(w, r, cfg)
	}).Methods("GET")
	api.HandleFunc("/logs/search", func(w http.ResponseWriter, r *http.Request) {
		h.HandleLogSearch(w, r, cfg)
	}).Methods("GET")
	api.HandleFunc("/auth/login", func(w http.ResponseWriter, r *http.Request) {
		h.HandleLogin(w, r, cfg)
	}).Methods("POST")
	api.HandleFunc("/auth/register", func(w http.ResponseWriter, r *http.Request) {
		h.HandleRegister(w, r, cfg)
	}).Methods("POST")

	// Admin-only endpoints for user management
	// IMPORTANT: Register these BEFORE other protected endpoints to ensure proper matching
	// These routes require authentication (via main.go Auth middleware) and admin role
	adminMiddleware := middleware.Admin(cfg)

	// IP whitelist for admin endpoints (if configured)
	adminIPWhitelist := middleware.IPWhitelist(cfg.AdminIPWhitelist)

	// User management endpoints - register directly on main router (not subrouter)
	// This ensures the route is matched correctly
	// Apply IP whitelist first, then admin middleware
	r.HandleFunc("/api/admin/users", func(w http.ResponseWriter, r *http.Request) {
		adminIPWhitelist(adminMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h.HandleListUsers(w, r, cfg)
		}))).ServeHTTP(w, r)
	}).Methods("GET")

	r.HandleFunc("/api/admin/users", func(w http.ResponseWriter, r *http.Request) {
		adminIPWhitelist(adminMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h.HandleCreateUser(w, r, cfg)
		}))).ServeHTTP(w, r)
	}).Methods("POST")

	r.HandleFunc("/api/admin/users/{id:[0-9]+}", func(w http.ResponseWriter, r *http.Request) {
		adminIPWhitelist(adminMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h.HandleGetUser(w, r, cfg)
		}))).ServeHTTP(w, r)
	}).Methods("GET")

	r.HandleFunc("/api/admin/users/{id:[0-9]+}", func(w http.ResponseWriter, r *http.Request) {
		adminIPWhitelist(adminMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h.HandleUpdateUser(w, r, cfg)
		}))).ServeHTTP(w, r)
	}).Methods("PUT")

	r.HandleFunc("/api/admin/users/{id:[0-9]+}", func(w http.ResponseWriter, r *http.Request) {
		adminIPWhitelist(adminMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h.HandleDeleteUser(w, r, cfg)
		}))).ServeHTTP(w, r)
	}).Methods("DELETE")

	r.HandleFunc("/api/admin/users/{id:[0-9]+}/role", func(w http.ResponseWriter, r *http.Request) {
		adminIPWhitelist(adminMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h.HandleUpdateUserRole(w, r, cfg)
		}))).ServeHTTP(w, r)
	}).Methods("PUT")

	r.HandleFunc("/api/admin/users/{id:[0-9]+}/approve", func(w http.ResponseWriter, r *http.Request) {
		adminIPWhitelist(adminMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h.HandleApproveUser(w, r, cfg)
		}))).ServeHTTP(w, r)
	}).Methods("PUT")

	// Protected endpoints (authentication required)
	api.HandleFunc("/vms", func(w http.ResponseWriter, r *http.Request) {
		h.HandleVMs(w, r, cfg)
	}).Methods("GET", "POST")
	api.HandleFunc("/vms/{id:[0-9]+}/action", h.HandleVMAction).Methods("POST")
	api.HandleFunc("/vms/{id:[0-9]+}/stats", h.HandleVMStats).Methods("GET")

	// Snapshot endpoints
	api.HandleFunc("/vms/{id:[0-9]+}/snapshots", h.HandleListSnapshots).Methods("GET")
	api.HandleFunc("/vms/{id:[0-9]+}/snapshots", h.HandleCreateSnapshot).Methods("POST")
	api.HandleFunc("/snapshots/{snapshot_id:[0-9]+}/restore", h.HandleRestoreSnapshot).Methods("POST")
	api.HandleFunc("/snapshots/{snapshot_id:[0-9]+}", h.HandleDeleteSnapshot).Methods("DELETE")

	// Quota endpoints (system-wide, shared by all users)
	api.HandleFunc("/quota", h.HandleGetQuota).Methods("GET")
	// Admin-only endpoint for updating quota
	api.HandleFunc("/quota", func(w http.ResponseWriter, r *http.Request) {
		// Apply admin middleware
		adminMiddleware := middleware.Admin(cfg)
		adminMiddleware(http.HandlerFunc(h.HandleUpdateQuota)).ServeHTTP(w, r)
	}).Methods("PUT")

	// WebSocket routes (must be before middleware to avoid ResponseWriter wrapping)
	// These routes need direct access to http.Hijacker for WebSocket upgrade
	r.HandleFunc("/ws/vnc", h.HandleVNC).Methods("GET")
	r.HandleFunc("/ws/vm-status", func(w http.ResponseWriter, r *http.Request) {
		h.HandleVMStatusWebSocket(w, r, cfg)
	}).Methods("GET")

	// Static file serving
	fs := http.FileServer(http.Dir("./uploads"))
	r.PathPrefix("/downloads/").Handler(http.StripPrefix("/downloads/", fs))

	// Agent reverse proxy (/agent/* -> http://127.0.0.1:9000)
	agentTarget, _ := url.Parse("http://127.0.0.1:9000")
	agentProxy := httputil.NewSingleHostReverseProxy(agentTarget)
	agentProxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		http.Error(w, "agent unavailable", http.StatusBadGateway)
	}
	r.PathPrefix("/agent/").Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Host = agentTarget.Host
		r.URL.Scheme = agentTarget.Scheme
		r.URL.Host = agentTarget.Host
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/agent")
		if r.URL.Path == "" {
			r.URL.Path = "/"
		}
		agentProxy.ServeHTTP(w, r)
	}))

	return r
}
