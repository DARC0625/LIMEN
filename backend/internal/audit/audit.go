// Package audit provides audit logging functionality for security and compliance.
package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/database"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/middleware"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// LogEvent logs an audit event to the database.
func LogEvent(ctx context.Context, action, resource, resourceID string, result string, errorCode, errorMessage string, metadata map[string]interface{}) error {
	// Get user info from context
	userID, _ := middleware.GetUserID(ctx)
	username, _ := middleware.GetUsername(ctx)
	role, _ := middleware.GetRole(ctx)

	// Get request info from context if available
	var requestID, clientIP, userAgent string
	if r, ok := ctx.Value("request").(*http.Request); ok {
		requestID = r.Header.Get("X-Request-ID")
		clientIP = r.RemoteAddr
		userAgent = r.UserAgent()
	}

	// Serialize metadata to JSON
	var metadataJSON string
	if metadata != nil && len(metadata) > 0 {
		jsonBytes, err := json.Marshal(metadata)
		if err == nil {
			metadataJSON = string(jsonBytes)
		}
	}
	// If metadataJSON is empty, set to null JSON value for database
	if metadataJSON == "" {
		metadataJSON = "null"
	}

	// Create audit log entry
	auditLog := models.AuditLog{
		RequestID:    requestID,
		UserID:       &userID,
		Username:     username,
		Role:         role,
		Action:       action,
		Resource:     resource,
		ResourceID:   resourceID,
		Result:       result,
		ErrorCode:    errorCode,
		ErrorMessage: errorMessage,
		ClientIP:     clientIP,
		UserAgent:    userAgent,
		Metadata:     metadataJSON,
		CreatedAt:    time.Now(),
	}

	if err := database.DB.Create(&auditLog).Error; err != nil {
		logger.Log.Error("Failed to create audit log", zap.Error(err))
		return err
	}

	return nil
}

// LogLogin logs a login event.
func LogLogin(ctx context.Context, userID uint, username, role string, success bool, errorMessage string) {
	result := "success"
	errorCode := ""
	if !success {
		result = "failure"
		errorCode = "INVALID_CREDENTIALS"
	}

	LogEvent(ctx, "login", "user", fmt.Sprintf("%d", userID), result, errorCode, errorMessage, map[string]interface{}{
		"username": username,
		"role":     role,
	})
}

// LogTokenRefresh logs a token refresh event.
func LogTokenRefresh(ctx context.Context, userID uint, success bool) {
	result := "success"
	errorCode := ""
	if !success {
		result = "failure"
		errorCode = "TOKEN_REFRESH_FAILED"
	}

	LogEvent(ctx, "token_refresh", "user", fmt.Sprintf("%d", userID), result, errorCode, "", nil)
}

// LogPermissionChange logs a permission change event (admin action).
func LogPermissionChange(ctx context.Context, adminID uint, targetUserID uint, permissionType string, granted bool) {
	action := fmt.Sprintf("permission_%s", permissionType)
	if granted {
		action = action + "_grant"
	} else {
		action = action + "_revoke"
	}

	LogEvent(ctx, action, "user", fmt.Sprintf("%d", targetUserID), "success", "", "", map[string]interface{}{
		"admin_id":        adminID,
		"target_user_id":  targetUserID,
		"permission_type": permissionType,
		"granted":         granted,
	})
}

// LogVMCreate logs a VM creation event.
func LogVMCreate(ctx context.Context, userID uint, vmID uint, vmUUID, vmName string, success bool, errorMessage string) {
	result := "success"
	errorCode := ""
	if !success {
		result = "failure"
		errorCode = "VM_CREATE_FAILED"
	}

	LogEvent(ctx, "vm.create", "vm", vmUUID, result, errorCode, errorMessage, map[string]interface{}{
		"vm_id":   vmID,
		"vm_name": vmName,
	})
}

// LogVMStart logs a VM start event.
func LogVMStart(ctx context.Context, userID uint, vmUUID string, success bool) {
	result := "success"
	errorCode := ""
	if !success {
		result = "failure"
		errorCode = "VM_START_FAILED"
	}

	LogEvent(ctx, "vm.start", "vm", vmUUID, result, errorCode, "", nil)
}

// LogVMStop logs a VM stop event.
func LogVMStop(ctx context.Context, userID uint, vmUUID string, success bool) {
	result := "success"
	errorCode := ""
	if !success {
		result = "failure"
		errorCode = "VM_STOP_FAILED"
	}

	LogEvent(ctx, "vm.stop", "vm", vmUUID, result, errorCode, "", nil)
}

// LogVMDelete logs a VM deletion event.
func LogVMDelete(ctx context.Context, userID uint, vmUUID string, success bool) {
	result := "success"
	errorCode := ""
	if !success {
		result = "failure"
		errorCode = "VM_DELETE_FAILED"
	}

	LogEvent(ctx, "vm.delete", "vm", vmUUID, result, errorCode, "", nil)
}

// LogConsoleSessionStart logs a console session start event.
func LogConsoleSessionStart(ctx context.Context, userID uint, sessionID, vmUUID string) {
	LogEvent(ctx, "console.session_start", "session", sessionID, "success", "", "", map[string]interface{}{
		"vm_uuid": vmUUID,
	})
}

// LogConsoleSessionEnd logs a console session end event.
func LogConsoleSessionEnd(ctx context.Context, userID uint, sessionID, vmUUID, reason string) {
	LogEvent(ctx, "console.session_end", "session", sessionID, "success", "", "", map[string]interface{}{
		"vm_uuid": vmUUID,
		"reason":  reason,
	})
}

// LogBetaAccessGrant logs a beta access grant event (admin action).
func LogBetaAccessGrant(ctx context.Context, adminID uint, targetUserID uint, granted bool) {
	LogPermissionChange(ctx, adminID, targetUserID, "beta_access", granted)
}

// GetAuditLogs retrieves audit logs with filtering.
func GetAuditLogs(db *gorm.DB, userID *uint, action, resource string, limit, offset int) ([]models.AuditLog, int64, error) {
	query := db.Model(&models.AuditLog{})

	if userID != nil {
		query = query.Where("user_id = ?", *userID)
	}
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if resource != "" {
		query = query.Where("resource = ?", resource)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var logs []models.AuditLog
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}
