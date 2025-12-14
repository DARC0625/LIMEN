package vm

import (
	"strings"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"go.uber.org/zap"
)

// SyncVMStatus syncs VM status from libvirt to database
func (s *VMService) SyncVMStatus(vm *models.VM) error {
	dom, err := s.conn.LookupDomainByName(vm.Name)
	if err != nil {
		// Domain not found in libvirt - VM was likely deleted externally
		// Check if error indicates domain not found
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "No such domain") {
			logger.Log.Info("VM not found in libvirt, marking as stopped", zap.String("vm_name", vm.Name))
			vm.Status = models.VMStatusStopped
			return s.db.Save(vm).Error
		}
		return err
	}
	defer dom.Free()

	// Check if domain is active (running)
	active, err := dom.IsActive()
	if err != nil {
		logger.Log.Warn("Failed to check VM active status", zap.String("vm_name", vm.Name), zap.Error(err))
		return err
	}

	// Update status based on libvirt state
	oldStatus := vm.Status
	if active {
		vm.Status = models.VMStatusRunning
	} else {
		vm.Status = models.VMStatusStopped
	}

	// Only update if status changed
	if oldStatus != vm.Status {
		logger.Log.Info("VM status synced from libvirt", 
			zap.String("vm_name", vm.Name),
			zap.String("old_status", string(oldStatus)),
			zap.String("new_status", string(vm.Status)))
		return s.db.Save(vm).Error
	}

	return nil
}

// SyncAllVMStatuses syncs all VM statuses from libvirt to database
func (s *VMService) SyncAllVMStatuses() error {
	var vms []models.VM
	if err := s.db.Find(&vms).Error; err != nil {
		return err
	}

	for i := range vms {
		if err := s.SyncVMStatus(&vms[i]); err != nil {
			logger.Log.Warn("Failed to sync VM status", 
				zap.String("vm_name", vms[i].Name), 
				zap.Error(err))
			// Continue with other VMs even if one fails
		}
	}

	return nil
}

// GetVMStatusFromLibvirt gets the actual status from libvirt without updating DB
func (s *VMService) GetVMStatusFromLibvirt(vmName string) (models.VMStatus, error) {
	dom, err := s.conn.LookupDomainByName(vmName)
	if err != nil {
		// Domain not found = stopped
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "No such domain") {
			return models.VMStatusStopped, nil
		}
		return "", err
	}
	defer dom.Free()

	active, err := dom.IsActive()
	if err != nil {
		return "", err
	}

	if active {
		return models.VMStatusRunning, nil
	}
	return models.VMStatusStopped, nil
}

// EnsureVMExists checks if VM exists in libvirt, if not marks it as stopped
func (s *VMService) EnsureVMExists(vm *models.VM) error {
	dom, err := s.conn.LookupDomainByName(vm.Name)
	if err != nil {
		// VM doesn't exist in libvirt but exists in DB
		// This can happen if VM was deleted externally or libvirt crashed
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "No such domain") {
			logger.Log.Warn("VM not found in libvirt, marking as stopped", zap.String("vm_name", vm.Name))
			vm.Status = models.VMStatusStopped
			return s.db.Save(vm).Error
		}
		return err
	}
	defer dom.Free()
	return nil
}

