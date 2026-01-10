// Package ratelimit provides rate limiting for VM creation requests.
package ratelimit

import (
	"fmt"
	"sync"
	"time"
)

// VMCreationLimiter limits VM creation requests per user.
type VMCreationLimiter struct {
	mu              sync.RWMutex
	userLastRequest map[uint]time.Time // userID -> last request time
	minInterval     time.Duration      // Minimum interval between requests (default: 30 seconds)
}

var (
	vmLimiterInstance *VMCreationLimiter
	vmLimiterOnce     sync.Once
)

// GetVMCreationLimiter returns the singleton VM creation limiter.
func GetVMCreationLimiter() *VMCreationLimiter {
	vmLimiterOnce.Do(func() {
		vmLimiterInstance = &VMCreationLimiter{
			userLastRequest: make(map[uint]time.Time),
			minInterval:     30 * time.Second, // 30 seconds between VM creation requests
		}
	})
	return vmLimiterInstance
}

// CheckRateLimit checks if the user can create a VM now (rate limit check).
// Returns error if rate limit is exceeded.
// DISABLED: Rate limit removed to allow immediate VM creation
func (l *VMCreationLimiter) CheckRateLimit(userID uint) error {
	// Rate limit disabled - allow all requests
	// No cooldown period between VM creations
	return nil
}

// RateLimitError represents a rate limit error.
type RateLimitError struct {
	Message    string
	RetryAfter time.Duration
}

func (e *RateLimitError) Error() string {
	return fmt.Sprintf("%s. Please wait %v before creating another VM.", e.Message, e.RetryAfter.Round(time.Second))
}
