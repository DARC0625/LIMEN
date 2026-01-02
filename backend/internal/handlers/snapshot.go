package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/DARC0625/LIMEN/backend/internal/errors"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/metrics"
	"github.com/DARC0625/LIMEN/backend/internal/middleware"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"go.uber.org/zap"
)

type CreateSnapshotRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// HandleCreateSnapshot handles snapshot creation.
func (h *Handler) HandleCreateSnapshot(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	// Get VM UUID from URL
	uuidStr := chi.URLParam(r, "uuid")
	if uuidStr == "" {
		errors.WriteBadRequest(w, "VM UUID is required", nil)
		return
	}

	// Get user ID from context
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		errors.WriteUnauthorized(w, "Authentication required")
		return
	}

	// Verify VM ownership
	var vm models.VM
	if err := h.DB.Where("uuid = ?", uuidStr).First(&vm).Error; err != nil {
		errors.WriteNotFound(w, "VM not found")
		return
	}

	if vm.OwnerID != userID {
		errors.WriteForbidden(w, "You don't have permission to create snapshots for this VM")
		return
	}

	// Parse request body
	var req CreateSnapshotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errors.WriteBadRequest(w, "Invalid request body", err)
		return
	}

	// Validate input
	if req.Name == "" {
		errors.WriteBadRequest(w, "Snapshot name is required", nil)
		return
	}

	// Create snapshot (VMService uses internal ID)
	snapshot, err := h.VMService.CreateSnapshot(vm.ID, req.Name, req.Description)
	if err != nil {
		logger.Log.Error("Failed to create snapshot", zap.Error(err), zap.String("vm_uuid", uuidStr))
		errors.WriteInternalError(w, err, false)
		return
	}

	logger.Log.Info("Snapshot created", zap.Uint("snapshot_id", snapshot.ID), zap.String("vm_uuid", uuidStr))

	// Update metrics
	metrics.VMSnapshotTotal.Inc()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(snapshot)
}

// HandleListSnapshots handles listing snapshots for a VM.
func (h *Handler) HandleListSnapshots(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	// Get VM UUID from URL
	uuidStr := chi.URLParam(r, "uuid")
	if uuidStr == "" {
		errors.WriteBadRequest(w, "VM UUID is required", nil)
		return
	}

	// Get user ID from context
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		errors.WriteUnauthorized(w, "Authentication required")
		return
	}

	// Verify VM ownership
	var vm models.VM
	if err := h.DB.Where("uuid = ?", uuidStr).First(&vm).Error; err != nil {
		errors.WriteNotFound(w, "VM not found")
		return
	}

	if vm.OwnerID != userID {
		errors.WriteForbidden(w, "You don't have permission to view snapshots for this VM")
		return
	}

	// List snapshots (VMService uses internal ID)
	snapshots, err := h.VMService.ListSnapshots(vm.ID)
	if err != nil {
		logger.Log.Error("Failed to list snapshots", zap.Error(err), zap.String("vm_uuid", uuidStr))
		errors.WriteInternalError(w, err, false)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(snapshots)
}

// HandleRestoreSnapshot handles snapshot restoration.
func (h *Handler) HandleRestoreSnapshot(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	// Get snapshot ID from URL
	snapshotIDStr := chi.URLParam(r, "snapshot_id")
	snapshotID, err := strconv.ParseUint(snapshotIDStr, 10, 32)
	if err != nil {
		errors.WriteBadRequest(w, "Invalid snapshot ID", err)
		return
	}

	// Get user ID from context
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		errors.WriteUnauthorized(w, "Authentication required")
		return
	}

	// Get snapshot
	snapshot, err := h.VMService.GetSnapshot(uint(snapshotID))
	if err != nil {
		errors.WriteNotFound(w, "Snapshot not found")
		return
	}

	// Verify VM ownership
	var vm models.VM
	if err := h.DB.First(&vm, snapshot.VMID).Error; err != nil {
		errors.WriteNotFound(w, "VM not found")
		return
	}

	if vm.OwnerID != userID {
		errors.WriteForbidden(w, "You don't have permission to restore this snapshot")
		return
	}

	// Restore snapshot
	if err := h.VMService.RestoreSnapshot(uint(snapshotID)); err != nil {
		logger.Log.Error("Failed to restore snapshot", zap.Error(err), zap.Uint("snapshot_id", uint(snapshotID)))
		errors.WriteInternalError(w, err, false)
		return
	}

	logger.Log.Info("Snapshot restored", zap.Uint("snapshot_id", uint(snapshotID)))
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":     "Snapshot restored successfully",
		"snapshot_id": snapshotID,
	})
}

// HandleDeleteSnapshot handles snapshot deletion.
func (h *Handler) HandleDeleteSnapshot(w http.ResponseWriter, r *http.Request) {
	if r.Method != "DELETE" {
		errors.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed", nil)
		return
	}

	// Get snapshot ID from URL
	snapshotIDStr := chi.URLParam(r, "snapshot_id")
	snapshotID, err := strconv.ParseUint(snapshotIDStr, 10, 32)
	if err != nil {
		errors.WriteBadRequest(w, "Invalid snapshot ID", err)
		return
	}

	// Get user ID from context
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		errors.WriteUnauthorized(w, "Authentication required")
		return
	}

	// Get snapshot
	snapshot, err := h.VMService.GetSnapshot(uint(snapshotID))
	if err != nil {
		errors.WriteNotFound(w, "Snapshot not found")
		return
	}

	// Verify VM ownership
	var vm models.VM
	if err := h.DB.First(&vm, snapshot.VMID).Error; err != nil {
		errors.WriteNotFound(w, "VM not found")
		return
	}

	if vm.OwnerID != userID {
		errors.WriteForbidden(w, "You don't have permission to delete this snapshot")
		return
	}

	// Delete snapshot
	if err := h.VMService.DeleteSnapshot(uint(snapshotID)); err != nil {
		logger.Log.Error("Failed to delete snapshot", zap.Error(err), zap.Uint("snapshot_id", uint(snapshotID)))
		errors.WriteInternalError(w, err, false)
		return
	}

	logger.Log.Info("Snapshot deleted", zap.Uint("snapshot_id", uint(snapshotID)))
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":     "Snapshot deleted successfully",
		"snapshot_id": snapshotID,
	})
}
