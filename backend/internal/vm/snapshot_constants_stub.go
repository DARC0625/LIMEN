//go:build !libvirt
// +build !libvirt

package vm

// Snapshot constants stub (for !libvirt builds)
var (
	SnapshotCreateAtomic       uint32 = 0
	SnapshotCreateDiskOnly     uint32 = 0
	SnapshotDeleteChildren     uint32 = 0
	SnapshotRevertRunning      uint32 = 0
	SnapshotRevertForce        uint32 = 0
	SnapshotDeleteMetadataOnly uint32 = 0
)
