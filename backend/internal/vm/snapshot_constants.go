//go:build libvirt
// +build libvirt

package vm

import libvirt "github.com/libvirt/libvirt-go"

// Snapshot constants from libvirt
var (
	SnapshotCreateAtomic       uint32 = uint32(libvirt.DOMAIN_SNAPSHOT_CREATE_ATOMIC)
	SnapshotCreateDiskOnly     uint32 = uint32(libvirt.DOMAIN_SNAPSHOT_CREATE_DISK_ONLY)
	SnapshotDeleteChildren     uint32 = uint32(libvirt.DOMAIN_SNAPSHOT_DELETE_CHILDREN)
	SnapshotRevertRunning      uint32 = uint32(libvirt.DOMAIN_SNAPSHOT_REVERT_RUNNING)
	SnapshotRevertForce        uint32 = uint32(libvirt.DOMAIN_SNAPSHOT_REVERT_FORCE)
	SnapshotDeleteMetadataOnly uint32 = uint32(libvirt.DOMAIN_SNAPSHOT_DELETE_METADATA_ONLY)
)
