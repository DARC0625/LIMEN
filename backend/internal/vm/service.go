package vm

import (
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
		return nil, fmt.Errorf("failed to create ISO directory: %v", err)
	}
	if err := os.MkdirAll(vmDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create VM directory: %v", err)
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

	// Ensure path uses correct project directory (LIMEN)
	if strings.Contains(imagePath, "/home/darc0/projects/") && !strings.Contains(imagePath, "/home/darc0/projects/LIMEN") {
		// Replace any old project paths with LIMEN
		imagePath = strings.Replace(imagePath, "/home/darc0/projects/", "/home/darc0/projects/LIMEN/", 1)
		// Update DB with corrected path
		image.Path = imagePath
		if err := s.db.Save(&image).Error; err != nil {
			logger.Log.Warn("Failed to update image path in DB", zap.String("os_type", osType), zap.Error(err))
		} else {
			logger.Log.Info("Updated image path in DB", zap.String("os_type", osType), zap.String("new_path", imagePath))
		}
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
		return fmt.Errorf("failed to create vm disk: %v, output: %s", err, string(out))
	}

	// 2. Ensure ISO exists (Using DB lookup)
	isoPath, err := s.EnsureISO(osType)
	if err != nil {
		return fmt.Errorf("failed to ensure iso: %v", err)
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
		return fmt.Errorf("failed to define domain: %v", err)
	}

	if err := dom.Create(); err != nil {
		return fmt.Errorf("failed to start domain: %v", err)
	}

	return nil
}

func (s *VMService) ListVMs() ([]string, error) {
	return nil, nil
}

func (s *VMService) DeleteVM(name string) error {
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
	vmDiskPath := filepath.Join(s.vmDir, name+".qcow2")
	if err := os.Remove(vmDiskPath); err != nil && !os.IsNotExist(err) {
		logger.Log.Warn("Failed to remove disk file", zap.String("path", vmDiskPath), zap.Error(err))
	} else {
		logger.Log.Info("VM disk file removed", zap.String("path", vmDiskPath))
	}

	// Also remove any snapshot files or other related files
	// Pattern: name.* (e.g., name.qcow2, name-snapshot1.qcow2, etc.)
	vmDirEntries, err := os.ReadDir(s.vmDir)
	if err == nil {
		for _, entry := range vmDirEntries {
			if !entry.IsDir() {
				fileName := entry.Name()
				// Check if file starts with VM name (to catch all related files)
				if len(fileName) >= len(name) && fileName[:len(name)] == name {
					filePath := filepath.Join(s.vmDir, fileName)
					if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
						logger.Log.Warn("Failed to remove VM related file", zap.String("path", filePath), zap.Error(err))
					} else {
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
		return fmt.Errorf("VM not found: %v", err)
	}
	defer dom.Free()

	// Check if VM is already running
	active, err := dom.IsActive()
	if err != nil {
		return fmt.Errorf("failed to check VM status: %v", err)
	}
	if active {
		logger.Log.Info("VM is already running", zap.String("vm_name", name))
		return nil
	}

	// Start VM
	if err := dom.Create(); err != nil {
		// Check if error is related to ISO file
		errStr := err.Error()
		if strings.Contains(errStr, "Cannot access storage file") {
			// Extract ISO path from error
			return fmt.Errorf("ISO file not found. Please check VM configuration. Original error: %v", err)
		}
		return fmt.Errorf("failed to start VM: %v", err)
	}

	// Wait for VM to fully start and VNC to initialize
	// VNC port assignment can take a few seconds
	time.Sleep(3 * time.Second)

	return nil
}

func (s *VMService) GetVNCPort(name string) (string, error) {
	// Retry getting VNC port with exponential backoff (max 5 seconds)
	maxRetries := 10
	retryDelay := 200 * time.Millisecond
	
	for attempt := 0; attempt < maxRetries; attempt++ {
		dom, err := s.conn.LookupDomainByName(name)
		if err != nil {
			return "", fmt.Errorf("VM not found: %v", err)
		}

		// Check if VM is running
		active, err := dom.IsActive()
		if err != nil {
			dom.Free()
			return "", fmt.Errorf("failed to check VM status: %v", err)
		}
		if !active {
			dom.Free()
			return "", fmt.Errorf("VM is not running")
		}

		xmlDesc, err := dom.GetXMLDesc(0)
		if err != nil {
			dom.Free()
			return "", fmt.Errorf("failed to get VM XML: %v", err)
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
			return "", fmt.Errorf("failed to parse VM XML: %v", err)
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
		return fmt.Errorf("failed to get max vcpus: %v", err)
	}

	// If requested vCPU is greater than max, update max first
	if uint(vcpu) > maxVcpu {
		// DOMAIN_VCPU_MAXIMUM = 1 (set maximum)
		maxVcpuFlags := libvirt.DomainVcpuFlags(1)
		if err := dom.SetVcpusFlags(uint(vcpu), maxVcpuFlags); err != nil {
			return fmt.Errorf("failed to set max vcpus: %v", err)
		}
	}

	// Update Memory (Config)
	// DOMAIN_AFFECT_CONFIG = 2
	memFlags := libvirt.DomainMemoryModFlags(2)

	if err := dom.SetMemoryFlags(uint64(memoryMB*1024), memFlags); err != nil {
		return fmt.Errorf("failed to set memory: %v", err)
	}

	// Update VCPU (Config)
	// DOMAIN_VCPU_CONFIG = 2
	vcpuFlags := libvirt.DomainVcpuFlags(2)
	if err := dom.SetVcpusFlags(uint(vcpu), vcpuFlags); err != nil {
		return fmt.Errorf("failed to set vcpus: %v", err)
	}

	return nil
}
