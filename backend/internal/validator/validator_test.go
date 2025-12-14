package validator

import (
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


