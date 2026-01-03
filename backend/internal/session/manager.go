// Package session provides console session management with limits and tracking.
package session

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"sync"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/database"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"go.uber.org/zap"
)

// SessionManager manages console sessions with limits and timeouts.
type SessionManager struct {
	mu              sync.RWMutex
	activeSessions  map[string]*ActiveSession // sessionID -> ActiveSession
	userSessions    map[uint][]string          // userID -> []sessionID
	maxIdleDuration time.Duration              // Default: 15 minutes
	maxDuration     time.Duration              // Default: 4 hours
	maxConcurrent   int                        // Default: 2 per user
	reconnectWindow time.Duration              // Default: 30 seconds
}

// ActiveSession represents an active console session.
type ActiveSession struct {
	SessionID      string
	UserID         uint
	VMID           uint
	VMUUID         string
	StartedAt      time.Time
	LastActivityAt time.Time
	ClientIP       string
	UserAgent      string
	ctx            context.Context
	cancel         context.CancelFunc
}

// Context returns the session's context.
func (s *ActiveSession) Context() context.Context {
	return s.ctx
}

var (
	managerInstance *SessionManager
	managerOnce     sync.Once
)

// GetSessionManager returns the singleton session manager instance.
func GetSessionManager() *SessionManager {
	managerOnce.Do(func() {
		managerInstance = &SessionManager{
			activeSessions:  make(map[string]*ActiveSession),
			userSessions:    make(map[uint][]string),
			maxIdleDuration: 15 * time.Minute,  // 15 minutes idle timeout
			maxDuration:     4 * time.Hour,     // 4 hours max duration
			maxConcurrent:   2,                 // 2 concurrent sessions per user
			reconnectWindow: 30 * time.Second,  // 30 seconds reconnect window
		}
		go managerInstance.cleanupLoop()
	})
	return managerInstance
}

// CreateSession creates a new console session with limits enforcement.
func (sm *SessionManager) CreateSession(userID, vmID uint, vmUUID, clientIP, userAgent string) (string, error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	// Check concurrent session limit
	userSessions := sm.userSessions[userID]
	activeCount := 0
	for _, sid := range userSessions {
		if sess, ok := sm.activeSessions[sid]; ok {
			// Check if session is still active (not expired)
			if time.Since(sess.LastActivityAt) < sm.maxIdleDuration &&
				time.Since(sess.StartedAt) < sm.maxDuration {
				activeCount++
			}
		}
	}

	if activeCount >= sm.maxConcurrent {
		return "", fmt.Errorf("maximum concurrent sessions (%d) reached", sm.maxConcurrent)
	}

	// Generate session ID
	sessionID, err := generateSessionID()
	if err != nil {
		return "", fmt.Errorf("failed to generate session ID: %w", err)
	}

	// Create context with cancellation
	ctx, cancel := context.WithCancel(context.Background())

	// Create active session
	sess := &ActiveSession{
		SessionID:      sessionID,
		UserID:         userID,
		VMID:           vmID,
		VMUUID:         vmUUID,
		StartedAt:      time.Now(),
		LastActivityAt: time.Now(),
		ClientIP:       clientIP,
		UserAgent:      userAgent,
		ctx:            ctx,
		cancel:         cancel,
	}

	sm.activeSessions[sessionID] = sess
	sm.userSessions[userID] = append(sm.userSessions[userID], sessionID)

	// Save to database
	dbSession := models.ConsoleSession{
		SessionID:      sessionID,
		UserID:         userID,
		VMID:           vmID,
		VMUUID:         vmUUID,
		StartedAt:      sess.StartedAt,
		LastActivityAt: sess.LastActivityAt,
		ClientIP:       clientIP,
		UserAgent:      userAgent,
	}
	if err := database.DB.Create(&dbSession).Error; err != nil {
		logger.Log.Error("Failed to save session to database", zap.Error(err))
		// Don't fail - session is still active in memory
	}

	logger.Log.Info("Console session created",
		zap.String("session_id", sessionID),
		zap.Uint("user_id", userID),
		zap.Uint("vm_id", vmID),
		zap.String("vm_uuid", vmUUID))

	return sessionID, nil
}

// UpdateActivity updates the last activity time for a session.
func (sm *SessionManager) UpdateActivity(sessionID string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sess, ok := sm.activeSessions[sessionID]
	if !ok {
		return fmt.Errorf("session not found")
	}

	sess.LastActivityAt = time.Now()

	// Update database
	if err := database.DB.Model(&models.ConsoleSession{}).
		Where("session_id = ?", sessionID).
		Update("last_activity_at", sess.LastActivityAt).Error; err != nil {
		logger.Log.Warn("Failed to update session activity in database", zap.Error(err))
	}

	return nil
}

// EndSession ends a console session.
func (sm *SessionManager) EndSession(sessionID, reason string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sess, ok := sm.activeSessions[sessionID]
	if !ok {
		return fmt.Errorf("session not found")
	}

	// Cancel context
	sess.cancel()

	// Remove from active sessions
	delete(sm.activeSessions, sessionID)

	// Remove from user sessions
	userSessions := sm.userSessions[sess.UserID]
	for i, sid := range userSessions {
		if sid == sessionID {
			sm.userSessions[sess.UserID] = append(userSessions[:i], userSessions[i+1:]...)
			break
		}
	}

	// Update database
	now := time.Now()
	if err := database.DB.Model(&models.ConsoleSession{}).
		Where("session_id = ?", sessionID).
		Updates(map[string]interface{}{
			"ended_at":   now,
			"end_reason": reason,
		}).Error; err != nil {
		logger.Log.Warn("Failed to update session end in database", zap.Error(err))
	}

	logger.Log.Info("Console session ended",
		zap.String("session_id", sessionID),
		zap.Uint("user_id", sess.UserID),
		zap.String("reason", reason))

	return nil
}

// GetSession returns an active session by ID.
func (sm *SessionManager) GetSession(sessionID string) (*ActiveSession, bool) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	sess, ok := sm.activeSessions[sessionID]
	return sess, ok
}

// GetUserSessions returns all active sessions for a user.
func (sm *SessionManager) GetUserSessions(userID uint) []*ActiveSession {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	var sessions []*ActiveSession
	for _, sid := range sm.userSessions[userID] {
		if sess, ok := sm.activeSessions[sid]; ok {
			sessions = append(sessions, sess)
		}
	}
	return sessions
}

// cleanupLoop periodically cleans up expired sessions.
func (sm *SessionManager) cleanupLoop() {
	ticker := time.NewTicker(1 * time.Minute) // Check every minute
	defer ticker.Stop()

	for range ticker.C {
		sm.cleanupExpiredSessions()
	}
}

// cleanupExpiredSessions removes expired sessions (idle timeout or max duration).
func (sm *SessionManager) cleanupExpiredSessions() {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	now := time.Now()
	var expired []string

	for sid, sess := range sm.activeSessions {
		// Check idle timeout
		if now.Sub(sess.LastActivityAt) > sm.maxIdleDuration {
			expired = append(expired, sid)
			logger.Log.Info("Session expired due to idle timeout",
				zap.String("session_id", sid),
				zap.Duration("idle_duration", now.Sub(sess.LastActivityAt)))
			continue
		}

		// Check max duration
		if now.Sub(sess.StartedAt) > sm.maxDuration {
			expired = append(expired, sid)
			logger.Log.Info("Session expired due to max duration",
				zap.String("session_id", sid),
				zap.Duration("duration", now.Sub(sess.StartedAt)))
		}
	}

	// End expired sessions
	for _, sid := range expired {
		sess := sm.activeSessions[sid]
		sess.cancel()
		delete(sm.activeSessions, sid)

		// Remove from user sessions
		userSessions := sm.userSessions[sess.UserID]
		for i, s := range userSessions {
			if s == sid {
				sm.userSessions[sess.UserID] = append(userSessions[:i], userSessions[i+1:]...)
				break
			}
		}

		// Update database
		reason := "idle_timeout"
		if time.Since(sess.StartedAt) > sm.maxDuration {
			reason = "max_duration"
		}
		now := time.Now()
		if err := database.DB.Model(&models.ConsoleSession{}).
			Where("session_id = ?", sid).
			Updates(map[string]interface{}{
				"ended_at":   now,
				"end_reason": reason,
			}).Error; err != nil {
			logger.Log.Warn("Failed to update expired session in database", zap.Error(err))
		}
	}
}

// CheckReconnectLimit checks if user is reconnecting too frequently.
func (sm *SessionManager) CheckReconnectLimit(userID uint) error {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	// Get recent sessions for this user (within reconnect window)
	recentCount := 0
	windowStart := time.Now().Add(-sm.reconnectWindow)

	var recentSessions []models.ConsoleSession
	if err := database.DB.Where("user_id = ? AND started_at > ?", userID, windowStart).
		Order("started_at DESC").
		Find(&recentSessions).Error; err == nil {
		recentCount = len(recentSessions)
	}

	// Allow up to 3 reconnects within the window
	if recentCount >= 3 {
		return fmt.Errorf("too many reconnection attempts. Please wait %v", sm.reconnectWindow)
	}

	return nil
}

// generateSessionID generates a unique session ID.
func generateSessionID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

