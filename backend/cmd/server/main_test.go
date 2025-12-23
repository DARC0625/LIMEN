package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/handlers"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/middleware"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/DARC0625/LIMEN/backend/internal/router"
	"github.com/DARC0625/LIMEN/backend/internal/vm"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupTestDB creates an in-memory SQLite database for testing
func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	// Run migrations using actual models
	err = db.AutoMigrate(&models.User{}, &models.VM{}, &models.VMImage{})
	require.NoError(t, err)

	return db
}

// setupTestServer creates a test HTTP server with mocked dependencies
func setupTestServer(t *testing.T) *httptest.Server {
	// Initialize logger for tests
	if err := logger.Init("error"); err != nil {
		t.Fatalf("Failed to initialize logger: %v", err)
	}
	defer logger.Sync()

	// Use in-memory database
	db := setupTestDB(t)

	// Create a mock VM service (we'll skip libvirt for testing)
	// Note: This is a simplified version. In a real scenario, you'd use a mock.
	var vmService *vm.VMService
	vmService, err := vm.NewVMService(db, "test:///system", "/tmp/test-iso", "/tmp/test-vm")
	if err != nil {
		// If libvirt connection fails, create a nil service
		// Tests that require VM service will need to be skipped or mocked
		t.Logf("Warning: Could not create VM service: %v. Some tests may fail.", err)
		vmService = nil
	}

	// Create handler (will handle nil VMService in health check)
	cfg := config.Load()
	h := handlers.NewHandler(db, vmService, cfg)

	// Create a minimal config for testing
	cfg := &config.Config{
		JWTSecret: "test-secret-key",
	}

	// Setup routes
	r := router.SetupRoutes(h, cfg)

	// Apply middleware
	handler := middleware.Recovery(r)
	handler = middleware.Logging(handler)
	handler = middleware.RequestID(handler)
	handler = middleware.CORS([]string{"*"})(handler)

	return httptest.NewServer(handler)
}

func TestHealthEndpoint(t *testing.T) {
	server := setupTestServer(t)
	defer server.Close()

	resp, err := http.Get(server.URL + "/api/health")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	require.NoError(t, err)

	assert.Contains(t, result, "status")
	assert.Contains(t, result, "time")
}

func TestGetVMsEndpoint(t *testing.T) {
	server := setupTestServer(t)
	defer server.Close()

	resp, err := http.Get(server.URL + "/api/vms")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var vms []interface{}
	err = json.NewDecoder(resp.Body).Decode(&vms)
	require.NoError(t, err)
	assert.NotNil(t, vms)
}

func TestCreateVMEndpoint_InvalidInput(t *testing.T) {
	server := setupTestServer(t)
	defer server.Close()

	// Test with invalid CPU
	reqBody := map[string]interface{}{
		"name":    "test-vm",
		"cpu":     0, // Invalid
		"memory":  1024,
		"os_type": "ubuntu-desktop",
	}

	jsonData, _ := json.Marshal(reqBody)
	resp, err := http.Post(server.URL+"/api/vms", "application/json", bytes.NewBuffer(jsonData))
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestCreateVMEndpoint_InvalidMemory(t *testing.T) {
	server := setupTestServer(t)
	defer server.Close()

	// Test with invalid memory (not multiple of 256)
	reqBody := map[string]interface{}{
		"name":    "test-vm",
		"cpu":     2,
		"memory":  513, // Not multiple of 256
		"os_type": "ubuntu-desktop",
	}

	jsonData, _ := json.Marshal(reqBody)
	resp, err := http.Post(server.URL+"/api/vms", "application/json", bytes.NewBuffer(jsonData))
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestCreateVMEndpoint_InvalidName(t *testing.T) {
	server := setupTestServer(t)
	defer server.Close()

	// Test with invalid name (too short)
	reqBody := map[string]interface{}{
		"name":    "vm", // Too short
		"cpu":     2,
		"memory":  1024,
		"os_type": "ubuntu-desktop",
	}

	jsonData, _ := json.Marshal(reqBody)
	resp, err := http.Post(server.URL+"/api/vms", "application/json", bytes.NewBuffer(jsonData))
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestCORSHeaders(t *testing.T) {
	server := setupTestServer(t)
	defer server.Close()

	req, _ := http.NewRequest("OPTIONS", server.URL+"/api/vms", nil)
	req.Header.Set("Origin", "http://localhost:3000")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	// CORS middleware allows "*" when ALLOWED_ORIGINS is "*"
	origin := resp.Header.Get("Access-Control-Allow-Origin")
	assert.True(t, origin == "*" || origin == "http://localhost:3000", "Expected CORS origin to be * or http://localhost:3000, got %s", origin)
	assert.Contains(t, resp.Header.Get("Access-Control-Allow-Methods"), "POST")
}

func TestRequestIDHeader(t *testing.T) {
	server := setupTestServer(t)
	defer server.Close()

	resp, err := http.Get(server.URL + "/api/health")
	require.NoError(t, err)
	defer resp.Body.Close()

	requestID := resp.Header.Get("X-Request-ID")
	assert.NotEmpty(t, requestID)
}
