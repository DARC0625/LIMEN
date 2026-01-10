//go:build !libvirt
// +build !libvirt

package vm

import "errors"

func (d *stubDomain) CreateSnapshotXML(xml string, flags uint32) (Snapshot, error) {
	return nil, ErrLibvirtDisabled
}

type stubSnapshot struct{}

func (s *stubSnapshot) Free() error {
	return nil
}

func (s *stubSnapshot) GetXMLDesc(flags uint32) (string, error) {
	return "", ErrLibvirtDisabled
}

func (s *stubSnapshot) Delete(flags uint32) error {
	return ErrLibvirtDisabled
}

func (s *stubSnapshot) RevertToSnapshot(flags uint32) error {
	return ErrLibvirtDisabled
}
