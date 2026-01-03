// Package errors provides standardized error handling for the API.
package errors

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// ErrorCode represents a standardized error code for API errors.
type ErrorCode string

const (
	// VM 관련 에러
	ErrCodeVMNotFound      ErrorCode = "VM_NOT_FOUND"
	ErrCodeVMCreateFailed  ErrorCode = "VM_CREATE_FAILED"
	ErrCodeVMStartFailed   ErrorCode = "VM_START_FAILED"
	ErrCodeVMStopFailed    ErrorCode = "VM_STOP_FAILED"
	ErrCodeVMDeleteFailed  ErrorCode = "VM_DELETE_FAILED"
	ErrCodeVMUpdateFailed  ErrorCode = "VM_UPDATE_FAILED"
	ErrCodeVMQuotaExceeded ErrorCode = "VM_QUOTA_EXCEEDED"

	// ISO/이미지 관련 에러
	ErrCodeISONotFound  ErrorCode = "ISO_NOT_FOUND"
	ErrCodeImageInvalid ErrorCode = "IMAGE_INVALID"

	// 데이터베이스 관련 에러
	ErrCodeDBError        ErrorCode = "DATABASE_ERROR"
	ErrCodeDBConnection   ErrorCode = "DATABASE_CONNECTION_ERROR"
	ErrCodeDBQueryFailed  ErrorCode = "DATABASE_QUERY_FAILED"
	ErrCodeDBTransaction  ErrorCode = "DATABASE_TRANSACTION_ERROR"

	// Libvirt 관련 에러
	ErrCodeLibvirtError      ErrorCode = "LIBVIRT_ERROR"
	ErrCodeLibvirtConnection ErrorCode = "LIBVIRT_CONNECTION_ERROR"
	ErrCodeLibvirtOperation  ErrorCode = "LIBVIRT_OPERATION_ERROR"

	// 인증/인가 관련 에러
	ErrCodeUnauthorized     ErrorCode = "UNAUTHORIZED"
	ErrCodeForbidden        ErrorCode = "FORBIDDEN"
	ErrCodeInvalidToken     ErrorCode = "INVALID_TOKEN"
	ErrCodeTokenExpired     ErrorCode = "TOKEN_EXPIRED"
	ErrCodeInvalidCredentials ErrorCode = "INVALID_CREDENTIALS"

	// 입력 검증 관련 에러
	ErrCodeValidationFailed ErrorCode = "VALIDATION_FAILED"
	ErrCodeInvalidInput     ErrorCode = "INVALID_INPUT"
	ErrCodeMissingField     ErrorCode = "MISSING_FIELD"

	// 리소스 관련 에러
	ErrCodeQuotaExceeded    ErrorCode = "QUOTA_EXCEEDED"
	ErrCodeResourceNotFound ErrorCode = "RESOURCE_NOT_FOUND"
	ErrCodeResourceConflict  ErrorCode = "RESOURCE_CONFLICT"

	// 시스템 관련 에러
	ErrCodeInternalError    ErrorCode = "INTERNAL_ERROR"
	ErrCodeServiceUnavailable ErrorCode = "SERVICE_UNAVAILABLE"
	ErrCodeTimeout          ErrorCode = "TIMEOUT"

	// RAG 관련 에러
	ErrCodeRAGError         ErrorCode = "RAG_ERROR"
	ErrCodeDocumentNotFound ErrorCode = "DOCUMENT_NOT_FOUND"
	ErrCodeSearchFailed     ErrorCode = "SEARCH_FAILED"
)

// APIError represents a standardized API error response.
type APIError struct {
	Code    int       `json:"code"`
	Message string    `json:"message"`
	Error   string    `json:"error,omitempty"` // Internal error details (only in development)
	ErrorCode ErrorCode `json:"error_code,omitempty"` // Structured error code
	Context  map[string]interface{} `json:"context,omitempty"` // Additional context
}

// AppError represents an application error with structured information.
type AppError struct {
	Code    ErrorCode
	Message string
	Context map[string]interface{}
	Cause   error
	HTTPCode int
}

// Error implements the error interface.
func (e *AppError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// Unwrap returns the underlying error.
func (e *AppError) Unwrap() error {
	return e.Cause
}

// NewAppError creates a new AppError.
func NewAppError(code ErrorCode, message string, httpCode int) *AppError {
	return &AppError{
		Code:     code,
		Message:  message,
		HTTPCode: httpCode,
		Context:  make(map[string]interface{}),
	}
}

// WithCause adds a cause to the error.
func (e *AppError) WithCause(cause error) *AppError {
	e.Cause = cause
	return e
}

// WithContext adds context to the error.
func (e *AppError) WithContext(key string, value interface{}) *AppError {
	if e.Context == nil {
		e.Context = make(map[string]interface{})
	}
	e.Context[key] = value
	return e
}

// ToAPIError converts AppError to APIError for HTTP response.
func (e *AppError) ToAPIError(isDevelopment bool) APIError {
	apiErr := APIError{
		Code:     e.HTTPCode,
		Message:  e.Message,
		ErrorCode: e.Code,
		Context:  e.Context,
	}

	// 개발 모드에서만 내부 에러 상세 정보 포함
	if isDevelopment && e.Cause != nil {
		apiErr.Error = e.Cause.Error()
	}

	return apiErr
}

// WriteError writes a standardized error response to the HTTP response writer.
// In production, internal error details are NEVER exposed to the client (zero-trust principle).
func WriteError(w http.ResponseWriter, code int, message string, internalErr error) {
	WriteErrorWithCode(w, code, message, "", internalErr, false)
}

// WriteErrorWithCode writes a standardized error response with error code.
func WriteErrorWithCode(w http.ResponseWriter, code int, message string, errorCode ErrorCode, internalErr error, isDevelopment bool) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)

	apiErr := APIError{
		Code:    code,
		Message: message,
		ErrorCode: errorCode,
	}

	// 개발 모드에서만 내부 에러 상세 정보 포함
	if isDevelopment && internalErr != nil {
		apiErr.Error = internalErr.Error()
	}

	if err := json.NewEncoder(w).Encode(apiErr); err != nil {
		// Fallback if JSON encoding fails - use generic message
		http.Error(w, "An error occurred", code)
	}
}

// WriteAppError writes an AppError to the HTTP response.
func WriteAppError(w http.ResponseWriter, appErr *AppError, isDevelopment bool) {
	apiErr := appErr.ToAPIError(isDevelopment)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(appErr.HTTPCode)
	
	if err := json.NewEncoder(w).Encode(apiErr); err != nil {
		// Fallback if JSON encoding fails
		http.Error(w, "An error occurred", appErr.HTTPCode)
	}
}

// WriteInternalError writes a 500 Internal Server Error response.
// Zero-trust principle: Never expose internal error details to clients.
func WriteInternalError(w http.ResponseWriter, internalErr error, isDevelopment bool) {
	WriteErrorWithCode(w, http.StatusInternalServerError, "Internal server error", ErrCodeInternalError, internalErr, isDevelopment)
}

// WriteBadRequest writes a 400 Bad Request response.
func WriteBadRequest(w http.ResponseWriter, message string, err error) {
	if message == "" {
		message = "Bad request"
	}
	WriteErrorWithCode(w, http.StatusBadRequest, message, ErrCodeInvalidInput, err, false)
}

// WriteValidationError writes a 400 Bad Request response for validation errors.
func WriteValidationError(w http.ResponseWriter, message string, err error, isDevelopment bool) {
	if message == "" {
		message = "Validation failed"
	}
	WriteErrorWithCode(w, http.StatusBadRequest, message, ErrCodeValidationFailed, err, isDevelopment)
}

// WriteNotFound writes a 404 Not Found response.
func WriteNotFound(w http.ResponseWriter, resource string) {
	message := fmt.Sprintf("%s not found", resource)
	if resource == "" {
		message = "Resource not found"
	}
	WriteErrorWithCode(w, http.StatusNotFound, message, ErrCodeResourceNotFound, nil, false)
}

// WriteVMNotFound writes a 404 Not Found response for VM.
func WriteVMNotFound(w http.ResponseWriter, vmID string) {
	message := fmt.Sprintf("VM not found: %s", vmID)
	WriteErrorWithCode(w, http.StatusNotFound, message, ErrCodeVMNotFound, nil, false)
}

// WriteUnauthorized writes a 401 Unauthorized response.
func WriteUnauthorized(w http.ResponseWriter, message string) {
	if message == "" {
		message = "Unauthorized"
	}
	// Note: Logging is done in the middleware that calls this function
	WriteErrorWithCode(w, http.StatusUnauthorized, message, ErrCodeUnauthorized, nil, false)
}

// WriteForbidden writes a 403 Forbidden response.
func WriteForbidden(w http.ResponseWriter, message string) {
	if message == "" {
		message = "Forbidden"
	}
	WriteErrorWithCode(w, http.StatusForbidden, message, ErrCodeForbidden, nil, false)
}

// WriteQuotaExceeded writes a 403 Forbidden response for quota exceeded.
func WriteQuotaExceeded(w http.ResponseWriter, message string) {
	if message == "" {
		message = "Resource quota exceeded"
	}
	WriteErrorWithCode(w, http.StatusForbidden, message, ErrCodeQuotaExceeded, nil, false)
}

// WriteTooManyRequests writes a 429 Too Many Requests response.
func WriteTooManyRequests(w http.ResponseWriter, message string) {
	if message == "" {
		message = "Too many requests"
	}
	WriteErrorWithCode(w, http.StatusTooManyRequests, message, "RATE_LIMIT_EXCEEDED", nil, false)
}

// WriteServiceUnavailable writes a 503 Service Unavailable response.
func WriteServiceUnavailable(w http.ResponseWriter, message string, err error, isDevelopment bool) {
	if message == "" {
		message = "Service unavailable"
	}
	WriteErrorWithCode(w, http.StatusServiceUnavailable, message, ErrCodeServiceUnavailable, err, isDevelopment)
}
