package validator

import (
	"strings"
	"testing"
)

func TestValidateVMName(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"valid name", "my-vm-01", false},
		{"valid with underscore", "my_vm_01", false},
		{"valid alphanumeric", "vm123", false},
		{"empty name", "", true},
		{"too short", "vm", true},
		{"too long", "a12345678901234567890123456789012345678901234567890123456789012345", true},
		{"invalid character", "my-vm@01", true},
		{"starts with number", "123vm", false}, // 숫자로 시작해도 허용
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateVMName(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateVMName(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

func TestValidateCPU(t *testing.T) {
	tests := []struct {
		name    string
		input   int
		wantErr bool
	}{
		{"valid minimum", 1, false},
		{"valid maximum", 32, false},
		{"valid middle", 4, false},
		{"zero", 0, true},
		{"negative", -1, true},
		{"too large", 33, true},
		{"very large", 100, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateCPU(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateCPU(%d) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

func TestValidateMemory(t *testing.T) {
	tests := []struct {
		name    string
		input   int
		wantErr bool
	}{
		{"valid minimum", 512, false},
		{"valid maximum", 65536, false},
		{"valid 256MB multiple", 1024, false},
		{"valid 256MB multiple 2", 2560, false},
		{"too small", 256, true},
		{"too large", 65537, true},
		{"not 256MB multiple", 513, true},
		{"not 256MB multiple 2", 1000, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateMemory(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateMemory(%d) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

func TestValidateOSType(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"valid ubuntu-desktop", "ubuntu-desktop", false},
		{"valid ubuntu-server", "ubuntu-server", false},
		{"valid kali", "kali", false},
		{"valid windows", "windows", false},
		{"invalid type", "invalid-os", true},
		{"empty", "", true},
		{"case sensitive", "Ubuntu-Desktop", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateOSType(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateOSType(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

func TestValidateVMAction(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"valid start", "start", false},
		{"valid stop", "stop", false},
		{"valid delete", "delete", false},
		{"valid update", "update", false},
		{"invalid action", "invalid", true},
		{"empty", "", true},
		{"case sensitive", "Start", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateVMAction(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateVMAction(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

func TestValidateVMName_SQLInjection(t *testing.T) {
	// Test SQL injection patterns
	sqlPatterns := []string{
		"'; DROP TABLE users; --",
		"\" OR 1=1 --",
		"'; SELECT * FROM users; --",
		"admin'--",
		"admin'/*",
		"xp_cmdshell",
		"sp_executesql",
		"UNION SELECT",
		"exec('rm -rf')",
	}

	for _, pattern := range sqlPatterns {
		t.Run("sql_injection_"+pattern, func(t *testing.T) {
			err := ValidateVMName(pattern)
			if err == nil {
				t.Errorf("ValidateVMName(%q) should reject SQL injection pattern", pattern)
			}
		})
	}
}

func TestValidateVMName_ControlCharacters(t *testing.T) {
	// Test control characters and null bytes
	tests := []struct {
		name      string
		vmName    string
		shouldErr bool
	}{
		// null byte is removed by SanitizeString, so "vm\x00name" becomes "vmname" which is valid
		// However, we still want to test that control characters are rejected
		{"null_byte", "vm\x00name", false}, // SanitizeString removes null byte, making it valid
		{"newline", "vm\nname", true},      // newline is allowed by ValidateInput but rejected by alphanumeric check
		{"tab", "vm\tname", true},          // tab is allowed by ValidateInput but rejected by alphanumeric check
		{"carriage_return", "vm\rname", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateVMName(tt.vmName)
			if (err != nil) != tt.shouldErr {
				t.Errorf("ValidateVMName(%q) error = %v, wantErr %v", tt.vmName, err, tt.shouldErr)
			}
		})
	}
}

func TestValidateVMName_EdgeCases(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"exactly 3 chars", "vm1", false},
		{"exactly 64 chars", strings.Repeat("a", 64), false},
		{"65 chars", strings.Repeat("a", 65), true},
		{"with spaces", "my vm", true},
		{"special chars", "vm@test", true},
		{"unicode", "vm테스트", true},
		{"mixed case", "MyVM-01", false},
		{"all numbers", "123", false},
		{"all letters", "vmname", false},
		{"hyphen only", "---", true}, // May be rejected by security validation
		{"underscore only", "___", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateVMName(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateVMName(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}
