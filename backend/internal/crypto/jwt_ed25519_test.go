package crypto

import (
	"testing"
)

func TestGenerateEd25519KeyPair(t *testing.T) {
	keyPair, err := GenerateEd25519KeyPair()
	if err != nil {
		t.Fatalf("GenerateEd25519KeyPair() error = %v", err)
	}
	if keyPair == nil {
		t.Error("GenerateEd25519KeyPair() returned nil")
	}
	if len(keyPair.PrivateKey) == 0 {
		t.Error("GenerateEd25519KeyPair() PrivateKey is empty")
	}
	if len(keyPair.PublicKey) == 0 {
		t.Error("GenerateEd25519KeyPair() PublicKey is empty")
	}
}

func TestEd25519KeyPair_EncodeDecode(t *testing.T) {
	keyPair, err := GenerateEd25519KeyPair()
	if err != nil {
		t.Fatalf("GenerateEd25519KeyPair() error = %v", err)
	}

	// Test encoding
	privateKeyEncoded := keyPair.EncodePrivateKey()
	publicKeyEncoded := keyPair.EncodePublicKey()

	if privateKeyEncoded == "" {
		t.Error("EncodePrivateKey() returned empty string")
	}
	if publicKeyEncoded == "" {
		t.Error("EncodePublicKey() returned empty string")
	}

	// Test decoding
	decodedPrivate, err := DecodePrivateKey(privateKeyEncoded)
	if err != nil {
		t.Fatalf("DecodePrivateKey() error = %v", err)
	}
	if len(decodedPrivate) != len(keyPair.PrivateKey) {
		t.Errorf("DecodePrivateKey() length = %d, want %d", len(decodedPrivate), len(keyPair.PrivateKey))
	}

	decodedPublic, err := DecodePublicKey(publicKeyEncoded)
	if err != nil {
		t.Fatalf("DecodePublicKey() error = %v", err)
	}
	if len(decodedPublic) != len(keyPair.PublicKey) {
		t.Errorf("DecodePublicKey() length = %d, want %d", len(decodedPublic), len(keyPair.PublicKey))
	}
}

func TestGenerateEd25519JWT(t *testing.T) {
	keyPair, err := GenerateEd25519KeyPair()
	if err != nil {
		t.Fatalf("GenerateEd25519KeyPair() error = %v", err)
	}

	token, err := GenerateEd25519JWT(1, "testuser", "user", true, keyPair.PrivateKey, 24)
	if err != nil {
		t.Fatalf("GenerateEd25519JWT() error = %v", err)
	}
	if token == "" {
		t.Error("GenerateEd25519JWT() returned empty token")
	}
}

func TestValidateEd25519JWT(t *testing.T) {
	keyPair, err := GenerateEd25519KeyPair()
	if err != nil {
		t.Fatalf("GenerateEd25519KeyPair() error = %v", err)
	}

	// Generate token
	token, err := GenerateEd25519JWT(1, "testuser", "user", true, keyPair.PrivateKey, 24)
	if err != nil {
		t.Fatalf("GenerateEd25519JWT() error = %v", err)
	}

	// Validate token
	claims, err := ValidateEd25519JWT(token, keyPair.PublicKey)
	if err != nil {
		t.Fatalf("ValidateEd25519JWT() error = %v", err)
	}
	if claims == nil {
		t.Error("ValidateEd25519JWT() returned nil claims")
	}
	if claims.UserID != 1 {
		t.Errorf("ValidateEd25519JWT() UserID = %d, want 1", claims.UserID)
	}
	if claims.Username != "testuser" {
		t.Errorf("ValidateEd25519JWT() Username = %s, want testuser", claims.Username)
	}
	if claims.Role != "user" {
		t.Errorf("ValidateEd25519JWT() Role = %s, want user", claims.Role)
	}
	if !claims.Approved {
		t.Error("ValidateEd25519JWT() Approved = false, want true")
	}
}

func TestValidateEd25519JWT_InvalidToken(t *testing.T) {
	keyPair, err := GenerateEd25519KeyPair()
	if err != nil {
		t.Fatalf("GenerateEd25519KeyPair() error = %v", err)
	}

	// Test with invalid token
	_, err = ValidateEd25519JWT("invalid.token.here", keyPair.PublicKey)
	if err == nil {
		t.Error("ValidateEd25519JWT() should return error for invalid token")
	}
}

