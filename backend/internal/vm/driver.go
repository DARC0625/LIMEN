// Package vm provides VM management with libvirt abstraction.
// This file defines the interface for libvirt operations.
package vm

// LibvirtDriver defines the interface for libvirt operations.
// This allows service.go to work without directly importing libvirt types.
type LibvirtDriver interface {
	// Connection management
	Connect(uri string) error
	Close() error
	IsAlive() bool

	// Domain operations
	LookupDomainByName(name string) (Domain, error)
	DomainDefineXML(xml string) (Domain, error)

	// Domain interface
	Domain() Domain
}

// Domain represents a libvirt domain (VM).
type Domain interface {
	Free() error
	IsActive() (bool, error)
	GetState() (DomainState, int, error) // Returns (state, reason, error)
	GetXMLDesc(flags uint32) (string, error)
	GetXMLDescInactive() (string, error)
	GetXMLDescSecure() (string, error)
	Create() error
	Destroy() error
	Shutdown() error
	UndefineFlags(flags uint32) error
	Undefine() error
	SetVcpusFlags(vcpu uint, flags uint32) error
	SetMemoryFlags(memory uint64, flags uint32) error
	GetVcpusFlags(flags uint32) (int, error)
	GetMemoryStats(flags uint32) (map[string]uint64, error)
}

// DomainState represents libvirt domain state.
type DomainState int

const (
	DomainStateNoState DomainState = iota
	DomainStateRunning
	DomainStateBlocked
	DomainStatePaused
	DomainStateShutdown
	DomainStateShutoff
	DomainStateCrashed
	DomainStatePMSuspended
)
