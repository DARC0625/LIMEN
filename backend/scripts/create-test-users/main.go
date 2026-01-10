package main

import (
	"fmt"
	"os"
	"strings"
	
	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/crypto"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		// .env file is optional
	}

	// Load configuration
	cfg := config.Load()

	// Initialize database connection
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=Asia/Seoul",
		cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort, cfg.DBSSLMode)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to connect to database: %v\n", err)
		os.Exit(1)
	}

	// 사용자 생성
	for i := 1; i <= 10; i++ {
		username := fmt.Sprintf("user%d", i)
		password := username // 비밀번호는 사용자 이름과 동일
		
		// 비밀번호 해시 생성
		hashedPassword, err := crypto.HashPassword(password)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to hash password for %s: %v\n", username, err)
			continue
		}

		// 사용자 생성 (이미 존재하면 스킵)
		user := models.User{
			Username: username,
			Password: hashedPassword,
			Role:     "user",
			Approved: true,
		}

		result := db.Create(&user)
		if result.Error != nil {
			if strings.Contains(result.Error.Error(), "duplicate key") || 
			   strings.Contains(result.Error.Error(), "UNIQUE constraint") {
				fmt.Printf("User %s already exists, skipping...\n", username)
			} else {
				fmt.Fprintf(os.Stderr, "Failed to create user %s: %v\n", username, result.Error)
			}
		} else {
			fmt.Printf("User %s created successfully (password: %s)\n", username, password)
		}
	}

	fmt.Println("Done!")
}
