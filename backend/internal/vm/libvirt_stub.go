//go:build !libvirt
// +build !libvirt

package vm

import (
	"errors"
)

var ErrLibvirtDisabled = errors.New("libvirt disabled in this build")

// stubDriver implements LibvirtDriver as a stub.
type stubDriver struct{}

// stubDomain implements Domain as a stub.
type stubDomain struct{}

// NewLibvirtDriver creates a stub libvirt driver.
func NewLibvirtDriver() LibvirtDriver {
	return &stubDriver{}
}

func (d *stubDriver) Connect(uri string) error {
	return ErrLibvirtDisabled
}

func (d *stubDriver) Close() error {
	return nil
}

func (d *stubDriver) IsAlive() bool {
	return false
}

func (d *stubDriver) LookupDomainByName(name string) (Domain, error) {
	return nil, ErrLibvirtDisabled
}

func (d *stubDriver) DomainDefineXML(xml string) (Domain, error) {
	return nil, ErrLibvirtDisabled
}

func (d *stubDriver) Domain() Domain {
	return &stubDomain{}
}

// stubDomain implementation

func (d *stubDomain) Free() error {
	return nil
}

func (d *stubDomain) IsActive() (bool, error) {
	return false, ErrLibvirtDisabled
}

func (d *stubDomain) GetState() (DomainState, int, error) {
	return DomainStateShutoff, 0, ErrLibvirtDisabled
}

func (d *stubDomain) GetXMLDesc(flags uint32) (string, error) {
	return "", ErrLibvirtDisabled
}

func (d *stubDomain) GetXMLDescInactive() (string, error) {
	return "", ErrLibvirtDisabled
}

func (d *stubDomain) GetXMLDescSecure() (string, error) {
	return "", ErrLibvirtDisabled
}

func (d *stubDomain) Create() error {
	return ErrLibvirtDisabled
}

func (d *stubDomain) Destroy() error {
	return ErrLibvirtDisabled
}

func (d *stubDomain) Shutdown() error {
	return ErrLibvirtDisabled
}

func (d *stubDomain) UndefineFlags(flags uint32) error {
	return ErrLibvirtDisabled
}

func (d *stubDomain) Undefine() error {
	return ErrLibvirtDisabled
}

func (d *stubDomain) SetVcpusFlags(vcpu uint, flags uint32) error {
	return ErrLibvirtDisabled
}

func (d *stubDomain) SetMemoryFlags(memory uint64, flags uint32) error {
	return ErrLibvirtDisabled
}

func (d *stubDomain) GetVcpusFlags(flags uint32) (int, error) {
	return 0, ErrLibvirtDisabled
}

func (d *stubDomain) GetMemoryStats(flags uint32) (map[string]uint64, error) {
	return nil, ErrLibvirtDisabled
}
