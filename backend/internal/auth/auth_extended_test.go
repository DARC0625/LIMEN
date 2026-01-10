package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestValidateToken_InvalidSigningMethod(t *testing.T) {
	secret := "test-secret-key-for-testing-only"
	tokenString, err := GenerateToken(1, "testuser", "user", secret, 1)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	// Validate with wrong secret
	_, err = ValidateToken(tokenString, "wrong-secret")
	if err == nil {
		t.Error("ValidateToken should fail with wrong secret")
	}
	if err != ErrInvalidToken {
		t.Errorf("Expected ErrInvalidToken, got %v", err)
	}
}

func TestValidateToken_ExpiredToken(t *testing.T) {
	secret := "test-secret-key-for-testing-only"

	// Create an expired token manually
	claims := &Claims{
		UserID:   1,
		Username: "testuser",
		Role:     "user",
		Approved: true,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)), // Expired
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
			Issuer:    "limen",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("Failed to sign token: %v", err)
	}

	// Validate expired token
	_, err = ValidateToken(tokenString, secret)
	if err == nil {
		t.Error("ValidateToken should fail with expired token")
	}
	if err != ErrTokenExpired {
		t.Errorf("Expected ErrTokenExpired, got %v", err)
	}
}

func TestValidateToken_InvalidTokenFormat(t *testing.T) {
	secret := "test-secret-key-for-testing-only"

	// Test with invalid token format
	_, err := ValidateToken("invalid.token.format", secret)
	if err == nil {
		t.Error("ValidateToken should fail with invalid token format")
	}
	if err != ErrInvalidToken {
		t.Errorf("Expected ErrInvalidToken, got %v", err)
	}
}

func TestGenerateRefreshToken_Extended(t *testing.T) {
	secret := "test-secret-key-for-testing-only"

	token, tokenID, err := GenerateRefreshToken(1, "testuser", "user", true, secret)
	if err != nil {
		t.Fatalf("GenerateRefreshToken failed: %v", err)
	}

	if token == "" {
		t.Error("GenerateRefreshToken returned empty token")
	}

	if tokenID == "" {
		t.Error("GenerateRefreshToken returned empty tokenID")
	}

	// Validate the refresh token
	claims, err := ValidateRefreshToken(token, secret)
	if err != nil {
		t.Errorf("ValidateRefreshToken failed: %v", err)
	}

	if claims.UserID != 1 {
		t.Errorf("Expected UserID 1, got %d", claims.UserID)
	}

	if claims.Username != "testuser" {
		t.Errorf("Expected Username 'testuser', got %s", claims.Username)
	}

	if claims.TokenID != tokenID {
		t.Errorf("Expected TokenID %s, got %s", tokenID, claims.TokenID)
	}
}

func TestValidateRefreshToken_InvalidToken(t *testing.T) {
	secret := "test-secret-key-for-testing-only"

	_, err := ValidateRefreshToken("invalid.token", secret)
	if err == nil {
		t.Error("ValidateRefreshToken should fail with invalid token")
	}
	if err != ErrInvalidRefreshToken {
		t.Errorf("Expected ErrInvalidRefreshToken, got %v", err)
	}
}

func TestValidateRefreshToken_ExpiredToken(t *testing.T) {
	secret := "test-secret-key-for-testing-only"

	// Create an expired refresh token
	claims := &RefreshTokenClaims{
		UserID:   1,
		Username: "testuser",
		Role:     "user",
		Approved: true,
		TokenID:  "test-token-id",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)), // Expired
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
			Issuer:    "limen",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("Failed to sign token: %v", err)
	}

	_, err = ValidateRefreshToken(tokenString, secret)
	if err == nil {
		t.Error("ValidateRefreshToken should fail with expired token")
	}
	if err != ErrInvalidRefreshToken {
		t.Errorf("Expected ErrInvalidRefreshToken, got %v", err)
	}
}

func TestExtractTokenFromHeader_InvalidFormat(t *testing.T) {
	tests := []struct {
		name       string
		authHeader string
		wantErr    error
	}{
		{
			name:       "empty header",
			authHeader: "",
			wantErr:    ErrInvalidToken,
		},
		{
			name:       "no Bearer prefix",
			authHeader: "token123",
			wantErr:    ErrInvalidToken,
		},
		{
			name:       "short header",
			authHeader: "Bear",
			wantErr:    ErrInvalidToken,
		},
		{
			name:       "valid format",
			authHeader: "Bearer token123",
			wantErr:    nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, err := ExtractTokenFromHeader(tt.authHeader)
			if tt.wantErr != nil {
				if err != tt.wantErr {
					t.Errorf("ExtractTokenFromHeader() error = %v, wantErr %v", err, tt.wantErr)
				}
			} else {
				if err != nil {
					t.Errorf("ExtractTokenFromHeader() error = %v, want nil", err)
				}
				if token != "token123" {
					t.Errorf("ExtractTokenFromHeader() token = %v, want token123", token)
				}
			}
		})
	}
}

func TestGenerateTokenWithApproval_Extended(t *testing.T) {
	secret := "test-secret-key-for-testing-only"

	tests := []struct {
		name     string
		approved bool
	}{
		{"approved user", true},
		{"unapproved user", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, err := GenerateTokenWithApproval(1, "testuser", "user", tt.approved, secret, 1)
			if err != nil {
				t.Fatalf("GenerateTokenWithApproval failed: %v", err)
			}

			claims, err := ValidateToken(token, secret)
			if err != nil {
				t.Fatalf("ValidateToken failed: %v", err)
			}

			if claims.Approved != tt.approved {
				t.Errorf("Expected Approved %v, got %v", tt.approved, claims.Approved)
			}
		})
	}
}

func TestGenerateAccessToken_Extended(t *testing.T) {
	secret := "test-secret-key-for-testing-only"

	token, err := GenerateAccessToken(1, "testuser", "user", true, secret)
	if err != nil {
		t.Fatalf("GenerateAccessToken failed: %v", err)
	}

	if token == "" {
		t.Error("GenerateAccessToken returned empty token")
	}

	// Validate the access token
	claims, err := ValidateToken(token, secret)
	if err != nil {
		t.Fatalf("ValidateToken failed: %v", err)
	}

	if claims.UserID != 1 {
		t.Errorf("Expected UserID 1, got %d", claims.UserID)
	}

	// Check expiration (should be ~15 minutes from now)
	expirationTime := claims.ExpiresAt.Time
	expectedExpiration := time.Now().Add(15 * time.Minute)
	diff := expectedExpiration.Sub(expirationTime)
	if diff > 1*time.Minute || diff < -1*time.Minute {
		t.Errorf("Expected expiration around 15 minutes, got %v", expirationTime)
	}
}
