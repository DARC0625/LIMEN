package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/errors"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/DARC0625/LIMEN/backend/internal/ratelimit"
	"github.com/DARC0625/LIMEN/backend/internal/validator"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// WaitlistRequest represents the request body for waitlist registration.
type WaitlistRequest struct {
	Name         string `json:"name"`
	Organization string `json:"organization"`
	Email        string `json:"email"`
	Purpose      string `json:"purpose,omitempty"`
	Honeypot     string `json:"website,omitempty"` // Honeypot field (should be empty)
}

// WaitlistResponse represents the response for waitlist registration.
type WaitlistResponse struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Data    *WaitlistResponseData  `json:"data,omitempty"`
}

// WaitlistResponseData contains the waitlist entry data.
type WaitlistResponseData struct {
	ID         uint   `json:"id"`
	EmailMasked string `json:"email_masked"`
}

// HandleWaitlist handles POST /api/public/waitlist - Public waitlist registration.
// This endpoint is public (no authentication required) but has rate limiting and validation.
func (h *Handler) HandleWaitlist(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	if r.Method != "POST" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	// Get client IP for rate limiting
	clientIP := getClientIPFromRequest(r)

	// Rate limiting: 5 requests per 5 minutes per IP
	rateLimiter := ratelimit.GetIPRateLimiter()
	if !rateLimiter.Allow(clientIP, 5, 5*time.Minute) {
		logger.Log.Warn("Waitlist rate limit exceeded",
			zap.String("ip", clientIP),
			zap.String("path", r.URL.Path))
		errors.WriteErrorWithCode(w, http.StatusTooManyRequests, "Too many requests. Please try again later.", "RATE_LIMIT_EXCEEDED", nil, false)
		return
	}

	// Limit request body size (max 10KB)
	r.Body = http.MaxBytesReader(w, r.Body, 10*1024)

	var req WaitlistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Log.Warn("Failed to decode waitlist request",
			zap.String("ip", clientIP),
			zap.Error(err))
		errors.WriteBadRequest(w, "Invalid request body", err)
		return
	}

	// Honeypot check: if "website" field is filled, it's likely a bot
	if req.Honeypot != "" {
		logger.Log.Warn("Waitlist honeypot triggered",
			zap.String("ip", clientIP),
			zap.String("email", req.Email))
		// Return success to avoid revealing honeypot
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(WaitlistResponse{
			Code:    "SUCCESS",
			Message: "Thank you for your interest. We'll be in touch soon.",
		})
		return
	}

	// Input validation
	if strings.TrimSpace(req.Name) == "" {
		errors.WriteBadRequest(w, "Name is required", nil)
		return
	}
	if strings.TrimSpace(req.Organization) == "" {
		errors.WriteBadRequest(w, "Organization is required", nil)
		return
	}
	if strings.TrimSpace(req.Email) == "" {
		errors.WriteBadRequest(w, "Email is required", nil)
		return
	}

	// Email validation
	if !validator.ValidateEmail(strings.TrimSpace(req.Email)) {
		errors.WriteBadRequest(w, "Invalid email format", nil)
		return
	}

	// Check if email already exists
	var existing models.Waitlist
	if err := h.DB.Where("email = ?", strings.ToLower(strings.TrimSpace(req.Email))).First(&existing).Error; err == nil {
		// Email already exists, return success (don't reveal that it exists)
		logger.Log.Info("Waitlist duplicate email",
			zap.String("ip", clientIP),
			zap.String("email", req.Email))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(WaitlistResponse{
			Code:    "SUCCESS",
			Message: "Thank you for your interest. We'll be in touch soon.",
			Data: &WaitlistResponseData{
				ID:          existing.ID,
				EmailMasked: maskEmail(existing.Email),
			},
		})
		return
	} else if err != gorm.ErrRecordNotFound {
		logger.Log.Error("Failed to check existing waitlist entry",
			zap.String("ip", clientIP),
			zap.Error(err))
		errors.WriteInternalError(w, err, cfg.Env == "development")
		return
	}

	// Create waitlist entry
	waitlistEntry := models.Waitlist{
		Name:         strings.TrimSpace(req.Name),
		Organization: strings.TrimSpace(req.Organization),
		Email:        strings.ToLower(strings.TrimSpace(req.Email)),
		Purpose:      strings.TrimSpace(req.Purpose),
		IPAddress:    clientIP,
	}

	if err := h.DB.Create(&waitlistEntry).Error; err != nil {
		logger.Log.Error("Failed to create waitlist entry",
			zap.String("ip", clientIP),
			zap.String("email", req.Email),
			zap.Error(err))
		errors.WriteInternalError(w, err, cfg.Env == "development")
		return
	}

	logger.Log.Info("Waitlist entry created",
		zap.Uint("id", waitlistEntry.ID),
		zap.String("ip", clientIP),
		zap.String("email", req.Email))

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(WaitlistResponse{
		Code:    "SUCCESS",
		Message: "Thank you for your interest. We'll be in touch soon.",
		Data: &WaitlistResponseData{
			ID:          waitlistEntry.ID,
			EmailMasked: maskEmail(waitlistEntry.Email),
		},
	})
}

// maskEmail masks an email address for privacy (e.g., "test@example.com" -> "tes***@example.com").
func maskEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return "***@***"
	}
	local := parts[0]
	domain := parts[1]

	if len(local) <= 3 {
		return fmt.Sprintf("%s***@%s", local, domain)
	}
	return fmt.Sprintf("%s***@%s", local[:3], domain)
}

// getClientIPFromRequest extracts the client IP address from the request.
func getClientIPFromRequest(r *http.Request) string {
	// Check X-Forwarded-For header (from reverse proxy)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP in X-Forwarded-For chain
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	// Check X-Real-IP header (from nginx/Envoy)
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}

	// Fallback to RemoteAddr
	host, _, found := strings.Cut(r.RemoteAddr, ":")
	if found {
		return host
	}
	return r.RemoteAddr
}

