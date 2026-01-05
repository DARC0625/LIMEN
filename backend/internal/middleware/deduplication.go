// Package middleware provides request deduplication to prevent duplicate requests.
package middleware

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// RequestDeduplicator prevents duplicate requests within a time window.
type RequestDeduplicator struct {
	mu              sync.RWMutex
	recentRequests  map[string]time.Time // requestHash -> timestamp
	windowDuration  time.Duration        // Time window for deduplication (default: 5 seconds)
	cleanupInterval time.Duration        // Cleanup interval (default: 1 minute)
}

var (
	deduplicatorInstance *RequestDeduplicator
	deduplicatorOnce     sync.Once
)

// GetRequestDeduplicator returns the singleton request deduplicator.
func GetRequestDeduplicator() *RequestDeduplicator {
	deduplicatorOnce.Do(func() {
		deduplicatorInstance = &RequestDeduplicator{
			recentRequests:  make(map[string]time.Time),
			windowDuration:  5 * time.Second,  // 5 seconds deduplication window
			cleanupInterval: 1 * time.Minute, // Cleanup every minute
		}
		go deduplicatorInstance.cleanupLoop()
	})
	return deduplicatorInstance
}

// Deduplication creates a middleware that prevents duplicate requests.
// It uses request method, path, body hash, and user ID to identify duplicates.
func Deduplication() func(http.Handler) http.Handler {
	dedup := GetRequestDeduplicator()
	
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip deduplication for GET requests (idempotent)
			if r.Method == "GET" || r.Method == "HEAD" || r.Method == "OPTIONS" {
				next.ServeHTTP(w, r)
				return
			}
			
			// Skip deduplication for VM action endpoints (they have their own idempotency checks)
			// VM actions may be retried quickly and should not be blocked
			if strings.HasPrefix(r.URL.Path, "/api/vms/") && strings.HasSuffix(r.URL.Path, "/action") {
				next.ServeHTTP(w, r)
				return
			}

			// Generate request hash
			requestHash, err := generateRequestHash(r)
			if err != nil {
				// If hash generation fails, allow request (fail open)
				next.ServeHTTP(w, r)
				return
			}

			// Check if this request was seen recently
			if dedup.isDuplicate(requestHash) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusConflict)
				w.Write([]byte(`{"error":"duplicate_request","message":"This request was recently processed. Please wait a moment before retrying."}`))
				return
			}

			// Mark request as seen
			dedup.markRequest(requestHash)

			next.ServeHTTP(w, r)
		})
	}
}

// isDuplicate checks if a request hash was seen recently.
func (d *RequestDeduplicator) isDuplicate(hash string) bool {
	d.mu.RLock()
	defer d.mu.RUnlock()

	timestamp, exists := d.recentRequests[hash]
	if !exists {
		return false
	}

	// Check if request is within the deduplication window
	return time.Since(timestamp) < d.windowDuration
}

// markRequest marks a request hash as seen.
func (d *RequestDeduplicator) markRequest(hash string) {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.recentRequests[hash] = time.Now()
}

// cleanupLoop periodically removes old request hashes.
func (d *RequestDeduplicator) cleanupLoop() {
	ticker := time.NewTicker(d.cleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		d.cleanup()
	}
}

// cleanup removes old request hashes.
func (d *RequestDeduplicator) cleanup() {
	d.mu.Lock()
	defer d.mu.Unlock()

	cutoff := time.Now().Add(-d.windowDuration)
	for hash, timestamp := range d.recentRequests {
		if timestamp.Before(cutoff) {
			delete(d.recentRequests, hash)
		}
	}
}

// generateRequestHash generates a hash for a request to identify duplicates.
func generateRequestHash(r *http.Request) (string, error) {
	hasher := sha256.New()

	// Include method and path
	hasher.Write([]byte(r.Method))
	hasher.Write([]byte(r.URL.Path))

	// Include query parameters
	hasher.Write([]byte(r.URL.RawQuery))

	// Include user ID from context if available
	if userID, ok := GetUserID(r.Context()); ok {
		hasher.Write([]byte(fmt.Sprintf("user:%d", userID)))
	}

	// Include request body (for POST/PUT/PATCH)
	if r.Body != nil {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			return "", err
		}
		hasher.Write(body)
		// Restore body for handler
		r.Body = io.NopCloser(bytes.NewReader(body))
	}

	hash := hasher.Sum(nil)
	return hex.EncodeToString(hash), nil
}

