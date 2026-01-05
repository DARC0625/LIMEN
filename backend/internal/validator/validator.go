// Package validator provides input validation functions.
// Zero-trust principle: Validate and sanitize all inputs.
package validator

import (
	"fmt"
	"html"
	"regexp"
	"strings"

	"github.com/DARC0625/LIMEN/backend/internal/security"
)

// ValidateVMName validates a VM name.
// Zero-trust: Strict validation to prevent injection attacks.
func ValidateVMName(name string) error {
	// Sanitize input first
	name = security.SanitizeString(name)

	if name == "" {
		return fmt.Errorf("VM name is required")
	}
	if len(name) < 3 {
		return fmt.Errorf("VM name must be at least 3 characters")
	}
	if len(name) > 64 {
		return fmt.Errorf("VM name must be at most 64 characters")
	}

	// Check for null bytes and control characters
	if err := security.ValidateInput(name, 64); err != nil {
		return fmt.Errorf("VM name contains invalid characters")
	}

	// Allow only alphanumeric, hyphen, underscore (whitelist approach)
	for _, r := range name {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_') {
			return fmt.Errorf("VM name can only contain alphanumeric characters, hyphens, and underscores")
		}
	}

	// Prevent SQL injection patterns
	sqlPatterns := []string{"'", "\"", ";", "--", "/*", "*/", "xp_", "sp_", "exec", "union", "select"}
	nameLower := strings.ToLower(name)
	for _, pattern := range sqlPatterns {
		if strings.Contains(nameLower, pattern) {
			return fmt.Errorf("VM name contains invalid characters")
		}
	}

	return nil
}

// ValidateCPU validates CPU count.
// No maximum limit - system resources determine the limit.
func ValidateCPU(cpu int) error {
	if cpu < 1 {
		return fmt.Errorf("CPU must be at least 1")
	}
	// No maximum limit - removed for flexibility
	return nil
}

// ValidateMemory validates memory amount in MB.
// No maximum limit - system resources determine the limit.
func ValidateMemory(memory int) error {
	if memory < 1024 {
		return fmt.Errorf("Memory must be at least 1024MB (1GB)")
	}
	// Memory should be a multiple of 256MB for better performance and stability
	if memory%256 != 0 {
		return fmt.Errorf("Memory should be a multiple of 256MB for stability")
	}
	return nil
}

// ValidateOSType validates OS type.
func ValidateOSType(osType string) error {
	validTypes := []string{
		"ubuntu-desktop",
		"ubuntu-server",
		"kali",
		"windows",
	}
	for _, valid := range validTypes {
		if osType == valid {
			return nil
		}
	}
	return fmt.Errorf("Invalid OS type. Valid types: %v", validTypes)
}

// ValidateVMAction validates VM action.
func ValidateVMAction(action string) error {
	validActions := []string{
		"start",
		"stop",
		"delete",
		"update",
	}
	for _, valid := range validActions {
		if action == valid {
			return nil
		}
	}
	return fmt.Errorf("Invalid action. Valid actions: %v", validActions)
}

// SanitizeHTML sanitizes HTML input to prevent XSS attacks.
// Escapes HTML special characters and removes potentially dangerous tags.
func SanitizeHTML(input string) string {
	// First escape HTML entities
	sanitized := html.EscapeString(input)
	
	// Remove script tags and event handlers (additional safety layer)
	scriptPattern := regexp.MustCompile(`(?i)<script[^>]*>.*?</script>`)
	sanitized = scriptPattern.ReplaceAllString(sanitized, "")
	
	// Remove javascript: protocol
	jsProtocolPattern := regexp.MustCompile(`(?i)javascript:`)
	sanitized = jsProtocolPattern.ReplaceAllString(sanitized, "")
	
	// Remove on* event handlers
	eventHandlerPattern := regexp.MustCompile(`(?i)\s*on\w+\s*=\s*["'][^"']*["']`)
	sanitized = eventHandlerPattern.ReplaceAllString(sanitized, "")
	
	return sanitized
}

// ValidateUsername validates a username with enhanced security checks.
func ValidateUsername(username string) error {
	// Sanitize input first
	username = security.SanitizeString(username)
	
	if username == "" {
		return fmt.Errorf("Username is required")
	}
	if len(username) < 3 {
		return fmt.Errorf("Username must be at least 3 characters")
	}
	if len(username) > 32 {
		return fmt.Errorf("Username must be at most 32 characters")
	}
	
	// Check for null bytes and control characters
	if err := security.ValidateInput(username, 32); err != nil {
		return fmt.Errorf("Username contains invalid characters")
	}
	
	// Allow only alphanumeric and underscore (whitelist approach)
	for _, r := range username {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_') {
			return fmt.Errorf("Username can only contain alphanumeric characters and underscores")
		}
	}
	
	// Prevent SQL injection patterns
	sqlPatterns := []string{"'", "\"", ";", "--", "/*", "*/", "xp_", "sp_", "exec", "union", "select", "drop", "delete", "insert", "update"}
	usernameLower := strings.ToLower(username)
	for _, pattern := range sqlPatterns {
		if strings.Contains(usernameLower, pattern) {
			return fmt.Errorf("Username contains invalid characters")
		}
	}
	
	// Prevent XSS patterns
	xssPatterns := []string{"<script", "</script", "javascript:", "onerror=", "onclick=", "onload="}
	usernameLower = strings.ToLower(username)
	for _, pattern := range xssPatterns {
		if strings.Contains(usernameLower, pattern) {
			return fmt.Errorf("Username contains invalid characters")
		}
	}
	
	return nil
}

// ValidateDescription validates a description field with XSS protection.
func ValidateDescription(description string, maxLength int) error {
	if maxLength <= 0 {
		maxLength = 1000 // Default max length
	}
	
	if len(description) > maxLength {
		return fmt.Errorf("Description must be at most %d characters", maxLength)
	}
	
	// Check for null bytes and control characters (except newlines and tabs)
	if err := security.ValidateInput(description, maxLength); err != nil {
		// Allow newlines and tabs in descriptions
		cleaned := strings.ReplaceAll(description, "\n", "")
		cleaned = strings.ReplaceAll(cleaned, "\t", "")
		if err := security.ValidateInput(cleaned, maxLength); err != nil {
			return fmt.Errorf("Description contains invalid characters")
		}
	}
	
	// Prevent dangerous HTML/JavaScript patterns
	dangerousPatterns := []string{
		"<script", "</script", "javascript:", "onerror=", "onclick=", "onload=",
		"<iframe", "<object", "<embed", "data:text/html",
	}
	descriptionLower := strings.ToLower(description)
	for _, pattern := range dangerousPatterns {
		if strings.Contains(descriptionLower, pattern) {
			return fmt.Errorf("Description contains potentially dangerous content")
		}
	}
	
	return nil
}

// SanitizeDescription sanitizes a description field for safe display.
func SanitizeDescription(description string) string {
	// Escape HTML entities
	sanitized := html.EscapeString(description)
	
	// Remove script tags
	scriptPattern := regexp.MustCompile(`(?i)<script[^>]*>.*?</script>`)
	sanitized = scriptPattern.ReplaceAllString(sanitized, "")
	
	// Remove javascript: protocol
	jsProtocolPattern := regexp.MustCompile(`(?i)javascript:`)
	sanitized = jsProtocolPattern.ReplaceAllString(sanitized, "")
	
	return sanitized
}
