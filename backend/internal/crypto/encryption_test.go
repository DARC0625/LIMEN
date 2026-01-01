package crypto

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
}

func TestCheckPassword(t *testing.T) {
	password := "test-password-123"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}

	// Test correct password
	if !CheckPassword(password, hash) {
		t.Error("CheckPassword() should return true for correct password")
	}

	// Test incorrect password
	if CheckPassword("wrong-password", hash) {
		t.Error("CheckPassword() should return false for incorrect password")
	}
}

func TestHashPasswordWithConfig(t *testing.T) {
	password := "test-password-123"
	config := DefaultArgon2idConfig()
	
	hash, err := HashPasswordWithConfig(password, config)
	if err != nil {
		t.Fatalf("HashPasswordWithConfig() error = %v", err)
	}
	if hash == "" {
		t.Error("HashPasswordWithConfig() returned empty hash")
	}

	// Verify password can be checked
	if !CheckPassword(password, hash) {
		t.Error("CheckPassword() should work with custom config hash")
	}
}

func TestDefaultArgon2idConfig(t *testing.T) {
	config := DefaultArgon2idConfig()
	if config.Memory == 0 {
		t.Error("DefaultArgon2idConfig() Memory should be > 0")
	}
	if config.Iterations == 0 {
		t.Error("DefaultArgon2idConfig() Iterations should be > 0")
	}
	if config.Parallelism == 0 {
		t.Error("DefaultArgon2idConfig() Parallelism should be > 0")
	}
}

func TestGetOptimalArgon2idConfig(t *testing.T) {
	config := GetOptimalArgon2idConfig()
	if config.Memory == 0 {
		t.Error("GetOptimalArgon2idConfig() Memory should be > 0")
	}
	if config.Iterations == 0 {
		t.Error("GetOptimalArgon2idConfig() Iterations should be > 0")
	}
	if config.Parallelism == 0 {
		t.Error("GetOptimalArgon2idConfig() Parallelism should be > 0")
	}
}

func TestGenerateSecureRandom(t *testing.T) {
	random, err := GenerateSecureRandom(32)
	if err != nil {
		t.Fatalf("GenerateSecureRandom() error = %v", err)
	}
	if len(random) != 32 {
		t.Errorf("GenerateSecureRandom() length = %d, want 32", len(random))
	}
}

func TestDeriveKey(t *testing.T) {
	secret := []byte("test-secret")
	salt := []byte("test-salt")
	info := []byte("test-info")
	length := 32

	key, err := DeriveKey(secret, salt, info, length)
	if err != nil {
		t.Fatalf("DeriveKey() error = %v", err)
	}
	if len(key) != length {
		t.Errorf("DeriveKey() length = %d, want %d", len(key), length)
	}
}

func TestChaCha20Poly1305EncryptDecrypt(t *testing.T) {
	plaintext := []byte("test message")
	key := make([]byte, 32) // 32 bytes for ChaCha20-Poly1305
	copy(key, []byte("test-key-32-bytes-long-key!!"))

	ciphertext, err := ChaCha20Poly1305Encrypt(plaintext, key)
	if err != nil {
		t.Fatalf("ChaCha20Poly1305Encrypt() error = %v", err)
	}
	if len(ciphertext) == 0 {
		t.Error("ChaCha20Poly1305Encrypt() returned empty ciphertext")
	}

	decrypted, err := ChaCha20Poly1305Decrypt(ciphertext, key)
	if err != nil {
		t.Fatalf("ChaCha20Poly1305Decrypt() error = %v", err)
	}
	if string(decrypted) != string(plaintext) {
		t.Errorf("ChaCha20Poly1305Decrypt() = %s, want %s", string(decrypted), string(plaintext))
	}
}

func TestAES256GCMEncryptDecrypt(t *testing.T) {
	plaintext := []byte("test message")
	key := make([]byte, 32) // 32 bytes for AES-256
	copy(key, []byte("test-key-32-bytes-long-key!!"))

	ciphertext, err := AES256GCMEncrypt(plaintext, key)
	if err != nil {
		t.Fatalf("AES256GCMEncrypt() error = %v", err)
	}
	if len(ciphertext) == 0 {
		t.Error("AES256GCMEncrypt() returned empty ciphertext")
	}

	decrypted, err := AES256GCMDecrypt(ciphertext, key)
	if err != nil {
		t.Fatalf("AES256GCMDecrypt() error = %v", err)
	}
	if string(decrypted) != string(plaintext) {
		t.Errorf("AES256GCMDecrypt() = %s, want %s", string(decrypted), string(plaintext))
	}
}

