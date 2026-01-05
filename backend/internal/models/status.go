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
