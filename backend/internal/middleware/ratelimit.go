// Package middleware provides rate limiting middleware.
package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// IPRateLimiter manages rate limiters per IP address.
type IPRateLimiter struct {
	ips        map[string]*rate.Limiter
	lastAccess map[string]time.Time // Track last access time for cleanup
	mu         *sync.RWMutex
	r          rate.Limit
	b          int
}

// NewIPRateLimiter creates a new IP rate limiter.
// r: requests per second, b: burst size
func NewIPRateLimiter(r rate.Limit, b int) *IPRateLimiter {
	return &IPRateLimiter{
		ips:        make(map[string]*rate.Limiter),
		lastAccess: make(map[string]time.Time),
		mu:         &sync.RWMutex{},
		r:          r,
		b:          b,
	}
}

// getLimiter returns the rate limiter for the given IP.
// Event-driven: cleans up expired entries on-demand when accessed.
func (i *IPRateLimiter) getLimiter(ip string) *rate.Limiter {
	i.mu.Lock()
	defer i.mu.Unlock()

	// Cleanup expired entries on-demand (event-driven)
	i.cleanupExpiredNow()

	limiter, exists := i.ips[ip]
	if !exists {
		limiter = rate.NewLimiter(i.r, i.b)
		i.ips[ip] = limiter
	}
	// Update last access time
	i.lastAccess[ip] = time.Now()

	return limiter
}

// cleanupExpiredNow removes old IP entries on-demand (event-driven).
// Removes entries that haven't been accessed in the last hour.
// Called automatically when getLimiter is accessed.
func (i *IPRateLimiter) cleanupExpiredNow() {
	now := time.Now()
	cutoff := now.Add(-1 * time.Hour) // Remove entries older than 1 hour

	// Remove stale entries
	for ip, lastAccess := range i.lastAccess {
		if lastAccess.Before(cutoff) {
			delete(i.ips, ip)
			delete(i.lastAccess, ip)
		}
	}
}

// RateLimitConfig defines rate limit configuration for different endpoint types.
type RateLimitConfig struct {
	DefaultRPS    float64            // Default requests per second
	DefaultBurst  int                // Default burst size
	EndpointRPS   map[string]float64 // Endpoint-specific RPS overrides
	EndpointBurst map[string]int     // Endpoint-specific burst overrides
}

// RateLimit creates a rate limiting middleware.
// requestsPerSecond: maximum requests per second per IP
// burstSize: maximum burst size
func RateLimit(requestsPerSecond float64, burstSize int) func(http.Handler) http.Handler {
	return RateLimitWithConfig(RateLimitConfig{
		DefaultRPS:    requestsPerSecond,
		DefaultBurst:  burstSize,
		EndpointRPS:   make(map[string]float64),
		EndpointBurst: make(map[string]int),
	})
}

// RateLimitWithConfig creates a rate limiting middleware with endpoint-specific configurations.
func RateLimitWithConfig(config RateLimitConfig) func(http.Handler) http.Handler {
	// Create default limiter (event-driven cleanup, no periodic goroutine)
	defaultLimiter := NewIPRateLimiter(rate.Limit(config.DefaultRPS), config.DefaultBurst)

	// Create endpoint-specific limiters (event-driven cleanup, no periodic goroutine)
	endpointLimiters := make(map[string]*IPRateLimiter)
	for path, rps := range config.EndpointRPS {
		burst := config.DefaultBurst
		if b, ok := config.EndpointBurst[path]; ok {
			burst = b
		}
		limiter := NewIPRateLimiter(rate.Limit(rps), burst)
		endpointLimiters[path] = limiter
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip rate limiting for public endpoints (health check, auth)
			if isPublicEndpointForRateLimit(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}

			// Get client IP
			ip := getClientIP(r)

			// Find endpoint-specific limiter or use default
			var limiter *rate.Limiter
			path := r.URL.Path

			// Check for exact path match first
			if endpointLimiter, ok := endpointLimiters[path]; ok {
				limiter = endpointLimiter.getLimiter(ip)
			} else {
				// Check for prefix match (e.g., /api/vms/*)
				matched := false
				for endpointPath, endpointLimiter := range endpointLimiters {
					if strings.HasPrefix(path, endpointPath) {
						limiter = endpointLimiter.getLimiter(ip)
						matched = true
						break
					}
				}
				if !matched {
					// Use default limiter
					limiter = defaultLimiter.getLimiter(ip)
				}
			}

			// Check if request is allowed
			if !limiter.Allow() {
				w.Header().Set("Retry-After", "1")
				http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// isPublicEndpointForRateLimit checks if the endpoint should skip rate limiting.
func isPublicEndpointForRateLimit(path string) bool {
	publicPaths := []string{
		"/api/health",
		"/api/auth/login",
		"/api/auth/register",
	}

	for _, publicPath := range publicPaths {
		if path == publicPath || strings.HasPrefix(path, publicPath+"/") {
			return true
		}
	}

	return false
}

// getClientIP extracts the client IP address from the request.
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (for proxies)
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		return forwarded
	}

	// Check X-Real-IP header
	realIP := r.Header.Get("X-Real-IP")
	if realIP != "" {
		return realIP
	}

	// Fallback to RemoteAddr
	return r.RemoteAddr
}
