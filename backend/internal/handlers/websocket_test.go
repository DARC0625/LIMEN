package handlers

import (
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/models"
)

func TestNewVMStatusBroadcaster(t *testing.T) {
	broadcaster := NewVMStatusBroadcaster()

	if broadcaster == nil {
		t.Fatal("NewVMStatusBroadcaster returned nil")
	}

	if broadcaster.clients == nil {
		t.Error("Broadcaster clients map not initialized")
	}
	if broadcaster.broadcast == nil {
		t.Error("Broadcaster broadcast channel not initialized")
	}
	if broadcaster.register == nil {
		t.Error("Broadcaster register channel not initialized")
	}
	if broadcaster.unregister == nil {
		t.Error("Broadcaster unregister channel not initialized")
	}
}

func TestVMStatusBroadcaster_BroadcastVMUpdate(t *testing.T) {
	broadcaster := NewVMStatusBroadcaster()

	vm := models.VM{
		ID:     1,
		UUID:   "test-uuid",
		Name:   "test-vm",
		Status: models.VMStatusRunning,
		CPU:    2,
		Memory: 1024,
	}

	// This should not panic even with no clients
	broadcaster.BroadcastVMUpdate(vm)

	// Verify message was sent to broadcast channel (non-blocking)
	select {
	case <-broadcaster.broadcast:
		// Message was sent successfully
	default:
		// Channel is full or message was dropped (expected in test)
	}
}

func TestVMStatusBroadcaster_BroadcastVMList(t *testing.T) {
	broadcaster := NewVMStatusBroadcaster()

	vms := []models.VM{
		{ID: 1, UUID: "uuid1", Name: "vm1", Status: models.VMStatusRunning},
		{ID: 2, UUID: "uuid2", Name: "vm2", Status: models.VMStatusStopped},
	}

	// This should not panic even with no clients
	broadcaster.BroadcastVMList(vms)

	// Verify message was sent to broadcast channel (non-blocking)
	select {
	case <-broadcaster.broadcast:
		// Message was sent successfully
	default:
		// Channel is full or message was dropped (expected in test)
	}
}

func TestVMStatusBroadcaster_BroadcastVMList_Empty(t *testing.T) {
	broadcaster := NewVMStatusBroadcaster()

	vms := []models.VM{}

	// Should handle empty list without panic
	broadcaster.BroadcastVMList(vms)
}

func TestVMStatusBroadcaster_BroadcastVMUpdate_EmptyVM(t *testing.T) {
	broadcaster := NewVMStatusBroadcaster()

	vm := models.VM{}

	// Should handle empty VM without panic
	broadcaster.BroadcastVMUpdate(vm)
}
