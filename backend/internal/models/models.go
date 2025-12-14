// Package models defines the database models using GORM.
package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User represents a system user.
type User struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	UUID      string         `gorm:"type:varchar(36);uniqueIndex" json:"uuid"` // Unique identifier (nullable initially for migration)
	Username  string         `gorm:"unique;not null" json:"username"`
	Password  string         `gorm:"not null" json:"-"` // Password hash, never exposed in JSON
	Role      UserRole       `gorm:"type:varchar(20);default:'user'" json:"role"` // User role: admin or user
	Approved  bool           `gorm:"default:false" json:"approved"` // Admin approval required
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"` // Soft delete
}

// BeforeCreate hook to generate UUID before creating a user
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.UUID == "" {
		u.UUID = uuid.New().String()
	}
	return nil
}

// IsAdmin checks if the user is an admin
func (u *User) IsAdmin() bool {
	return u.Role == RoleAdmin
}

// VM represents a virtual machine instance.
type VM struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	UUID      string         `gorm:"type:varchar(36);uniqueIndex" json:"uuid"` // Unique identifier (nullable initially for migration)
	Name      string         `gorm:"unique;not null" json:"name"`
	CPU       int            `gorm:"not null" json:"cpu"`        // Number of CPU cores
	Memory    int            `gorm:"not null" json:"memory"`    // Memory in MB
	Status    VMStatus       `gorm:"type:varchar(20);default:'Stopped'" json:"status"` // VM state
	OSType    string         `json:"os_type"`                    // OS type identifier
	OwnerID   uint           `gorm:"not null" json:"owner_id"`  // Foreign key to User
	Owner     User           `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"` // Soft delete
}

// BeforeCreate hook to generate UUID before creating a VM
func (v *VM) BeforeCreate(tx *gorm.DB) error {
	if v.UUID == "" {
		v.UUID = uuid.New().String()
	}
	return nil
}

// VMImage represents an OS image (ISO or disk image) that can be used to create VMs.
type VMImage struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Name        string         `gorm:"not null" json:"name"`        // Display name
	OSType      string         `json:"os_type"`                     // OS type for UI grouping
	Path        string         `gorm:"not null" json:"-"`          // Local filesystem path (not exposed)
	IsISO       bool           `gorm:"default:true" json:"is_iso"`  // true for ISO, false for disk image
	Description string         `json:"description"`                 // Optional description
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"` // Soft delete
}

// VMSnapshot represents a snapshot of a virtual machine.
type VMSnapshot struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	VMID        uint           `gorm:"not null;index" json:"vm_id"` // Foreign key to VM
	VM          VM             `gorm:"foreignKey:VMID" json:"vm,omitempty"`
	Name        string         `gorm:"not null" json:"name"`        // Snapshot name
	Description string         `json:"description"`                 // Optional description
	LibvirtName string         `gorm:"not null" json:"libvirt_name"` // libvirt snapshot name (UUID)
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"` // Soft delete
}
