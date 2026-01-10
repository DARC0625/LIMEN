package auth

import (
	"testing"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
)

func init() {
	// Initialize logger for tests
	if err := logger.Init("debug"); err != nil {
		panic(err)
	}
}

func TestGetSessionStore(t *testing.T) {
	store1 := GetSessionStore()
	store2 := GetSessionStore()

	if store1 != store2 {
		t.Error("GetSessionStore() should return the same instance (singleton)")
	}
}

func TestNewSessionStore(t *testing.T) {
	store := NewSessionStore()

	if store == nil {
		t.Fatal("NewSessionStore() returned nil")
	}

	if store.sessions == nil {
		t.Error("NewSessionStore() sessions map is nil")
	}

	// Cleanup
	store.Stop()
}

func TestGenerateSessionID(t *testing.T) {
	id1, err := GenerateSessionID()
	if err != nil {
		t.Fatalf("GenerateSessionID() error = %v", err)
	}

	if id1 == "" {
		t.Error("GenerateSessionID() returned empty ID")
	}

	// Generate another ID and verify uniqueness
	id2, err := GenerateSessionID()
	if err != nil {
		t.Fatalf("GenerateSessionID() error = %v", err)
	}

	if id1 == id2 {
		t.Error("GenerateSessionID() returned duplicate IDs")
	}
}

func TestCreateSession(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	accessToken := "access-token"
	refreshToken := "refresh-token"
	tokenID := "token-id"
	csrfToken := "csrf-token"
	userID := uint(1)
	username := "testuser"
	role := "user"
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	session, err := store.CreateSession(accessToken, refreshToken, tokenID, csrfToken, userID, username, role, expiresAt)
	if err != nil {
		t.Fatalf("CreateSession() error = %v", err)
	}

	if session == nil {
		t.Fatal("CreateSession() returned nil session")
	}

	if session.ID == "" {
		t.Error("CreateSession() session ID is empty")
	}

	if session.AccessToken != accessToken {
		t.Errorf("CreateSession() AccessToken = %v, want %v", session.AccessToken, accessToken)
	}

	if session.RefreshToken != refreshToken {
		t.Errorf("CreateSession() RefreshToken = %v, want %v", session.RefreshToken, refreshToken)
	}

	if session.TokenID != tokenID {
		t.Errorf("CreateSession() TokenID = %v, want %v", session.TokenID, tokenID)
	}

	if session.CSRFToken != csrfToken {
		t.Errorf("CreateSession() CSRFToken = %v, want %v", session.CSRFToken, csrfToken)
	}

	if session.UserID != userID {
		t.Errorf("CreateSession() UserID = %v, want %v", session.UserID, userID)
	}

	if session.Username != username {
		t.Errorf("CreateSession() Username = %v, want %v", session.Username, username)
	}

	if session.Role != role {
		t.Errorf("CreateSession() Role = %v, want %v", session.Role, role)
	}
}

func TestGetSessionByRefreshToken(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	refreshToken := "refresh-token-123"
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	session, err := store.CreateSession("access", refreshToken, "token-id", "csrf", 1, "user", "user", expiresAt)
	if err != nil {
		t.Fatalf("CreateSession() error = %v", err)
	}

	// Get session by refresh token
	found, exists := store.GetSessionByRefreshToken(refreshToken)
	if !exists {
		t.Error("GetSessionByRefreshToken() session not found")
	}

	if found.ID != session.ID {
		t.Errorf("GetSessionByRefreshToken() session ID = %v, want %v", found.ID, session.ID)
	}

	// Test non-existent token
	_, exists = store.GetSessionByRefreshToken("non-existent")
	if exists {
		t.Error("GetSessionByRefreshToken() should return false for non-existent token")
	}

	// Test expired session
	expiredSession, err := store.CreateSession("access", "expired-token", "token-id", "csrf", 1, "user", "user", time.Now().Add(-1*time.Hour))
	if err != nil {
		t.Fatalf("CreateSession() error = %v", err)
	}

	_, exists = store.GetSessionByRefreshToken(expiredSession.RefreshToken)
	if exists {
		t.Error("GetSessionByRefreshToken() should return false for expired session")
	}
}

func TestGetSessionByTokenID(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	tokenID := "token-id-123"
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	session, err := store.CreateSession("access", "refresh", tokenID, "csrf", 1, "user", "user", expiresAt)
	if err != nil {
		t.Fatalf("CreateSession() error = %v", err)
	}

	// Get session by token ID
	found, exists := store.GetSessionByTokenID(tokenID)
	if !exists {
		t.Error("GetSessionByTokenID() session not found")
	}

	if found.ID != session.ID {
		t.Errorf("GetSessionByTokenID() session ID = %v, want %v", found.ID, session.ID)
	}

	// Test non-existent token ID
	_, exists = store.GetSessionByTokenID("non-existent")
	if exists {
		t.Error("GetSessionByTokenID() should return false for non-existent token ID")
	}
}

func TestUpdateSessionTokens(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	session, err := store.CreateSession("old-access", "old-refresh", "old-token-id", "csrf", 1, "user", "user", time.Now().Add(7*24*time.Hour))
	if err != nil {
		t.Fatalf("CreateSession() error = %v", err)
	}

	newAccessToken := "new-access"
	newRefreshToken := "new-refresh"
	newTokenID := "new-token-id"

	err = store.UpdateSessionTokens(session.ID, newAccessToken, newRefreshToken, newTokenID)
	if err != nil {
		t.Fatalf("UpdateSessionTokens() error = %v", err)
	}

	// Verify update
	updated, exists := store.GetSession(session.ID)
	if !exists {
		t.Fatal("GetSession() session not found after update")
	}

	if updated.AccessToken != newAccessToken {
		t.Errorf("UpdateSessionTokens() AccessToken = %v, want %v", updated.AccessToken, newAccessToken)
	}

	if updated.RefreshToken != newRefreshToken {
		t.Errorf("UpdateSessionTokens() RefreshToken = %v, want %v", updated.RefreshToken, newRefreshToken)
	}

	if updated.TokenID != newTokenID {
		t.Errorf("UpdateSessionTokens() TokenID = %v, want %v", updated.TokenID, newTokenID)
	}

	// Test update without refresh token (only access token)
	err = store.UpdateSessionTokens(session.ID, "another-access", "", "")
	if err != nil {
		t.Fatalf("UpdateSessionTokens() error = %v", err)
	}

	updated, _ = store.GetSession(session.ID)
	if updated.AccessToken != "another-access" {
		t.Errorf("UpdateSessionTokens() AccessToken = %v, want another-access", updated.AccessToken)
	}

	// Refresh token should remain unchanged
	if updated.RefreshToken != newRefreshToken {
		t.Errorf("UpdateSessionTokens() RefreshToken should remain unchanged, got %v", updated.RefreshToken)
	}

	// Test non-existent session
	err = store.UpdateSessionTokens("non-existent", "token", "", "")
	if err == nil {
		t.Error("UpdateSessionTokens() should return error for non-existent session")
	}
}

func TestValidateCSRFToken(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	csrfToken := "csrf-token-123"
	session, err := store.CreateSession("access", "refresh", "token-id", csrfToken, 1, "user", "user", time.Now().Add(7*24*time.Hour))
	if err != nil {
		t.Fatalf("CreateSession() error = %v", err)
	}

	// Valid CSRF token
	if !store.ValidateCSRFToken(session.ID, csrfToken) {
		t.Error("ValidateCSRFToken() should return true for valid token")
	}

	// Invalid CSRF token
	if store.ValidateCSRFToken(session.ID, "wrong-csrf") {
		t.Error("ValidateCSRFToken() should return false for invalid token")
	}

	// Non-existent session
	if store.ValidateCSRFToken("non-existent", csrfToken) {
		t.Error("ValidateCSRFToken() should return false for non-existent session")
	}
}

func TestGetSession(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	session, err := store.CreateSession("access", "refresh", "token-id", "csrf", 1, "user", "user", time.Now().Add(7*24*time.Hour))
	if err != nil {
		t.Fatalf("CreateSession() error = %v", err)
	}

	// Get existing session
	found, exists := store.GetSession(session.ID)
	if !exists {
		t.Error("GetSession() session not found")
	}

	if found.ID != session.ID {
		t.Errorf("GetSession() session ID = %v, want %v", found.ID, session.ID)
	}

	// Test non-existent session
	_, exists = store.GetSession("non-existent")
	if exists {
		t.Error("GetSession() should return false for non-existent session")
	}

	// Test expired session
	expiredSession, err := store.CreateSession("access", "refresh", "token-id", "csrf", 1, "user", "user", time.Now().Add(-1*time.Hour))
	if err != nil {
		t.Fatalf("CreateSession() error = %v", err)
	}

	_, exists = store.GetSession(expiredSession.ID)
	if exists {
		t.Error("GetSession() should return false for expired session")
	}
}

func TestGetSessionByRefreshTokenCookie(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	refreshToken := "refresh-token-123"
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	session, err := store.CreateSession("access", refreshToken, "token-id", "csrf", 1, "user", "user", expiresAt)
	if err != nil {
		t.Fatalf("CreateSession() error = %v", err)
	}

	// Get session by refresh token cookie (same as GetSessionByRefreshToken)
	found, exists := store.GetSessionByRefreshTokenCookie(refreshToken)
	if !exists {
		t.Error("GetSessionByRefreshTokenCookie() session not found")
	}

	if found.ID != session.ID {
		t.Errorf("GetSessionByRefreshTokenCookie() session ID = %v, want %v", found.ID, session.ID)
	}
}

func TestDeleteSession(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	session, err := store.CreateSession("access", "refresh", "token-id", "csrf", 1, "user", "user", time.Now().Add(7*24*time.Hour))
	if err != nil {
		t.Fatalf("CreateSession() error = %v", err)
	}

	// Delete session
	store.DeleteSession(session.ID)

	// Verify deletion
	_, exists := store.GetSession(session.ID)
	if exists {
		t.Error("DeleteSession() session should be deleted")
	}

	// Delete non-existent session (should not panic)
	store.DeleteSession("non-existent")
}
