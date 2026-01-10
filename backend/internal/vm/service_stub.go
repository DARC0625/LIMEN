//go:build !libvirt
// +build !libvirt

package vm

import (
	"fmt"
	"os"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/models"
	"gorm.io/gorm"
)

// VMService is a stub implementation when built without libvirt tag.
type VMService struct {
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

// NewVMService creates a new VM service (stub implementation).
func NewVMService(db *gorm.DB, libvirtURI, isoDir, vmDir string) (*VMService, error) {
	// Ensure directories exist with proper permissions
	if err := os.MkdirAll(isoDir, 0755); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(vmDir, 0755); err != nil {
		return nil, err
	}

	return &VMService{
		db:                db,
		isoDir:            isoDir,
		vmDir:             vmDir,
		operationSemaphore: make(chan struct{}, MaxConcurrentLibvirtOps),
		operationTimeout:   DefaultLibvirtTimeout,
	}, nil
}

// GetVMDir returns the VM directory path
func (s *VMService) GetVMDir() string {
	return s.vmDir
}

// Close closes the VM service (stub: no-op)
func (s *VMService) Close() {
	// Stub: no-op
}

// IsAlive checks if the VM service connection is alive (stub: always false)
func (s *VMService) IsAlive() bool {
	return false
}

// SyncVMStatus syncs VM status from libvirt to database (stub: no-op)
func (s *VMService) SyncVMStatus(vm *models.VM) error {
	return nil
}

// SyncAllVMStatuses syncs all VM statuses from libvirt to database (stub: no-op)
func (s *VMService) SyncAllVMStatuses() error {
	return nil
}

// GetVMStatusFromLibvirt gets the actual status from libvirt without updating DB (stub)
func (s *VMService) GetVMStatusFromLibvirt(vmName string) (models.VMStatus, error) {
	return models.VMStatusStopped, nil
}

// EnsureVMExists checks if VM exists in libvirt, if not marks it as stopped (stub: no-op)
func (s *VMService) EnsureVMExists(vm *models.VM) error {
	return nil
}

// CreateVM creates a new VM (stub: returns error)
// Note: Actual signature in service.go is different, but handlers expect this interface
func (s *VMService) CreateVM(name string, memoryMB int, vcpu int, osType string, vmUUID string, graphicsType string, vncEnabled bool) error {
	return fmt.Errorf("libvirt not available: VM creation requires libvirt build tag")
}

// DeleteVM deletes a VM (stub: returns error)
func (s *VMService) DeleteVM(name string) error {
	return fmt.Errorf("libvirt not available: VM deletion requires libvirt build tag")
}

// StartVM starts a VM (stub: returns error)
func (s *VMService) StartVM(name string) error {
	return fmt.Errorf("libvirt not available: VM start requires libvirt build tag")
}

// StopVM stops a VM (stub: returns error)
func (s *VMService) StopVM(name string) error {
	return fmt.Errorf("libvirt not available: VM stop requires libvirt build tag")
}

// EnsureISO ensures ISO file exists (stub: returns error)
func (s *VMService) EnsureISO(osType string) (string, error) {
	return "", fmt.Errorf("libvirt not available: EnsureISO requires libvirt build tag")
}

// ListVMs lists all VMs (stub: returns empty list)
func (s *VMService) ListVMs() ([]string, error) {
	return []string{}, nil
}

// GetCurrentMedia gets the current media for a VM (stub: returns error)
func (s *VMService) GetCurrentMedia(name string) (string, error) {
	return "", fmt.Errorf("libvirt not available: GetCurrentMedia requires libvirt build tag")
}

// GetVNCPort gets the VNC port for a VM (stub: returns error)
func (s *VMService) GetVNCPort(name string) (int, error) {
	return 0, fmt.Errorf("libvirt not available: GetVNCPort requires libvirt build tag")
}

// ListISOs lists available ISO files (stub: returns empty list)
func (s *VMService) ListISOs() ([]string, error) {
	return []string{}, nil
}

// DetachMedia detaches media from a VM (stub: returns error)
func (s *VMService) DetachMedia(name string) error {
	return fmt.Errorf("libvirt not available: DetachMedia requires libvirt build tag")
}

// AttachMedia attaches media to a VM (stub: returns error)
func (s *VMService) AttachMedia(name string, isoPath string) error {
	return fmt.Errorf("libvirt not available: AttachMedia requires libvirt build tag")
}

// SetBootOrder sets the boot order for a VM (stub: returns error)
func (s *VMService) SetBootOrder(name string, bootOrder models.BootOrder) error {
	return fmt.Errorf("libvirt not available: SetBootOrder requires libvirt build tag")
}

// FinalizeInstall finalizes VM installation (stub: returns error)
func (s *VMService) FinalizeInstall(name string) error {
	return fmt.Errorf("libvirt not available: FinalizeInstall requires libvirt build tag")
}

// UpdateVM updates a VM (stub: returns error)
func (s *VMService) UpdateVM(name string, memoryMB int, vcpu int) error {
	return fmt.Errorf("libvirt not available: VM update requires libvirt build tag")
}
