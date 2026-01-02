package models

import "testing"

func TestVMStatus_IsValid(t *testing.T) {
	tests := []struct {
		name   string
		status VMStatus
		want   bool
	}{
		{"valid Running", VMStatusRunning, true},
		{"valid Stopped", VMStatusStopped, true},
		{"valid Creating", VMStatusCreating, true},
		{"valid Deleting", VMStatusDeleting, true},
		{"valid Error", VMStatusError, true},
		{"invalid status", VMStatus("Invalid"), false},
		{"empty status", VMStatus(""), false},
		{"lowercase", VMStatus("running"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.status.IsValid(); got != tt.want {
				t.Errorf("VMStatus.IsValid() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestVMStatus_String(t *testing.T) {
	tests := []struct {
		name   string
		status VMStatus
		want   string
	}{
		{"Running", VMStatusRunning, "Running"},
		{"Stopped", VMStatusStopped, "Stopped"},
		{"Creating", VMStatusCreating, "Creating"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.status.String(); got != tt.want {
				t.Errorf("VMStatus.String() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestVMAction_IsValid(t *testing.T) {
	tests := []struct {
		name   string
		action VMAction
		want   bool
	}{
		{"valid start", VMActionStart, true},
		{"valid stop", VMActionStop, true},
		{"valid restart", VMActionRestart, true},
		{"valid delete", VMActionDelete, true},
		{"valid update", VMActionUpdate, true},
		{"invalid action", VMAction("invalid"), false},
		{"empty action", VMAction(""), false},
		{"uppercase", VMAction("START"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.action.IsValid(); got != tt.want {
				t.Errorf("VMAction.IsValid() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestVMAction_String(t *testing.T) {
	tests := []struct {
		name   string
		action VMAction
		want   string
	}{
		{"start", VMActionStart, "start"},
		{"stop", VMActionStop, "stop"},
		{"restart", VMActionRestart, "restart"},
		{"delete", VMActionDelete, "delete"},
		{"update", VMActionUpdate, "update"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.action.String(); got != tt.want {
				t.Errorf("VMAction.String() = %v, want %v", got, tt.want)
			}
		})
	}
}
