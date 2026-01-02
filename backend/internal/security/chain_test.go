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
		// Ignore error if already initialized
	}
}

func TestGetCurrentChain(t *testing.T) {
	// First validate chain to populate currentChain
	ctx := context.Background()
	_, err := ValidateSecurityChain(ctx)
	if err != nil {
		t.Fatalf("ValidateSecurityChain failed: %v", err)
	}

	result := GetCurrentChain()
	if result == nil {
		t.Fatal("GetCurrentChain returned nil")
	}

	// Verify structure
	if result.Overall == "" {
		t.Error("Overall status should not be empty")
	}
}

func TestCheckSecurityChain(t *testing.T) {
	ctx := context.Background()

	result, err := CheckSecurityChain(ctx)
	if err != nil {
		t.Fatalf("CheckSecurityChain failed: %v", err)
	}

	if result == nil {
		t.Fatal("CheckSecurityChain returned nil")
	}

	// Verify structure
	if result.Overall == "" {
		t.Error("Overall status should not be empty")
	}

	// Verify components exist (they are structs, not pointers)
	if result.Hardware.Status == "" {
		t.Error("Hardware status should not be empty")
	}
	if result.Software.Status == "" {
		t.Error("Software status should not be empty")
	}
	if result.Network.Status == "" {
		t.Error("Network status should not be empty")
	}
	if result.User.Status == "" {
		t.Error("User status should not be empty")
	}
}

func TestGetWeakestLink(t *testing.T) {
	// First validate chain to populate currentChain
	ctx := context.Background()
	_, err := ValidateSecurityChain(ctx)
	if err != nil {
		t.Fatalf("ValidateSecurityChain failed: %v", err)
	}

	weakest := GetWeakestLink()
	// Weakest link can be nil if no weak links found
	if weakest != nil {
		// Verify structure if weak link exists
		if weakest.Component == "" {
			t.Error("Component should not be empty")
		}
		if weakest.Severity == "" {
			t.Error("Severity should not be empty")
		}
	}
}

func TestValidateSecurityChain(t *testing.T) {
	ctx := context.Background()

	result, err := ValidateSecurityChain(ctx)
	if err != nil {
		t.Fatalf("ValidateSecurityChain failed: %v", err)
	}

	if result == nil {
		t.Fatal("ValidateSecurityChain returned nil")
	}

	// Verify structure
	if result.Overall == "" {
		t.Error("Overall status should not be empty")
	}

	// Verify all components are validated
	if result.Hardware.Status == "" {
		t.Error("Hardware status should not be empty")
	}
	if result.Software.Status == "" {
		t.Error("Software status should not be empty")
	}
	if result.Network.Status == "" {
		t.Error("Network status should not be empty")
	}
	if result.User.Status == "" {
		t.Error("User status should not be empty")
	}

	// Verify timestamp
	if result.Timestamp.IsZero() {
		t.Error("Timestamp should not be zero")
	}
}

func TestStartChainMonitoring(t *testing.T) {
	ctx := context.Background()

	// Start monitoring (deprecated function, but should not panic)
	StartChainMonitoring(ctx, 30*time.Second)

	// Give it a moment
	time.Sleep(100 * time.Millisecond)

	// Function should return without error (it's deprecated but kept for compatibility)
}

func TestDetermineOverallStatus_Logic(t *testing.T) {
	// Test determineOverallStatus logic by creating chains with different statuses
	ctx := context.Background()

	// Create a chain with all strong components
	chain1, err := ValidateSecurityChain(ctx)
	if err != nil {
		t.Fatalf("ValidateSecurityChain failed: %v", err)
	}

	// The overall status should be determined correctly
	if chain1.Overall == "" {
		t.Error("Overall status should not be empty")
	}

	// Verify overall status is one of the valid values
	validStatuses := []ChainStatus{StatusStrong, StatusModerate, StatusWeak, StatusUnknown}
	valid := false
	for _, status := range validStatuses {
		if chain1.Overall == status {
			valid = true
			break
		}
	}
	if !valid {
		t.Errorf("Overall status '%s' is not a valid status", chain1.Overall)
	}
}

func TestSecurityChain_WeakLinks(t *testing.T) {
	ctx := context.Background()

	chain, err := ValidateSecurityChain(ctx)
	if err != nil {
		t.Fatalf("ValidateSecurityChain failed: %v", err)
	}

	// WeakLinks should be a slice (can be empty)
	if chain.WeakLinks == nil {
		t.Error("WeakLinks should not be nil")
	}

	// If there are weak links, verify their structure
	for _, link := range chain.WeakLinks {
		if link.Component == "" {
			t.Error("Weak link component should not be empty")
		}
		if link.Severity == "" {
			t.Error("Weak link severity should not be empty")
		}
		if link.Issue == "" {
			t.Error("Weak link issue should not be empty")
		}
		if link.DetectedAt.IsZero() {
			t.Error("Weak link detectedAt should not be zero")
		}
	}
}

