//go:build libvirt
// +build libvirt

package vm

import (
	"encoding/xml"
	"fmt"
	"time"

)

// VMStats represents VM resource usage statistics
type VMStats struct {
	CPUUsagePercent    float64 `json:"cpu_usage_percent"`    // CPU usage percentage (0-100)
	MemoryUsedMB       uint64  `json:"memory_used_mb"`       // Memory used in MB
	MemoryTotalMB      uint64  `json:"memory_total_mb"`      // Total memory allocated in MB
	MemoryUsagePercent float64 `json:"memory_usage_percent"` // Memory usage percentage (0-100)
	Timestamp          int64   `json:"timestamp"`            // Unix timestamp
}

// GetVMStats retrieves current resource usage statistics for a VM
func (s *VMService) GetVMStats(vmName string) (*VMStats, error) {
	dom, err := s.driver.LookupDomainByName(vmName)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup domain: %v", err)
	}
	defer dom.Free()

	// Check if domain is active
	active, err := dom.IsActive()
	if err != nil {
		return nil, fmt.Errorf("failed to check domain status: %v", err)
	}
	if !active {
		return nil, fmt.Errorf("domain is not active")
	}

	// Use fallback method which uses XML (most reliable)
	return s.getVMStatsFallback(dom, vmName)
}

// getVMStatsFallback uses alternative methods to get VM stats
func (s *VMService) getVMStatsFallback(dom Domain, vmName string) (*VMStats, error) {
	stats := &VMStats{
		Timestamp: time.Now().Unix(),
	}

	// Get memory info from domain XML (most reliable method)
	xmlDesc, err := dom.GetXMLDesc(0)
	if err != nil {
		return nil, fmt.Errorf("failed to get domain XML: %v", err)
	}

	var domainXML struct {
		Memory struct {
			Unit string `xml:"unit,attr"`
			Text string `xml:",chardata"`
		} `xml:"memory"`
		CurrentMemory struct {
			Unit string `xml:"unit,attr"`
			Text string `xml:",chardata"`
		} `xml:"currentMemory"`
	}

	if err := xml.Unmarshal([]byte(xmlDesc), &domainXML); err != nil {
		return nil, fmt.Errorf("failed to parse domain XML: %v", err)
	}

	var totalMemMB uint64
	var currentMemMB uint64

	// Parse total memory (configured maximum)
	if domainXML.Memory.Unit == "KiB" {
		fmt.Sscanf(domainXML.Memory.Text, "%d", &totalMemMB)
		totalMemMB = totalMemMB / 1024
	} else if domainXML.Memory.Unit == "MiB" || domainXML.Memory.Unit == "MB" {
		fmt.Sscanf(domainXML.Memory.Text, "%d", &totalMemMB)
	} else if domainXML.Memory.Unit == "GiB" || domainXML.Memory.Unit == "GB" {
		fmt.Sscanf(domainXML.Memory.Text, "%d", &totalMemMB)
		totalMemMB = totalMemMB * 1024
	}

	// Parse current memory (actual allocated/used)
	if domainXML.CurrentMemory.Unit == "KiB" {
		fmt.Sscanf(domainXML.CurrentMemory.Text, "%d", &currentMemMB)
		currentMemMB = currentMemMB / 1024
	} else if domainXML.CurrentMemory.Unit == "MiB" || domainXML.CurrentMemory.Unit == "MB" {
		fmt.Sscanf(domainXML.CurrentMemory.Text, "%d", &currentMemMB)
	} else if domainXML.CurrentMemory.Unit == "GiB" || domainXML.CurrentMemory.Unit == "GB" {
		fmt.Sscanf(domainXML.CurrentMemory.Text, "%d", &currentMemMB)
		currentMemMB = currentMemMB * 1024
	}

	stats.MemoryTotalMB = totalMemMB
	if currentMemMB > 0 {
		stats.MemoryUsedMB = currentMemMB
	} else if totalMemMB > 0 {
		// If currentMemory is not set, use total memory as estimate
		stats.MemoryUsedMB = totalMemMB
	}

	if totalMemMB > 0 && stats.MemoryUsedMB > 0 {
		stats.MemoryUsagePercent = (float64(stats.MemoryUsedMB) / float64(totalMemMB)) * 100
	}

	// CPU usage requires time-based sampling
	// For now, we'll use a simple approach: get CPU count and estimate
	// Actual CPU usage calculation would require periodic sampling
	cpuCount, err := dom.GetVcpusFlags(DomainVCPUCurrent)
	if err == nil && cpuCount > 0 {
		// CPU usage is difficult to calculate without time-based sampling
		// We'll return 0 and let the frontend handle it or use periodic updates
		stats.CPUUsagePercent = 0.0
	}

	return stats, nil
}
