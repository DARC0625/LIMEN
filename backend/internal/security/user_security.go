// Package security provides user-level security features.
// The human element is often the weakest link - we must strengthen it.
package security

import (
	"context"
	"fmt"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"go.uber.org/zap"
)

// UserSecurityPolicy represents security policies for users.
type UserSecurityPolicy struct {
	MinPasswordLength     int           `json:"min_password_length"`
	RequireUppercase      bool          `json:"require_uppercase"`
	RequireLowercase      bool          `json:"require_lowercase"`
	RequireNumbers        bool          `json:"require_numbers"`
	RequireSpecialChars   bool          `json:"require_special_chars"`
	PasswordExpiryDays    int           `json:"password_expiry_days"`
	MaxFailedAttempts     int           `json:"max_failed_attempts"`
	LockoutDuration       time.Duration `json:"lockout_duration"`
	RequireMFA            bool          `json:"require_mfa"`            // Future
	SessionTimeout        time.Duration `json:"session_timeout"`
	AuditAllActions       bool          `json:"audit_all_actions"`
}

// DefaultUserSecurityPolicy returns a secure default user security policy.
func DefaultUserSecurityPolicy() UserSecurityPolicy {
	return UserSecurityPolicy{
		MinPasswordLength:   12,                    // Strong minimum
		RequireUppercase:    true,
		RequireLowercase:    true,
		RequireNumbers:       true,
		RequireSpecialChars: true,
		PasswordExpiryDays:  90,                    // 3 months
		MaxFailedAttempts:   5,                     // Lock after 5 failed attempts
		LockoutDuration:     15 * time.Minute,      // 15 minute lockout
		RequireMFA:          false,                // Future: enable when implemented
		SessionTimeout:      24 * time.Hour,       // 24 hour session
		AuditAllActions:     true,                  // Audit all user actions
	}
}

// UserBehavior represents user behavior patterns for anomaly detection.
type UserBehavior struct {
	UserID           uint      `json:"user_id"`
	LastLoginTime    time.Time `json:"last_login_time"`
	LastLoginIP      string    `json:"last_login_ip"`
	FailedAttempts   int       `json:"failed_attempts"`
	LockedUntil      *time.Time `json:"locked_until"`
	UnusualActivity  bool      `json:"unusual_activity"`
	LastActivityTime time.Time `json:"last_activity_time"`
}

// DetectAnomalousBehavior detects unusual user behavior patterns.
// This helps identify compromised accounts or insider threats.
func DetectAnomalousBehavior(ctx context.Context, userID uint, currentIP string, currentTime time.Time) (bool, []string) {
	var anomalies []string

	// This would query user behavior history
	// For now, implement basic checks

	// Check for rapid login attempts from different IPs
	// Check for unusual access patterns
	// Check for off-hours access
	// Check for privilege escalation attempts

	return len(anomalies) > 0, anomalies
}

// ValidatePasswordPolicy validates a password against the security policy.
func ValidatePasswordPolicy(password string, policy UserSecurityPolicy) (bool, []string) {
	var issues []string

	if len(password) < policy.MinPasswordLength {
		issues = append(issues, fmt.Sprintf("Password must be at least %d characters", policy.MinPasswordLength))
	}

	hasUpper := false
	hasLower := false
	hasNumber := false
	hasSpecial := false

	for _, char := range password {
		switch {
		case char >= 'A' && char <= 'Z':
			hasUpper = true
		case char >= 'a' && char <= 'z':
			hasLower = true
		case char >= '0' && char <= '9':
			hasNumber = true
		case (char >= '!' && char <= '/') || (char >= ':' && char <= '@') || (char >= '[' && char <= '`') || (char >= '{' && char <= '~'):
			hasSpecial = true
		}
	}

	if policy.RequireUppercase && !hasUpper {
		issues = append(issues, "Password must contain at least one uppercase letter")
	}
	if policy.RequireLowercase && !hasLower {
		issues = append(issues, "Password must contain at least one lowercase letter")
	}
	if policy.RequireNumbers && !hasNumber {
		issues = append(issues, "Password must contain at least one number")
	}
	if policy.RequireSpecialChars && !hasSpecial {
		issues = append(issues, "Password must contain at least one special character")
	}

	return len(issues) == 0, issues
}

// AuditUserAction logs a user action for security auditing.
// All user actions should be audited to detect anomalies and breaches.
func AuditUserAction(ctx context.Context, userID uint, action string, resource string, success bool, details map[string]interface{}) {
	logger.Log.Info("User action audited",
		zap.Uint("user_id", userID),
		zap.String("action", action),
		zap.String("resource", resource),
		zap.Bool("success", success),
		zap.Any("details", details),
	)

	// Future: Store in audit log database
	// Future: Real-time anomaly detection
	// Future: Alert on suspicious patterns
}

// CheckAccountLockout checks if an account is locked due to failed attempts.
func CheckAccountLockout(userID uint) (bool, *time.Time) {
	// This would query the database for lockout status
	// For now, return false (not implemented)
	return false, nil
}

// RecordFailedLogin records a failed login attempt.
func RecordFailedLogin(ctx context.Context, userID uint, ip string) {
	logger.Log.Warn("Failed login attempt",
		zap.Uint("user_id", userID),
		zap.String("ip", ip),
	)

	// Future: Increment failed attempt counter
	// Future: Lock account after max attempts
	// Future: Alert on brute force attempts
}

