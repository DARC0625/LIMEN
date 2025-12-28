// Package auth provides authentication and authorization functionality.
// Uses state-of-the-art cryptographic techniques for maximum security and performance.
package auth

import (
	"errors"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/crypto"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrTokenExpired       = errors.New("token expired")
	ErrInvalidToken       = errors.New("invalid token")
)

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
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`     // User role: admin or user
	Approved bool   `json:"approved"` // User approval status
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
