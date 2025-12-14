// Package validator provides input validation functions.
package validator

import (
	"fmt"
)

// ValidateVMName validates a VM name.
func ValidateVMName(name string) error {
	if name == "" {
		return fmt.Errorf("VM name is required")
	}
	if len(name) < 3 {
		return fmt.Errorf("VM name must be at least 3 characters")
	}
	if len(name) > 64 {
		return fmt.Errorf("VM name must be at most 64 characters")
	}
	// Allow alphanumeric, hyphen, underscore
	for _, r := range name {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_') {
			return fmt.Errorf("VM name can only contain alphanumeric characters, hyphens, and underscores")
		}
	}
	return nil
}

// ValidateCPU validates CPU count.
func ValidateCPU(cpu int) error {
	if cpu < 1 {
		return fmt.Errorf("CPU must be at least 1")
	}
	if cpu > 32 {
		return fmt.Errorf("CPU must be at most 32")
	}
	return nil
}

// ValidateMemory validates memory amount in MB.
func ValidateMemory(memory int) error {
	if memory < 512 {
		return fmt.Errorf("Memory must be at least 512MB")
	}
	if memory > 65536 {
		return fmt.Errorf("Memory must be at most 65536MB (64GB)")
	}
	// Memory should be a multiple of 256MB for better performance
	if memory%256 != 0 {
		return fmt.Errorf("Memory should be a multiple of 256MB")
	}
	return nil
}

// ValidateOSType validates OS type.
func ValidateOSType(osType string) error {
	validTypes := []string{
		"ubuntu-desktop",
		"ubuntu-server",
		"kali",
		"windows",
	}
	for _, valid := range validTypes {
		if osType == valid {
			return nil
		}
	}
	return fmt.Errorf("Invalid OS type. Valid types: %v", validTypes)
}

// ValidateVMAction validates VM action.
func ValidateVMAction(action string) error {
	validActions := []string{
		"start",
		"stop",
		"delete",
		"update",
	}
	for _, valid := range validActions {
		if action == valid {
			return nil
		}
	}
	return fmt.Errorf("Invalid action. Valid actions: %v", validActions)
}


