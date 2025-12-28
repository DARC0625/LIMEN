// Package crypto provides advanced cryptographic functions.
// Uses state-of-the-art, experimental, and future-proof encryption techniques.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/chacha20poly1305"
	"golang.org/x/crypto/hkdf"
)

var (
	ErrInvalidKeyLength = errors.New("invalid key length")
	ErrDecryptionFailed = errors.New("decryption failed")
)

// Argon2idConfig holds configuration for Argon2id hashing.
// These parameters are optimized for security and performance.
type Argon2idConfig struct {
	Memory      uint32 // Memory cost in KB (64MB = 65536)
	Iterations uint32 // Number of iterations (3 is recommended)
	Parallelism uint8  // Number of threads (4 is recommended)
	SaltLength  int    // Salt length in bytes (16 is recommended)
	KeyLength   uint32 // Output key length in bytes (32 for 256-bit)
}

// DefaultArgon2idConfig returns a secure default configuration.
// Memory: 64MB, Iterations: 3, Parallelism: 4
// This provides excellent security while maintaining good performance.
// Note: Use GetOptimalArgon2idConfig() to get hardware-optimized configuration.
func DefaultArgon2idConfig() Argon2idConfig {
	return Argon2idConfig{
		Memory:      65536, // 64MB - memory-hard, GPU resistant
		Iterations:  3,     // Recommended by RFC 9106
		Parallelism: 4,     // Optimal for most systems
		SaltLength:  16,    // 128-bit salt
		KeyLength:   32,    // 256-bit key
	}
}

// GetOptimalArgon2idConfig returns hardware-optimized Argon2id configuration.
// This function should be called after hardware detection is initialized.
// Falls back to DefaultArgon2idConfig() if hardware detection is not available.
func GetOptimalArgon2idConfig() Argon2idConfig {
	// Try to get hardware-optimized config
	// If hardware detection is not available, use default
	if getHardwareSecurityConfig != nil {
		if secConfig := getHardwareSecurityConfig(); secConfig != nil {
			return secConfig.Argon2idConfig
		}
	}
	return DefaultArgon2idConfig()
}

// getHardwareSecurityConfig is a helper to avoid circular dependency.
// It will be set by the hardware package during initialization.
var getHardwareSecurityConfig func() *SecurityConfigFromHardware

// SecurityConfigFromHardware is a simplified version to avoid circular dependency.
type SecurityConfigFromHardware struct {
	Argon2idConfig Argon2idConfig
}

// SetHardwareSecurityConfig sets the function to get hardware-optimized config.
func SetHardwareSecurityConfig(fn func() *SecurityConfigFromHardware) {
	getHardwareSecurityConfig = fn
}

// HashPassword hashes a password using Argon2id.
// Argon2id is the winner of the Password Hashing Competition (PHC)
// and provides superior security compared to bcrypt/scrypt.
// It's memory-hard and GPU-resistant, making it ideal for password hashing.
func HashPassword(password string) (string, error) {
	return HashPasswordWithConfig(password, DefaultArgon2idConfig())
}

// HashPasswordWithConfig hashes a password with custom Argon2id configuration.
func HashPasswordWithConfig(password string, config Argon2idConfig) (string, error) {
	// Generate random salt
	salt := make([]byte, config.SaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	// Hash password using Argon2id
	hash := argon2.IDKey([]byte(password), salt, config.Iterations, config.Memory, config.Parallelism, config.KeyLength)

	// Encode: base64(salt) + ":" + base64(hash)
	encodedSalt := base64.RawStdEncoding.EncodeToString(salt)
	encodedHash := base64.RawStdEncoding.EncodeToString(hash)

	return "argon2id$" + encodedSalt + "$" + encodedHash, nil
}

// CheckPassword verifies a password against an Argon2id hash.
func CheckPassword(password, hash string) bool {
	// Parse hash format: "argon2id$salt$hash"
	parts := splitHash(hash)
	if len(parts) != 3 || parts[0] != "argon2id" {
		// Fallback to bcrypt for backward compatibility
		return checkBcryptPassword(password, hash)
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[1])
	if err != nil {
		return false
	}

	storedHash, err := base64.RawStdEncoding.DecodeString(parts[2])
	if err != nil {
		return false
	}

	// Use default config for verification (stored hash length determines key length)
	config := DefaultArgon2idConfig()
	config.KeyLength = uint32(len(storedHash))

	// Compute hash and compare
	computedHash := argon2.IDKey([]byte(password), salt, config.Iterations, config.Memory, config.Parallelism, config.KeyLength)

	return constantTimeCompare(computedHash, storedHash)
}

// ChaCha20Poly1305Encrypt encrypts data using ChaCha20-Poly1305.
// ChaCha20-Poly1305 is faster than AES-GCM on systems without AES hardware acceleration
// and provides the same security level (256-bit key, 128-bit authentication tag).
func ChaCha20Poly1305Encrypt(plaintext []byte, key []byte) ([]byte, error) {
	if len(key) != chacha20poly1305.KeySize {
		return nil, ErrInvalidKeyLength
	}

	aead, err := chacha20poly1305.New(key)
	if err != nil {
		return nil, err
	}

	// Generate random nonce
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}

	// Encrypt and authenticate
	ciphertext := aead.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

// ChaCha20Poly1305Decrypt decrypts data using ChaCha20-Poly1305.
func ChaCha20Poly1305Decrypt(ciphertext []byte, key []byte) ([]byte, error) {
	if len(key) != chacha20poly1305.KeySize {
		return nil, ErrInvalidKeyLength
	}

	aead, err := chacha20poly1305.New(key)
	if err != nil {
		return nil, err
	}

	nonceSize := aead.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, ErrDecryptionFailed
	}

	// Extract nonce and ciphertext
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	// Decrypt and verify
	plaintext, err := aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, ErrDecryptionFailed
	}

	return plaintext, nil
}

// AES256GCMEncrypt encrypts data using AES-256-GCM.
// AES-GCM is the standard authenticated encryption mode.
func AES256GCMEncrypt(plaintext []byte, key []byte) ([]byte, error) {
	if len(key) != 32 { // AES-256 requires 32-byte key
		return nil, ErrInvalidKeyLength
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	// Generate random nonce
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}

	// Encrypt and authenticate
	ciphertext := aead.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

// AES256GCMDecrypt decrypts data using AES-256-GCM.
func AES256GCMDecrypt(ciphertext []byte, key []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, ErrInvalidKeyLength
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := aead.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, ErrDecryptionFailed
	}

	// Extract nonce and ciphertext
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	// Decrypt and verify
	plaintext, err := aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, ErrDecryptionFailed
	}

	return plaintext, nil
}

// DeriveKey derives a cryptographic key using HKDF-SHA256.
// HKDF (HMAC-based Key Derivation Function) is the standard for key derivation.
func DeriveKey(secret []byte, salt []byte, info []byte, length int) ([]byte, error) {
	hkdf := hkdf.New(sha256.New, secret, salt, info)
	key := make([]byte, length)
	if _, err := io.ReadFull(hkdf, key); err != nil {
		return nil, err
	}
	return key, nil
}

// GenerateSecureRandom generates cryptographically secure random bytes.
func GenerateSecureRandom(length int) ([]byte, error) {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return nil, err
	}
	return b, nil
}

// Helper functions

func splitHash(hash string) []string {
	parts := make([]string, 0, 3)
	current := ""
	for _, char := range hash {
		if char == '$' {
			if current != "" {
				parts = append(parts, current)
				current = ""
			}
		} else {
			current += string(char)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	return parts
}

// constantTimeCompare performs a constant-time comparison to prevent timing attacks.
func constantTimeCompare(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	result := byte(0)
	for i := 0; i < len(a); i++ {
		result |= a[i] ^ b[i]
	}
	return result == 0
}

// checkBcryptPassword provides backward compatibility with bcrypt hashes.
func checkBcryptPassword(password, hash string) bool {
	// This will be implemented if needed for migration
	// For now, return false to force migration to Argon2id
	return false
}

