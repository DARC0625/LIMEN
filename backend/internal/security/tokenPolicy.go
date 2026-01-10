// Package security provides token policy and security configuration.
package security

import "time"

// ConsoleTokenPolicy defines the policy for console (VNC) access tokens.
type ConsoleTokenPolicy struct {
	// TTL is the time-to-live for console tokens (default: 5 minutes)
	TTL time.Duration

	// Issuer is the JWT issuer claim (default: "limen")
	Issuer string

	// Audience is the JWT audience claim (optional)
	Audience string

	// RequireUUIDBinding requires token to be bound to specific VM UUID
	RequireUUIDBinding bool
}

// DefaultConsoleTokenPolicy returns the default console token policy.
func DefaultConsoleTokenPolicy() ConsoleTokenPolicy {
	return ConsoleTokenPolicy{
		TTL:                5 * time.Minute,
		Issuer:             "limen",
		Audience:           "limen-console",
		RequireUUIDBinding: true,
	}
}

// TokenErrorCode represents different token validation error types.
type TokenErrorCode string

const (
	TokenErrorMissing      TokenErrorCode = "MISSING_TOKEN"
	TokenErrorInvalid      TokenErrorCode = "INVALID_TOKEN"
	TokenErrorExpired      TokenErrorCode = "TOKEN_EXPIRED"
	TokenErrorUUIDMismatch TokenErrorCode = "UUID_MISMATCH"
	TokenErrorNotApproved  TokenErrorCode = "NOT_APPROVED"
)

// TokenError represents a token validation error with a standardized code.
type TokenError struct {
	Code    TokenErrorCode
	Message string
}

func (e *TokenError) Error() string {
	return e.Message
}

// NewTokenError creates a new TokenError.
func NewTokenError(code TokenErrorCode, message string) *TokenError {
	return &TokenError{
		Code:    code,
		Message: message,
	}
}
