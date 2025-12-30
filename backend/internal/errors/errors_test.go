package errors

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteError(t *testing.T) {
	tests := []struct {
		name       string
		code       int
		message    string
		internalErr error
		wantCode   int
		wantMessage string
	}{
		{
			name:       "400 Bad Request",
			code:       http.StatusBadRequest,
			message:    "Invalid input",
			internalErr: nil,
			wantCode:   http.StatusBadRequest,
			wantMessage: "Invalid input",
		},
		{
			name:       "401 Unauthorized",
			code:       http.StatusUnauthorized,
			message:    "Authentication required",
			internalErr: nil,
			wantCode:   http.StatusUnauthorized,
			wantMessage: "Authentication required",
		},
		{
			name:       "404 Not Found",
			code:       http.StatusNotFound,
			message:    "Resource not found",
			internalErr: nil,
			wantCode:   http.StatusNotFound,
			wantMessage: "Resource not found",
		},
		{
			name:       "500 Internal Server Error",
			code:       http.StatusInternalServerError,
			message:    "Internal server error",
			internalErr: nil,
			wantCode:   http.StatusInternalServerError,
			wantMessage: "Internal server error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			WriteError(w, tt.code, tt.message, tt.internalErr)

			if w.Code != tt.wantCode {
				t.Errorf("WriteError() code = %v, want %v", w.Code, tt.wantCode)
			}

			var apiErr APIError
			if err := json.NewDecoder(w.Body).Decode(&apiErr); err != nil {
				t.Fatalf("Failed to decode response: %v", err)
			}

			if apiErr.Code != tt.wantCode {
				t.Errorf("APIError.Code = %v, want %v", apiErr.Code, tt.wantCode)
			}

			if apiErr.Message != tt.wantMessage {
				t.Errorf("APIError.Message = %v, want %v", apiErr.Message, tt.wantMessage)
			}

			// Internal error should never be exposed (zero-trust)
			if apiErr.Error != "" {
				t.Errorf("APIError.Error should be empty (zero-trust), got %v", apiErr.Error)
			}

			if w.Header().Get("Content-Type") != "application/json" {
				t.Errorf("Content-Type = %v, want application/json", w.Header().Get("Content-Type"))
			}
		})
	}
}

func TestWriteInternalError(t *testing.T) {
	tests := []struct {
		name          string
		internalErr   error
		isDevelopment bool
		wantCode      int
		wantMessage   string
	}{
		{
			name:          "Production mode",
			internalErr:   nil,
			isDevelopment: false,
			wantCode:      http.StatusInternalServerError,
			wantMessage:   "Internal server error",
		},
		{
			name:          "Development mode",
			internalErr:   nil,
			isDevelopment: true,
			wantCode:      http.StatusInternalServerError,
			wantMessage:   "Internal server error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			WriteInternalError(w, tt.internalErr, tt.isDevelopment)

			if w.Code != tt.wantCode {
				t.Errorf("WriteInternalError() code = %v, want %v", w.Code, tt.wantCode)
			}

			var apiErr APIError
			if err := json.NewDecoder(w.Body).Decode(&apiErr); err != nil {
				t.Fatalf("Failed to decode response: %v", err)
			}

			if apiErr.Message != tt.wantMessage {
				t.Errorf("APIError.Message = %v, want %v", apiErr.Message, tt.wantMessage)
			}

			// Internal error should never be exposed (zero-trust)
			if apiErr.Error != "" {
				t.Errorf("APIError.Error should be empty (zero-trust), got %v", apiErr.Error)
			}
		})
	}
}

func TestWriteBadRequest(t *testing.T) {
	tests := []struct {
		name        string
		message     string
		err         error
		wantCode    int
		wantMessage string
	}{
		{
			name:        "With message",
			message:     "Invalid input",
			err:         nil,
			wantCode:    http.StatusBadRequest,
			wantMessage: "Invalid input",
		},
		{
			name:        "Empty message",
			message:     "",
			err:         nil,
			wantCode:    http.StatusBadRequest,
			wantMessage: "Bad request",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			WriteBadRequest(w, tt.message, tt.err)

			if w.Code != tt.wantCode {
				t.Errorf("WriteBadRequest() code = %v, want %v", w.Code, tt.wantCode)
			}

			var apiErr APIError
			if err := json.NewDecoder(w.Body).Decode(&apiErr); err != nil {
				t.Fatalf("Failed to decode response: %v", err)
			}

			if apiErr.Message != tt.wantMessage {
				t.Errorf("APIError.Message = %v, want %v", apiErr.Message, tt.wantMessage)
			}
		})
	}
}

func TestWriteNotFound(t *testing.T) {
	tests := []struct {
		name        string
		resource    string
		wantCode    int
		wantMessage string
	}{
		{
			name:        "With resource",
			resource:    "User",
			wantCode:    http.StatusNotFound,
			wantMessage: "User not found",
		},
		{
			name:        "Empty resource",
			resource:    "",
			wantCode:    http.StatusNotFound,
			wantMessage: "Resource not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			WriteNotFound(w, tt.resource)

			if w.Code != tt.wantCode {
				t.Errorf("WriteNotFound() code = %v, want %v", w.Code, tt.wantCode)
			}

			var apiErr APIError
			if err := json.NewDecoder(w.Body).Decode(&apiErr); err != nil {
				t.Fatalf("Failed to decode response: %v", err)
			}

			if apiErr.Message != tt.wantMessage {
				t.Errorf("APIError.Message = %v, want %v", apiErr.Message, tt.wantMessage)
			}
		})
	}
}

func TestWriteUnauthorized(t *testing.T) {
	tests := []struct {
		name        string
		message     string
		wantCode    int
		wantMessage string
	}{
		{
			name:        "With message",
			message:     "Authentication required",
			wantCode:    http.StatusUnauthorized,
			wantMessage: "Authentication required",
		},
		{
			name:        "Empty message",
			message:     "",
			wantCode:    http.StatusUnauthorized,
			wantMessage: "Unauthorized",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			WriteUnauthorized(w, tt.message)

			if w.Code != tt.wantCode {
				t.Errorf("WriteUnauthorized() code = %v, want %v", w.Code, tt.wantCode)
			}

			var apiErr APIError
			if err := json.NewDecoder(w.Body).Decode(&apiErr); err != nil {
				t.Fatalf("Failed to decode response: %v", err)
			}

			if apiErr.Message != tt.wantMessage {
				t.Errorf("APIError.Message = %v, want %v", apiErr.Message, tt.wantMessage)
			}
		})
	}
}

func TestWriteForbidden(t *testing.T) {
	tests := []struct {
		name        string
		message     string
		wantCode    int
		wantMessage string
	}{
		{
			name:        "With message",
			message:     "Access denied",
			wantCode:    http.StatusForbidden,
			wantMessage: "Access denied",
		},
		{
			name:        "Empty message",
			message:     "",
			wantCode:    http.StatusForbidden,
			wantMessage: "Forbidden",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			WriteForbidden(w, tt.message)

			if w.Code != tt.wantCode {
				t.Errorf("WriteForbidden() code = %v, want %v", w.Code, tt.wantCode)
			}

			var apiErr APIError
			if err := json.NewDecoder(w.Body).Decode(&apiErr); err != nil {
				t.Fatalf("Failed to decode response: %v", err)
			}

			if apiErr.Message != tt.wantMessage {
				t.Errorf("APIError.Message = %v, want %v", apiErr.Message, tt.wantMessage)
			}
		})
	}
}

func TestAPIError(t *testing.T) {
	err := APIError{
		Code:    http.StatusBadRequest,
		Message: "Test error",
		Error:   "",
	}

	if err.Code != http.StatusBadRequest {
		t.Errorf("APIError.Code = %v, want %v", err.Code, http.StatusBadRequest)
	}

	if err.Message != "Test error" {
		t.Errorf("APIError.Message = %v, want Test error", err.Message)
	}
}

