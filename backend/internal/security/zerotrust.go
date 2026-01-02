// Package security provides zero-trust security utilities.
package security

import (
	"crypto/rand"
	"encoding/base64"
	"html"
	"net/http"
	"regexp"
	"strings"
	"unicode"
)

// SanitizeString removes potentially dangerous characters from user input.
// This helps prevent XSS and injection attacks.
func SanitizeString(input string) string {
	// Remove null bytes
	input = strings.ReplaceAll(input, "\x00", "")

	// HTML escape to prevent XSS
	input = html.EscapeString(input)

	// Trim whitespace
	input = strings.TrimSpace(input)

	return input
}

// SanitizeForLog removes sensitive information from strings before logging.
func SanitizeForLog(input string) string {
	// Remove common sensitive patterns
	patterns := []string{
		`(?i)password\s*[:=]\s*[^\s]+`,
		`(?i)token\s*[:=]\s*[^\s]+`,
		`(?i)secret\s*[:=]\s*[^\s]+`,
		`(?i)key\s*[:=]\s*[^\s]+`,
		`(?i)authorization\s*[:=]\s*[^\s]+`,
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		input = re.ReplaceAllString(input, "[REDACTED]")
	}

	return input
}

// ValidateInput performs basic input validation to prevent injection attacks.
func ValidateInput(input string, maxLength int) error {
	if len(input) > maxLength {
		return ErrInputTooLong
	}

	// Check for null bytes
	if strings.Contains(input, "\x00") {
		return ErrInvalidInput
	}

	// Check for control characters (except newline and tab)
	for _, r := range input {
		if unicode.IsControl(r) && r != '\n' && r != '\t' {
			return ErrInvalidInput
		}
	}

	return nil
}

// GenerateCSRFToken generates a secure CSRF token.
func GenerateCSRFToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// ValidateCSRFToken validates a CSRF token.
func ValidateCSRFToken(token, expectedToken string) bool {
	if token == "" || expectedToken == "" {
		return false
	}
	return token == expectedToken
}

// GetCSRFTokenFromRequest extracts CSRF token from request header or form.
func GetCSRFTokenFromRequest(r *http.Request) string {
	// Check header first
	if token := r.Header.Get("X-CSRF-Token"); token != "" {
		return token
	}

	// Check form value
	if token := r.FormValue("csrf_token"); token != "" {
		return token
	}

	return ""
}

// IsSafePath validates that a file path is safe (prevents directory traversal).
func IsSafePath(path string) bool {
	// Reject paths with ".."
	if strings.Contains(path, "..") {
		return false
	}

	// Reject absolute paths (in most cases)
	if strings.HasPrefix(path, "/") && !strings.HasPrefix(path, "/safe/") {
		return false
	}

	// Reject null bytes
	if strings.Contains(path, "\x00") {
		return false
	}

	return true
}

// RedactSensitiveFields removes sensitive fields from a map before logging.
func RedactSensitiveFields(data map[string]interface{}) map[string]interface{} {
	sensitiveKeys := []string{
		"password", "Password", "PASSWORD",
		"token", "Token", "TOKEN",
		"secret", "Secret", "SECRET",
		"key", "Key", "KEY",
		"authorization", "Authorization", "AUTHORIZATION",
		"api_key", "apiKey", "API_KEY",
		"access_token", "accessToken", "ACCESS_TOKEN",
	}

	result := make(map[string]interface{})
	for k, v := range data {
		isSensitive := false
		for _, sensitiveKey := range sensitiveKeys {
			if strings.Contains(strings.ToLower(k), strings.ToLower(sensitiveKey)) {
				isSensitive = true
				break
			}
		}

		if isSensitive {
			result[k] = "[REDACTED]"
		} else {
			result[k] = v
		}
	}

	return result
}

// Errors
var (
	ErrInputTooLong     = &SecurityError{Message: "Input exceeds maximum length"}
	ErrInvalidInput     = &SecurityError{Message: "Invalid input detected"}
	ErrCSRFTokenMissing = &SecurityError{Message: "CSRF token missing"}
	ErrCSRFTokenInvalid = &SecurityError{Message: "CSRF token invalid"}
	ErrUnsafePath       = &SecurityError{Message: "Unsafe path detected"}
)

type SecurityError struct {
	Message string
}

func (e *SecurityError) Error() string {
	return e.Message
}








