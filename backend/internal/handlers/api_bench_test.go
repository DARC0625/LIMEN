//go:build extended
// +build extended

package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/middleware"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// BenchmarkHandleHealth benchmarks the health check endpoint
func BenchmarkHandleHealth(b *testing.B) {
	h, _ := setupBenchHandler(b)

	req := httptest.NewRequest("GET", "/api/health", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		h.HandleHealth(w, req)
	}
}

// BenchmarkHandleVMs_GET benchmarks VM list retrieval
func BenchmarkHandleVMs_GET(b *testing.B) {
	h, cfg := setupBenchHandler(b)

	// Create test VMs
	vms := make([]models.VM, 100)
	for i := 0; i < 100; i++ {
		vms[i] = models.VM{
			UUID:   generateTestUUID(i),
			Name:   "test-vm-" + string(rune(i)),
			Status: models.VMStatusRunning,
			CPU:    2,
			Memory: 2048,
		}
	}
	h.DB.Create(&vms)

	req := httptest.NewRequest("GET", "/api/vms", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		h.HandleVMs(w, req, cfg)
	}
}

// BenchmarkHandleVMAction benchmarks VM action endpoint
func BenchmarkHandleVMAction(b *testing.B) {
	h, _ := setupBenchHandler(b)

	vm := models.VM{
		UUID:   "12345678-1234-1234-1234-123456789abc",
		Name:   "test-vm",
		Status: models.VMStatusStopped,
		CPU:    2,
		Memory: 2048,
	}
	h.DB.Create(&vm)

	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("uuid", vm.UUID)
	ctx := context.WithValue(context.Background(), chi.RouteCtxKey, rctx)
	type contextKey string
	const roleKey contextKey = "role"
	ctx = context.WithValue(ctx, middleware.UserIDKey, uint(1))
	ctx = context.WithValue(ctx, roleKey, string(models.RoleAdmin))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		reqBody := bytes.NewBufferString(`{"action":"stop"}`)
		req := httptest.NewRequest("POST", "/api/vms/12345678-1234-1234-1234-123456789abc/action", reqBody)
		req = req.WithContext(ctx)
		h.HandleVMAction(w, req)
	}
}

// BenchmarkDatabaseQuery_SelectAll benchmarks database query without Select
func BenchmarkDatabaseQuery_SelectAll(b *testing.B) {
	db := setupBenchDB(b)

	// Create test VMs
	vms := make([]models.VM, 100)
	for i := 0; i < 100; i++ {
		vms[i] = models.VM{
			UUID:   generateTestUUID(i),
			Name:   "test-vm-" + string(rune(i)),
			Status: models.VMStatusRunning,
			CPU:    2,
			Memory: 2048,
		}
	}
	db.Create(&vms)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var result []models.VM
		db.Find(&result)
	}
}

// BenchmarkDatabaseQuery_SelectFields benchmarks database query with Select
func BenchmarkDatabaseQuery_SelectFields(b *testing.B) {
	db := setupBenchDB(b)

	// Create test VMs
	vms := make([]models.VM, 100)
	for i := 0; i < 100; i++ {
		vms[i] = models.VM{
			UUID:   generateTestUUID(i),
			Name:   "test-vm-" + string(rune(i)),
			Status: models.VMStatusRunning,
			CPU:    2,
			Memory: 2048,
		}
	}
	db.Create(&vms)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var result []models.VM
		db.Select("id", "uuid", "name", "status", "cpu", "memory").Find(&result)
	}
}

// BenchmarkJSONEncoding benchmarks JSON encoding performance
func BenchmarkJSONEncoding(b *testing.B) {
	vm := models.VM{
		UUID:   "12345678-1234-1234-1234-123456789abc",
		Name:   "test-vm",
		Status: models.VMStatusRunning,
		CPU:    4,
		Memory: 4096,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		json.Marshal(vm)
	}
}

// BenchmarkJSONDecoding benchmarks JSON decoding performance
func BenchmarkJSONDecoding(b *testing.B) {
	jsonData := []byte(`{"uuid":"12345678-1234-1234-1234-123456789abc","name":"test-vm","status":"running","cpu":4,"memory":4096}`)
	var vm models.VM

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		json.Unmarshal(jsonData, &vm)
	}
}

// Helper function to generate test UUIDs
func generateTestUUID(i int) string {
	// Simple UUID generation for testing (format: 00000000-0000-0000-0000-XXXXXXXXXXXX)
	uuid := "00000000-0000-0000-0000-"
	hex := "0123456789abcdef"
	for j := 0; j < 12; j++ {
		uuid += string(hex[i%16])
		i /= 16
	}
	return uuid
}

// setupBenchDB creates an in-memory SQLite database for benchmarking
func setupBenchDB(b *testing.B) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		b.Fatalf("Failed to open test database: %v", err)
	}

	// Auto-migrate models
	if err := db.AutoMigrate(&models.VM{}, &models.User{}, &models.VMImage{}); err != nil {
		b.Fatalf("Failed to migrate test database: %v", err)
	}

	return db
}

// setupBenchHandler creates a test handler with mock dependencies for benchmarking
func setupBenchHandler(b *testing.B) (*Handler, *config.Config) {
	db := setupBenchDB(b)
	cfg := &config.Config{
		Env:            "test",
		Port:           "18443",
		JWTSecret:      "test-secret-key-for-testing-only",
		AllowedOrigins: []string{"http://localhost:3000"},
	}

	// Create handler without VMService for basic tests
	handler := &Handler{
		DB:                  db,
		VMService:           nil, // Will be nil for basic tests
		VMStatusBroadcaster: NewVMStatusBroadcaster(),
		Config:              cfg,
	}

	return handler, cfg
}
