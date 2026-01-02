package auth

import (
	"testing"
)

func TestHashPassword(t *testing.T) {
	password := "test-password-123"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}

	if hash == "" {
		t.Error("HashPassword() returned empty hash")
	}

	if hash == password {
		t.Error("HashPassword() returned plain password")
	}
}

func TestCheckPassword(t *testing.T) {
	password := "test-password-123"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}

	// Correct password
	if !CheckPassword(password, hash) {
		t.Error("CheckPassword() failed with correct password")
	}

	// Wrong password
	if CheckPassword("wrong-password", hash) {
		t.Error("CheckPassword() succeeded with wrong password")
	}
}

func TestGenerateToken(t *testing.T) {
	secret := "test-secret-key"
	userID := uint(1)
	username := "testuser"

	token, err := GenerateToken(userID, username, "user", secret, 24)
	if err != nil {
		t.Fatalf("GenerateToken() error = %v", err)
	}

	if token == "" {
		t.Error("GenerateToken() returned empty token")
	}
}

func TestValidateToken(t *testing.T) {
	secret := "test-secret-key"
	userID := uint(1)
	username := "testuser"

	// Generate token
	token, err := GenerateToken(userID, username, "user", secret, 24)
	if err != nil {
		t.Fatalf("GenerateToken() error = %v", err)
	}

	// Validate token
	claims, err := ValidateToken(token, secret)
	if err != nil {
		t.Fatalf("ValidateToken() error = %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("ValidateToken() UserID = %v, want %v", claims.UserID, userID)
	}

	if claims.Username != username {
		t.Errorf("ValidateToken() Username = %v, want %v", claims.Username, username)
	}
}

func TestValidateToken_InvalidSecret(t *testing.T) {
	secret := "test-secret-key"
	userID := uint(1)
	username := "testuser"

	token, err := GenerateToken(userID, username, "user", secret, 24)
	if err != nil {
		t.Fatalf("GenerateToken() error = %v", err)
	}

	// Validate with wrong secret
	_, err = ValidateToken(token, "wrong-secret")
	if err == nil {
		t.Error("ValidateToken() should fail with wrong secret")
	}
}

func TestExtractTokenFromHeader(t *testing.T) {
	tests := []struct {
		name      string
		header    string
		wantToken string
		wantErr   bool
	}{
		{"valid header", "Bearer test-token", "test-token", false},
		{"valid header with spaces", "Bearer  test-token  ", " test-token  ", false},
		{"empty header", "", "", true},
		{"no Bearer prefix", "test-token", "", true},
		{"only Bearer", "Bearer", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, err := ExtractTokenFromHeader(tt.header)
			if (err != nil) != tt.wantErr {
				t.Errorf("ExtractTokenFromHeader() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && token != tt.wantToken {
				t.Errorf("ExtractTokenFromHeader() = %v, want %v", token, tt.wantToken)
			}
		})
	}
}
