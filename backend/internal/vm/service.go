package vm

import (
	"context"
	"encoding/xml"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type VMService struct {
	driver LibvirtDriver // libvirt driver interface (no direct libvirt import)
	db     *gorm.DB
	isoDir string
	vmDir  string

	// Concurrency control for libvirt operations
	operationSemaphore chan struct{}

	// Timeout for libvirt operations
	operationTimeout time.Duration
}

const (
	// MaxConcurrentLibvirtOps limits concurrent libvirt operations
	MaxConcurrentLibvirtOps = 5

	// DefaultLibvirtTimeout is the default timeout for libvirt operations
	DefaultLibvirtTimeout = 30 * time.Second
)

// safeFreeDomain safely frees a libvirt domain, logging any errors.
// This helper is used to satisfy errcheck linter requirements.
func safeFreeDomain(dom Domain) {
	if dom == nil {
		return
	}
	if err := dom.Free(); err != nil {
		logger.Log.Warn("domain.Free failed", zap.Error(err))
	}
}

// safeDestroyDomain safely destroys a libvirt domain, logging any errors.
// This helper is used to satisfy errcheck linter requirements.
func safeDestroyDomain(dom Domain, vmName string) {
	if dom == nil {
		return
	}
	if err := dom.Destroy(); err != nil {
		logger.Log.Warn("domain.Destroy failed", zap.String("vm_name", vmName), zap.Error(err))
		// Continue anyway - domain might already be destroyed
	}
}

// GetVMDir returns the VM directory path
func (s *VMService) GetVMDir() string {
	return s.vmDir
}

func NewVMService(db *gorm.DB, libvirtURI, isoDir, vmDir string) (*VMService, error) {
	// Ensure directories exist with proper permissions
	if err := os.MkdirAll(isoDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create ISO directory: %w", err)
	}
	if err := os.MkdirAll(vmDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create VM directory: %w", err)
	}

	// Create libvirt driver (implementation depends on build tags)
	driver := NewLibvirtDriver()
	if err := driver.Connect(libvirtURI); err != nil {
		return nil, fmt.Errorf("failed to connect to libvirt: %w", err)
	}

	return &VMService{
		driver:             driver,
		db:                 db,
		isoDir:             isoDir,
		vmDir:              vmDir,
		operationSemaphore: make(chan struct{}, MaxConcurrentLibvirtOps),
		operationTimeout:   DefaultLibvirtTimeout,
	}, nil
}

func (s *VMService) Close() {
	if s.driver != nil {
		s.driver.Close()
	}
}

func (s *VMService) IsAlive() bool {
	if s.driver == nil {
		return false
	}
	return s.driver.IsAlive()
}

func (s *VMService) EnsureISO(osType string) (string, error) {
	var image models.VMImage
	// For Windows, always use Windows 10 ISO
	if strings.Contains(strings.ToLower(osType), "windows") {
		// Find Windows 10 ISO by path containing "Windows10.iso" (case-insensitive)
		if err := s.db.Where("os_type = ? AND LOWER(path) LIKE '%windows10%' AND LOWER(path) NOT LIKE '%windows11%'", osType).First(&image).Error; err != nil {
			return "", fmt.Errorf("Windows 10 ISO not found for os type: %s", osType)
		}
	} else {
		if err := s.db.Where("os_type = ?", osType).First(&image).Error; err != nil {
			return "", fmt.Errorf("image not found for os type: %s", osType)
		}
	}

	imagePath := image.Path

	// Migrate old project path to new path
	// Handle path migration from /home/darc0/projects/LIMEN to /home/darc0/LIMEN
	if strings.Contains(imagePath, "/home/darc0/projects/LIMEN") {
		imagePath = strings.Replace(imagePath, "/home/darc0/projects/LIMEN", "/home/darc0/LIMEN", 1)
		image.Path = imagePath
		if err := s.db.Save(&image).Error; err != nil {
			logger.Log.Warn("Failed to update image path in DB", zap.String("os_type", osType), zap.Error(err))
		} else {
			logger.Log.Info("Migrated image path to new location", zap.String("os_type", osType), zap.String("new_path", imagePath))
		}
	}

	// Convert absolute paths to relative paths if they point to the project directory
	// This ensures portability across different environments
	if filepath.IsAbs(imagePath) {
		// Try to make it relative to the ISO directory
		relPath, err := filepath.Rel(s.isoDir, imagePath)
		if err == nil && !strings.HasPrefix(relPath, "..") {
			// Path is within ISO directory, use relative path
			imagePath = relPath
			image.Path = imagePath
			if err := s.db.Save(&image).Error; err != nil {
				logger.Log.Warn("Failed to update image path in DB", zap.String("os_type", osType), zap.Error(err))
			} else {
				logger.Log.Debug("Converted absolute path to relative", zap.String("os_type", osType), zap.String("new_path", imagePath))
			}
		}
	}

	// Resolve path: if relative, make it relative to ISO directory
	if !filepath.IsAbs(imagePath) {
		imagePath = filepath.Join(s.isoDir, imagePath)
	}

	if _, err := os.Stat(imagePath); err == nil {
		return imagePath, nil
	}

	return "", fmt.Errorf("ISO file not found. Please check VM configuration. Original error: %v", fmt.Errorf("iso file not found at %s. please upload it manually", imagePath))
}

func (s *VMService) CreateVM(name string, memoryMB int, vcpu int, osType string, vmUUID string, graphicsType string, vncEnabled bool) error {
	return s.withLibvirtGuard("CreateVM", func() error {
		return s.createVMInternal(name, memoryMB, vcpu, osType, vmUUID, graphicsType, vncEnabled)
	})
}

func (s *VMService) createVMInternal(name string, memoryMB int, vcpu int, osType string, vmUUID string, graphicsType string, vncEnabled bool) error {
	// 0. Cleanup existing resources (Libvirt domain and Disk)
	// Check if domain exists in libvirt and cleanup
	if dom, err := s.driver.LookupDomainByName(name); err == nil {
		if active, err := dom.IsActive(); err == nil && active {
			safeDestroyDomain(dom, name)
		}
		if err := dom.UndefineFlags(0); err != nil {
			logger.Log.Warn("domain.UndefineFlags failed", zap.String("vm_name", name), zap.Error(err))
		}
		safeFreeDomain(dom)
	}

	// 1. Create empty disk for VM in vmDir using UUID instead of name
	vmDiskPath := filepath.Join(s.vmDir, vmUUID+".qcow2")
	// Remove existing disk if any
	os.Remove(vmDiskPath)

	diskSize := "20G" // Default size

	cmd := exec.Command("qemu-img", "create", "-f", "qcow2", vmDiskPath, diskSize)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to create vm disk: %w, output: %s", err, string(out))
	}

	// 2. Ensure ISO exists (Using DB lookup)
	isoPath, err := s.EnsureISO(osType)
	if err != nil {
		return fmt.Errorf("failed to ensure iso: %w", err)
	}

	// 3. Determine VNC graphics settings
	// GUI OS types that should have VNC enabled by default
	guiOSTypes := []string{"ubuntu-desktop", "kali", "windows", "windows10", "windows11"}
	isGUIOs := false
	for _, guiType := range guiOSTypes {
		if strings.Contains(strings.ToLower(osType), strings.ToLower(guiType)) {
			isGUIOs = true
			break
		}
	}

	// Determine if VNC should be enabled
	enableVNC := vncEnabled
	if !vncEnabled && isGUIOs {
		// Auto-enable VNC for GUI OS if not explicitly disabled
		enableVNC = true
		logger.Log.Info("Auto-enabling VNC for GUI OS", zap.String("os_type", osType), zap.String("vm_name", name))
	}

	// Determine graphics type
	graphicsTypeToUse := graphicsType
	if graphicsTypeToUse == "" {
		if enableVNC {
			graphicsTypeToUse = "vnc"
		} else {
			graphicsTypeToUse = "none"
		}
	}

	// 4. Define VM with CDROM boot enabled
	// Build graphics XML based on settings
	graphicsXML := ""
	if enableVNC && graphicsTypeToUse == "vnc" {
		graphicsXML = `    <graphics type='vnc' port='-1' autoport='yes' listen='0.0.0.0'>
      <listen type='address' address='0.0.0.0'/>
    </graphics>
    `
		logger.Log.Info("VNC graphics enabled for VM", zap.String("vm_name", name), zap.String("os_type", osType))
	} else if graphicsTypeToUse == "spice" {
		graphicsXML = `    <graphics type='spice' port='-1' autoport='yes' listen='0.0.0.0'>
      <listen type='address' address='0.0.0.0'/>
    </graphics>
    `
		logger.Log.Info("SPICE graphics enabled for VM", zap.String("vm_name", name))
	} else {
		logger.Log.Info("No graphics configured for VM", zap.String("vm_name", name), zap.String("graphics_type", graphicsTypeToUse))
	}

	// Build boot order XML (default: cdrom_hd for new VMs)
	bootOrder := models.BootOrderCDROMHD
	bootDevices := bootOrder.GetBootDevices()
	bootXML := ""
	for _, device := range bootDevices {
		bootXML += fmt.Sprintf("    <boot dev='%s'/>\n", device)
	}

	vmXML := fmt.Sprintf(`
<domain type='kvm'>
  <name>%s</name>
  <memory unit='KiB'>%d</memory>
  <vcpu placement='static'>%d</vcpu>
  <os>
    <type arch='x86_64' machine='pc-q35-7.2'>hvm</type>
%s
  </os>
  <features>
    <acpi/>
    <apic/>
    <vmport state='off'/>
  </features>
  <cpu mode='host-model' check='partial'/>
  <clock offset='utc'>
    <timer name='rtc' tickpolicy='catchup'/>
    <timer name='pit' tickpolicy='delay'/>
    <timer name='hpet' present='no'/>
  </clock>
  <on_poweroff>destroy</on_poweroff>
  <on_reboot>restart</on_reboot>
  <on_crash>destroy</on_crash>
  <pm>
    <suspend-to-mem enabled='no'/>
    <suspend-to-disk enabled='no'/>
  </pm>
  <devices>
    <emulator>/usr/bin/qemu-system-x86_64</emulator>
    
    <disk type='file' device='disk'>
      <driver name='qemu' type='qcow2'/>
      <source file='%s'/>
      <target dev='vda' bus='virtio'/>
      <address type='pci' domain='0x0000' bus='0x04' slot='0x00' function='0x0'/>
    </disk>
    
    <disk type='file' device='cdrom'>
      <driver name='qemu' type='raw'/>
      <source file='%s'/>
      <target dev='sda' bus='sata'/>
      <readonly/>
      <address type='drive' controller='0' bus='0' target='0' unit='0'/>
    </disk>

    <controller type='usb' index='0' model='qemu-xhci' ports='15'>
      <address type='pci' domain='0x0000' bus='0x02' slot='0x00' function='0x0'/>
    </controller>
    <controller type='pci' index='0' model='pcie-root'/>
    <controller type='pci' index='1' model='pcie-root-port'>
      <model name='pcie-root-port'/>
      <target chassis='1' port='0x10'/>
      <address type='pci' domain='0x0000' bus='0x00' slot='0x02' function='0x0' multifunction='on'/>
    </controller>
    <controller type='pci' index='2' model='pcie-root-port'>
      <model name='pcie-root-port'/>
      <target chassis='2' port='0x11'/>
      <address type='pci' domain='0x0000' bus='0x00' slot='0x02' function='0x1'/>
    </controller>
    <controller type='pci' index='3' model='pcie-root-port'>
      <model name='pcie-root-port'/>
      <target chassis='3' port='0x12'/>
      <address type='pci' domain='0x0000' bus='0x00' slot='0x02' function='0x2'/>
    </controller>
    <controller type='pci' index='4' model='pcie-root-port'>
      <model name='pcie-root-port'/>
      <target chassis='4' port='0x13'/>
      <address type='pci' domain='0x0000' bus='0x00' slot='0x02' function='0x3'/>
    </controller>
    <controller type='sata' index='0'>
      <address type='pci' domain='0x0000' bus='0x00' slot='0x1f' function='0x2'/>
    </controller>
    
    <interface type='network'>
      <mac address='52:54:00:e2:26:c5'/>
      <source network='default'/>
      <model type='virtio'/>
      <address type='pci' domain='0x0000' bus='0x01' slot='0x00' function='0x0'/>
    </interface>
    
    <serial type='pty'>
      <target type='isa-serial' port='0'>
        <model name='isa-serial'/>
      </target>
    </serial>
    <console type='pty'>
      <target type='serial' port='0'/>
    </console>
    
    <input type='mouse' bus='ps2'/>
    <input type='keyboard' bus='ps2'/>
    <input type='tablet' bus='usb'/>
    <video>
      <model type='virtio' heads='1' primary='yes'/>
      <address type='pci' domain='0x0000' bus='0x00' slot='0x01' function='0x0'/>
    </video>
    <memballoon model='virtio'>
      <address type='pci' domain='0x0000' bus='0x00' slot='0x05' function='0x0'/>
    </memballoon>
%s</devices>
</domain>
`, name, memoryMB*1024, vcpu, bootXML, vmDiskPath, isoPath, graphicsXML)

	dom, err := s.driver.DomainDefineXML(vmXML)
	if err != nil {
		return fmt.Errorf("failed to define domain: %w", err)
	}
	defer safeFreeDomain(dom)

	if err := dom.Create(); err != nil {
		return fmt.Errorf("failed to start domain: %w", err)
	}

	return nil
}

func (s *VMService) ListVMs() ([]string, error) {
	return nil, nil
}

func (s *VMService) DeleteVM(name string) error {
	return s.withLibvirtGuard("DeleteVM", func() error {
		return s.deleteVMInternal(name)
	})
}

func (s *VMService) deleteVMInternal(name string) error {
	// First, get VM from DB to retrieve UUID for disk file cleanup
	var vmRec models.VM
	if err := s.db.Where("name = ?", name).First(&vmRec).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			logger.Log.Warn("VM not found in DB, proceeding with libvirt cleanup only", zap.String("vm_name", name))
			// Still try to cleanup libvirt and disk files even if not in DB
		} else {
			logger.Log.Error("Failed to query VM from DB", zap.String("vm_name", name), zap.Error(err))
			// Continue with cleanup anyway - might be a transient DB issue
		}
		// Set empty struct to avoid nil pointer issues
		vmRec = models.VM{}
	}

	// 1. Try to cleanup Libvirt Domain
	dom, err := s.driver.LookupDomainByName(name)
	if err == nil {
		defer safeFreeDomain(dom)

		active, err := dom.IsActive()
		if err == nil && active {
			if err := dom.Destroy(); err != nil {
				logger.Log.Warn("Failed to destroy domain", zap.String("vm_name", name), zap.Error(err))
			}
		}

		if err := dom.UndefineFlags(0); err != nil {
			logger.Log.Warn("Failed to undefine domain", zap.String("vm_name", name), zap.Error(err))
		}
	} else {
		logger.Log.Info("Domain not found in libvirt, proceeding to cleanup", zap.String("vm_name", name))
	}

	// 2. Remove VM disk and all related files from vmDir
	// Try UUID-based filename first (current format)
	if vmRec.UUID != "" {
		vmDiskPath := filepath.Join(s.vmDir, vmRec.UUID+".qcow2")
		if err := os.Remove(vmDiskPath); err != nil && !os.IsNotExist(err) {
			logger.Log.Warn("Failed to remove disk file (UUID)", zap.String("path", vmDiskPath), zap.Error(err))
		} else if err == nil {
			logger.Log.Info("VM disk file removed (UUID)", zap.String("path", vmDiskPath))
		}
	}

	// Also try name-based filename (legacy format)
	vmDiskPath := filepath.Join(s.vmDir, name+".qcow2")
	if err := os.Remove(vmDiskPath); err != nil && !os.IsNotExist(err) {
		logger.Log.Warn("Failed to remove disk file (name)", zap.String("path", vmDiskPath), zap.Error(err))
	} else if err == nil {
		logger.Log.Info("VM disk file removed (name)", zap.String("path", vmDiskPath))
	}

	// Also remove any snapshot files or other related files
	// Pattern: UUID.* or name.* (e.g., uuid.qcow2, name-snapshot1.qcow2, etc.)
	vmDirEntries, err := os.ReadDir(s.vmDir)
	if err == nil {
		for _, entry := range vmDirEntries {
			if !entry.IsDir() {
				fileName := entry.Name()
				// Check if file starts with VM UUID or name (to catch all related files)
				shouldRemove := false
				if vmRec.UUID != "" && len(fileName) >= len(vmRec.UUID) && fileName[:len(vmRec.UUID)] == vmRec.UUID {
					shouldRemove = true
				} else if len(fileName) >= len(name) && fileName[:len(name)] == name {
					shouldRemove = true
				}

				if shouldRemove {
					filePath := filepath.Join(s.vmDir, fileName)
					if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
						logger.Log.Warn("Failed to remove VM related file", zap.String("path", filePath), zap.Error(err))
					} else if err == nil {
						logger.Log.Info("VM related file removed", zap.String("path", filePath))
					}
				}
			}
		}
	}

	// 3. Remove related console_sessions first (foreign key constraint)
	// CRITICAL: Must delete console_sessions before deleting VM to avoid foreign key constraint violation
	// Only proceed with DB deletion if VM was found in DB
	if vmRec.ID > 0 {
		logger.Log.Info("Starting console_sessions deletion", zap.String("vm_name", name), zap.Uint("vm_id", vmRec.ID), zap.String("vm_uuid", vmRec.UUID))

		// Use transaction to ensure atomic deletion
		err := s.db.Transaction(func(tx *gorm.DB) error {
			// Delete console_sessions by vm_id (most reliable)
			// Use Unscoped() to perform hard delete (not soft delete)
			result := tx.Unscoped().Where("vm_id = ?", vmRec.ID).Delete(&models.ConsoleSession{})
			if result.Error != nil {
				logger.Log.Error("Failed to delete console sessions for VM by ID", zap.String("vm_name", name), zap.Uint("vm_id", vmRec.ID), zap.Error(result.Error))
				return fmt.Errorf("failed to delete console sessions: %w", result.Error)
			}
			if result.RowsAffected > 0 {
				logger.Log.Info("Console sessions deleted for VM by ID", zap.String("vm_name", name), zap.Uint("vm_id", vmRec.ID), zap.Int64("deleted_count", result.RowsAffected))
			} else {
				logger.Log.Debug("No console sessions found for VM by ID", zap.String("vm_name", name), zap.Uint("vm_id", vmRec.ID))
			}

			// Also try to delete by UUID as a safety measure
			// Use Unscoped() to perform hard delete (not soft delete)
			if vmRec.UUID != "" {
				result := tx.Unscoped().Where("vm_uuid = ? AND vm_id != ?", vmRec.UUID, vmRec.ID).Delete(&models.ConsoleSession{})
				if result.Error != nil {
					logger.Log.Warn("Failed to delete console sessions for VM by UUID", zap.String("vm_name", name), zap.String("vm_uuid", vmRec.UUID), zap.Error(result.Error))
					// Don't return error - this is just a safety check
				} else if result.RowsAffected > 0 {
					logger.Log.Info("Additional console sessions deleted for VM by UUID", zap.String("vm_name", name), zap.String("vm_uuid", vmRec.UUID), zap.Int64("deleted_count", result.RowsAffected))
				}
			}

			// Delete VM from DB (within same transaction)
			// Use Unscoped() to perform hard delete (not soft delete)
			result = tx.Unscoped().Where("id = ?", vmRec.ID).Delete(&models.VM{})
			if result.Error != nil {
				logger.Log.Error("Failed to delete VM from DB", zap.String("vm_name", name), zap.Uint("vm_id", vmRec.ID), zap.Error(result.Error))
				return fmt.Errorf("failed to delete VM from DB: %w", result.Error)
			}
			if result.RowsAffected == 0 {
				logger.Log.Warn("No VM record found in DB to delete", zap.String("vm_name", name), zap.Uint("vm_id", vmRec.ID))
			} else {
				logger.Log.Info("VM successfully deleted from DB (hard delete)", zap.String("vm_name", name), zap.Uint("vm_id", vmRec.ID), zap.Int64("rows_affected", result.RowsAffected))
			}

			return nil
		})

		if err != nil {
			logger.Log.Error("Transaction failed during VM deletion", zap.String("vm_name", name), zap.Error(err))
			return fmt.Errorf("failed to delete VM and related data: %w", err)
		}
	} else {
		// VM not found in DB - skip DB deletion but log it
		logger.Log.Info("VM not found in DB, skipping DB deletion", zap.String("vm_name", name))
	}

	return nil
}

func (s *VMService) StopVM(name string) error {
	return s.withLibvirtGuard("StopVM", func() error {
		dom, err := s.driver.LookupDomainByName(name)
		if err != nil {
		return err
	}
	defer safeFreeDomain(dom)

	if err := dom.Destroy(); err != nil {
		logger.Log.Warn("domain.Destroy failed", zap.String("vm_name", name), zap.Error(err))
		return fmt.Errorf("failed to destroy domain: %w", err)
	}
	return nil
	})
}

func (s *VMService) StartVM(name string) error {
	return s.withLibvirtGuard("StartVM", func() error {
		return s.startVMInternal(name)
	})
}

func (s *VMService) startVMInternal(name string) error {
	dom, err := s.driver.LookupDomainByName(name)
	if err != nil {
		return fmt.Errorf("VM not found: %w", err)
	}
	defer safeFreeDomain(dom)

	// Check if VM is already running
	active, err := dom.IsActive()
	if err != nil {
		return fmt.Errorf("failed to check VM status: %w", err)
	}
	if active {
		logger.Log.Info("VM is already running", zap.String("vm_name", name))
		// Even if running, ensure VNC is configured
		if err := s.ensureVNCGraphics(name); err != nil {
			logger.Log.Warn("Failed to ensure VNC graphics on running VM", zap.String("vm_name", name), zap.Error(err))
		}
		// Verify the VM is actually running and update DB status
		state, _, err := dom.GetState()
		if err == nil && state == DomainStateRunning {
			// Update DB to ensure status is synced
			var vmRec models.VM
			if err := s.db.Where("name = ?", name).First(&vmRec).Error; err == nil {
				if vmRec.Status != models.VMStatusRunning {
					vmRec.Status = models.VMStatusRunning
					if err := s.db.Save(&vmRec).Error; err != nil {
						logger.Log.Warn("Failed to sync VM status in DB", zap.String("vm_name", name), zap.Error(err))
					} else {
						logger.Log.Info("VM status synced to Running in DB", zap.String("vm_name", name))
					}
				}
			}
		}
		return nil
	}

	// Get BootOrder from database and apply it before starting
	var vmRec models.VM
	if err := s.db.Where("name = ?", name).First(&vmRec).Error; err == nil {
		if vmRec.BootOrder != "" && vmRec.BootOrder.IsValid() {
			if err := s.SetBootOrder(name, vmRec.BootOrder); err != nil {
				logger.Log.Warn("Failed to set boot order before starting VM",
					zap.String("vm_name", name),
					zap.String("boot_order", string(vmRec.BootOrder)),
					zap.Error(err))
				// Continue anyway - VM might start with default boot order
			} else {
				logger.Log.Info("Boot order applied before VM start",
					zap.String("vm_name", name),
					zap.String("boot_order", string(vmRec.BootOrder)))
			}
		}
	} else {
		logger.Log.Warn("Failed to get VM from database for boot order", zap.String("vm_name", name), zap.Error(err))
	}

	// Ensure VNC graphics is configured before starting
	// Note: This must be done before starting the VM, as DomainDefineXML cannot modify running VMs
	if err := s.ensureVNCGraphics(name); err != nil {
		logger.Log.Warn("Failed to ensure VNC graphics, VM may not have VNC access", zap.String("vm_name", name), zap.Error(err))
		// Continue anyway - VNC might already be configured or VM might start without it
	}

	// Start VM
	if err := dom.Create(); err != nil {
		// Check if error is related to ISO file
		errStr := err.Error()
		if strings.Contains(errStr, "Cannot access storage file") {
			// Extract ISO path from error
			return fmt.Errorf("ISO file not found. Please check VM configuration. Original error: %w", err)
		}
		// Check for other common errors
		if strings.Contains(errStr, "already exists") || strings.Contains(errStr, "already active") {
			// VM might have been started by another process, verify status
			active, checkErr := dom.IsActive()
			if checkErr == nil && active {
				logger.Log.Info("VM was already started by another process", zap.String("vm_name", name))
				return nil
			}
		}
		return fmt.Errorf("failed to start VM: %w", err)
	}

	// Optimized: Use context with timeout instead of fixed sleep
	// Wait for VM to fully start and VNC to initialize (max 10 seconds for slow systems)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	vmStarted := false
	var lastErr error
	for {
		select {
		case <-ctx.Done():
			// Check one more time before giving up
			active, err := dom.IsActive()
			if err == nil && active {
				vmStarted = true
				break
			}
			if !vmStarted {
				// Get more detailed error information
				state, reason, stateErr := dom.GetState()
				if stateErr == nil {
					logger.Log.Error("Timeout waiting for VM to start",
						zap.String("vm_name", name),
						zap.Int("state", int(state)),
						zap.Int("reason", int(reason)))
					return fmt.Errorf("VM failed to start within timeout period (state: %d, reason: %d)", state, reason)
				}
				logger.Log.Error("Timeout waiting for VM to start",
					zap.String("vm_name", name),
					zap.Error(lastErr))
				return fmt.Errorf("VM failed to start within timeout period: %w", lastErr)
			}
			break
		case <-ticker.C:
			active, err := dom.IsActive()
			if err != nil {
				lastErr = err
				// Continue checking - might be transient
				continue
			}
			if active {
				vmStarted = true
				// Double-check: Wait a bit more to ensure VM doesn't immediately crash
				time.Sleep(1 * time.Second)
				activeAgain, err := dom.IsActive()
				if err == nil && activeAgain {
					break
				} else {
					// VM started but immediately stopped - get state for better error
					state, reason, stateErr := dom.GetState()
					if stateErr == nil {
						logger.Log.Error("VM started but immediately stopped",
							zap.String("vm_name", name),
							zap.Int("state", int(state)),
							zap.Int("reason", int(reason)))
						return fmt.Errorf("VM started but immediately stopped (state: %d, reason: %d). Check boot configuration (disk, ISO, boot order)", state, reason)
					}
					return fmt.Errorf("VM started but immediately stopped: %w", err)
				}
			}
		}
		if vmStarted {
			break
		}
	}

	if !vmStarted {
		// Get final state for better error message
		state, reason, stateErr := dom.GetState()
		if stateErr == nil {
			return fmt.Errorf("VM failed to start: domain is not active after start command (state: %d, reason: %d)", state, reason)
		}
		return fmt.Errorf("VM failed to start: domain is not active after start command: %w", lastErr)
	}

	logger.Log.Info("VM successfully started and verified", zap.String("vm_name", name))
	return nil
}

// SetBootOrder sets the boot order for a VM
// AddTPMAndSecureBoot adds TPM 2.0 and Secure Boot to an existing Windows VM
func (s *VMService) AddTPMAndSecureBoot(name string) error {
	dom, err := s.driver.LookupDomainByName(name)
	if err != nil {
		return fmt.Errorf("VM not found: %w", err)
	}
	defer safeFreeDomain(dom)

	// Check if VM is running - need to stop it first
	active, err := dom.IsActive()
	if err != nil {
		return fmt.Errorf("failed to check VM status: %w", err)
	}
	if active {
		return fmt.Errorf("VM must be stopped before adding TPM and Secure Boot")
	}

	// Get current XML
	xmlDesc, err := dom.GetXMLDesc(0)
	if err != nil {
		return fmt.Errorf("failed to get VM XML: %w", err)
	}

	// Check if TPM already exists
	if strings.Contains(xmlDesc, "<tpm") {
		logger.Log.Info("TPM already exists in VM", zap.String("vm_name", name))
	}

	// Check if loader (UEFI) already exists
	if strings.Contains(xmlDesc, "<loader") {
		logger.Log.Info("UEFI loader already exists in VM", zap.String("vm_name", name))
	}

	// Parse XML
	var domainXML struct {
		XMLName xml.Name `xml:"domain"`
		OS      struct {
			Type    string `xml:"type,attr"`
			Arch    string `xml:"arch,attr"`
			Machine string `xml:"machine,attr"`
			Boot    []struct {
				Dev string `xml:"dev,attr"`
			} `xml:"boot"`
			Loader struct {
				Readonly string `xml:"readonly,attr"`
				Type     string `xml:"type,attr"`
				Content  string `xml:",chardata"`
			} `xml:"loader"`
			NVRAM string `xml:"nvram"`
		} `xml:"os"`
		Devices struct {
			XMLName xml.Name `xml:"devices"`
			Content string   `xml:",innerxml"`
		} `xml:"devices"`
	}

	if err := xml.Unmarshal([]byte(xmlDesc), &domainXML); err != nil {
		return fmt.Errorf("failed to parse VM XML: %w", err)
	}

	// Add loader and nvram to OS section if not present
	nvramPath := fmt.Sprintf("/var/lib/libvirt/qemu/nvram/%s_VARS.fd", name)
	nvramTemplate := "/usr/share/OVMF/OVMF_VARS_4M.fd"
	if _, err := os.Stat(nvramPath); os.IsNotExist(err) {
		if templateData, err := os.ReadFile(nvramTemplate); err == nil {
			if err := os.MkdirAll(filepath.Dir(nvramPath), 0755); err == nil {
				if err := os.WriteFile(nvramPath, templateData, 0644); err != nil {
					logger.Log.Warn("Failed to write NVRAM template", zap.String("path", nvramPath), zap.Error(err))
				}
			}
		}
	}

	// Modify XML to add TPM and Secure Boot
	// Add loader and nvram to OS section
	osSection := fmt.Sprintf(`    <type arch='%s' machine='%s'>hvm</type>
`, domainXML.OS.Arch, domainXML.OS.Machine)
	for _, boot := range domainXML.OS.Boot {
		osSection += fmt.Sprintf("    <boot dev='%s'/>\n", boot.Dev)
	}
	if !strings.Contains(xmlDesc, "<loader") {
		osSection += fmt.Sprintf(`    <loader readonly='yes' type='pflash'>/usr/share/OVMF/OVMF_CODE_4M.secboot.fd</loader>
    <nvram>%s</nvram>
`, nvramPath)
	}

	// Add TPM to devices section if not present
	tpmXML := `    <tpm model='tpm-tis'>
      <backend type='emulator' version='2.0'/>
    </tpm>
`
	devicesContent := domainXML.Devices.Content
	if !strings.Contains(devicesContent, "<tpm") {
		// Insert TPM before video device
		if strings.Contains(devicesContent, "<video") {
			devicesContent = strings.Replace(devicesContent, "<video", tpmXML+"    <video", 1)
		} else {
			// Add at the end of devices
			devicesContent += tpmXML
		}
	}

	// Reconstruct XML
	updatedXML := strings.Replace(xmlDesc, "<os>", "<os>\n"+osSection, 1)
	updatedXML = strings.Replace(updatedXML, domainXML.Devices.Content, devicesContent, 1)

	// Undefine and redefine domain
	if err := dom.Undefine(); err != nil {
		return fmt.Errorf("failed to undefine domain: %w", err)
	}

	if _, err := s.driver.DomainDefineXML(updatedXML); err != nil {
		return fmt.Errorf("failed to redefine domain with TPM and Secure Boot: %w", err)
	}

	logger.Log.Info("TPM and Secure Boot added to VM", zap.String("vm_name", name))
	return nil
}

func (s *VMService) SetBootOrder(name string, bootOrder models.BootOrder) error {
	if !bootOrder.IsValid() {
		return fmt.Errorf("invalid boot order: %s", bootOrder)
	}

	dom, err := s.driver.LookupDomainByName(name)
	if err != nil {
		// Check if error is "Domain not found"
		if strings.Contains(err.Error(), "Domain not found") || strings.Contains(err.Error(), "no domain with matching name") {
			// VM exists in DB but not in libvirt - this is a sync issue
			// We can't update libvirt config, but we can still update DB
			// Return a specific error that the handler can handle
			return fmt.Errorf("VM not found in libvirt: %w", err)
		}
		return fmt.Errorf("failed to lookup domain: %w", err)
	}
	defer safeFreeDomain(dom)

	// Get current XML
	xmlDesc, err := dom.GetXMLDescInactive()
	if err != nil {
		// If VM is running, try to get active XML
		xmlDesc, err = dom.GetXMLDescSecure()
		if err != nil {
			return fmt.Errorf("failed to get VM XML: %w", err)
		}
	}

	// Parse and update boot order
	updatedXML, err := s.updateBootOrder(xmlDesc, bootOrder)
	if err != nil {
		return fmt.Errorf("failed to update boot order: %w", err)
	}

	// Check if VM is running
	active, err := dom.IsActive()
	if err != nil {
		return fmt.Errorf("failed to check VM status: %w", err)
	}

	if active {
		// VM is running - need to undefine and redefine
		// Save current state
		if err := dom.UndefineFlags(1); err != nil {
			logger.Log.Warn("domain.UndefineFlags failed during update", zap.String("vm_name", name), zap.Error(err))
			return fmt.Errorf("failed to undefine domain for update: %w", err)
		}
	}

	// Define updated domain
	newDom, err := s.driver.DomainDefineXML(updatedXML)
	if err != nil {
		return fmt.Errorf("failed to redefine domain with new boot order: %w", err)
	}
	defer newDom.Free()

	logger.Log.Info("Boot order updated", zap.String("vm_name", name), zap.String("boot_order", string(bootOrder)))
	return nil
}

// FinalizeInstall removes CDROM device and marks installation as complete
// Boot order is preserved (not changed) - user can configure it separately
// This is the standard way to transition from installation mode to normal operation
// (equivalent to "Eject ISO" in VMware/VirtualBox, but boot order is user-configurable)
func (s *VMService) FinalizeInstall(name string) error {
	dom, err := s.driver.LookupDomainByName(name)
	if err != nil {
		return fmt.Errorf("VM not found: %w", err)
	}
	defer safeFreeDomain(dom)

	// 1. Check VM state - should be shutoff for safe transition
	state, _, err := dom.GetState()
	if err != nil {
		return fmt.Errorf("failed to get VM state: %w", err)
	}

	// If VM is running, attempt graceful shutdown
	if state == DomainStateRunning {
		logger.Log.Warn("VM is running during finalize install, attempting graceful shutdown",
			zap.String("vm_name", name))
		if err := dom.Shutdown(); err != nil {
			logger.Log.Warn("Failed to shutdown VM, attempting force destroy",
				zap.String("vm_name", name),
				zap.Error(err))
			// Try force destroy if graceful shutdown fails
			if destroyErr := dom.Destroy(); destroyErr != nil {
				logger.Log.Warn("Failed to force destroy VM, continuing anyway",
					zap.String("vm_name", name),
					zap.Error(destroyErr))
			}
		} else {
			// Wait up to 10 seconds for shutdown (reduced from 30 to avoid timeout)
			for i := 0; i < 10; i++ {
				time.Sleep(1 * time.Second)
				state, _, _ := dom.GetState()
				if state == DomainStateShutoff {
					logger.Log.Info("VM shutdown completed", zap.String("vm_name", name))
					break
				}
			}
			// If still running after 10 seconds, force destroy
			state, _, _ := dom.GetState()
			if state == DomainStateRunning {
				logger.Log.Warn("VM still running after graceful shutdown timeout, forcing destroy",
					zap.String("vm_name", name))
				if err := dom.Destroy(); err != nil {
					logger.Log.Warn("Failed to force destroy VM, continuing anyway",
						zap.String("vm_name", name),
						zap.Error(err))
				} else {
					// Wait a bit more for force destroy to complete
					time.Sleep(2 * time.Second)
				}
			}
		}
	}

	// 2. Get current XML
	xmlDesc, err := dom.GetXMLDesc(0)
	if err != nil {
		return fmt.Errorf("failed to get VM XML: %w", err)
	}

	// 3. Remove CDROM from boot order in <os> section
	osStartPattern := `<os>`
	osEndPattern := `</os>`
	osStartIdx := strings.Index(xmlDesc, osStartPattern)
	if osStartIdx == -1 {
		return fmt.Errorf("could not find <os> section in XML")
	}

	osEndIdx := strings.Index(xmlDesc[osStartIdx:], osEndPattern)
	if osEndIdx == -1 {
		return fmt.Errorf("could not find </os> closing tag")
	}
	osEndIdx += osStartIdx + len(osEndPattern)

	osSection := xmlDesc[osStartIdx:osEndIdx]

	// Remove <boot dev='cdrom'/> tags
	bootCDROMPattern := `\s*<boot dev='cdrom'/>\s*`
	bootCDROMRegex := regexp.MustCompile(bootCDROMPattern)
	osSectionCleaned := bootCDROMRegex.ReplaceAllString(osSection, "")

	// Ensure at least one <boot dev='hd'/> exists
	if !strings.Contains(osSectionCleaned, `<boot dev='hd'/>`) {
		// Find <type> tag and add boot after it
		typePattern := `<type[^>]*>.*?</type>`
		typeRegex := regexp.MustCompile(typePattern)
		typeMatch := typeRegex.FindString(osSectionCleaned)
		if typeMatch != "" {
			typeEndIdx := strings.Index(osSectionCleaned, typeMatch) + len(typeMatch)
			osSectionCleaned = osSectionCleaned[:typeEndIdx] + "\n    <boot dev='hd'/>" + osSectionCleaned[typeEndIdx:]
		}
	}

	// Rebuild XML with updated OS section
	updatedXML := xmlDesc[:osStartIdx] + osSectionCleaned + xmlDesc[osEndIdx:]

	// 4. Remove CDROM disk from devices section
	// Find and remove CDROM disk block (multiline pattern)
	cdromDiskPattern := `(?s)<disk type='file' device='cdrom'>.*?</disk>`
	cdromDiskRegex := regexp.MustCompile(cdromDiskPattern)
	updatedXML = cdromDiskRegex.ReplaceAllString(updatedXML, "")

	// 5. Update domain definition
	_, err = s.driver.DomainDefineXML(updatedXML)
	if err != nil {
		return fmt.Errorf("failed to update domain XML: %w", err)
	}

	// 6. Update database: set installation status to Installed (but preserve existing boot order)
	// Note: Boot order is NOT changed here - user may want to keep CDROM boot for reinstallation
	var vmRec models.VM
	if err := s.db.Where("name = ?", name).First(&vmRec).Error; err == nil {
		// Only update installation status, preserve boot order
		oldBootOrder := vmRec.BootOrder
		vmRec.InstallationStatus = models.InstallationStatusInstalled
		// Boot order is preserved - user can change it manually if needed
		if err := s.db.Save(&vmRec).Error; err != nil {
			logger.Log.Warn("Failed to update VM installation status in DB",
				zap.String("vm_name", name),
				zap.Error(err))
		} else {
			logger.Log.Info("VM installation finalized in database",
				zap.String("vm_name", name),
				zap.String("boot_order", string(vmRec.BootOrder)),
				zap.String("old_boot_order", string(oldBootOrder)),
				zap.String("installation_status", string(vmRec.InstallationStatus)))
		}
	}

	logger.Log.Info("VM installation finalized - CDROM removed, boot order preserved",
		zap.String("vm_name", name))

	return nil
}

// updateBootOrder updates the boot order in libvirt XML
func (s *VMService) updateBootOrder(xmlDesc string, bootOrder models.BootOrder) (string, error) {
	// Get boot devices from boot order
	bootDevices := bootOrder.GetBootDevices()

	// Build boot XML
	bootXML := ""
	for _, device := range bootDevices {
		bootXML += fmt.Sprintf("    <boot dev='%s'/>\n", device)
	}

	// Find and replace <os> section
	// Pattern: <os>...</os> with boot tags inside
	osStartPattern := `<os>`
	osEndPattern := `</os>`

	osStartIdx := strings.Index(xmlDesc, osStartPattern)
	if osStartIdx == -1 {
		return "", fmt.Errorf("could not find <os> section in XML")
	}

	osEndIdx := strings.Index(xmlDesc[osStartIdx:], osEndPattern)
	if osEndIdx == -1 {
		return "", fmt.Errorf("could not find </os> closing tag")
	}
	osEndIdx += osStartIdx + len(osEndPattern)

	// Extract the <os> section
	osSection := xmlDesc[osStartIdx:osEndIdx]

	// Find <type> tag to preserve it
	typePattern := `<type[^>]*>.*?</type>`
	typeRegex := regexp.MustCompile(typePattern)
	typeMatch := typeRegex.FindString(osSection)

	if typeMatch == "" {
		return "", fmt.Errorf("could not find <type> tag in <os> section")
	}

	// Remove existing boot tags from osSection
	bootTagPattern := `\s*<boot[^>]*/>\s*`
	bootRegex := regexp.MustCompile(bootTagPattern)
	osSectionWithoutBoot := bootRegex.ReplaceAllString(osSection, "")

	// Find <type> position in cleaned section
	typeMatchInCleaned := typeRegex.FindString(osSectionWithoutBoot)
	if typeMatchInCleaned == "" {
		return "", fmt.Errorf("could not find <type> tag after cleaning")
	}

	// Build new <os> section with type and new boot order
	// Find where to insert boot tags (after type tag)
	typeEndIdx := strings.Index(osSectionWithoutBoot, typeMatchInCleaned) + len(typeMatchInCleaned)
	newOSSection := osSectionWithoutBoot[:typeEndIdx] + "\n" + bootXML + osSectionWithoutBoot[typeEndIdx:]

	// Replace in original XML
	result := xmlDesc[:osStartIdx] + newOSSection + xmlDesc[osEndIdx:]

	return result, nil
}

// parseDomainXML parses VM XML and extracts disk information
func (s *VMService) parseDomainXML(xmlDesc string) (struct {
	Devices struct {
		Disks []struct {
			Type   string `xml:"type,attr"`
			Device string `xml:"device,attr"`
			Source struct {
				File string `xml:"file,attr"`
			} `xml:"source"`
			Target struct {
				Dev string `xml:"dev,attr"`
			} `xml:"target"`
		} `xml:"disk"`
	} `xml:"devices"`
}, error) {
	var domainXML struct {
		Devices struct {
			Disks []struct {
				Type   string `xml:"type,attr"`
				Device string `xml:"device,attr"`
				Source struct {
					File string `xml:"file,attr"`
				} `xml:"source"`
				Target struct {
					Dev string `xml:"dev,attr"`
				} `xml:"target"`
			} `xml:"disk"`
		} `xml:"devices"`
	}

	if err := xml.Unmarshal([]byte(xmlDesc), &domainXML); err != nil {
		return domainXML, fmt.Errorf("failed to parse VM XML: %w", err)
	}
	return domainXML, nil
}

// updateCDROMSource updates CDROM source in XML
// Uses string replacement but with proper escaping to handle special characters
func (s *VMService) updateCDROMSource(xmlDesc string, newSource string) (string, error) {
	domainXML, err := s.parseDomainXML(xmlDesc)
	if err != nil {
		return "", err
	}

	// Find CDROM disk and get current source
	var currentSource string
	var cdromFound bool
	for _, disk := range domainXML.Devices.Disks {
		if disk.Device == "cdrom" {
			cdromFound = true
			currentSource = disk.Source.File
			break
		}
	}

	if !cdromFound {
		return "", fmt.Errorf("CDROM device not found in VM configuration")
	}

	// Escape XML special characters in paths
	escapeXML := func(s string) string {
		s = strings.ReplaceAll(s, "&", "&amp;")
		s = strings.ReplaceAll(s, "<", "&lt;")
		s = strings.ReplaceAll(s, ">", "&gt;")
		s = strings.ReplaceAll(s, "'", "&apos;")
		s = strings.ReplaceAll(s, `"`, "&quot;")
		return s
	}

	// Build replacement patterns
	var oldPattern, newPattern string

	// Handle detach (newSource is empty)
	if newSource == "" {
		if currentSource == "" {
			// Already detached, nothing to do
			return xmlDesc, nil
		}
		// Remove existing source - try multiple patterns
		escapedCurrent := escapeXML(currentSource)

		// Try single quote pattern first
		oldPattern = fmt.Sprintf(`<source file='%s'/>`, escapedCurrent)
		if strings.Contains(xmlDesc, oldPattern) {
			newPattern = `<source/>`
		} else {
			// Try double quote pattern
			oldPattern = fmt.Sprintf(`<source file="%s"/>`, escapedCurrent)
			if strings.Contains(xmlDesc, oldPattern) {
				newPattern = `<source/>`
			} else {
				// Try with closing tag (single quote)
				oldPattern = fmt.Sprintf(`<source file='%s'></source>`, escapedCurrent)
				if strings.Contains(xmlDesc, oldPattern) {
					newPattern = `<source></source>`
				} else {
					// Try with closing tag (double quote)
					oldPattern = fmt.Sprintf(`<source file="%s"></source>`, escapedCurrent)
					if strings.Contains(xmlDesc, oldPattern) {
						newPattern = `<source></source>`
					} else {
						return "", fmt.Errorf("could not find CDROM source pattern in XML for detach")
					}
				}
			}
		}
	} else {
		// Handle attach (newSource is not empty)
		escapedNew := escapeXML(newSource)
		if currentSource == "" {
			// Empty source - look for <source/> or <source></source> or <source index='...'/>
			// Try <source/> first
			oldPattern = `<source/>`
			newPattern = fmt.Sprintf(`<source file='%s'/>`, escapedNew)
			if !strings.Contains(xmlDesc, oldPattern) {
				// Try <source></source>
				oldPattern = `<source></source>`
				newPattern = fmt.Sprintf(`<source file='%s'></source>`, escapedNew)
				if !strings.Contains(xmlDesc, oldPattern) {
					// Try <source index='1'/> (ejected state)
					oldPattern = `<source index='1'/>`
					newPattern = fmt.Sprintf(`<source file='%s'/>`, escapedNew)
					if !strings.Contains(xmlDesc, oldPattern) {
						// Try <source index='5'/> (another ejected state)
						oldPattern = `<source index='5'/>`
						newPattern = fmt.Sprintf(`<source file='%s'/>`, escapedNew)
					}
				}
			}
		} else {
			// Replace existing source
			escapedCurrent := escapeXML(currentSource)
			// Try both single and double quotes, with and without index attribute
			oldPattern = fmt.Sprintf(`<source file='%s'/>`, escapedCurrent)
			newPattern = fmt.Sprintf(`<source file='%s'/>`, escapedNew)
			if !strings.Contains(xmlDesc, oldPattern) {
				oldPattern = fmt.Sprintf(`<source file="%s"/>`, escapedCurrent)
				newPattern = fmt.Sprintf(`<source file="%s"/>`, escapedNew)
				if !strings.Contains(xmlDesc, oldPattern) {
					// Try with index attribute
					oldPattern = fmt.Sprintf(`<source file='%s' index='1'/>`, escapedCurrent)
					newPattern = fmt.Sprintf(`<source file='%s'/>`, escapedNew)
					if !strings.Contains(xmlDesc, oldPattern) {
						oldPattern = fmt.Sprintf(`<source file="%s" index="1"/>`, escapedCurrent)
						newPattern = fmt.Sprintf(`<source file="%s"/>`, escapedNew)
					}
				}
			}
		}
	}

	if !strings.Contains(xmlDesc, oldPattern) {
		return "", fmt.Errorf("could not find CDROM source pattern in XML")
	}

	updatedXML := strings.Replace(xmlDesc, oldPattern, newPattern, 1)
	return updatedXML, nil
}

// DetachMedia removes ISO/CDROM media from a VM
func (s *VMService) DetachMedia(name string) error {
	dom, err := s.driver.LookupDomainByName(name)
	if err != nil {
		return fmt.Errorf("VM not found: %w", err)
	}
	defer safeFreeDomain(dom)

	// Get current XML
	xmlDesc, err := dom.GetXMLDesc(0)
	if err != nil {
		return fmt.Errorf("failed to get VM XML: %w", err)
	}

	// Parse XML to find CDROM disk
	domainXML, err := s.parseDomainXML(xmlDesc)
	if err != nil {
		return err
	}

	// Find CDROM disk and get current ISO path for logging
	var currentISOPath string
	var cdromFound bool
	for _, disk := range domainXML.Devices.Disks {
		if disk.Device == "cdrom" {
			cdromFound = true
			currentISOPath = disk.Source.File
			break
		}
	}

	if !cdromFound {
		return fmt.Errorf("no CDROM device found in VM configuration")
	}

	// Update XML to remove source (empty source = no media)
	updatedXML, err := s.updateCDROMSource(xmlDesc, "")
	if err != nil {
		return fmt.Errorf("failed to update CDROM source: %w", err)
	}

	// Update domain definition
	_, err = s.driver.DomainDefineXML(updatedXML)
	if err != nil {
		return fmt.Errorf("failed to detach media: %w", err)
	}

	logger.Log.Info("CDROM media detached",
		zap.String("vm_name", name),
		zap.String("iso_path", currentISOPath))

	return nil
}

// AttachMedia attaches ISO/CDROM media to a VM
func (s *VMService) AttachMedia(name string, isoPath string) error {
	// Verify media file exists before proceeding (supports both ISO and .qcow2 files)
	if _, err := os.Stat(isoPath); os.IsNotExist(err) {
		return fmt.Errorf("Media file not found: %s", isoPath)
	}

	dom, err := s.driver.LookupDomainByName(name)
	if err != nil {
		// Check if error is "Domain not found"
		if strings.Contains(err.Error(), "Domain not found") || strings.Contains(err.Error(), "no domain with matching name") {
			return fmt.Errorf("VM not found in libvirt: %w", err)
		}
		return fmt.Errorf("VM not found: %w", err)
	}
	defer safeFreeDomain(dom)

	// Get current XML
	xmlDesc, err := dom.GetXMLDesc(0)
	if err != nil {
		return fmt.Errorf("failed to get VM XML: %w", err)
	}

	// Parse XML to check if CDROM exists
	domainXML, err := s.parseDomainXML(xmlDesc)
	if err != nil {
		return err
	}

	// Find CDROM disk
	var cdromExists bool
	for _, disk := range domainXML.Devices.Disks {
		if disk.Device == "cdrom" {
			cdromExists = true
			break
		}
	}

	if !cdromExists {
		return fmt.Errorf("CDROM device not found in VM configuration. Please recreate VM with ISO support")
	}

	// Update XML with new ISO path
	updatedXML, err := s.updateCDROMSource(xmlDesc, isoPath)
	if err != nil {
		return fmt.Errorf("failed to update CDROM source: %w", err)
	}

	// Update domain definition
	_, err = s.driver.DomainDefineXML(updatedXML)
	if err != nil {
		return fmt.Errorf("failed to attach media: %w", err)
	}

	logger.Log.Info("CDROM media attached",
		zap.String("vm_name", name),
		zap.String("iso_path", isoPath))

	return nil
}

// GetCurrentMedia returns the currently attached media (ISO) path for a VM
func (s *VMService) GetCurrentMedia(name string) (string, error) {
	dom, err := s.driver.LookupDomainByName(name)
	if err != nil {
		return "", fmt.Errorf("VM not found: %w", err)
	}
	defer safeFreeDomain(dom)

	// Get current XML
	xmlDesc, err := dom.GetXMLDesc(0)
	if err != nil {
		return "", fmt.Errorf("failed to get VM XML: %w", err)
	}

	// Parse XML to find CDROM disk
	domainXML, err := s.parseDomainXML(xmlDesc)
	if err != nil {
		return "", err
	}

	// Find CDROM disk and get current ISO path
	for _, disk := range domainXML.Devices.Disks {
		if disk.Device == "cdrom" {
			if disk.Source.File != "" {
				return disk.Source.File, nil
			}
			// CDROM exists but no media attached
			return "", nil
		}
	}

	// No CDROM device found
	return "", fmt.Errorf("no CDROM device found in VM configuration")
}

// ListISOs returns a list of available ISO files in the ISO directory
func (s *VMService) ListISOs() ([]map[string]interface{}, error) {
	files, err := os.ReadDir(s.isoDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []map[string]interface{}{}, nil // Return empty list if directory doesn't exist
		}
		return nil, fmt.Errorf("failed to read ISO directory: %w", err)
	}

	var isos []map[string]interface{}
	for _, file := range files {
		if file.IsDir() {
			continue
		}

		// Check if file has ISO extension (case-insensitive)
		name := file.Name()
		ext := strings.ToLower(filepath.Ext(name))
		if ext != ".iso" && ext != ".img" {
			continue
		}

		// Get file info
		info, err := file.Info()
		if err != nil {
			logger.Log.Warn("Failed to get file info", zap.String("file", name), zap.Error(err))
			continue
		}

		fullPath := filepath.Join(s.isoDir, name)
		isos = append(isos, map[string]interface{}{
			"name":     name,
			"path":     fullPath,
			"size":     info.Size(),
			"modified": info.ModTime().Format(time.RFC3339),
		})
	}

	return isos, nil
}

func (s *VMService) GetVNCPort(name string) (string, error) {
	// Retry getting VNC port with exponential backoff (max 5 seconds)
	maxRetries := 10
	retryDelay := 200 * time.Millisecond

	for attempt := 0; attempt < maxRetries; attempt++ {
		dom, err := s.driver.LookupDomainByName(name)
		if err != nil {
			return "", fmt.Errorf("VM not found: %w", err)
		}

		// Check if VM is running
		active, err := dom.IsActive()
		if err != nil {
			safeFreeDomain(dom)
			return "", fmt.Errorf("failed to check VM status: %w", err)
		}
		if !active {
			safeFreeDomain(dom)
			return "", fmt.Errorf("VM is not running")
		}

		xmlDesc, err := dom.GetXMLDesc(0)
		if err != nil {
			safeFreeDomain(dom)
			return "", fmt.Errorf("failed to get VM XML: %w", err)
		}
		safeFreeDomain(dom)

		var domainXML struct {
			Devices struct {
				Graphics []struct {
					Type     string `xml:"type,attr"`
					Port     string `xml:"port,attr"`
					AutoPort string `xml:"autoport,attr"`
				} `xml:"graphics"`
			} `xml:"devices"`
		}

		if err := xml.Unmarshal([]byte(xmlDesc), &domainXML); err != nil {
			return "", fmt.Errorf("failed to parse VM XML: %w", err)
		}

		for _, g := range domainXML.Devices.Graphics {
			if g.Type == "vnc" {
				// If autoport is enabled, get the actual port from libvirt
				if g.AutoPort == "yes" || g.Port == "-1" {
					// Use virsh vncdisplay command to get the actual port
					cmd := exec.Command("virsh", "vncdisplay", name)
					output, err := cmd.CombinedOutput()
					if err == nil {
						// Output format: :0 or :1 etc, port is 5900 + display number
						outputStr := strings.TrimSpace(string(output))
						if strings.HasPrefix(outputStr, ":") {
							var displayNum int
							if _, err := fmt.Sscanf(outputStr, ":%d", &displayNum); err == nil {
								port := 5900 + displayNum
								// Verify the port is actually listening
								if s.verifyVNCPort(port) {
									return fmt.Sprintf("%d", port), nil
								}
								// Port not ready yet, continue retry
							}
						}
					}
					// If virsh command failed or port not ready, try to find port by scanning
					// Only scan on last attempt to avoid unnecessary overhead
					if attempt == maxRetries-1 {
						for port := 5900; port < 6000; port++ {
							if s.verifyVNCPort(port) {
								return fmt.Sprintf("%d", port), nil
							}
						}
					}
					// Port not ready yet, wait and retry
					if attempt < maxRetries-1 {
						time.Sleep(retryDelay)
						retryDelay = time.Duration(float64(retryDelay) * 1.5) // Exponential backoff
						continue
					}
					return "", fmt.Errorf("VNC port not found after %d attempts (autoport enabled but port not determined)", maxRetries)
				}
				if g.Port != "" && g.Port != "-1" {
					return g.Port, nil
				}
			}
		}

		// If we get here, VNC graphics not found - no need to retry
		return "", fmt.Errorf("VNC graphics not found in VM configuration")
	}

	return "", fmt.Errorf("VNC port not found after %d attempts", maxRetries)
}

// verifyVNCPort checks if a VNC port is actually listening
func (s *VMService) verifyVNCPort(port int) bool {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("localhost:%d", port), 200*time.Millisecond)
	if err == nil {
		conn.Close()
		return true
	}
	return false
}

// ensureVNCGraphics ensures VNC graphics is configured in VM XML
// If VNC graphics is missing, it will be added automatically
// Note: This function should be called before starting the VM, as DomainDefineXML cannot modify running VMs
func (s *VMService) ensureVNCGraphics(name string) error {
	dom, err := s.driver.LookupDomainByName(name)
	if err != nil {
		return fmt.Errorf("VM not found: %w", err)
	}
	defer safeFreeDomain(dom)

	// Check if VM is running - if so, we cannot modify the domain definition
	active, err := dom.IsActive()
	if err != nil {
		return fmt.Errorf("failed to check VM status: %w", err)
	}
	if active {
		// VM is running, check if VNC is already configured
		// We cannot modify running VMs, so just verify VNC exists
		xmlDesc, err := dom.GetXMLDesc(0)
		if err != nil {
			return fmt.Errorf("failed to get VM XML: %w", err)
		}
		if strings.Contains(xmlDesc, "type='vnc'") {
			// VNC already configured
			return nil
		}
		// VNC not configured but VM is running - cannot modify
		logger.Log.Warn("VM is running but VNC graphics is not configured, cannot modify running VM", zap.String("vm_name", name))
		return nil // Don't fail, just log warning
	}

	// Get current XML (VM is not running, so we can modify it)
	xmlDesc, err := dom.GetXMLDesc(0)
	if err != nil {
		return fmt.Errorf("failed to get VM XML: %w", err)
	}

	// Parse XML to check if VNC graphics exists
	var domainXML struct {
		Devices struct {
			Graphics []struct {
				Type     string `xml:"type,attr"`
				Port     string `xml:"port,attr"`
				AutoPort string `xml:"autoport,attr"`
			} `xml:"graphics"`
		} `xml:"devices"`
	}

	if err := xml.Unmarshal([]byte(xmlDesc), &domainXML); err != nil {
		return fmt.Errorf("failed to parse VM XML: %w", err)
	}

	// Check if VNC graphics already exists
	hasVNC := false
	for _, g := range domainXML.Devices.Graphics {
		if g.Type == "vnc" {
			hasVNC = true
			break
		}
	}

	if hasVNC {
		// VNC already configured, nothing to do
		return nil
	}

	// VNC graphics not found, add it
	logger.Log.Info("VNC graphics not found, adding to VM configuration", zap.String("vm_name", name))

	// Find the closing </devices> tag and insert VNC graphics before it
	// We'll insert it after the last device (before </devices>)
	// Look for </devices> and insert before it
	devicesCloseTag := "</devices>"
	if !strings.Contains(xmlDesc, devicesCloseTag) {
		return fmt.Errorf("could not find </devices> tag in VM XML")
	}

	// Insert VNC graphics configuration before </devices>
	vncConfig := `    <graphics type='vnc' port='-1' autoport='yes' listen='0.0.0.0'>
      <listen type='address' address='0.0.0.0'/>
    </graphics>
`

	// Find the position to insert (before </devices>)
	insertPos := strings.LastIndex(xmlDesc, devicesCloseTag)
	if insertPos == -1 {
		return fmt.Errorf("could not find </devices> tag in VM XML")
	}

	// Insert VNC config before </devices>
	updatedXML := xmlDesc[:insertPos] + vncConfig + xmlDesc[insertPos:]

	// Update domain definition
	_, err = s.driver.DomainDefineXML(updatedXML)
	if err != nil {
		return fmt.Errorf("failed to add VNC graphics to VM: %w", err)
	}

	logger.Log.Info("VNC graphics added to VM configuration", zap.String("vm_name", name))
	return nil
}

func (s *VMService) UpdateVM(name string, memoryMB int, vcpu int) error {
	dom, err := s.driver.LookupDomainByName(name)
	if err != nil {
		// Check if error is "Domain not found"
		if strings.Contains(err.Error(), "Domain not found") || strings.Contains(err.Error(), "no domain with matching name") {
			// VM exists in DB but not in libvirt - this is a sync issue
			// We can't update libvirt config, but we can still update DB
			// Return a specific error that the handler can handle
			return fmt.Errorf("VM not found in libvirt: %w", err)
		}
		return fmt.Errorf("failed to lookup domain: %w", err)
	}
	defer safeFreeDomain(dom)

	active, err := dom.IsActive()
	if err == nil && active {
		return fmt.Errorf("vm must be stopped to update resources")
	}

	// Get current max vCPU count from XML (works for stopped VMs)
	xmlDesc, err := dom.GetXMLDesc(0)
	if err != nil {
		return fmt.Errorf("failed to get VM XML: %w", err)
	}

	// Parse XML to get max vCPU
	var domainXML struct {
		VCPU struct {
			Placement string `xml:"placement,attr"`
			Text      string `xml:",chardata"`
		} `xml:"vcpu"`
	}
	if err := xml.Unmarshal([]byte(xmlDesc), &domainXML); err != nil {
		return fmt.Errorf("failed to parse VM XML: %w", err)
	}

	maxVcpu := uint(0)
	if domainXML.VCPU.Text != "" {
		if parsed, err := strconv.ParseUint(domainXML.VCPU.Text, 10, 32); err == nil {
			maxVcpu = uint(parsed)
		}
	}

	// Fallback: if XML parsing failed or returned 0, use the requested vCPU as max
	if maxVcpu == 0 {
		maxVcpu = uint(vcpu)
	}

	// If requested vCPU is greater than max, update max first
	if uint(vcpu) > maxVcpu {
		// DOMAIN_VCPU_MAXIMUM = 1 (set maximum)
		maxVcpuFlags := uint32(1) // DOMAIN_VCPU_MAXIMUM
		if err := dom.SetVcpusFlags(uint(vcpu), maxVcpuFlags); err != nil {
			return fmt.Errorf("failed to set max vcpus: %w", err)
		}
	}

	// Update Memory (Config)
	// DOMAIN_AFFECT_CONFIG = 2
	memFlags := uint32(2) // DOMAIN_MEM_CURRENT // DOMAIN_MEM_CURRENT

	if err := dom.SetMemoryFlags(uint64(memoryMB*1024), memFlags); err != nil {
		return fmt.Errorf("failed to set memory: %w", err)
	}

	// Update VCPU (Config)
	// DOMAIN_VCPU_CONFIG = 2
	vcpuFlags := uint32(2) // DOMAIN_VCPU_LIVE // DOMAIN_VCPU_LIVE
	if err := dom.SetVcpusFlags(uint(vcpu), vcpuFlags); err != nil {
		return fmt.Errorf("failed to set vcpus: %w", err)
	}

	return nil
}
