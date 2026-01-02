package security

import (
	"testing"
)

func TestGenerateSecureToken(t *testing.T) {
	// Test token generation
	token1, err := GenerateSecureToken(32)
	if err != nil {
		t.Fatalf("GenerateSecureToken failed: %v", err)
	}

	if len(token1) == 0 {
		t.Error("GenerateSecureToken returned empty token")
	}

	// Test that tokens are unique
	token2, err := GenerateSecureToken(32)
	if err != nil {
		t.Fatalf("GenerateSecureToken failed: %v", err)
	}

	if token1 == token2 {
		t.Error("GenerateSecureToken should generate unique tokens")
	}

	// Test different lengths
	token16, err := GenerateSecureToken(16)
	if err != nil {
		t.Fatalf("GenerateSecureToken failed: %v", err)
	}

	if len(token16) == 0 {
		t.Error("GenerateSecureToken returned empty token for length 16")
	}
}

func TestGenerateSecureToken_ZeroLength(t *testing.T) {
	_, err := GenerateSecureToken(0)
	if err == nil {
		t.Error("GenerateSecureToken should fail with zero length")
	}
}

func TestGenerateSecureToken_NegativeLength(t *testing.T) {
	_, err := GenerateSecureToken(-1)
	if err == nil {
		t.Error("GenerateSecureToken should fail with negative length")
	}
}

func TestGenerateSecureToken_VariousLengths(t *testing.T) {
	lengths := []int{8, 16, 24, 32, 64, 128}

	for _, length := range lengths {
		t.Run(string(rune(length)), func(t *testing.T) {
			token, err := GenerateSecureToken(length)
			if err != nil {
				t.Errorf("GenerateSecureToken(%d) failed: %v", length, err)
				return
			}

			if len(token) == 0 {
				t.Errorf("GenerateSecureToken(%d) returned empty token", length)
			}
		})
	}
}

