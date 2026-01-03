// Package auth provides authentication and authorization functionality.
// Uses state-of-the-art cryptographic techniques for maximum security and performance.
package auth

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/crypto"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials   = errors.New("invalid credentials")
	ErrTokenExpired         = errors.New("token expired")
	ErrInvalidToken         = errors.New("invalid token")
	ErrInvalidRefreshToken  = errors.New("invalid or expired refresh token")
	ErrInvalidCSRFToken     = errors.New("invalid CSRF token")
)

// RefreshTokenClaims represents JWT claims for refresh tokens.
type RefreshTokenClaims struct {
	UserID     uint   `json:"user_id"`
	Username   string `json:"username"`
	Role       string `json:"role"`
	Approved   bool   `json:"approved"`
	BetaAccess bool   `json:"beta_access"` // Beta access permission
	TokenID    string `json:"token_id"`    // Unique token ID for rotation
	jwt.RegisteredClaims
}

// HashPassword hashes a password using Argon2id.
// Argon2id is the winner of the Password Hashing Competition (PHC)
// and provides superior security compared to bcrypt:
// - Memory-hard (resistant to GPU attacks)
// - Configurable memory/time trade-offs
// - Faster than bcrypt on modern systems
// - Post-quantum resistant design
// Uses hardware-optimized configuration if available.
func HashPassword(password string) (string, error) {
	// Use hardware-optimized configuration
	config := crypto.GetOptimalArgon2idConfig()
	return crypto.HashPasswordWithConfig(password, config)
}

// CheckPassword verifies a password against an Argon2id hash.
// Supports both Argon2id (new) and bcrypt (legacy) hashes for backward compatibility.
func CheckPassword(password, hash string) bool {
	// Try Argon2id first (new format)
	if crypto.CheckPassword(password, hash) {
		return true
	}

	// Fallback to bcrypt for backward compatibility
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// Claims represents JWT claims.
type Claims struct {
	UserID     uint   `json:"user_id"`
	Username   string `json:"username"`
	Role       string `json:"role"`        // User role: admin or user
	Approved   bool   `json:"approved"`    // User approval status
	BetaAccess bool   `json:"beta_access"` // Beta access permission
	jwt.RegisteredClaims
}

// GenerateToken generates a JWT token for a user.
func GenerateToken(userID uint, username string, role string, secret string, expiryHours int) (string, error) {
	return GenerateTokenWithApproval(userID, username, role, true, secret, expiryHours)
}

// GenerateTokenWithApproval generates a JWT token for a user with approval status.
func GenerateTokenWithApproval(userID uint, username string, role string, approved bool, secret string, expiryHours int) (string, error) {
	expirationTime := time.Now().Add(time.Duration(expiryHours) * time.Hour)
	claims := &Claims{
		UserID:   userID,
		Username: username,
		Role:     role,
		Approved: approved,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "limen",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ValidateToken validates a JWT token and returns the claims.
func ValidateToken(tokenString string, secret string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrTokenExpired
		}
		return nil, ErrInvalidToken
	}

	if !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// ExtractTokenFromHeader extracts JWT token from Authorization header.
func ExtractTokenFromHeader(authHeader string) (string, error) {
	if authHeader == "" {
		return "", ErrInvalidToken
	}

	// Expected format: "Bearer <token>"
	const bearerPrefix = "Bearer "
	if len(authHeader) < len(bearerPrefix) || authHeader[:len(bearerPrefix)] != bearerPrefix {
		return "", ErrInvalidToken
	}

	return authHeader[len(bearerPrefix):], nil
}

// GenerateAccessToken generates a short-lived access token (15 minutes).
func GenerateAccessToken(userID uint, username, role string, approved bool, secret string) (string, error) {
	return GenerateAccessTokenWithBetaAccess(userID, username, role, approved, false, secret)
}

// GenerateAccessTokenWithBetaAccess generates a short-lived access token with beta access flag.
func GenerateAccessTokenWithBetaAccess(userID uint, username, role string, approved, betaAccess bool, secret string) (string, error) {
	expirationTime := time.Now().Add(15 * time.Minute) // 15 minutes
	claims := &Claims{
		UserID:     userID,
		Username:   username,
		Role:       role,
		Approved:   approved,
		BetaAccess: betaAccess,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "limen",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// GenerateRefreshToken generates a long-lived refresh token (7 days).
func GenerateRefreshToken(userID uint, username, role string, approved bool, secret string) (string, string, error) {
	return GenerateRefreshTokenWithBetaAccess(userID, username, role, approved, false, secret)
}

// GenerateRefreshTokenWithBetaAccess generates a long-lived refresh token with beta access flag.
func GenerateRefreshTokenWithBetaAccess(userID uint, username, role string, approved, betaAccess bool, secret string) (string, string, error) {
	// Generate unique token ID for rotation
	tokenID, err := generateTokenID()
	if err != nil {
		return "", "", err
	}

	expirationTime := time.Now().Add(7 * 24 * time.Hour) // 7 days
	claims := &RefreshTokenClaims{
		UserID:     userID,
		Username:   username,
		Role:       role,
		Approved:   approved,
		BetaAccess: betaAccess,
		TokenID:    tokenID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "limen",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", "", err
	}

	return tokenString, tokenID, nil
}

// ValidateRefreshToken validates a refresh token and returns the claims.
func ValidateRefreshToken(tokenString, secret string) (*RefreshTokenClaims, error) {
	claims := &RefreshTokenClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrTokenExpired
		}
		return nil, ErrInvalidRefreshToken
	}

	if !token.Valid {
		return nil, ErrInvalidRefreshToken
	}

	return claims, nil
}

// generateTokenID generates a unique token ID for refresh token rotation.
func generateTokenID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}
