// Package crypto provides JWT signing using Ed25519.
// Ed25519 is a modern, high-performance elliptic curve signature scheme.
package crypto

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrEd25519KeyGeneration = errors.New("failed to generate Ed25519 key")
	ErrEd25519InvalidKey    = errors.New("invalid Ed25519 key")
)

// Ed25519KeyPair represents an Ed25519 public/private key pair.
type Ed25519KeyPair struct {
	PrivateKey ed25519.PrivateKey
	PublicKey  ed25519.PublicKey
}

// GenerateEd25519KeyPair generates a new Ed25519 key pair.
// Ed25519 keys are only 32 bytes (private) + 32 bytes (public) = 64 bytes total,
// making them very efficient compared to RSA (which requires 2048+ bits).
func GenerateEd25519KeyPair() (*Ed25519KeyPair, error) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, ErrEd25519KeyGeneration
	}

	return &Ed25519KeyPair{
		PrivateKey: privateKey,
		PublicKey:  publicKey,
	}, nil
}

// EncodePrivateKey encodes the private key to base64 string.
func (k *Ed25519KeyPair) EncodePrivateKey() string {
	return base64.StdEncoding.EncodeToString(k.PrivateKey)
}

// EncodePublicKey encodes the public key to base64 string.
func (k *Ed25519KeyPair) EncodePublicKey() string {
	return base64.StdEncoding.EncodeToString(k.PublicKey)
}

// DecodePrivateKey decodes a base64-encoded private key.
func DecodePrivateKey(encoded string) (ed25519.PrivateKey, error) {
	keyBytes, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, err
	}
	if len(keyBytes) != ed25519.PrivateKeySize {
		return nil, ErrEd25519InvalidKey
	}
	return ed25519.PrivateKey(keyBytes), nil
}

// DecodePublicKey decodes a base64-encoded public key.
func DecodePublicKey(encoded string) (ed25519.PublicKey, error) {
	keyBytes, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, err
	}
	if len(keyBytes) != ed25519.PublicKeySize {
		return nil, ErrEd25519InvalidKey
	}
	return ed25519.PublicKey(keyBytes), nil
}

// JWTClaims represents JWT claims for Ed25519-signed tokens.
type JWTClaims struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	Approved bool   `json:"approved"`
	jwt.RegisteredClaims
}

// GenerateEd25519JWT generates a JWT token signed with Ed25519.
// Ed25519 signatures are:
// - Faster than RSA (especially verification)
// - Smaller than RSA (64 bytes vs 256+ bytes)
// - More secure than HMAC (public key cryptography)
// - Post-quantum resistant (compared to RSA/ECC)
func GenerateEd25519JWT(userID uint, username string, role string, approved bool, privateKey ed25519.PrivateKey, expiryHours int) (string, error) {
	expirationTime := time.Now().Add(time.Duration(expiryHours) * time.Hour)
	claims := &JWTClaims{
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

	// Use Ed25519 signing method (EdDSA)
	token := jwt.NewWithClaims(jwt.SigningMethodEdDSA, claims)
	
	// Sign with Ed25519 private key
	tokenString, err := token.SignedString(privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return tokenString, nil
}

// ValidateEd25519JWT validates a JWT token signed with Ed25519.
func ValidateEd25519JWT(tokenString string, publicKey ed25519.PublicKey) (*JWTClaims, error) {
	claims := &JWTClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method is EdDSA (Ed25519)
		if token.Method != jwt.SigningMethodEdDSA {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return publicKey, nil
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

// Errors
var (
	ErrTokenExpired = errors.New("token expired")
	ErrInvalidToken = errors.New("invalid token")
)

