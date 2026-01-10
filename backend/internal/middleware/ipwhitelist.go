// Package middleware provides IP whitelist middleware.
package middleware

import (
	"net"
	"net/http"
	"strings"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"go.uber.org/zap"
)

// IPWhitelist creates a middleware that restricts access to specific IP addresses or CIDR ranges.
// If whitelist is empty, all IPs are allowed (no restriction).
func IPWhitelist(allowedIPs []string) func(http.Handler) http.Handler {
	if len(allowedIPs) == 0 {
		// No whitelist configured, allow all
		return func(next http.Handler) http.Handler {
			return next
		}
	}

	// Parse CIDR ranges and individual IPs
	cidrs := make([]*net.IPNet, 0)
	ips := make(map[string]bool)

	for _, ipStr := range allowedIPs {
		ipStr = strings.TrimSpace(ipStr)
		if ipStr == "" {
			continue
		}

		// Try parsing as CIDR
		if strings.Contains(ipStr, "/") {
			_, cidr, err := net.ParseCIDR(ipStr)
			if err == nil {
				cidrs = append(cidrs, cidr)
				continue
			}
		}

		// Try parsing as IP
		ip := net.ParseIP(ipStr)
		if ip != nil {
			ips[ip.String()] = true
			continue
		}

		logger.Log.Warn("Invalid IP or CIDR in whitelist", zap.String("ip", ipStr))
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			clientIP := getClientIP(r)

			// Remove port from IP if present
			host, _, err := net.SplitHostPort(clientIP)
			if err == nil {
				clientIP = host
			}

			// Parse client IP
			ip := net.ParseIP(clientIP)
			if ip == nil {
				logger.Log.Warn("Failed to parse client IP", zap.String("ip", clientIP))
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}

			// Check if IP is in whitelist
			allowed := false

			// Check individual IPs
			if ips[ip.String()] {
				allowed = true
			}

			// Check CIDR ranges
			if !allowed {
				for _, cidr := range cidrs {
					if cidr.Contains(ip) {
						allowed = true
						break
					}
				}
			}

			if !allowed {
				logger.Log.Warn("IP not in whitelist",
					zap.String("ip", clientIP),
					zap.String("path", r.URL.Path),
					zap.String("method", r.Method),
				)
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
