package models

// UserRole represents the role of a user in the system
type UserRole string

const (
	RoleAdmin UserRole = "admin"
	RoleUser  UserRole = "user"
)

// IsValid checks if the role is valid
func (r UserRole) IsValid() bool {
	return r == RoleAdmin || r == RoleUser
}

// String returns the string representation of the role
func (r UserRole) String() string {
	return string(r)
}

// IsAdmin checks if the role is admin
func (r UserRole) IsAdmin() bool {
	return r == RoleAdmin
}


