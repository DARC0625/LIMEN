// Package models provides type-safe status constants.
package models

// VMStatus represents the state of a virtual machine.
type VMStatus string

const (
	VMStatusRunning  VMStatus = "Running"
	VMStatusStopped  VMStatus = "Stopped"
	VMStatusCreating VMStatus = "Creating"
	VMStatusDeleting VMStatus = "Deleting"
	VMStatusError    VMStatus = "Error"
)

// String returns the string representation of the status.
func (s VMStatus) String() string {
	return string(s)
}

// IsValid checks if the status is valid.
func (s VMStatus) IsValid() bool {
	switch s {
	case VMStatusRunning, VMStatusStopped, VMStatusCreating, VMStatusDeleting, VMStatusError:
		return true
	}
	return false
}

// VMAction represents a VM action.
type VMAction string

const (
	VMActionStart  VMAction = "start"
	VMActionStop   VMAction = "stop"
	VMActionDelete VMAction = "delete"
	VMActionUpdate VMAction = "update"
)

// String returns the string representation of the action.
func (a VMAction) String() string {
	return string(a)
}

// IsValid checks if the action is valid.
func (a VMAction) IsValid() bool {
	switch a {
	case VMActionStart, VMActionStop, VMActionDelete, VMActionUpdate:
		return true
	}
	return false
}

// BootOrder represents the boot order for a VM.
type BootOrder string

const (
	BootOrderCDROMHD BootOrder = "cdrom_hd" // CDROM first, then HDD (for installation)
	BootOrderHD      BootOrder = "hd"       // HDD only (for normal use)
	BootOrderCDROM   BootOrder = "cdrom"    // CDROM only (for ISO-only boot)
	BootOrderHDCDROM BootOrder = "hd_cdrom" // HDD first, then CDROM (for recovery)
)

// String returns the string representation of the boot order.
func (bo BootOrder) String() string {
	return string(bo)
}

// IsValid checks if the boot order is valid.
func (bo BootOrder) IsValid() bool {
	switch bo {
	case BootOrderCDROMHD, BootOrderHD, BootOrderCDROM, BootOrderHDCDROM:
		return true
	}
	return false
}

// GetBootDevices returns the boot devices in order.
func (bo BootOrder) GetBootDevices() []string {
	switch bo {
	case BootOrderCDROMHD:
		return []string{"cdrom", "hd"}
	case BootOrderHD:
		return []string{"hd"}
	case BootOrderCDROM:
		return []string{"cdrom"}
	case BootOrderHDCDROM:
		return []string{"hd", "cdrom"}
	default:
		return []string{"cdrom", "hd"} // Default to installation mode
	}
}

// InstallationStatus represents the installation status of a VM.
type InstallationStatus string

const (
	InstallationStatusNotInstalled InstallationStatus = "NotInstalled"
	InstallationStatusInstalling   InstallationStatus = "Installing"
	InstallationStatusInstalled    InstallationStatus = "Installed"
	InstallationStatusFailed       InstallationStatus = "InstallationFailed"
)

// String returns the string representation of the installation status.
func (is InstallationStatus) String() string {
	return string(is)
}

// IsValid checks if the installation status is valid.
func (is InstallationStatus) IsValid() bool {
	switch is {
	case InstallationStatusNotInstalled, InstallationStatusInstalling, InstallationStatusInstalled, InstallationStatusFailed:
		return true
	}
	return false
}
