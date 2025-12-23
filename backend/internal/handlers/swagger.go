package handlers

import (
	"net/http"

	httpSwagger "github.com/swaggo/http-swagger"
)

// @title           LIMEN API
// @version         1.0
// @description     LIMEN (Linux Infrastructure Management Engine) - VM Management API
// @description     Comprehensive API for managing virtual machines, users, and system resources.
// @description
// @description     ## Security
// @description     - Authentication: JWT Bearer Token
// @description     - Authorization: Role-based access control (Admin/User)
// @description     - Encryption: Argon2id, ChaCha20-Poly1305, Ed25519
// @description
// @description     ## Features
// @description     - VM lifecycle management (create, start, stop, delete)
// @description     - User management and authentication
// @description     - Resource quota management
// @description     - Real-time VM status via WebSocket
// @description     - Hardware specification detection
// @description     - Security chain monitoring

// @contact.name   LIMEN Support
// @contact.url    https://github.com/DARC0625/LIMEN
// @contact.email  support@limen.local

// @license.name  MIT
// @license.url   https://opensource.org/licenses/MIT

// @host      localhost:18443
// @BasePath  /api

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token. Example: "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."

// HandleSwaggerUI serves the Swagger UI
func (h *Handler) HandleSwaggerUI(w http.ResponseWriter, r *http.Request) {
	// Use http-swagger for automatic Swagger UI serving
	handler := httpSwagger.Handler(
		httpSwagger.URL("/api/swagger/doc.json"), // Swagger JSON endpoint
		httpSwagger.DeepLinking(true),
		httpSwagger.DocExpansion("list"),
		httpSwagger.DomID("swagger-ui"),
	)
	handler.ServeHTTP(w, r)
}
