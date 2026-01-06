package models

import (
	"time"

	"gorm.io/gorm"
)

// Waitlist represents a public waitlist entry.
type Waitlist struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Name         string         `gorm:"not null" json:"name"`
	Organization string         `gorm:"not null" json:"organization"`
	Email        string         `gorm:"not null;index" json:"email"`
	Purpose      string         `gorm:"type:text" json:"purpose,omitempty"`
	IPAddress    string         `gorm:"index" json:"-"` // Store IP for rate limiting, not exposed in JSON
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName returns the table name for Waitlist.
func (Waitlist) TableName() string {
	return "waitlist"
}




