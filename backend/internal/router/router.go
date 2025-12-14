// Package router provides HTTP routing configuration.
package router

import (
	"net/http"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/handlers"
	"github.com/DARC0625/LIMEN/backend/internal/middleware"
	"github.com/gorilla/mux"
)

// SetupRoutes configures all HTTP routes and returns a router.
func SetupRoutes(h *handlers.Handler, cfg *config.Config) *mux.Router {
	r := mux.NewRouter()

	// API routes
	api := r.PathPrefix("/api").Subrouter()

	// Public endpoints (no authentication required)
	api.HandleFunc("/health", h.HandleHealth).Methods("GET")
	api.HandleFunc("/metrics", h.HandleMetrics).Methods("GET") // Prometheus metrics endpoint
	api.HandleFunc("/swagger.json", h.HandleSwaggerJSON).Methods("GET")
	api.HandleFunc("/swagger.yaml", h.HandleSwaggerJSON).Methods("GET")
	r.HandleFunc("/swagger", h.HandleSwaggerUI).Methods("GET") // Swagger UI (outside /api prefix)
	r.HandleFunc("/docs", h.HandleSwaggerUI).Methods("GET")    // Alternative path for Swagger UI
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

	// User management endpoints - register directly on main router (not subrouter)
	// This ensures the route is matched correctly
	r.HandleFunc("/api/admin/users", func(w http.ResponseWriter, r *http.Request) {
		adminMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h.HandleListUsers(w, r, cfg)
		})).ServeHTTP(w, r)
	}).Methods("GET")

	r.HandleFunc("/api/admin/users", func(w http.ResponseWriter, r *http.Request) {
		adminMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h.HandleCreateUser(w, r, cfg)
		})).ServeHTTP(w, r)
	}).Methods("POST")

	r.HandleFunc("/api/admin/users/{id:[0-9]+}", func(w http.ResponseWriter, r *http.Request) {
		adminMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h.HandleGetUser(w, r, cfg)
		})).ServeHTTP(w, r)
	}).Methods("GET")

	r.HandleFunc("/api/admin/users/{id:[0-9]+}", func(w http.ResponseWriter, r *http.Request) {
		adminMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h.HandleUpdateUser(w, r, cfg)
		})).ServeHTTP(w, r)
	}).Methods("PUT")

	r.HandleFunc("/api/admin/users/{id:[0-9]+}", func(w http.ResponseWriter, r *http.Request) {
		adminMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h.HandleDeleteUser(w, r, cfg)
		})).ServeHTTP(w, r)
	}).Methods("DELETE")

	r.HandleFunc("/api/admin/users/{id:[0-9]+}/role", func(w http.ResponseWriter, r *http.Request) {
		adminMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h.HandleUpdateUserRole(w, r, cfg)
		})).ServeHTTP(w, r)
	}).Methods("PUT")

	r.HandleFunc("/api/admin/users/{id:[0-9]+}/approve", func(w http.ResponseWriter, r *http.Request) {
		adminMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h.HandleApproveUser(w, r, cfg)
		})).ServeHTTP(w, r)
	}).Methods("PUT")

	// Protected endpoints (authentication required)
	api.HandleFunc("/vms", h.HandleVMs).Methods("GET", "POST")
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

	return r
}
