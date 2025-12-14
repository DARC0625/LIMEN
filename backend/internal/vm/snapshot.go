package vm

import (
	"fmt"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/libvirt/libvirt-go"
	"go.uber.org/zap"
)

// CreateSnapshot creates a snapshot of a VM.
func (s *VMService) CreateSnapshot(vmID uint, snapshotName, description string) (*models.VMSnapshot, error) {
	// Get VM from database
	var vm models.VM
	if err := s.db.First(&vm, vmID).Error; err != nil {
		return nil, fmt.Errorf("VM not found: %w", err)
	}

	// Get libvirt domain
	dom, err := s.conn.LookupDomainByName(vm.Name)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup domain: %w", err)
	}
	defer dom.Free()

	// Generate unique snapshot name (UUID)
	snapshotUUID := fmt.Sprintf("%d-%d", vmID, time.Now().Unix())

	// Create snapshot XML
	snapshotXML := fmt.Sprintf(`
<domainsnapshot>
  <name>%s</name>
  <description>%s</description>
  <disks>
    <disk name='vda' snapshot='internal'/>
  </disks>
</domainsnapshot>
`, snapshotUUID, description)

	// Create snapshot flags
	flags := libvirt.DOMAIN_SNAPSHOT_CREATE_ATOMIC | libvirt.DOMAIN_SNAPSHOT_CREATE_DISK_ONLY

	// Create snapshot
	snap, err := dom.CreateSnapshotXML(snapshotXML, flags)
	if err != nil {
		return nil, fmt.Errorf("failed to create snapshot: %w", err)
	}
	defer snap.Free()

	// Get snapshot info
	snapXML, err := snap.GetXMLDesc(0)
	if err != nil {
		logger.Log.Warn("Failed to get snapshot XML", zap.Error(err))
	}

	// Save snapshot to database
	snapshot := models.VMSnapshot{
		VMID:        vmID,
		Name:        snapshotName,
		Description: description,
		LibvirtName: snapshotUUID,
	}

	if err := s.db.Create(&snapshot).Error; err != nil {
		// Try to delete snapshot from libvirt if DB save fails
		if delErr := snap.Delete(libvirt.DOMAIN_SNAPSHOT_DELETE_CHILDREN); delErr != nil {
			logger.Log.Error("Failed to delete snapshot after DB error", zap.Error(delErr))
		}
		return nil, fmt.Errorf("failed to save snapshot to database: %w", err)
	}

	logger.Log.Info("Snapshot created", zap.Uint("vm_id", vmID), zap.String("snapshot_name", snapshotName), zap.String("snapshot_xml", snapXML))
	return &snapshot, nil
}

// ListSnapshots returns all snapshots for a VM.
func (s *VMService) ListSnapshots(vmID uint) ([]models.VMSnapshot, error) {
	var snapshots []models.VMSnapshot
	if err := s.db.Where("vm_id = ?", vmID).Find(&snapshots).Error; err != nil {
		return nil, fmt.Errorf("failed to list snapshots: %w", err)
	}
	return snapshots, nil
}

// GetSnapshot retrieves a snapshot by ID.
func (s *VMService) GetSnapshot(snapshotID uint) (*models.VMSnapshot, error) {
	var snapshot models.VMSnapshot
	if err := s.db.First(&snapshot, snapshotID).Error; err != nil {
		return nil, fmt.Errorf("snapshot not found: %w", err)
	}
	return &snapshot, nil
}

// RestoreSnapshot restores a VM to a snapshot state.
func (s *VMService) RestoreSnapshot(snapshotID uint) error {
	// Get snapshot from database
	snapshot, err := s.GetSnapshot(snapshotID)
	if err != nil {
		return err
	}

	// Get VM
	var vm models.VM
	if err := s.db.First(&vm, snapshot.VMID).Error; err != nil {
		return fmt.Errorf("VM not found: %w", err)
	}

	// Get libvirt domain
	dom, err := s.conn.LookupDomainByName(vm.Name)
	if err != nil {
		return fmt.Errorf("failed to lookup domain: %w", err)
	}
	defer dom.Free()

	// Check if VM is running
	active, err := dom.IsActive()
	if err != nil {
		return fmt.Errorf("failed to check domain state: %w", err)
	}

	// If VM is running, we need to shut it down first
	if active {
		logger.Log.Info("Shutting down VM for snapshot restore", zap.String("vm_name", vm.Name))
		if err := dom.Shutdown(); err != nil {
			// Try force shutdown
			if err := dom.Destroy(); err != nil {
				return fmt.Errorf("failed to shutdown VM: %w", err)
			}
		}

		// Wait for VM to shut down (max 30 seconds)
		for i := 0; i < 30; i++ {
			time.Sleep(1 * time.Second)
			active, _ := dom.IsActive()
			if !active {
				break
			}
		}
	}

	// Lookup snapshot in libvirt
	snap, err := dom.SnapshotLookupByName(snapshot.LibvirtName, 0)
	if err != nil {
		return fmt.Errorf("failed to lookup snapshot in libvirt: %w", err)
	}
	defer snap.Free()

	// Revert to snapshot
	flags := libvirt.DOMAIN_SNAPSHOT_REVERT_RUNNING | libvirt.DOMAIN_SNAPSHOT_REVERT_FORCE
	if err := snap.RevertToSnapshot(flags); err != nil {
		return fmt.Errorf("failed to revert to snapshot: %w", err)
	}

	// Update VM status in database
	vm.Status = models.VMStatusStopped
	if err := s.db.Save(&vm).Error; err != nil {
		logger.Log.Warn("Failed to update VM status", zap.Error(err))
	}

	logger.Log.Info("Snapshot restored", zap.Uint("snapshot_id", snapshotID), zap.String("vm_name", vm.Name))
	return nil
}

// DeleteSnapshot deletes a snapshot.
func (s *VMService) DeleteSnapshot(snapshotID uint) error {
	// Get snapshot from database
	snapshot, err := s.GetSnapshot(snapshotID)
	if err != nil {
		return err
	}

	// Get VM
	var vm models.VM
	if err := s.db.First(&vm, snapshot.VMID).Error; err != nil {
		return fmt.Errorf("VM not found: %w", err)
	}

	// Get libvirt domain
	dom, err := s.conn.LookupDomainByName(vm.Name)
	if err != nil {
		return fmt.Errorf("failed to lookup domain: %w", err)
	}
	defer dom.Free()

	// Lookup snapshot in libvirt
	snap, err := dom.SnapshotLookupByName(snapshot.LibvirtName, 0)
	if err != nil {
		// Snapshot might not exist in libvirt, but we should still delete from DB
		logger.Log.Warn("Snapshot not found in libvirt, deleting from DB only", zap.Error(err))
	} else {
		defer snap.Free()

		// Delete snapshot from libvirt
		flags := libvirt.DOMAIN_SNAPSHOT_DELETE_CHILDREN | libvirt.DOMAIN_SNAPSHOT_DELETE_METADATA_ONLY
		if err := snap.Delete(flags); err != nil {
			logger.Log.Warn("Failed to delete snapshot from libvirt", zap.Error(err))
			// Continue to delete from DB anyway
		}
	}

	// Delete from database
	if err := s.db.Delete(snapshot).Error; err != nil {
		return fmt.Errorf("failed to delete snapshot from database: %w", err)
	}

	logger.Log.Info("Snapshot deleted", zap.Uint("snapshot_id", snapshotID))
	return nil
}

// ListAllSnapshots returns all snapshots (for admin purposes).
func (s *VMService) ListAllSnapshots() ([]models.VMSnapshot, error) {
	var snapshots []models.VMSnapshot
	if err := s.db.Preload("VM").Find(&snapshots).Error; err != nil {
		return nil, fmt.Errorf("failed to list all snapshots: %w", err)
	}
	return snapshots, nil
}

