package validator

import (
	"regexp"
	"strings"
)

// ValidateEmail validates an email address format.
func ValidateEmail(email string) bool {
	if email == "" {
		return false
	}

	// Basic email format validation
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(email) {
		return false
	}

	// Check length limits
	if len(email) > 254 { // RFC 5321 limit
		return false
	}

	// Check for dangerous patterns
	emailLower := strings.ToLower(email)
	dangerousPatterns := []string{"<script", "javascript:", "onerror=", "onload="}
	for _, pattern := range dangerousPatterns {
		if strings.Contains(emailLower, pattern) {
			return false
		}
	}

	return true
}




