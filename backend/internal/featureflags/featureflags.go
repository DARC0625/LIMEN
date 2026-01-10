// Package featureflags provides feature flag management for experimental/test features.
// Features behind flags can be disabled at build time for production builds.
package featureflags

import (
	"os"
	"strings"
)

var (
	// E2EModeEnabled indicates if E2E test mode is enabled.
	// Set via E2E_MODE environment variable (default: false for production).
	E2EModeEnabled = getEnvBool("E2E_MODE", false)
)

// IsE2EModeEnabled returns true if E2E test mode is enabled.
func IsE2EModeEnabled() bool {
	return E2EModeEnabled
}

// CheckE2EHeader checks if the X-Limen-E2E header is present and valid.
// Only works if E2E_MODE is enabled at build time.
func CheckE2EHeader(headerValue string) bool {
	if !E2EModeEnabled {
		return false
	}
	return strings.TrimSpace(headerValue) == "1"
}

// getEnvBool reads a boolean environment variable.
func getEnvBool(key string, defaultValue bool) bool {
	val := os.Getenv(key)
	if val == "" {
		return defaultValue
	}
	val = strings.ToLower(strings.TrimSpace(val))
	return val == "true" || val == "1" || val == "yes" || val == "on"
}
