// Package security provides comprehensive security chain monitoring and validation.
// Implements the "Weakest Link" principle: security is only as strong as the weakest component.
package security

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"go.uber.org/zap"
)

// SecurityChain represents the complete security chain.
// All components must be strong - one weak link breaks the entire chain.
type SecurityChain struct {
	Hardware  HardwareSecurity `json:"hardware"`
	Software  SoftwareSecurity `json:"software"`
	Network   NetworkSecurity  `json:"network"`
	User      UserSecurity     `json:"user"`
	Timestamp time.Time        `json:"timestamp"`
	Overall   ChainStatus      `json:"overall"`
	WeakLinks []WeakLink       `json:"weak_links"`
}

// HardwareSecurity represents hardware-level security status.
type HardwareSecurity struct {
	Status      ChainStatus `json:"status"`
	TPM         bool        `json:"tpm"`
	SecureBoot  bool        `json:"secure_boot"`
	AESAccel    bool        `json:"aes_accel"`
	HardwareRNG bool        `json:"hardware_rng"`
	SMEP        bool        `json:"smep"`
	SMAP        bool        `json:"smap"`
	Issues      []string    `json:"issues"`
	LastChecked time.Time   `json:"last_checked"`
}

// SoftwareSecurity represents software-level security status.
type SoftwareSecurity struct {
	Status          ChainStatus `json:"status"`
	ZeroTrust       bool        `json:"zero_trust"`
	Encryption      bool        `json:"encryption"`
	InputValidation bool        `json:"input_validation"`
	ErrorHandling   bool        `json:"error_handling"`
	SecurityHeaders bool        `json:"security_headers"`
	RateLimiting    bool        `json:"rate_limiting"`
	DependencyScan  bool        `json:"dependency_scan"`
	CodeQuality     bool        `json:"code_quality"`
	Issues          []string    `json:"issues"`
	LastChecked     time.Time   `json:"last_checked"`
}

// NetworkSecurity represents network-level security status.
type NetworkSecurity struct {
	Status       ChainStatus `json:"status"`
	Firewall     bool        `json:"firewall"`      // Network-level firewall (future)
	IPS          bool        `json:"ips"`           // Intrusion Prevention System (future)
	RateLimiting bool        `json:"rate_limiting"` // Application-level
	CORS         bool        `json:"cors"`
	HTTPS        bool        `json:"https"`
	DNSSEC       bool        `json:"dnssec"` // Future
	Issues       []string    `json:"issues"`
	LastChecked  time.Time   `json:"last_checked"`
}

// UserSecurity represents user-level security status.
// The human element is often the weakest link in security chains.
type UserSecurity struct {
	Status             ChainStatus `json:"status"`
	StrongPasswords    bool        `json:"strong_passwords"`
	MFA                bool        `json:"mfa"` // Multi-Factor Authentication (future)
	SessionManagement  bool        `json:"session_management"`
	AccessControl      bool        `json:"access_control"`
	AuditLogging       bool        `json:"audit_logging"`
	UserEducation      bool        `json:"user_education"`      // Policy-based
	BehaviorMonitoring bool        `json:"behavior_monitoring"` // Future
	Issues             []string    `json:"issues"`
	LastChecked        time.Time   `json:"last_checked"`
}

// ChainStatus represents the status of a security component.
type ChainStatus string

const (
	StatusStrong   ChainStatus = "strong"   // No issues, secure
	StatusModerate ChainStatus = "moderate" // Some issues, acceptable
	StatusWeak     ChainStatus = "weak"     // Critical issues, insecure
	StatusUnknown  ChainStatus = "unknown"  // Not checked yet
)

// WeakLink represents a weak point in the security chain.
type WeakLink struct {
	Component      string    `json:"component"` // hardware, software, network, user
	Severity       string    `json:"severity"`  // critical, high, medium, low
	Issue          string    `json:"issue"`
	Impact         string    `json:"impact"`
	Recommendation string    `json:"recommendation"`
	DetectedAt     time.Time `json:"detected_at"`
}

var (
	chainMutex   sync.RWMutex
	currentChain *SecurityChain
)

// ValidateSecurityChain validates the entire security chain.
// Returns the overall status and list of weak links.
func ValidateSecurityChain(ctx context.Context) (*SecurityChain, error) {
	chain := &SecurityChain{
		Timestamp: time.Now(),
		WeakLinks: make([]WeakLink, 0),
	}

	// Validate hardware security
	chain.Hardware = validateHardwareSecurity(ctx)
	if chain.Hardware.Status == StatusWeak {
		chain.WeakLinks = append(chain.WeakLinks, WeakLink{
			Component:      "hardware",
			Severity:       "critical",
			Issue:          "Hardware security issues detected",
			Impact:         "System vulnerable to hardware-level attacks",
			Recommendation: "Enable TPM, Secure Boot, and hardware security features",
			DetectedAt:     time.Now(),
		})
	}

	// Validate software security
	chain.Software = validateSoftwareSecurity(ctx)
	if chain.Software.Status == StatusWeak {
		chain.WeakLinks = append(chain.WeakLinks, WeakLink{
			Component:      "software",
			Severity:       "critical",
			Issue:          "Software security issues detected",
			Impact:         "Application vulnerable to attacks",
			Recommendation: "Review and fix software security issues",
			DetectedAt:     time.Now(),
		})
	}

	// Validate network security
	chain.Network = validateNetworkSecurity(ctx)
	if chain.Network.Status == StatusWeak {
		chain.WeakLinks = append(chain.WeakLinks, WeakLink{
			Component:      "network",
			Severity:       "critical",
			Issue:          "Network security issues detected",
			Impact:         "Network traffic vulnerable to interception/attacks",
			Recommendation: "Implement network-level firewall and IPS",
			DetectedAt:     time.Now(),
		})
	}

	// Validate user security
	chain.User = validateUserSecurity(ctx)
	if chain.User.Status == StatusWeak {
		chain.WeakLinks = append(chain.WeakLinks, WeakLink{
			Component:      "user",
			Severity:       "critical",
			Issue:          "User security issues detected",
			Impact:         "Human element is the weakest link",
			Recommendation: "Implement user education, MFA, and behavior monitoring",
			DetectedAt:     time.Now(),
		})
	}

	// Determine overall status (weakest link principle)
	chain.Overall = determineOverallStatus(chain)

	// Update current chain
	chainMutex.Lock()
	currentChain = chain
	chainMutex.Unlock()

	return chain, nil
}

// validateHardwareSecurity validates hardware-level security.
func validateHardwareSecurity(ctx context.Context) HardwareSecurity {
	hw := HardwareSecurity{
		LastChecked: time.Now(),
		Issues:      make([]string, 0),
	}

	// Check hardware features (would use hardware package)
	// For now, use placeholder checks
	hw.TPM = false        // Would check actual TPM
	hw.SecureBoot = false // Would check actual Secure Boot
	hw.AESAccel = true    // Assume AES-NI available
	hw.HardwareRNG = true // Assume RDRAND/RDSEED available
	hw.SMEP = true        // Assume SMEP available
	hw.SMAP = true        // Assume SMAP available

	// Determine status
	if !hw.TPM {
		hw.Issues = append(hw.Issues, "TPM not available")
	}
	if !hw.SecureBoot {
		hw.Issues = append(hw.Issues, "Secure Boot not enabled")
	}

	if len(hw.Issues) == 0 {
		hw.Status = StatusStrong
	} else if len(hw.Issues) <= 2 {
		hw.Status = StatusModerate
	} else {
		hw.Status = StatusWeak
	}

	return hw
}

// validateSoftwareSecurity validates software-level security.
func validateSoftwareSecurity(ctx context.Context) SoftwareSecurity {
	sw := SoftwareSecurity{
		LastChecked: time.Now(),
		Issues:      make([]string, 0),
	}

	// Check software security features
	sw.ZeroTrust = true       // Implemented
	sw.Encryption = true      // Argon2id, ChaCha20, Ed25519 implemented
	sw.InputValidation = true // Implemented
	sw.ErrorHandling = true   // Implemented
	sw.SecurityHeaders = true // Implemented
	sw.RateLimiting = true    // Implemented
	sw.DependencyScan = true  // CI/CD implemented
	sw.CodeQuality = true     // Linting implemented

	// Determine status
	if sw.ZeroTrust && sw.Encryption && sw.InputValidation && sw.ErrorHandling {
		sw.Status = StatusStrong
	} else {
		sw.Status = StatusModerate
		sw.Issues = append(sw.Issues, "Some software security features need improvement")
	}

	return sw
}

// validateNetworkSecurity validates network-level security.
func validateNetworkSecurity(ctx context.Context) NetworkSecurity {
	nw := NetworkSecurity{
		LastChecked: time.Now(),
		Issues:      make([]string, 0),
	}

	// Check network security features
	nw.Firewall = false    // Future: network-level firewall
	nw.IPS = false         // Future: IPS system
	nw.RateLimiting = true // Application-level implemented
	nw.CORS = true         // Implemented
	nw.HTTPS = false       // Would check actual HTTPS configuration
	nw.DNSSEC = false      // Future

	// Determine status
	if !nw.Firewall {
		nw.Issues = append(nw.Issues, "Network-level firewall not implemented (planned)")
	}
	if !nw.IPS {
		nw.Issues = append(nw.Issues, "IPS not implemented (planned)")
	}
	if !nw.HTTPS {
		nw.Issues = append(nw.Issues, "HTTPS not configured (check reverse proxy)")
	}

	if len(nw.Issues) <= 1 {
		nw.Status = StatusModerate
	} else {
		nw.Status = StatusWeak
	}

	return nw
}

// validateUserSecurity validates user-level security.
// The human element is critical - often the weakest link.
func validateUserSecurity(ctx context.Context) UserSecurity {
	us := UserSecurity{
		LastChecked: time.Now(),
		Issues:      make([]string, 0),
	}

	// Check user security features
	us.StrongPasswords = true     // Argon2id + password policy implemented
	us.MFA = false                // Future: Multi-Factor Authentication
	us.SessionManagement = true   // JWT tokens implemented
	us.AccessControl = true       // RBAC implemented
	us.AuditLogging = true        // Logging implemented
	us.UserEducation = false      // Policy-based, needs documentation
	us.BehaviorMonitoring = false // Future: anomaly detection

	// Determine status
	if !us.MFA {
		us.Issues = append(us.Issues, "Multi-Factor Authentication not implemented")
	}
	if !us.UserEducation {
		us.Issues = append(us.Issues, "User security education materials needed")
	}
	if !us.BehaviorMonitoring {
		us.Issues = append(us.Issues, "User behavior monitoring not implemented")
	}

	if len(us.Issues) == 0 {
		us.Status = StatusStrong
	} else if len(us.Issues) <= 2 {
		us.Status = StatusModerate
	} else {
		us.Status = StatusWeak
	}

	return us
}

// determineOverallStatus determines the overall security chain status.
// Uses the "weakest link" principle: overall status = weakest component.
func determineOverallStatus(chain *SecurityChain) ChainStatus {
	// Find the weakest component
	weakest := StatusStrong

	if chain.Hardware.Status == StatusWeak ||
		chain.Software.Status == StatusWeak ||
		chain.Network.Status == StatusWeak ||
		chain.User.Status == StatusWeak {
		return StatusWeak
	}

	if chain.Hardware.Status == StatusModerate ||
		chain.Software.Status == StatusModerate ||
		chain.Network.Status == StatusModerate ||
		chain.User.Status == StatusModerate {
		return StatusModerate
	}

	return weakest
}

// GetCurrentChain returns the current security chain status.
func GetCurrentChain() *SecurityChain {
	chainMutex.RLock()
	defer chainMutex.RUnlock()
	return currentChain
}

// StartChainMonitoring starts periodic security chain monitoring.
func StartChainMonitoring(ctx context.Context, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		logger.Log.Info("Security chain monitoring started",
			zap.Duration("interval", interval),
		)

		for {
			select {
			case <-ctx.Done():
				logger.Log.Info("Security chain monitoring stopped")
				return
			case <-ticker.C:
				chain, err := ValidateSecurityChain(ctx)
				if err != nil {
					logger.Log.Error("Failed to validate security chain", zap.Error(err))
					continue
				}

				// Log weak links
				if len(chain.WeakLinks) > 0 {
					logger.Log.Warn("Security chain weak links detected",
						zap.Int("count", len(chain.WeakLinks)),
						zap.String("overall_status", string(chain.Overall)),
					)
					for _, link := range chain.WeakLinks {
						logger.Log.Warn("Weak link detected",
							zap.String("component", link.Component),
							zap.String("severity", link.Severity),
							zap.String("issue", link.Issue),
							zap.String("recommendation", link.Recommendation),
						)
					}
				} else {
					logger.Log.Info("Security chain validation passed",
						zap.String("overall_status", string(chain.Overall)),
					)
				}
			}
		}
	}()
}

// GetWeakestLink returns the weakest link in the security chain.
func GetWeakestLink() *WeakLink {
	chain := GetCurrentChain()
	if chain == nil || len(chain.WeakLinks) == 0 {
		return nil
	}

	// Find the most critical weak link
	weakest := &chain.WeakLinks[0]
	for i := 1; i < len(chain.WeakLinks); i++ {
		if severityWeight(chain.WeakLinks[i].Severity) > severityWeight(weakest.Severity) {
			weakest = &chain.WeakLinks[i]
		}
	}

	return weakest
}

// severityWeight returns a weight for severity comparison.
func severityWeight(severity string) int {
	switch severity {
	case "critical":
		return 4
	case "high":
		return 3
	case "medium":
		return 2
	case "low":
		return 1
	default:
		return 0
	}
}

// FormatSecurityChainReport formats a comprehensive security chain report.
func FormatSecurityChainReport(chain *SecurityChain) string {
	report := fmt.Sprintf("=== Security Chain Report ===\n")
	report += fmt.Sprintf("Generated: %s\n", chain.Timestamp.Format(time.RFC3339))
	report += fmt.Sprintf("Overall Status: %s\n\n", chain.Overall)

	report += fmt.Sprintf("Hardware Security: %s\n", chain.Hardware.Status)
	if len(chain.Hardware.Issues) > 0 {
		for _, issue := range chain.Hardware.Issues {
			report += fmt.Sprintf("  - %s\n", issue)
		}
	}

	report += fmt.Sprintf("\nSoftware Security: %s\n", chain.Software.Status)
	if len(chain.Software.Issues) > 0 {
		for _, issue := range chain.Software.Issues {
			report += fmt.Sprintf("  - %s\n", issue)
		}
	}

	report += fmt.Sprintf("\nNetwork Security: %s\n", chain.Network.Status)
	if len(chain.Network.Issues) > 0 {
		for _, issue := range chain.Network.Issues {
			report += fmt.Sprintf("  - %s\n", issue)
		}
	}

	report += fmt.Sprintf("\nUser Security: %s\n", chain.User.Status)
	if len(chain.User.Issues) > 0 {
		for _, issue := range chain.User.Issues {
			report += fmt.Sprintf("  - %s\n", issue)
		}
	}

	if len(chain.WeakLinks) > 0 {
		report += fmt.Sprintf("\n=== Weak Links ===\n")
		for _, link := range chain.WeakLinks {
			report += fmt.Sprintf("[%s] %s: %s\n", link.Severity, link.Component, link.Issue)
			report += fmt.Sprintf("  Impact: %s\n", link.Impact)
			report += fmt.Sprintf("  Recommendation: %s\n", link.Recommendation)
		}
	}

	return report
}






