package ratelimit

import (
	"sync"
	"time"
)

// IPRateLimiter manages rate limits per IP address.
type IPRateLimiter struct {
	mu              sync.RWMutex
	ipAttempts      map[string][]time.Time // IP -> []attempt timestamps
	cleanupInterval time.Duration
}

var (
	ipRateLimiterInstance *IPRateLimiter
	ipRateLimiterOnce     sync.Once
)

// GetIPRateLimiter returns the singleton instance of IPRateLimiter.
func GetIPRateLimiter() *IPRateLimiter {
	ipRateLimiterOnce.Do(func() {
		ipRateLimiterInstance = &IPRateLimiter{
			ipAttempts:      make(map[string][]time.Time),
			cleanupInterval: 10 * time.Minute, // Cleanup every 10 minutes
		}
		go ipRateLimiterInstance.cleanupLoop()
	})
	return ipRateLimiterInstance
}

// Allow checks if a request from the given IP is allowed within the rate limit.
// maxRequests: maximum number of requests allowed
// window: time window for the rate limit
func (rl *IPRateLimiter) Allow(ip string, maxRequests int, window time.Duration) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-window)

	// Get existing attempts for this IP
	attempts, exists := rl.ipAttempts[ip]
	if !exists {
		attempts = []time.Time{}
	}

	// Remove old attempts outside the window
	validAttempts := []time.Time{}
	for _, attempt := range attempts {
		if attempt.After(cutoff) {
			validAttempts = append(validAttempts, attempt)
		}
	}

	// Check if limit exceeded
	if len(validAttempts) >= maxRequests {
		return false
	}

	// Add current attempt
	validAttempts = append(validAttempts, now)
	rl.ipAttempts[ip] = validAttempts

	return true
}

// cleanupLoop periodically removes old IP attempt records.
func (rl *IPRateLimiter) cleanupLoop() {
	ticker := time.NewTicker(rl.cleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		rl.cleanup()
	}
}

// cleanup removes old IP attempt records.
func (rl *IPRateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-1 * time.Hour) // Remove records older than 1 hour

	for ip, attempts := range rl.ipAttempts {
		validAttempts := []time.Time{}
		for _, attempt := range attempts {
			if attempt.After(cutoff) {
				validAttempts = append(validAttempts, attempt)
			}
		}

		if len(validAttempts) == 0 {
			delete(rl.ipAttempts, ip)
		} else {
			rl.ipAttempts[ip] = validAttempts
		}
	}
}

