package crypto

import (
	"testing"
)

// Note: SetHardwareSecurityConfig is in hardware package, not crypto package
// This test is skipped as it's not in this package

func TestChaCha20Poly1305Encrypt_Decrypt(t *testing.T) {
	plaintext := []byte("test message for encryption")
	key := make([]byte, 32) // 256-bit key
	copy(key, []byte("test-key-32-bytes-long-key!!"))

	// Encrypt (nonce is generated internally)
	ciphertext, err := ChaCha20Poly1305Encrypt(plaintext, key)
	if err != nil {
		t.Fatalf("ChaCha20Poly1305Encrypt failed: %v", err)
	}

	if len(ciphertext) == 0 {
		t.Error("ChaCha20Poly1305Encrypt returned empty ciphertext")
	}

	// Decrypt
	decrypted, err := ChaCha20Poly1305Decrypt(ciphertext, key)
	if err != nil {
		t.Fatalf("ChaCha20Poly1305Decrypt failed: %v", err)
	}

	if string(decrypted) != string(plaintext) {
		t.Errorf("Decrypted text = %q, want %q", string(decrypted), string(plaintext))
	}
}

func TestChaCha20Poly1305Encrypt_InvalidKey(t *testing.T) {
	plaintext := []byte("test message")
	key := make([]byte, 16) // Wrong key size (should be 32)

	_, err := ChaCha20Poly1305Encrypt(plaintext, key)
	if err == nil {
		t.Error("ChaCha20Poly1305Encrypt should fail with invalid key size")
	}
}

func TestChaCha20Poly1305Decrypt_InvalidKey(t *testing.T) {
	ciphertext := []byte("test ciphertext")
	key := make([]byte, 16) // Wrong key size (should be 32)

	_, err := ChaCha20Poly1305Decrypt(ciphertext, key)
	if err == nil {
		t.Error("ChaCha20Poly1305Decrypt should fail with invalid key size")
	}
}

func TestChaCha20Poly1305Decrypt_InvalidCiphertext(t *testing.T) {
	plaintext := []byte("test message")
	key := make([]byte, 32)
	copy(key, []byte("test-key-32-bytes-long-key!!"))

	ciphertext, err := ChaCha20Poly1305Encrypt(plaintext, key)
	if err != nil {
		t.Fatalf("ChaCha20Poly1305Encrypt failed: %v", err)
	}

	// Try to decrypt with corrupted ciphertext
	corruptedCiphertext := make([]byte, len(ciphertext))
	copy(corruptedCiphertext, ciphertext)
	corruptedCiphertext[0] ^= 0xFF // Corrupt first byte

	_, err = ChaCha20Poly1305Decrypt(corruptedCiphertext, key)
	if err == nil {
		t.Error("ChaCha20Poly1305Decrypt should fail with corrupted ciphertext")
	}
}

func TestAES256GCMEncrypt_Decrypt(t *testing.T) {
	plaintext := []byte("test message for AES encryption")
	key := make([]byte, 32) // 256-bit key
	copy(key, []byte("test-key-32-bytes-long-key!!"))

	// Encrypt (nonce is generated internally)
	ciphertext, err := AES256GCMEncrypt(plaintext, key)
	if err != nil {
		t.Fatalf("AES256GCMEncrypt failed: %v", err)
	}

	if len(ciphertext) == 0 {
		t.Error("AES256GCMEncrypt returned empty ciphertext")
	}

	// Decrypt
	decrypted, err := AES256GCMDecrypt(ciphertext, key)
	if err != nil {
		t.Fatalf("AES256GCMDecrypt failed: %v", err)
	}

	if string(decrypted) != string(plaintext) {
		t.Errorf("Decrypted text = %q, want %q", string(decrypted), string(plaintext))
	}
}

func TestAES256GCMEncrypt_InvalidKey(t *testing.T) {
	plaintext := []byte("test message")
	key := make([]byte, 16) // Wrong key size (should be 32)

	_, err := AES256GCMEncrypt(plaintext, key)
	if err == nil {
		t.Error("AES256GCMEncrypt should fail with invalid key size")
	}
}

func TestAES256GCMDecrypt_InvalidKey(t *testing.T) {
	ciphertext := []byte("test ciphertext")
	key := make([]byte, 16) // Wrong key size (should be 32)

	_, err := AES256GCMDecrypt(ciphertext, key)
	if err == nil {
		t.Error("AES256GCMDecrypt should fail with invalid key size")
	}
}

func TestAES256GCMDecrypt_InvalidCiphertext(t *testing.T) {
	plaintext := []byte("test message")
	key := make([]byte, 32)
	copy(key, []byte("test-key-32-bytes-long-key!!"))

	ciphertext, err := AES256GCMEncrypt(plaintext, key)
	if err != nil {
		t.Fatalf("AES256GCMEncrypt failed: %v", err)
	}

	// Try to decrypt with corrupted ciphertext
	corruptedCiphertext := make([]byte, len(ciphertext))
	copy(corruptedCiphertext, ciphertext)
	corruptedCiphertext[0] ^= 0xFF // Corrupt first byte

	_, err = AES256GCMDecrypt(corruptedCiphertext, key)
	if err == nil {
		t.Error("AES256GCMDecrypt should fail with corrupted ciphertext")
	}
}

func TestHashPasswordWithConfig_DifferentConfigs(t *testing.T) {
	password := "test-password-123"

	// Test with default config
	defaultConfig := DefaultArgon2idConfig()
	hash1, err := HashPasswordWithConfig(password, defaultConfig)
	if err != nil {
		t.Fatalf("HashPasswordWithConfig failed: %v", err)
	}

	// Test with different config
	customConfig := Argon2idConfig{
		Memory:      64 * 1024,
		Iterations:  3,
		Parallelism: 2,
		KeyLength:   32,
		SaltLength:  16,
	}
	hash2, err := HashPasswordWithConfig(password, customConfig)
	if err != nil {
		t.Fatalf("HashPasswordWithConfig failed: %v", err)
	}

	// Hashes should be different (different salts)
	if hash1 == hash2 {
		t.Error("HashPasswordWithConfig should produce different hashes with different configs")
	}

	// Both should verify correctly
	if !CheckPassword(password, hash1) {
		t.Error("CheckPassword should verify hash1")
	}
	if !CheckPassword(password, hash2) {
		t.Error("CheckPassword should verify hash2")
	}
}

func TestCheckPassword_InvalidHash(t *testing.T) {
	password := "test-password-123"
	invalidHash := "invalid-hash-format"

	if CheckPassword(password, invalidHash) {
		t.Error("CheckPassword should fail with invalid hash")
	}
}

func TestCheckPassword_WrongPassword(t *testing.T) {
	password := "test-password-123"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}

	wrongPassword := "wrong-password"
	if CheckPassword(wrongPassword, hash) {
		t.Error("CheckPassword should fail with wrong password")
	}
}
