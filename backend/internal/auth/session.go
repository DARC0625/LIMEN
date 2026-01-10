// Package auth provides session management functionality.
package auth

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"sync"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"go.uber.org/zap"
)

// Session represents a user session.
type Session struct {
	ID           string
	AccessToken  string // Short-lived access token (15 minutes)
	RefreshToken string // Long-lived refresh token (7 days)
	TokenID      string // Unique token ID for refresh token rotation
	CSRFToken    string // CSRF token for state-changing requests
	UserID       uint
	Username     string
	Role         string
	ExpiresAt    time.Time // Refresh token expiry
}

// SessionStore manages sessions in memory.
// In production, consider using Redis for distributed systems.
type SessionStore struct {
	sessions map[string]*Session
	mu       sync.RWMutex
	// Cleanup goroutine
	stopCleanup chan struct{}
}

var (
	globalSessionStore *SessionStore
	sessionStoreOnce   sync.Once
)

// GetSessionStore returns the global session store (singleton).
func GetSessionStore() *SessionStore {
	sessionStoreOnce.Do(func() {
		globalSessionStore = NewSessionStore()
	})
	return globalSessionStore
}

// NewSessionStore creates a new session store.
func NewSessionStore() *SessionStore {
	store := &SessionStore{
		sessions:    make(map[string]*Session),
		stopCleanup: make(chan struct{}),
	}
	// No periodic cleanup - cleanup happens on-demand when sessions are accessed
	return store
}

// GenerateSessionID generates a secure random session ID.
func GenerateSessionID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate session ID: %w", err)
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// CreateSession creates a new session with access token, refresh token, and CSRF token.
func (s *SessionStore) CreateSession(accessToken, refreshToken, tokenID, csrfToken string, userID uint, username, role string, expiresAt time.Time) (*Session, error) {
	sessionID, err := GenerateSessionID()
	if err != nil {
		return nil, err
	}

	session := &Session{
		ID:           sessionID,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenID:      tokenID,
		CSRFToken:    csrfToken,
		UserID:       userID,
		Username:     username,
		Role:         role,
		ExpiresAt:    expiresAt,
	}

	s.mu.Lock()
	// Cleanup expired sessions before creating new one (event-driven)
	s.cleanupExpiredSessionsNow()
	s.sessions[sessionID] = session
	s.mu.Unlock()

	logger.Log.Debug("Session created",
		zap.String("session_id", sessionID),
		zap.Uint("user_id", userID),
		zap.String("username", username))

	return session, nil
}

// GetSessionByRefreshToken retrieves a session by refresh token.
func (s *SessionStore) GetSessionByRefreshToken(refreshToken string) (*Session, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Cleanup expired sessions on-demand (event-driven)
	s.cleanupExpiredSessionsNow()

	for _, session := range s.sessions {
		if session.RefreshToken == refreshToken {
			// Check if session is expired
			if time.Now().After(session.ExpiresAt) {
				return nil, false
			}
			return session, true
		}
	}

	return nil, false
}

// GetSessionByTokenID retrieves a session by token ID (for refresh token rotation).
func (s *SessionStore) GetSessionByTokenID(tokenID string) (*Session, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Cleanup expired sessions on-demand (event-driven)
	s.cleanupExpiredSessionsNow()

	for _, session := range s.sessions {
		if session.TokenID == tokenID {
			// Check if session is expired
			if time.Now().After(session.ExpiresAt) {
				return nil, false
			}
			return session, true
		}
	}

	return nil, false
}

// UpdateSessionTokens updates access token and optionally refresh token (rotation).
func (s *SessionStore) UpdateSessionTokens(sessionID, newAccessToken, newRefreshToken, newTokenID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	session, exists := s.sessions[sessionID]
	if !exists {
		return fmt.Errorf("session not found")
	}

	session.AccessToken = newAccessToken
	if newRefreshToken != "" {
		session.RefreshToken = newRefreshToken
		session.TokenID = newTokenID
	}

	return nil
}

// ValidateCSRFToken validates a CSRF token for a session.
func (s *SessionStore) ValidateCSRFToken(sessionID, csrfToken string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, exists := s.sessions[sessionID]
	if !exists {
		return false
	}

	return session.CSRFToken == csrfToken
}

// GetSession retrieves a session by ID.
func (s *SessionStore) GetSession(sessionID string) (*Session, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, exists := s.sessions[sessionID]
	if !exists {
		return nil, false
	}

	// Check if session is expired
	if time.Now().After(session.ExpiresAt) {
		// Delete expired session
		s.mu.RUnlock()
		s.mu.Lock()
		delete(s.sessions, sessionID)
		s.mu.Unlock()
		s.mu.RLock()
		return nil, false
	}

	return session, true
}

// GetSessionByRefreshTokenCookie retrieves a session by refresh token from cookie.
func (s *SessionStore) GetSessionByRefreshTokenCookie(refreshToken string) (*Session, bool) {
	return s.GetSessionByRefreshToken(refreshToken)
}

// DeleteSession deletes a session.
func (s *SessionStore) DeleteSession(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.sessions[sessionID]; exists {
		delete(s.sessions, sessionID)
		logger.Log.Debug("Session deleted", zap.String("session_id", sessionID))
	}
}

// cleanupExpiredSessionsNow removes expired sessions immediately (event-driven).
// Called on-demand when sessions are accessed or created.
func (s *SessionStore) cleanupExpiredSessionsNow() {
	now := time.Now()
	count := 0
	for id, session := range s.sessions {
		if now.After(session.ExpiresAt) {
			delete(s.sessions, id)
			count++
		}
	}
	if count > 0 {
		logger.Log.Debug("Cleaned up expired sessions", zap.Int("count", count))
	}
}

// Stop stops the session store (no-op for event-driven cleanup).
func (s *SessionStore) Stop() {
	// No periodic cleanup goroutine to stop
}
