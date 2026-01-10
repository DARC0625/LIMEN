//go:build libvirt
// +build libvirt

package vm

import libvirt "github.com/libvirt/libvirt-go"

// Stats constants from libvirt
var (
	DomainVCPUCurrent uint32 = uint32(libvirt.DOMAIN_VCPU_CURRENT)
)
