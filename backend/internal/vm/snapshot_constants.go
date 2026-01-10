//go:build libvirt
// +build libvirt

package vm

import libvirt "github.com/libvirt/libvirt-go"

// Snapshot constants from libvirt
var (
	SnapshotCreateAtomic     = libvirt.DOMAIN_SNAPSHOT_CREATE_ATOMIC
	SnapshotCreateDiskOnly   = libvirt.DOMAIN_SNAPSHOT_CREATE_DISK_ONLY
	SnapshotDeleteChildren   = libvirt.DOMAIN_SNAPSHOT_DELETE_CHILDREN
	SnapshotRevertRunning    = libvirt.DOMAIN_SNAPSHOT_REVERT_RUNNING
	SnapshotRevertForce       = libvirt.DOMAIN_SNAPSHOT_REVERT_FORCE
	SnapshotDeleteMetadataOnly = libvirt.DOMAIN_SNAPSHOT_DELETE_METADATA_ONLY
)
