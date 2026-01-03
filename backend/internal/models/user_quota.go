package models

import (
	"fmt"

	"gorm.io/gorm"
)

// GetOrCreateUserQuota retrieves or creates a user quota with default values.
func GetOrCreateUserQuota(db *gorm.DB, userID uint) (*UserQuota, error) {
	var quota UserQuota
	err := db.Where("user_id = ?", userID).First(&quota).Error
	if err == gorm.ErrRecordNotFound {
		// Create default user quota
		quota = UserQuota{
			UserID:    userID,
			MaxVMs:    3,    // Default: 3 VMs per user
			MaxCPU:    4,    // Default: 4 vCPU total
			MaxMemory: 4096, // Default: 4GB total
			MaxDisk:   100,  // Default: 100GB total
		}
		if err := db.Create(&quota).Error; err != nil {
			return nil, err
		}
		return &quota, nil
	}
	if err != nil {
		return nil, err
	}
	return &quota, nil
}

// CheckUserQuota checks if the user can create a VM with the given resources.
func (q *UserQuota) CheckUserQuota(db *gorm.DB, cpu, memory, disk int) error {
	// Get current resource usage for this user
	var currentVMs int64
	var currentCPU int
	var currentMemory int
	var currentDisk int

	// Count user's VMs
	if err := db.Model(&VM{}).Where("owner_id = ?", q.UserID).Count(&currentVMs).Error; err != nil {
		return err
	}

	// Get user's VMs to calculate resource usage
	var vms []VM
	if err := db.Where("owner_id = ?", q.UserID).Find(&vms).Error; err != nil {
		return err
	}

	for _, vm := range vms {
		currentCPU += vm.CPU
		currentMemory += vm.Memory
		// Disk size estimation (simplified - assume 20GB per VM)
		currentDisk += 20
	}

	// Check limits
	if int(currentVMs) >= q.MaxVMs {
		return &QuotaError{
			Resource:  "VMs",
			Current:   int(currentVMs),
			Limit:     q.MaxVMs,
			Requested: 1,
		}
	}

	if currentCPU+cpu > q.MaxCPU {
		return &QuotaError{
			Resource:  "CPU",
			Current:   currentCPU,
			Limit:     q.MaxCPU,
			Requested: cpu,
		}
	}

	if currentMemory+memory > q.MaxMemory {
		return &QuotaError{
			Resource:  "Memory",
			Current:   currentMemory,
			Limit:     q.MaxMemory,
			Requested: memory,
		}
	}

	if currentDisk+disk > q.MaxDisk {
		return &QuotaError{
			Resource:  "Disk",
			Current:   currentDisk,
			Limit:     q.MaxDisk,
			Requested: disk,
		}
	}

	return nil
}

// CheckVMResourceLimits checks if the requested VM specs exceed user's limits.
func (q *UserQuota) CheckVMResourceLimits(cpu, memory int) error {
	// Check individual VM resource limits (max per VM)
	maxCPUPerVM := 4    // Max 4 vCPU per VM
	maxMemoryPerVM := 8192 // Max 8GB per VM

	if cpu > maxCPUPerVM {
		return fmt.Errorf("CPU limit exceeded: requested %d, max %d per VM", cpu, maxCPUPerVM)
	}

	if memory > maxMemoryPerVM {
		return fmt.Errorf("Memory limit exceeded: requested %d MB, max %d MB per VM", memory, maxMemoryPerVM)
	}

	return nil
}

