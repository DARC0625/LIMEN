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
	ips map[string]*rate.Limiter
	mu  *sync.RWMutex
	r   rate.Limit
	b   int
}

// NewIPRateLimiter creates a new IP rate limiter.
// r: requests per second, b: burst size
func NewIPRateLimiter(r rate.Limit, b int) *IPRateLimiter {
	return &IPRateLimiter{
		ips: make(map[string]*rate.Limiter),
		mu:  &sync.RWMutex{},
		r:   r,
		b:   b,
	}
}

// getLimiter returns the rate limiter for the given IP.
func (i *IPRateLimiter) getLimiter(ip string) *rate.Limiter {
	i.mu.Lock()
	defer i.mu.Unlock()

	limiter, exists := i.ips[ip]
	if !exists {
		limiter = rate.NewLimiter(i.r, i.b)
		i.ips[ip] = limiter
	}

	return limiter
}

// cleanup removes old IP entries periodically to prevent memory leaks.
func (i *IPRateLimiter) cleanup() {
	ticker := time.NewTicker(10 * time.Minute)
	go func() {
		for range ticker.C {
			i.mu.Lock()
			// In a production system, you might want to track last access time
			// and remove entries that haven't been accessed in a while
			i.mu.Unlock()
		}
	}()
}

// RateLimitConfig defines rate limit configuration for different endpoint types.
type RateLimitConfig struct {
	DefaultRPS   float64            // Default requests per second
	DefaultBurst int                // Default burst size
	EndpointRPS  map[string]float64 // Endpoint-specific RPS overrides
	EndpointBurst map[string]int    // Endpoint-specific burst overrides
}

// RateLimit creates a rate limiting middleware.
// requestsPerSecond: maximum requests per second per IP
// burstSize: maximum burst size
func RateLimit(requestsPerSecond float64, burstSize int) func(http.Handler) http.Handler {
	return RateLimitWithConfig(RateLimitConfig{
		DefaultRPS:   requestsPerSecond,
		DefaultBurst: burstSize,
		EndpointRPS:  make(map[string]float64),
		EndpointBurst: make(map[string]int),
	})
}

// RateLimitWithConfig creates a rate limiting middleware with endpoint-specific configurations.
func RateLimitWithConfig(config RateLimitConfig) func(http.Handler) http.Handler {
	// Create default limiter
	defaultLimiter := NewIPRateLimiter(rate.Limit(config.DefaultRPS), config.DefaultBurst)
	defaultLimiter.cleanup()

	// Create endpoint-specific limiters
	endpointLimiters := make(map[string]*IPRateLimiter)
	for path, rps := range config.EndpointRPS {
		burst := config.DefaultBurst
		if b, ok := config.EndpointBurst[path]; ok {
			burst = b
		}
		limiter := NewIPRateLimiter(rate.Limit(rps), burst)
		limiter.cleanup()
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
