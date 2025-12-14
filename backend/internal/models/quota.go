package models

import (
	"fmt"

	"gorm.io/gorm"
)

// ResourceQuota represents system-wide resource limits (shared by all users).
type ResourceQuota struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	MaxVMs    int    `gorm:"default:32" json:"max_vms"`            // Maximum number of VMs (same as MaxCPU)
	MaxCPU    int    `gorm:"default:32" json:"max_cpu"`           // Maximum total CPU cores
	MaxMemory int    `gorm:"default:192512" json:"max_memory"`    // Maximum total memory in MB (188GB)
	CreatedAt int64  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt int64  `gorm:"autoUpdateTime" json:"updated_at"`
}

// GetOrCreateQuota retrieves or creates the system-wide quota (shared by all users).
func GetOrCreateQuota(db *gorm.DB) (*ResourceQuota, error) {
	var quota ResourceQuota
	// System-wide quota has ID = 1 (or first record)
	err := db.First(&quota, 1).Error
	if err == gorm.ErrRecordNotFound {
		// Create default system-wide quota
		// MaxVMs is set to MaxCPU (they should be equal)
		quota = ResourceQuota{
			ID:        1,
			MaxVMs:    32, // Same as MaxCPU
			MaxCPU:    32,
			MaxMemory: 192512, // 188GB
		}
		if err := db.Create(&quota).Error; err != nil {
			return nil, err
		}
		return &quota, nil
	}
	if err != nil {
		return nil, err
	}
	
	// Ensure MaxVMs equals MaxCPU
	if quota.MaxVMs != quota.MaxCPU {
		quota.MaxVMs = quota.MaxCPU
		db.Save(&quota)
	}
	
	return &quota, nil
}

// CheckQuota checks if the system can create a VM with the given resources (system-wide check).
func (q *ResourceQuota) CheckQuota(db *gorm.DB, cpu, memory int) error {
	// Get current resource usage across ALL users (system-wide)
	var currentVMs int64
	var currentCPU int
	var currentMemory int

	// Count all VMs in the system (not per user)
	if err := db.Model(&VM{}).Count(&currentVMs).Error; err != nil {
		return err
	}

	// Only count Running VMs for resource usage (system-wide)
	var vms []VM
	if err := db.Where("status = ?", VMStatusRunning).Find(&vms).Error; err != nil {
		return err
	}

	for _, vm := range vms {
		currentCPU += vm.CPU
		currentMemory += vm.Memory
	}

	// Check limits (system-wide)
	if int(currentVMs) >= q.MaxVMs {
		return &QuotaError{
			Resource: "VMs",
			Current:  int(currentVMs),
			Limit:    q.MaxVMs,
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

	return nil
}

// QuotaError represents a quota exceeded error.
type QuotaError struct {
	Resource  string
	Current   int
	Limit     int
	Requested int
}

func (e *QuotaError) Error() string {
	return fmt.Sprintf("quota exceeded for %s: current %d + requested %d > limit %d", 
		e.Resource, e.Current, e.Requested, e.Limit)
}

