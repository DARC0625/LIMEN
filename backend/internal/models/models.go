// Package models defines the database models using GORM.
package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User represents a system user.
type User struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	UUID       string         `gorm:"type:varchar(36);uniqueIndex" json:"uuid"`          // Unique identifier (nullable initially for migration)
	Username   string         `gorm:"unique;not null;index" json:"username"`             // Indexed for faster lookups
	Password   string         `gorm:"not null" json:"-"`                                 // Password hash, never exposed in JSON
	Role       UserRole       `gorm:"type:varchar(20);default:'user';index" json:"role"` // User role: admin or user - indexed for filtering
	Approved   bool           `gorm:"default:false;index" json:"approved"`               // Admin approval required - indexed for filtering
	BetaAccess bool           `gorm:"default:false;index" json:"beta_access"`            // Beta access permission - indexed for filtering
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"` // Soft delete
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
	UUID      string         `gorm:"type:varchar(36);uniqueIndex" json:"uuid"`               // Unique identifier (nullable initially for migration)
	Name      string         `gorm:"unique;not null;index" json:"name"`                      // Indexed for faster lookups
	CPU       int            `gorm:"not null" json:"cpu"`                                    // Number of CPU cores
	Memory    int            `gorm:"not null" json:"memory"`                                 // Memory in MB
	Status    VMStatus       `gorm:"type:varchar(20);default:'Stopped';index;index:idx_vm_owner_status" json:"status"` // VM state - indexed for filtering and composite index
	OSType    string         `gorm:"index" json:"os_type"`                                   // OS type identifier - indexed for filtering
	OwnerID   uint           `gorm:"not null;index;index:idx_vm_owner_status" json:"owner_id"` // Foreign key to User - indexed for joins and composite index
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
	Name        string         `gorm:"not null" json:"name"`       // Display name
	OSType      string         `gorm:"index" json:"os_type"`       // OS type for UI grouping - indexed for lookups
	Path        string         `gorm:"not null" json:"-"`          // Local filesystem path (not exposed)
	IsISO       bool           `gorm:"default:true" json:"is_iso"` // true for ISO, false for disk image
	Description string         `json:"description"`                // Optional description
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"` // Soft delete
}

// VMSnapshot represents a snapshot of a virtual machine.
type VMSnapshot struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	VMID        uint           `gorm:"not null;index;index:idx_snapshot_vm_name" json:"vm_id"` // Foreign key to VM - indexed for joins and composite index
	VM          VM             `gorm:"foreignKey:VMID" json:"vm,omitempty"`
	Name        string         `gorm:"not null;index:idx_snapshot_vm_name" json:"name"`         // Snapshot name - composite index with VMID
	Description string         `json:"description"`                  // Optional description
	LibvirtName string         `gorm:"not null;index" json:"libvirt_name"` // libvirt snapshot name (UUID) - indexed for lookups
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"` // Soft delete
}

// ConsoleSession represents a VNC/console session for a VM.
type ConsoleSession struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	SessionID      string         `gorm:"type:varchar(64);uniqueIndex;not null" json:"session_id"` // Unique session identifier
	UserID         uint           `gorm:"not null;index" json:"user_id"`                          // Foreign key to User
	User           User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	VMID           uint           `gorm:"not null;index" json:"vm_id"` // Foreign key to VM
	VM             VM             `gorm:"foreignKey:VMID" json:"vm,omitempty"`
	VMUUID         string         `gorm:"type:varchar(36);index" json:"vm_uuid"` // VM UUID for quick lookup
	StartedAt      time.Time      `gorm:"not null;index" json:"started_at"`     // Session start time
	LastActivityAt time.Time      `gorm:"not null;index" json:"last_activity_at"` // Last activity time (for idle timeout)
	EndedAt        *time.Time     `gorm:"index" json:"ended_at,omitempty"`       // Session end time (null if active)
	EndReason      string         `gorm:"type:varchar(50)" json:"end_reason,omitempty"` // Reason for ending: idle_timeout, max_duration, user_disconnect, error
	ClientIP       string         `gorm:"type:varchar(45)" json:"client_ip"`     // Client IP address
	UserAgent      string         `gorm:"type:text" json:"user_agent"`          // User agent string
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"` // Soft delete
}

// UserQuota represents per-user resource limits.
type UserQuota struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	UserID    uint           `gorm:"uniqueIndex;not null" json:"user_id"` // Foreign key to User (one quota per user)
	User      User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	MaxVMs    int            `gorm:"default:32" json:"max_vms"`        // Maximum number of VMs
	MaxCPU    int            `gorm:"default:128" json:"max_cpu"`        // Maximum total vCPU (increased from 4)
	MaxMemory int            `gorm:"default:524288" json:"max_memory"`  // Maximum total memory (MB) - 512GB (increased from 4GB)
	MaxDisk   int            `gorm:"default:10000" json:"max_disk"`     // Maximum total disk (GB) - 10TB (increased from 100GB)
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"` // Soft delete
}

// AuditLog represents an audit log entry for security and compliance.
type AuditLog struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	RequestID   string         `gorm:"type:varchar(64);index" json:"request_id"` // Request ID for tracing
	UserID      *uint          `gorm:"index" json:"user_id,omitempty"`           // User who performed the action (null for system)
	Username    string         `gorm:"type:varchar(100);index" json:"username"`   // Username (for quick lookup)
	Role        string         `gorm:"type:varchar(20);index" json:"role"`       // User role at time of action
	Action      string         `gorm:"type:varchar(100);index;not null" json:"action"` // Action performed (e.g., "vm.create", "console.connect")
	Resource    string         `gorm:"type:varchar(100);index" json:"resource,omitempty"` // Resource affected (e.g., "vm:uuid", "user:123")
	ResourceID  string         `gorm:"type:varchar(100);index" json:"resource_id,omitempty"` // Resource ID (VM UUID, User ID, etc.)
	Result      string         `gorm:"type:varchar(20);index;not null" json:"result"` // success, failure, denied
	ErrorCode   string         `gorm:"type:varchar(50)" json:"error_code,omitempty"` // Error code if failed
	ErrorMessage string        `gorm:"type:text" json:"error_message,omitempty"`     // Error message if failed
	ClientIP    string         `gorm:"type:varchar(45);index" json:"client_ip"`      // Client IP address
	UserAgent   string         `gorm:"type:text" json:"user_agent"`                 // User agent string
	Metadata    string         `gorm:"type:jsonb" json:"metadata,omitempty"`         // Additional metadata (JSON)
	CreatedAt   time.Time      `gorm:"index" json:"created_at"`                      // When the action occurred
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`                               // Soft delete (for compliance retention)
}
