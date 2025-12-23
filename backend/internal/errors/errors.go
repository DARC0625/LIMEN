// Package errors provides standardized error handling for the API.
package errors

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// APIError represents a standardized API error response.
type APIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"` // Internal error details (only in development)
}

// WriteError writes a standardized error response to the HTTP response writer.
// In production, internal error details are NEVER exposed to the client (zero-trust principle).
func WriteError(w http.ResponseWriter, code int, message string, internalErr error) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)

	apiErr := APIError{
		Code:    code,
		Message: message,
	}

	// NEVER include internal error details in production (zero-trust: minimize information exposure)
	// Only include in development mode for debugging
	if internalErr != nil {
		// Check if we're in development mode via environment variable or config
		// For now, we'll be conservative and never expose internal errors
		// apiErr.Error = internalErr.Error() // Commented out for zero-trust
	}

	if err := json.NewEncoder(w).Encode(apiErr); err != nil {
		// Fallback if JSON encoding fails - use generic message
		http.Error(w, "An error occurred", code)
	}
}

// WriteInternalError writes a 500 Internal Server Error response.
// Zero-trust principle: Never expose internal error details to clients.
func WriteInternalError(w http.ResponseWriter, internalErr error, isDevelopment bool) {
	// Always use generic message - never expose internal error details (zero-trust)
	message := "Internal server error"
	// Even in development, we don't expose error details to prevent information leakage
	// Log the error internally instead
	WriteError(w, http.StatusInternalServerError, message, nil)
}

// WriteBadRequest writes a 400 Bad Request response.
func WriteBadRequest(w http.ResponseWriter, message string, err error) {
	if message == "" {
		message = "Bad request"
	}
	WriteError(w, http.StatusBadRequest, message, err)
}

// WriteNotFound writes a 404 Not Found response.
func WriteNotFound(w http.ResponseWriter, resource string) {
	message := fmt.Sprintf("%s not found", resource)
	if resource == "" {
		message = "Resource not found"
	}
	WriteError(w, http.StatusNotFound, message, nil)
}

// WriteUnauthorized writes a 401 Unauthorized response.
func WriteUnauthorized(w http.ResponseWriter, message string) {
	if message == "" {
		message = "Unauthorized"
	}
	// Note: Logging is done in the middleware that calls this function
	WriteError(w, http.StatusUnauthorized, message, nil)
}

// WriteForbidden writes a 403 Forbidden response.
func WriteForbidden(w http.ResponseWriter, message string) {
	if message == "" {
		message = "Forbidden"
	}
	WriteError(w, http.StatusForbidden, message, nil)
}
