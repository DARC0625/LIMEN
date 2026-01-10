package auth

import (
	"testing"
	"time"
)

func TestGenerateSessionID_Extended(t *testing.T) {
	// Test that session IDs are unique
	sessionID1, err1 := GenerateSessionID()
	if err1 != nil {
		t.Fatalf("GenerateSessionID failed: %v", err1)
	}

	sessionID2, err2 := GenerateSessionID()
	if err2 != nil {
		t.Fatalf("GenerateSessionID failed: %v", err2)
	}

	if sessionID1 == "" {
		t.Error("GenerateSessionID returned empty string")
	}

	if sessionID2 == "" {
		t.Error("GenerateSessionID returned empty string")
	}

	if sessionID1 == sessionID2 {
		t.Error("GenerateSessionID should generate unique IDs")
	}

	// Test that session IDs have reasonable length
	if len(sessionID1) < 20 {
		t.Errorf("Session ID too short: %d characters", len(sessionID1))
	}
}

func TestCreateSession_WithAllFields(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	session, err := store.CreateSession("access-token", "refresh-token", "token-id", "csrf-token", 1, "testuser", "user", expiresAt)
	if err != nil {
		t.Fatalf("CreateSession failed: %v", err)
	}

	if session == nil {
		t.Fatal("CreateSession returned nil session")
	}

	if session.UserID != 1 {
		t.Errorf("Expected UserID 1, got %d", session.UserID)
	}

	if session.Username != "testuser" {
		t.Errorf("Expected Username 'testuser', got %s", session.Username)
	}

	if session.RefreshToken != "refresh-token" {
		t.Errorf("Expected RefreshToken 'refresh-token', got %s", session.RefreshToken)
	}

	if session.TokenID != "token-id" {
		t.Errorf("Expected TokenID 'token-id', got %s", session.TokenID)
	}

	if session.CSRFToken != "csrf-token" {
		t.Errorf("Expected CSRFToken 'csrf-token', got %s", session.CSRFToken)
	}
}

func TestGetSessionByRefreshToken_NotFound(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	_, exists := store.GetSessionByRefreshToken("non-existent-token")
	if exists {
		t.Error("GetSessionByRefreshToken should return false for non-existent token")
	}
}

func TestGetSessionByTokenID_NotFound(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	_, exists := store.GetSessionByTokenID("non-existent-token-id")
	if exists {
		t.Error("GetSessionByTokenID should return false for non-existent token ID")
	}
}

func TestGetSessionByRefreshToken_MultipleSessions(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	// Create multiple sessions
	session1, _ := store.CreateSession("access-1", "refresh-token-1", "token-id-1", "csrf-1", 1, "user1", "user", expiresAt)
	session2, _ := store.CreateSession("access-2", "refresh-token-2", "token-id-2", "csrf-2", 2, "user2", "user", expiresAt)

	// Retrieve sessions
	found1, exists1 := store.GetSessionByRefreshToken("refresh-token-1")
	if !exists1 {
		t.Error("GetSessionByRefreshToken should find session1")
	}
	if found1.UserID != session1.UserID {
		t.Errorf("Expected UserID %d, got %d", session1.UserID, found1.UserID)
	}

	found2, exists2 := store.GetSessionByRefreshToken("refresh-token-2")
	if !exists2 {
		t.Error("GetSessionByRefreshToken should find session2")
	}
	if found2.UserID != session2.UserID {
		t.Errorf("Expected UserID %d, got %d", session2.UserID, found2.UserID)
	}
}

func TestGetSessionByTokenID_MultipleSessions(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	// Create multiple sessions
	session1, _ := store.CreateSession("access-1", "refresh-token-1", "token-id-1", "csrf-1", 1, "user1", "user", expiresAt)
	session2, _ := store.CreateSession("access-2", "refresh-token-2", "token-id-2", "csrf-2", 2, "user2", "user", expiresAt)

	// Retrieve sessions by token ID
	found1, exists1 := store.GetSessionByTokenID("token-id-1")
	if !exists1 {
		t.Error("GetSessionByTokenID should find session1")
	}
	if found1.UserID != session1.UserID {
		t.Errorf("Expected UserID %d, got %d", session1.UserID, found1.UserID)
	}

	found2, exists2 := store.GetSessionByTokenID("token-id-2")
	if !exists2 {
		t.Error("GetSessionByTokenID should find session2")
	}
	if found2.UserID != session2.UserID {
		t.Errorf("Expected UserID %d, got %d", session2.UserID, found2.UserID)
	}
}

func TestUpdateSessionTokens_Extended(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	session, _ := store.CreateSession("access", "old-refresh", "old-token-id", "csrf", 1, "testuser", "user", expiresAt)

	// Update tokens
	err := store.UpdateSessionTokens(session.ID, "new-access", "new-refresh", "new-token-id")
	if err != nil {
		t.Fatalf("UpdateSessionTokens failed: %v", err)
	}

	// Verify update
	updated, exists := store.GetSession(session.ID)
	if !exists {
		t.Fatal("Session should still exist after update")
	}

	if updated.RefreshToken != "new-refresh" {
		t.Errorf("Expected RefreshToken 'new-refresh', got %s", updated.RefreshToken)
	}

	if updated.TokenID != "new-token-id" {
		t.Errorf("Expected TokenID 'new-token-id', got %s", updated.TokenID)
	}
}

func TestUpdateSessionTokens_NotFound(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	err := store.UpdateSessionTokens("non-existent-session-id", "new-access", "new-refresh", "new-token-id")
	if err == nil {
		t.Error("UpdateSessionTokens should fail for non-existent session")
	}
}

func TestValidateCSRFToken_Extended(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	session, _ := store.CreateSession("access", "refresh-token", "token-id", "csrf-token", 1, "testuser", "user", expiresAt)

	// Valid CSRF token
	valid := store.ValidateCSRFToken(session.ID, "csrf-token")
	if !valid {
		t.Error("ValidateCSRFToken should return true for valid token")
	}

	// Invalid CSRF token
	valid = store.ValidateCSRFToken(session.ID, "wrong-csrf-token")
	if valid {
		t.Error("ValidateCSRFToken should return false for invalid token")
	}

	// Non-existent session
	valid = store.ValidateCSRFToken("non-existent-session-id", "csrf-token")
	if valid {
		t.Error("ValidateCSRFToken should return false for non-existent session")
	}
}

func TestGetSessionByRefreshTokenCookie_Extended(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	session, _ := store.CreateSession("access", "refresh-token", "token-id", "csrf-token", 1, "testuser", "user", expiresAt)

	// Test with valid refresh token
	found, exists := store.GetSessionByRefreshTokenCookie("refresh-token")
	if !exists {
		t.Error("GetSessionByRefreshTokenCookie should find session")
	}
	if found.UserID != session.UserID {
		t.Errorf("Expected UserID %d, got %d", session.UserID, found.UserID)
	}

	// Test with invalid refresh token
	_, exists = store.GetSessionByRefreshTokenCookie("invalid-token")
	if exists {
		t.Error("GetSessionByRefreshTokenCookie should not find session for invalid token")
	}
}

func TestSession_Expiration(t *testing.T) {
	store := NewSessionStore()
	defer store.Stop()

	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	session, _ := store.CreateSession("access", "refresh-token", "token-id", "csrf-token", 1, "testuser", "user", expiresAt)

	// Check that session has expiration time set
	if session.ExpiresAt.IsZero() {
		t.Error("Session should have ExpiresAt set")
	}

	// Check that expiration is in the future
	if session.ExpiresAt.Before(time.Now()) {
		t.Error("Session ExpiresAt should be in the future")
	}
}
