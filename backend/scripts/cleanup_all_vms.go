package main

import (
	"fmt"
	"log"
	
	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	cfg := config.Load()
	
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=5432 sslmode=disable TimeZone=Asia/Seoul",
		cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName)
	
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	
	// Delete all console sessions first (foreign key constraint)
	if err := db.Exec("DELETE FROM console_sessions").Error; err != nil {
		log.Printf("Warning: Failed to delete console_sessions: %v", err)
	}
	
	// Count VMs before deletion
	var count int64
	if err := db.Model(&models.VM{}).Count(&count).Error; err != nil {
		log.Fatalf("Failed to count VMs: %v", err)
	}
	
	fmt.Printf("Found %d VMs in database\n", count)
	
	if count == 0 {
		fmt.Println("✅ No VMs to delete")
		return
	}
	
	// Delete all VMs
	if err := db.Exec("DELETE FROM vms").Error; err != nil {
		log.Fatalf("Failed to delete VMs: %v", err)
	}
	
	fmt.Printf("✅ Successfully deleted %d VMs from database\n", count)
}



