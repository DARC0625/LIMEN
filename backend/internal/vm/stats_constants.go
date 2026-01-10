//go:build libvirt
// +build libvirt

package vm

import libvirt "github.com/libvirt/libvirt-go"

// Stats constants from libvirt
var (
	DomainVCPUCurrent = libvirt.DOMAIN_VCPU_CURRENT
)
