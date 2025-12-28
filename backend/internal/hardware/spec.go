// Package hardware provides hardware specification detection and security configuration.
// Automatically detects server hardware and adjusts security settings accordingly.
package hardware

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"go.uber.org/zap"
)

// Spec represents the complete hardware specification of the server.
type Spec struct {
	Timestamp    time.Time `json:"timestamp"`
	Hostname     string    `json:"hostname"`
	Architecture string    `json:"architecture"`
	OS           string    `json:"os"`
	Kernel       string    `json:"kernel"`

	CPU      CPUInfo       `json:"cpu"`
	Memory   MemoryInfo    `json:"memory"`
	Disks    []DiskInfo    `json:"disks"`
	Network  []NetworkInfo `json:"network"`
	Security SecurityInfo  `json:"security"`

	// Hash of the spec for change detection
	Hash string `json:"hash"`
}

// CPUInfo contains detailed CPU information.
type CPUInfo struct {
	Model        string   `json:"model"`
	Vendor       string   `json:"vendor"`
	Architecture string   `json:"architecture"`
	Cores        int      `json:"cores"`
	Threads      int      `json:"threads"`
	FrequencyMHz float64  `json:"frequency_mhz"`
	CacheL1      string   `json:"cache_l1"`
	CacheL2      string   `json:"cache_l2"`
	CacheL3      string   `json:"cache_l3"`
	Flags        []string `json:"flags"`

	// Security features
	HasAES      bool `json:"has_aes"`       // AES-NI instruction set
	HasAVX      bool `json:"has_avx"`       // AVX instruction set
	HasAVX2     bool `json:"has_avx2"`      // AVX2 instruction set
	HasSHA      bool `json:"has_sha"`       // SHA-NI instruction set
	HasRDRAND   bool `json:"has_rdrand"`    // Hardware RNG
	HasRDSEED   bool `json:"has_rdseed"`    // Hardware RNG (better)
	HasSMEP     bool `json:"has_smep"`      // Supervisor Mode Execution Prevention
	HasSMAP     bool `json:"has_smap"`      // Supervisor Mode Access Prevention
	HasIntelTXT bool `json:"has_intel_txt"` // Intel Trusted Execution Technology
}

// MemoryInfo contains memory information.
type MemoryInfo struct {
	TotalGB     float64 `json:"total_gb"`
	AvailableGB float64 `json:"available_gb"`
	UsedGB      float64 `json:"used_gb"`
	SwapTotalGB float64 `json:"swap_total_gb"`
	SwapUsedGB  float64 `json:"swap_used_gb"`
}

// DiskInfo contains disk information.
type DiskInfo struct {
	Name       string `json:"name"`
	Size       string `json:"size"`
	Type       string `json:"type"`
	MountPoint string `json:"mount_point"`
	FileSystem string `json:"file_system"`
	Available  string `json:"available"`
}

// NetworkInfo contains network interface information.
type NetworkInfo struct {
	Name   string   `json:"name"`
	Type   string   `json:"type"`
	MAC    string   `json:"mac"`
	IPs    []string `json:"ips"`
	Speed  string   `json:"speed"`
	Duplex string   `json:"duplex"`
}

// SecurityInfo contains security-related hardware features.
type SecurityInfo struct {
	TPM           bool   `json:"tpm"`         // Trusted Platform Module
	SecureBoot    bool   `json:"secure_boot"` // UEFI Secure Boot
	SELinux       bool   `json:"selinux"`     // SELinux enabled
	AppArmor      bool   `json:"apparmor"`    // AppArmor enabled
	ASLR          int    `json:"aslr"`        // Address Space Layout Randomization level
	KernelVersion string `json:"kernel_version"`

	// Hardware encryption acceleration
	HasAESAccel bool `json:"has_aes_accel"` // AES hardware acceleration
	HasSHAAccel bool `json:"has_sha_accel"` // SHA hardware acceleration
}

var (
	currentSpec *Spec
	specMutex   sync.RWMutex
	specFile    = "/home/darc0/projects/LIMEN/.server-spec.json"
)

// DetectSpec detects the complete hardware specification.
func DetectSpec() (*Spec, error) {
	spec := &Spec{
		Timestamp: time.Now(),
	}

	// Basic system info
	hostname, _ := os.Hostname()
	spec.Hostname = hostname
	spec.Architecture = runtime.GOARCH
	spec.OS = runtime.GOOS

	// Kernel version
	if kernel, err := exec.Command("uname", "-r").Output(); err == nil {
		spec.Kernel = strings.TrimSpace(string(kernel))
	}

	// CPU info
	cpuInfo, err := detectCPU()
	if err != nil {
		logger.Log.Warn("Failed to detect CPU info", zap.Error(err))
	} else {
		spec.CPU = *cpuInfo
	}

	// Memory info
	memInfo, err := detectMemory()
	if err != nil {
		logger.Log.Warn("Failed to detect memory info", zap.Error(err))
	} else {
		spec.Memory = *memInfo
	}

	// Disk info
	disks, err := detectDisks()
	if err != nil {
		logger.Log.Warn("Failed to detect disk info", zap.Error(err))
	} else {
		spec.Disks = disks
	}

	// Network info
	networks, err := detectNetwork()
	if err != nil {
		logger.Log.Warn("Failed to detect network info", zap.Error(err))
	} else {
		spec.Network = networks
	}

	// Security info
	secInfo, err := detectSecurity()
	if err != nil {
		logger.Log.Warn("Failed to detect security info", zap.Error(err))
	} else {
		spec.Security = *secInfo
	}

	// Calculate hash for change detection
	spec.Hash = calculateSpecHash(spec)

	return spec, nil
}

// detectCPU detects CPU information.
func detectCPU() (*CPUInfo, error) {
	cpu := &CPUInfo{
		Cores:   runtime.NumCPU(),
		Threads: runtime.NumCPU(),
	}

	// Read /proc/cpuinfo
	data, err := os.ReadFile("/proc/cpuinfo")
	if err != nil {
		return cpu, err
	}

	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		switch key {
		case "model name":
			cpu.Model = value
		case "vendor_id":
			cpu.Vendor = value
		case "cpu MHz":
			if freq, err := strconv.ParseFloat(value, 64); err == nil {
				cpu.FrequencyMHz = freq
			}
		case "cache size":
			cpu.CacheL3 = value
		case "flags":
			cpu.Flags = strings.Fields(value)
			// Check for security features
			for _, flag := range cpu.Flags {
				switch flag {
				case "aes":
					cpu.HasAES = true
				case "avx":
					cpu.HasAVX = true
				case "avx2":
					cpu.HasAVX2 = true
				case "sha_ni":
					cpu.HasSHA = true
				case "rdrand":
					cpu.HasRDRAND = true
				case "rdseed":
					cpu.HasRDSEED = true
				case "smep":
					cpu.HasSMEP = true
				case "smap":
					cpu.HasSMAP = true
				case "sdbg":
					cpu.HasIntelTXT = true
				}
			}
		}
	}

	return cpu, nil
}

// detectMemory detects memory information.
func detectMemory() (*MemoryInfo, error) {
	mem := &MemoryInfo{}

	// Read /proc/meminfo
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return mem, err
	}

	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}

		key := parts[0]
		value, _ := strconv.ParseFloat(parts[1], 64)

		switch key {
		case "MemTotal:":
			mem.TotalGB = value / 1024 / 1024 // KB to GB
		case "MemAvailable:":
			mem.AvailableGB = value / 1024 / 1024
		case "SwapTotal:":
			mem.SwapTotalGB = value / 1024 / 1024
		case "SwapFree:":
			mem.SwapUsedGB = (mem.SwapTotalGB - value/1024/1024)
		}
	}

	mem.UsedGB = mem.TotalGB - mem.AvailableGB

	return mem, nil
}

// detectDisks detects disk information.
func detectDisks() ([]DiskInfo, error) {
	var disks []DiskInfo

	// Try lsblk first
	cmd := exec.Command("lsblk", "-o", "NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE", "-n")
	output, err := cmd.Output()
	if err == nil {
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			fields := strings.Fields(line)
			if len(fields) >= 3 && fields[2] == "disk" {
				disk := DiskInfo{
					Name: fields[0],
					Size: fields[1],
					Type: fields[2],
				}
				if len(fields) >= 4 {
					disk.MountPoint = fields[3]
				}
				if len(fields) >= 5 {
					disk.FileSystem = fields[4]
				}
				disks = append(disks, disk)
			}
		}
		return disks, nil
	}

	// Fallback to df
	cmd = exec.Command("df", "-h")
	output, err = cmd.Output()
	if err != nil {
		return disks, err
	}

	lines := strings.Split(string(output), "\n")
	for i, line := range lines {
		if i == 0 {
			continue // Skip header
		}
		fields := strings.Fields(line)
		if len(fields) >= 6 {
			disks = append(disks, DiskInfo{
				Name:       fields[0],
				Size:       fields[1],
				Available:  fields[3],
				MountPoint: fields[5],
				FileSystem: fields[0],
			})
		}
	}

	return disks, nil
}

// detectNetwork detects network interface information.
func detectNetwork() ([]NetworkInfo, error) {
	var networks []NetworkInfo

	// Try ip command
	cmd := exec.Command("ip", "-br", "addr", "show")
	output, err := cmd.Output()
	if err == nil {
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				net := NetworkInfo{
					Name: fields[0],
					Type: fields[1],
				}
				if len(fields) >= 3 {
					net.IPs = []string{fields[2]}
				}
				networks = append(networks, net)
			}
		}
		return networks, nil
	}

	return networks, nil
}

// detectSecurity detects security-related features.
func detectSecurity() (*SecurityInfo, error) {
	sec := &SecurityInfo{}

	// Check TPM
	if _, err := os.Stat("/dev/tpm0"); err == nil {
		sec.TPM = true
	}
	if _, err := os.Stat("/dev/tpmrm0"); err == nil {
		sec.TPM = true
	}

	// Check Secure Boot
	if _, err := os.Stat("/sys/firmware/efi"); err == nil {
		// Try to read SecureBoot variable
		files, _ := os.ReadDir("/sys/firmware/efi/efivars")
		for _, file := range files {
			if strings.Contains(file.Name(), "SecureBoot") {
				sec.SecureBoot = true
				break
			}
		}
	}

	// Check SELinux
	if cmd := exec.Command("sestatus"); cmd.Run() == nil {
		sec.SELinux = true
	}

	// Check AppArmor
	if cmd := exec.Command("aa-status"); cmd.Run() == nil {
		sec.AppArmor = true
	}

	// Check ASLR
	if data, err := os.ReadFile("/proc/sys/kernel/randomize_va_space"); err == nil {
		if val, err := strconv.Atoi(strings.TrimSpace(string(data))); err == nil {
			sec.ASLR = val
		}
	}

	// Check kernel modules for encryption acceleration
	if data, err := os.ReadFile("/proc/modules"); err == nil {
		modules := string(data)
		if strings.Contains(modules, "aes") {
			sec.HasAESAccel = true
		}
		if strings.Contains(modules, "sha") {
			sec.HasSHAAccel = true
		}
	}

	return sec, nil
}

// calculateSpecHash calculates a hash of the spec for change detection.
func calculateSpecHash(spec *Spec) string {
	// Create a simplified representation for hashing
	hashData := fmt.Sprintf("%s-%s-%s-%d-%d-%d",
		spec.Hostname,
		spec.CPU.Model,
		spec.Architecture,
		spec.CPU.Cores,
		int(spec.Memory.TotalGB),
		len(spec.Disks),
	)

	// Simple hash (can be improved with crypto/sha256)
	return fmt.Sprintf("%x", hashData)
}

// LoadSpec loads the saved hardware specification.
func LoadSpec() (*Spec, error) {
	data, err := os.ReadFile(specFile)
	if err != nil {
		return nil, err
	}

	var spec Spec
	if err := json.Unmarshal(data, &spec); err != nil {
		return nil, err
	}

	return &spec, nil
}

// SaveSpec saves the hardware specification to disk.
func SaveSpec(spec *Spec) error {
	data, err := json.MarshalIndent(spec, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(specFile, data, 0644)
}

// GetCurrentSpec returns the current hardware specification.
func GetCurrentSpec() *Spec {
	specMutex.RLock()
	defer specMutex.RUnlock()
	return currentSpec
}

// UpdateSpec detects and updates the hardware specification.
func UpdateSpec() (*Spec, error) {
	newSpec, err := DetectSpec()
	if err != nil {
		return nil, err
	}

	// Check if spec has changed
	oldSpec := GetCurrentSpec()
	if oldSpec != nil && oldSpec.Hash == newSpec.Hash {
		logger.Log.Info("Hardware specification unchanged", zap.String("hash", newSpec.Hash))
		return oldSpec, nil
	}

	// Spec has changed
	if oldSpec != nil {
		logger.Log.Info("Hardware specification changed",
			zap.String("old_hash", oldSpec.Hash),
			zap.String("new_hash", newSpec.Hash),
		)
	}

	// Update current spec
	specMutex.Lock()
	currentSpec = newSpec
	specMutex.Unlock()

	// Save to disk
	if err := SaveSpec(newSpec); err != nil {
		logger.Log.Warn("Failed to save hardware specification", zap.Error(err))
	}

	return newSpec, nil
}

// Initialize initializes the hardware specification detection.
func Initialize() error {
	// Try to load existing spec
	if spec, err := LoadSpec(); err == nil {
		specMutex.Lock()
		currentSpec = spec
		specMutex.Unlock()
		logger.Log.Info("Loaded hardware specification from disk", zap.String("hash", spec.Hash))
	}

	// Always detect current spec
	spec, err := UpdateSpec()
	if err != nil {
		return err
	}

	logger.Log.Info("Hardware specification detected",
		zap.String("hostname", spec.Hostname),
		zap.String("cpu", spec.CPU.Model),
		zap.Int("cores", spec.CPU.Cores),
		zap.Float64("memory_gb", spec.Memory.TotalGB),
		zap.Bool("has_aes", spec.CPU.HasAES),
		zap.Bool("has_tpm", spec.Security.TPM),
	)

	return nil
}

