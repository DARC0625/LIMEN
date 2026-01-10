//go:build libvirt
// +build libvirt

package vm

import (
	"fmt"

	libvirt "github.com/libvirt/libvirt-go"
)

// libvirtDriver implements LibvirtDriver using real libvirt.
type libvirtDriver struct {
	conn *libvirt.Connect
	dom  *libvirt.Domain
}

// libvirtDomain wraps libvirt.Domain to implement Domain interface.
type libvirtDomain struct {
	dom *libvirt.Domain
}

// NewLibvirtDriver creates a new libvirt driver.
func NewLibvirtDriver() LibvirtDriver {
	return &libvirtDriver{}
}

func (d *libvirtDriver) Connect(uri string) error {
	conn, err := libvirt.NewConnect(uri)
	if err != nil {
		return fmt.Errorf("failed to connect to libvirt: %w", err)
	}
	d.conn = conn
	return nil
}

func (d *libvirtDriver) Close() error {
	if d.conn != nil {
		return d.conn.Close()
	}
	return nil
}

func (d *libvirtDriver) IsAlive() bool {
	if d.conn == nil {
		return false
	}
	res, err := d.conn.IsAlive()
	return err == nil && res
}

func (d *libvirtDriver) LookupDomainByName(name string) (Domain, error) {
	if d.conn == nil {
		return nil, fmt.Errorf("not connected to libvirt")
	}
	dom, err := d.conn.LookupDomainByName(name)
	if err != nil {
		return nil, err
	}
	return &libvirtDomain{dom: dom}, nil
}

func (d *libvirtDriver) DomainDefineXML(xml string) (Domain, error) {
	if d.conn == nil {
		return nil, fmt.Errorf("not connected to libvirt")
	}
	dom, err := d.conn.DomainDefineXML(xml)
	if err != nil {
		return nil, err
	}
	return &libvirtDomain{dom: dom}, nil
}

func (d *libvirtDriver) Domain() Domain {
	if d.dom == nil {
		return nil
	}
	return &libvirtDomain{dom: d.dom}
}

// libvirtDomain implementation

func (d *libvirtDomain) Free() error {
	return d.dom.Free()
}

func (d *libvirtDomain) IsActive() (bool, error) {
	return d.dom.IsActive()
}

func (d *libvirtDomain) GetState() (DomainState, int, error) {
	state, reason, err := d.dom.GetState()
	return DomainState(state), int(reason), err
}

func (d *libvirtDomain) GetXMLDesc(flags uint32) (string, error) {
	return d.dom.GetXMLDesc(libvirt.DomainXMLFlags(flags))
}

func (d *libvirtDomain) GetXMLDescInactive() (string, error) {
	return d.dom.GetXMLDesc(libvirt.DOMAIN_XML_INACTIVE)
}

func (d *libvirtDomain) GetXMLDescSecure() (string, error) {
	return d.dom.GetXMLDesc(libvirt.DOMAIN_XML_SECURE)
}

func (d *libvirtDomain) Create() error {
	return d.dom.Create()
}

func (d *libvirtDomain) Destroy() error {
	return d.dom.Destroy()
}

func (d *libvirtDomain) Shutdown() error {
	return d.dom.Shutdown()
}

func (d *libvirtDomain) UndefineFlags(flags uint32) error {
	return d.dom.UndefineFlags(libvirt.DomainUndefineFlagsValues(flags))
}

func (d *libvirtDomain) Undefine() error {
	return d.dom.Undefine()
}

func (d *libvirtDomain) SetVcpusFlags(vcpu uint, flags uint32) error {
	return d.dom.SetVcpusFlags(vcpu, libvirt.DomainVcpuFlags(flags))
}

func (d *libvirtDomain) SetMemoryFlags(memory uint64, flags uint32) error {
	return d.dom.SetMemoryFlags(memory, libvirt.DomainMemoryModFlags(flags))
}

func (d *libvirtDomain) GetVcpusFlags(flags uint32) (int, error) {
	count, err := d.dom.GetVcpusFlags(libvirt.DomainVcpuFlags(flags))
	return int(count), err
}

func (d *libvirtDomain) GetMemoryStats(flags uint32) (map[string]uint64, error) {
	// libvirt-go MemoryStats: MemoryStats(flags DomainMemoryStatFlags, nrStats uint) ([]DomainMemoryStat, error)
	// DOMAIN_MEMORY_STAT_ACTUAL = 1
	stats, err := d.dom.MemoryStats(1, 0)
	if err != nil {
		return nil, err
	}
	result := make(map[string]uint64)
	for _, stat := range stats {
		// libvirt DomainMemoryStat has Tag (int32) and Val (uint64)
		// Use Tag as string key
		result[fmt.Sprintf("tag_%d", stat.Tag)] = stat.Val
	}
	return result, nil
}
