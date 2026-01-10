//go:build libvirt
// +build libvirt

package vm

import (
	"fmt"

	libvirt "github.com/libvirt/libvirt-go"
)

// libvirtSnapshot wraps libvirt.DomainSnapshot to implement Snapshot interface.
type libvirtSnapshot struct {
	snap *libvirt.DomainSnapshot
}

func (d *libvirtDomain) CreateSnapshotXML(xml string, flags uint32) (Snapshot, error) {
	snap, err := d.dom.CreateSnapshotXML(xml, libvirt.DomainSnapshotCreateFlags(flags))
	if err != nil {
		return nil, fmt.Errorf("failed to create snapshot: %w", err)
	}
	return &libvirtSnapshot{snap: snap}, nil
}

func (s *libvirtSnapshot) Free() error {
	return s.snap.Free()
}

func (s *libvirtSnapshot) GetXMLDesc(flags uint32) (string, error) {
	return s.snap.GetXMLDesc(libvirt.DomainSnapshotXMLFlags(flags))
}

func (s *libvirtSnapshot) Delete(flags uint32) error {
	return s.snap.Delete(libvirt.DomainSnapshotDeleteFlags(flags))
}

func (s *libvirtSnapshot) RevertToSnapshot(flags uint32) error {
	return s.snap.RevertToSnapshot(libvirt.DomainSnapshotRevertFlags(flags))
}
