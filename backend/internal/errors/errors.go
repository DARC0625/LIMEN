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
// In production, internal error details are not exposed to the client.
func WriteError(w http.ResponseWriter, code int, message string, internalErr error) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)

	apiErr := APIError{
		Code:    code,
		Message: message,
	}

	// Only include internal error details in development
	if internalErr != nil {
		apiErr.Error = internalErr.Error()
	}

	if err := json.NewEncoder(w).Encode(apiErr); err != nil {
		// Fallback if JSON encoding fails
		http.Error(w, message, code)
	}
}

// WriteInternalError writes a 500 Internal Server Error response.
func WriteInternalError(w http.ResponseWriter, internalErr error, isDevelopment bool) {
	message := "Internal server error"
	if isDevelopment && internalErr != nil {
		message = fmt.Sprintf("Internal server error: %v", internalErr)
	}
	WriteError(w, http.StatusInternalServerError, message, internalErr)
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
	WriteError(w, http.StatusUnauthorized, message, nil)
}

// WriteForbidden writes a 403 Forbidden response.
func WriteForbidden(w http.ResponseWriter, message string) {
	if message == "" {
		message = "Forbidden"
	}
	WriteError(w, http.StatusForbidden, message, nil)
}


