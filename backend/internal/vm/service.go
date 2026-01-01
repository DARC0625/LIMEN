package vm

import (
	"context"
	"encoding/xml"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/libvirt/libvirt-go"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type VMService struct {
	conn   *libvirt.Connect
	db     *gorm.DB
	isoDir string
	vmDir  string
}

func NewVMService(db *gorm.DB, libvirtURI, isoDir, vmDir string) (*VMService, error) {
	conn, err := libvirt.NewConnect(libvirtURI)
	if err != nil {
		return nil, err
	}

	// Ensure directories exist with proper permissions
	if err := os.MkdirAll(isoDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create ISO directory: %w", err)
	}
	if err := os.MkdirAll(vmDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create VM directory: %w", err)
	}

	return &VMService{
		conn:   conn,
		db:     db,
		isoDir: isoDir,
		vmDir:  vmDir,
	}, nil
}

func (s *VMService) Close() {
	if s.conn != nil {
		s.conn.Close()
	}
}

func (s *VMService) IsAlive() bool {
	if s.conn == nil {
		return false
	}
	res, err := s.conn.IsAlive()
	if err != nil {
		return false
	}
	return res
}

func (s *VMService) EnsureISO(osType string) (string, error) {
	var image models.VMImage
	if err := s.db.Where("os_type = ?", osType).First(&image).Error; err != nil {
		return "", fmt.Errorf("image not found for os type: %s", osType)
	}

	imagePath := image.Path

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

	return "", fmt.Errorf("iso file not found at %s. please upload it manually", imagePath)
}

func (s *VMService) CreateVM(name string, memoryMB int, vcpu int, osType string, vmUUID string) error {
	// 0. Cleanup existing resources (Libvirt domain and Disk)
	// Check if domain exists in libvirt and cleanup
	if dom, err := s.conn.LookupDomainByName(name); err == nil {
		if active, _ := dom.IsActive(); active {
			dom.Destroy()
		}
		dom.Undefine()
		dom.Free()
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

	// 3. Define VM with CDROM boot enabled
	vmXML := fmt.Sprintf(`
<domain type='kvm'>
  <name>%s</name>
  <memory unit='KiB'>%d</memory>
  <vcpu placement='static'>%d</vcpu>
  <os>
    <type arch='x86_64' machine='pc-q35-7.2'>hvm</type>
    <boot dev='cdrom'/>
    <boot dev='hd'/>
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
    <graphics type='vnc' port='-1' autoport='yes' listen='0.0.0.0'>
      <listen type='address' address='0.0.0.0'/>
    </graphics>
    <video>
      <model type='virtio' heads='1' primary='yes'/>
      <address type='pci' domain='0x0000' bus='0x00' slot='0x01' function='0x0'/>
    </video>
    <memballoon model='virtio'>
      <address type='pci' domain='0x0000' bus='0x00' slot='0x05' function='0x0'/>
    </memballoon>
  </devices>
</domain>
`, name, memoryMB*1024, vcpu, vmDiskPath, isoPath)

	dom, err := s.conn.DomainDefineXML(vmXML)
	if err != nil {
		return fmt.Errorf("failed to define domain: %w", err)
	}
	defer dom.Free()

	if err := dom.Create(); err != nil {
		return fmt.Errorf("failed to start domain: %w", err)
	}

	return nil
}

func (s *VMService) ListVMs() ([]string, error) {
	return nil, nil
}

func (s *VMService) DeleteVM(name string) error {
	// First, get VM from DB to retrieve UUID for disk file cleanup
	var vmRec models.VM
	if err := s.db.Where("name = ?", name).First(&vmRec).Error; err != nil {
		logger.Log.Warn("VM not found in DB, proceeding with libvirt cleanup only", zap.String("vm_name", name), zap.Error(err))
	}

	// 1. Try to cleanup Libvirt Domain
	dom, err := s.conn.LookupDomainByName(name)
	if err == nil {
		defer dom.Free()

		active, err := dom.IsActive()
		if err == nil && active {
			if err := dom.Destroy(); err != nil {
				logger.Log.Warn("Failed to destroy domain", zap.String("vm_name", name), zap.Error(err))
			}
		}

		if err := dom.Undefine(); err != nil {
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

	// 3. Remove from DB (Hard delete)
	if err := s.db.Unscoped().Where("name = ?", name).Delete(&models.VM{}).Error; err != nil {
		logger.Log.Error("Failed to delete VM from DB", zap.String("vm_name", name), zap.Error(err))
	}

	return nil
}

func (s *VMService) StopVM(name string) error {
	dom, err := s.conn.LookupDomainByName(name)
	if err != nil {
		return err
	}
	defer dom.Free()

	return dom.Destroy()
}

func (s *VMService) StartVM(name string) error {
	dom, err := s.conn.LookupDomainByName(name)
	if err != nil {
		return fmt.Errorf("VM not found: %w", err)
	}
	defer dom.Free()

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
		return nil
	}

	// Ensure VNC graphics is configured before starting
	if err := s.ensureVNCGraphics(name); err != nil {
		logger.Log.Warn("Failed to ensure VNC graphics, VM may not have VNC access", zap.String("vm_name", name), zap.Error(err))
	}

	// Start VM
	if err := dom.Create(); err != nil {
		// Check if error is related to ISO file
		errStr := err.Error()
		if strings.Contains(errStr, "Cannot access storage file") {
			// Extract ISO path from error
			return fmt.Errorf("ISO file not found. Please check VM configuration. Original error: %w", err)
		}
		return fmt.Errorf("failed to start VM: %w", err)
	}

	// Optimized: Use context with timeout instead of fixed sleep
	// Wait for VM to fully start and VNC to initialize (max 5 seconds)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	
	vmStarted := false
	for {
		select {
		case <-ctx.Done():
			logger.Log.Warn("Timeout waiting for VM to start", zap.String("vm_name", name))
			break
		case <-ticker.C:
			active, err := dom.IsActive()
			if err == nil && active {
				vmStarted = true
				break
			}
		}
		if vmStarted {
			break
		}
	}

	return nil
}

// RestartVM restarts a VM (stops and starts)
// Media is not automatically detached - user must manually detach if needed
func (s *VMService) RestartVM(name string) error {
	// Ensure VNC graphics is configured before restarting
	if err := s.ensureVNCGraphics(name); err != nil {
		logger.Log.Warn("Failed to ensure VNC graphics before restart, VM may not have VNC access", zap.String("vm_name", name), zap.Error(err))
	}

	// Stop VM first
	if err := s.StopVM(name); err != nil {
		return fmt.Errorf("failed to stop VM: %w", err)
	}
	
	// Wait a moment for VM to fully stop (optimized: use shorter wait with status check)
	time.Sleep(1 * time.Second)
	
	// Verify VM is stopped before starting
	maxWait := 5 * time.Second
	waitInterval := 500 * time.Millisecond
	for elapsed := time.Duration(0); elapsed < maxWait; elapsed += waitInterval {
		dom, err := s.conn.LookupDomainByName(name)
		if err != nil {
			break // VM might not exist, try to start anyway
		}
		active, _ := dom.IsActive()
		dom.Free() // Free libvirt domain resource immediately after use
		if !active {
			break // VM is stopped
		}
		time.Sleep(waitInterval)
	}
	
	// Start VM
	if err := s.StartVM(name); err != nil {
		return fmt.Errorf("failed to start VM: %w", err)
	}
	
	return nil
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
			// Empty source - look for <source/> or <source></source>
			oldPattern = `<source/>`
			newPattern = fmt.Sprintf(`<source file='%s'/>`, escapedNew)
			// Also try with closing tag
			if !strings.Contains(xmlDesc, oldPattern) {
				oldPattern = `<source></source>`
				newPattern = fmt.Sprintf(`<source file='%s'></source>`, escapedNew)
			}
		} else {
			// Replace existing source
			escapedCurrent := escapeXML(currentSource)
			// Try both single and double quotes
			oldPattern = fmt.Sprintf(`<source file='%s'/>`, escapedCurrent)
			newPattern = fmt.Sprintf(`<source file='%s'/>`, escapedNew)
			if !strings.Contains(xmlDesc, oldPattern) {
				oldPattern = fmt.Sprintf(`<source file="%s"/>`, escapedCurrent)
				newPattern = fmt.Sprintf(`<source file="%s"/>`, escapedNew)
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
	dom, err := s.conn.LookupDomainByName(name)
	if err != nil {
		return fmt.Errorf("VM not found: %w", err)
	}
	defer dom.Free()

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
	_, err = s.conn.DomainDefineXML(updatedXML)
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
	// Verify ISO file exists before proceeding
	if _, err := os.Stat(isoPath); os.IsNotExist(err) {
		return fmt.Errorf("ISO file not found: %s", isoPath)
	}

	dom, err := s.conn.LookupDomainByName(name)
	if err != nil {
		return fmt.Errorf("VM not found: %w", err)
	}
	defer dom.Free()

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
	_, err = s.conn.DomainDefineXML(updatedXML)
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
	dom, err := s.conn.LookupDomainByName(name)
	if err != nil {
		return "", fmt.Errorf("VM not found: %w", err)
	}
	defer dom.Free()

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
		dom, err := s.conn.LookupDomainByName(name)
		if err != nil {
			return "", fmt.Errorf("VM not found: %w", err)
		}

		// Check if VM is running
		active, err := dom.IsActive()
		if err != nil {
			dom.Free()
			return "", fmt.Errorf("failed to check VM status: %w", err)
		}
		if !active {
			dom.Free()
			return "", fmt.Errorf("VM is not running")
		}

		xmlDesc, err := dom.GetXMLDesc(0)
		if err != nil {
			dom.Free()
			return "", fmt.Errorf("failed to get VM XML: %w", err)
		}
		dom.Free()

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
func (s *VMService) ensureVNCGraphics(name string) error {
	dom, err := s.conn.LookupDomainByName(name)
	if err != nil {
		return fmt.Errorf("VM not found: %w", err)
	}
	defer dom.Free()

	// Get current XML
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
	_, err = s.conn.DomainDefineXML(updatedXML)
	if err != nil {
		return fmt.Errorf("failed to add VNC graphics to VM: %w", err)
	}

	logger.Log.Info("VNC graphics added to VM configuration", zap.String("vm_name", name))
	return nil
}

func (s *VMService) UpdateVM(name string, memoryMB int, vcpu int) error {
	dom, err := s.conn.LookupDomainByName(name)
	if err != nil {
		return err
	}
	defer dom.Free()

	active, err := dom.IsActive()
	if err == nil && active {
		return fmt.Errorf("vm must be stopped to update resources")
	}

	// Get current max vCPU count
	maxVcpu, err := dom.GetMaxVcpus()
	if err != nil {
		return fmt.Errorf("failed to get max vcpus: %w", err)
	}

	// If requested vCPU is greater than max, update max first
	if uint(vcpu) > maxVcpu {
		// DOMAIN_VCPU_MAXIMUM = 1 (set maximum)
		maxVcpuFlags := libvirt.DomainVcpuFlags(1)
		if err := dom.SetVcpusFlags(uint(vcpu), maxVcpuFlags); err != nil {
			return fmt.Errorf("failed to set max vcpus: %w", err)
		}
	}

	// Update Memory (Config)
	// DOMAIN_AFFECT_CONFIG = 2
	memFlags := libvirt.DomainMemoryModFlags(2)

	if err := dom.SetMemoryFlags(uint64(memoryMB*1024), memFlags); err != nil {
		return fmt.Errorf("failed to set memory: %w", err)
	}

	// Update VCPU (Config)
	// DOMAIN_VCPU_CONFIG = 2
	vcpuFlags := libvirt.DomainVcpuFlags(2)
	if err := dom.SetVcpusFlags(uint(vcpu), vcpuFlags); err != nil {
		return fmt.Errorf("failed to set vcpus: %w", err)
	}

	return nil
}
