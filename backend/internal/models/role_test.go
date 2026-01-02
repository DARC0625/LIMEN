package models

import (
	"testing"
)

func TestUserRole_IsValid(t *testing.T) {
	tests := []struct {
		name   string
		role   UserRole
		want   bool
	}{
		{"valid admin", RoleAdmin, true},
		{"valid user", RoleUser, true},
		{"invalid role", UserRole("invalid"), false},
		{"empty role", UserRole(""), false},
		{"lowercase admin", UserRole("admin"), true}, // RoleAdmin is "admin", so lowercase is valid
		{"lowercase user", UserRole("user"), true},     // RoleUser is "user", so lowercase is valid
		{"uppercase admin", UserRole("ADMIN"), false},
		{"uppercase user", UserRole("USER"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.role.IsValid(); got != tt.want {
				t.Errorf("UserRole.IsValid() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestUserRole_String(t *testing.T) {
	tests := []struct {
		name   string
		role   UserRole
		want   string
	}{
		{"admin", RoleAdmin, "admin"},
		{"user", RoleUser, "user"},
		{"empty", UserRole(""), ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.role.String(); got != tt.want {
				t.Errorf("UserRole.String() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestUserRole_IsAdmin(t *testing.T) {
	tests := []struct {
		name   string
		role   UserRole
		want   bool
	}{
		{"admin role", RoleAdmin, true},
		{"user role", RoleUser, false},
		{"invalid role", UserRole("invalid"), false},
		{"empty role", UserRole(""), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.role.IsAdmin(); got != tt.want {
				t.Errorf("UserRole.IsAdmin() = %v, want %v", got, tt.want)
			}
		})
	}
}

