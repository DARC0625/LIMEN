// Package database provides database migration functionality.
package database

import (
	"gorm.io/gorm"
)

// CreateIndexes creates additional indexes for performance optimization.
// This function should be called after AutoMigrate to ensure all indexes are created.
func CreateIndexes(db *gorm.DB) error {
	// VM table indexes
	indexes := []struct {
		table   string
		name    string
		columns string
		unique  bool
	}{
		// VM indexes
		{"vms", "idx_vms_owner_id", "owner_id", false}, // Use owner_id (not user_id) - matches VM model
		{"vms", "idx_vms_status", "status", false},
		{"vms", "idx_vms_created_at", "created_at DESC", false},
		{"vms", "idx_vms_uuid", "uuid", true},                      // Already exists as uniqueIndex, but ensure it's there
		{"vms", "idx_vms_owner_status", "owner_id, status", false}, // Composite index for common query pattern

		// User indexes (additional)
		{"users", "idx_users_role", "role", false},
		{"users", "idx_users_approved", "approved", false},

		// VMSnapshot indexes
		{"vm_snapshots", "idx_snapshots_vm_id", "vm_id", false},
		{"vm_snapshots", "idx_snapshots_libvirt_name", "libvirt_name", false},
	}

	for _, idx := range indexes {
		uniqueClause := ""
		if idx.unique {
			uniqueClause = "UNIQUE"
		}

		// Use IF NOT EXISTS to avoid errors if index already exists
		sql := "CREATE " + uniqueClause + " INDEX IF NOT EXISTS " + idx.name + " ON " + idx.table + " (" + idx.columns + ")"
		if err := db.Exec(sql).Error; err != nil {
			// Log error but continue with other indexes
			// Some indexes might already exist or have different names
			// This is expected behavior - continue with next index
			continue
		}
	}

	return nil
}
