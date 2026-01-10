// Package logger provides PII (Personally Identifiable Information) masking utilities.
package logger

import (
	"regexp"
	"strings"
)

var (
	// Email regex pattern
	emailRegex = regexp.MustCompile(`([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})`)
	
	// JWT token pattern (3 parts separated by dots)
	jwtRegex = regexp.MustCompile(`eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`)
	
	// Authorization header pattern
	authHeaderRegex = regexp.MustCompile(`(?i)(bearer|basic|token)\s+([^\s]+)`)
)

// MaskEmail masks email addresses in strings.
// Example: "user@example.com" -> "u***@example.com"
func MaskEmail(s string) string {
	return emailRegex.ReplaceAllStringFunc(s, func(match string) string {
		parts := strings.Split(match, "@")
		if len(parts) != 2 {
			return match
		}
		local := parts[0]
		domain := parts[1]
		if len(local) > 1 {
			local = string(local[0]) + "***"
		} else {
			local = "***"
		}
		return local + "@" + domain
	})
}

// MaskToken masks JWT tokens and other tokens in strings.
// Example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." -> "eyJ***[MASKED]"
func MaskToken(s string) string {
	// Mask JWT tokens
	result := jwtRegex.ReplaceAllStringFunc(s, func(match string) string {
		if len(match) > 20 {
			return match[:10] + "***[MASKED]"
		}
		return "***[MASKED]"
	})
	
	// Mask Authorization headers
	result = authHeaderRegex.ReplaceAllStringFunc(result, func(match string) string {
		parts := strings.Fields(match)
		if len(parts) >= 2 {
			token := parts[1]
			if len(token) > 10 {
				return parts[0] + " " + token[:10] + "***[MASKED]"
			}
			return parts[0] + " ***[MASKED]"
		}
		return "***[MASKED]"
	})
	
	return result
}

// MaskCookie masks cookie values in strings.
// Example: "session=abc123def456" -> "session=***[MASKED]"
func MaskCookie(s string) string {
	// Pattern: cookie_name=cookie_value
	cookieRegex := regexp.MustCompile(`([^=]+)=([^\s;]+)`)
	return cookieRegex.ReplaceAllStringFunc(s, func(match string) string {
		parts := strings.SplitN(match, "=", 2)
		if len(parts) == 2 {
			return parts[0] + "=***[MASKED]"
		}
		return "***[MASKED]"
	})
}

// MaskPII masks all PII in a string (email, token, cookie).
func MaskPII(s string) string {
	result := s
	result = MaskEmail(result)
	result = MaskToken(result)
	result = MaskCookie(result)
	return result
}
