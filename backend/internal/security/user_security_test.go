package security

import (
	"context"
	"testing"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
)

func init() {
	// Initialize logger for tests
	if err := logger.Init("debug"); err != nil {
		panic(err)
	}
}

func TestDefaultUserSecurityPolicy(t *testing.T) {
	policy := DefaultUserSecurityPolicy()

	if policy.MinPasswordLength != 12 {
		t.Errorf("DefaultUserSecurityPolicy() MinPasswordLength = %v, want 12", policy.MinPasswordLength)
	}

	if !policy.RequireUppercase {
		t.Error("DefaultUserSecurityPolicy() RequireUppercase should be true")
	}

	if !policy.RequireLowercase {
		t.Error("DefaultUserSecurityPolicy() RequireLowercase should be true")
	}

	if !policy.RequireNumbers {
		t.Error("DefaultUserSecurityPolicy() RequireNumbers should be true")
	}

	if !policy.RequireSpecialChars {
		t.Error("DefaultUserSecurityPolicy() RequireSpecialChars should be true")
	}

	if policy.PasswordExpiryDays != 90 {
		t.Errorf("DefaultUserSecurityPolicy() PasswordExpiryDays = %v, want 90", policy.PasswordExpiryDays)
	}

	if policy.MaxFailedAttempts != 5 {
		t.Errorf("DefaultUserSecurityPolicy() MaxFailedAttempts = %v, want 5", policy.MaxFailedAttempts)
	}

	if policy.LockoutDuration != 15*time.Minute {
		t.Errorf("DefaultUserSecurityPolicy() LockoutDuration = %v, want 15m", policy.LockoutDuration)
	}

	if policy.SessionTimeout != 24*time.Hour {
		t.Errorf("DefaultUserSecurityPolicy() SessionTimeout = %v, want 24h", policy.SessionTimeout)
	}

	if !policy.AuditAllActions {
		t.Error("DefaultUserSecurityPolicy() AuditAllActions should be true")
	}
}

func TestDetectAnomalousBehavior(t *testing.T) {
	ctx := context.Background()
	userID := uint(1)
	currentIP := "192.168.1.1"
	currentTime := time.Now()

	anomalous, anomalies := DetectAnomalousBehavior(ctx, userID, currentIP, currentTime)

	// Currently returns false (not implemented)
	if anomalous {
		t.Error("DetectAnomalousBehavior() should return false when not implemented")
	}

	if len(anomalies) != 0 {
		t.Errorf("DetectAnomalousBehavior() anomalies = %v, want empty", anomalies)
	}
}

func TestValidatePasswordPolicy(t *testing.T) {
	policy := DefaultUserSecurityPolicy()

	tests := []struct {
		name     string
		password string
		want     bool
		wantIssues int
	}{
		{
			name:      "Valid password",
			password:   "StrongPass123!",
			want:      true,
			wantIssues: 0,
		},
		{
			name:      "Too short",
			password:   "Short1!",
			want:      false,
			wantIssues: 1,
		},
		{
			name:      "No uppercase",
			password:   "lowercase123!",
			want:      false,
			wantIssues: 1,
		},
		{
			name:      "No lowercase",
			password:   "UPPERCASE123!",
			want:      false,
			wantIssues: 1,
		},
		{
			name:      "No numbers",
			password:   "NoNumbers!",
			want:      false,
			wantIssues: 2, // Length (10 < 12) and number check fail
		},
		{
			name:      "No special chars",
			password:   "NoSpecial123",
			want:      false,
			wantIssues: 1,
		},
		{
			name:      "Multiple issues",
			password:   "weak",
			want:      false,
			wantIssues: 4, // uppercase, lowercase, numbers, special (length check happens first but may not be counted separately)
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			valid, issues := ValidatePasswordPolicy(tt.password, policy)
			if valid != tt.want {
				t.Errorf("ValidatePasswordPolicy() valid = %v, want %v", valid, tt.want)
			}
			if len(issues) != tt.wantIssues {
				t.Errorf("ValidatePasswordPolicy() issues count = %v, want %v (issues: %v)", len(issues), tt.wantIssues, issues)
			}
		})
	}
}

func TestValidatePasswordPolicy_CustomPolicy(t *testing.T) {
	policy := UserSecurityPolicy{
		MinPasswordLength:   8,
		RequireUppercase:    false,
		RequireLowercase:    true,
		RequireNumbers:      false,
		RequireSpecialChars: false,
	}

	// Valid with custom policy
	valid, issues := ValidatePasswordPolicy("lowercase", policy)
	if !valid {
		t.Errorf("ValidatePasswordPolicy() should be valid with custom policy, issues: %v", issues)
	}

	// Invalid - too short
	valid, issues = ValidatePasswordPolicy("short", policy)
	if valid {
		t.Error("ValidatePasswordPolicy() should be invalid when too short")
	}
}

func TestAuditUserAction(t *testing.T) {
	ctx := context.Background()
	userID := uint(1)
	action := "login"
	resource := "user"
	success := true
	details := map[string]interface{}{
		"ip": "192.168.1.1",
	}

	// Should not panic
	AuditUserAction(ctx, userID, action, resource, success, details)
}

func TestCheckAccountLockout(t *testing.T) {
	userID := uint(1)

	locked, lockUntil := CheckAccountLockout(userID)

	// Currently returns false (not implemented)
	if locked {
		t.Error("CheckAccountLockout() should return false when not implemented")
	}

	if lockUntil != nil {
		t.Error("CheckAccountLockout() should return nil lockUntil when not implemented")
	}
}

func TestRecordFailedLogin(t *testing.T) {
	ctx := context.Background()
	userID := uint(1)
	ip := "192.168.1.1"

	// Should not panic
	RecordFailedLogin(ctx, userID, ip)
}

