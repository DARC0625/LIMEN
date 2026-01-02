package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/errors"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"go.uber.org/zap"
)

// HandleLogStats handles GET /api/logs/stats - Get log statistics.
// @Summary     Get log statistics
// @Description Returns aggregated log statistics for the specified time period
// @Tags        Logs
// @Accept      json
// @Produce     json
// @Param       hours query int false "Hours to look back (default: 24)" default(24)
// @Success     200  {object}  logger.LogStats  "Log statistics"
// @Failure     500  {object}  map[string]interface{}  "Internal server error"
// @Router      /logs/stats [get]
func (h *Handler) HandleLogStats(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	if r.Method != "GET" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	// Parse hours parameter
	hoursStr := r.URL.Query().Get("hours")
	hours := 24 // Default: 24 hours
	if hoursStr != "" {
		if parsed, err := strconv.Atoi(hoursStr); err == nil && parsed > 0 {
			hours = parsed
		}
	}

	since := time.Duration(hours) * time.Hour
	logDir := logger.GetLogDir()

	stats, err := logger.AnalyzeLogs(logDir, since)
	if err != nil {
		logger.Log.Error("Failed to analyze logs", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(stats); err != nil {
		logger.Log.Error("Failed to encode log stats", zap.Error(err))
	}
}

// HandleLogSearch handles GET /api/logs/search - Search log entries.
// @Summary     Search log entries
// @Description Searches for log entries matching the query
// @Tags        Logs
// @Accept      json
// @Produce     json
// @Param       query query string true "Search query"
// @Param       hours query int false "Hours to look back (default: 24)" default(24)
// @Param       limit query int false "Maximum number of results (default: 100)" default(100)
// @Success     200  {array}   logger.LogEntry  "Matching log entries"
// @Failure     400  {object}  map[string]interface{}  "Invalid request"
// @Failure     500  {object}  map[string]interface{}  "Internal server error"
// @Router      /logs/search [get]
func (h *Handler) HandleLogSearch(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	if r.Method != "GET" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	query := r.URL.Query().Get("query")
	if query == "" {
		errors.WriteBadRequest(w, "Query parameter is required", nil)
		return
	}

	// Parse hours parameter
	hoursStr := r.URL.Query().Get("hours")
	hours := 24 // Default: 24 hours
	if hoursStr != "" {
		if parsed, err := strconv.Atoi(hoursStr); err == nil && parsed > 0 {
			hours = parsed
		}
	}

	// Parse limit parameter
	limitStr := r.URL.Query().Get("limit")
	limit := 100 // Default: 100 entries
	if limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 && parsed <= 1000 {
			limit = parsed
		}
	}

	since := time.Duration(hours) * time.Hour
	logDir := logger.GetLogDir()

	entries, err := logger.SearchLogs(logDir, query, since, limit)
	if err != nil {
		logger.Log.Error("Failed to search logs", zap.Error(err))
		errors.WriteInternalError(w, err, false)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(entries); err != nil {
		logger.Log.Error("Failed to encode log entries", zap.Error(err))
	}
}








