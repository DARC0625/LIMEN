//go:build integration
// +build integration

package integration

import (
	"encoding/json"
	"net/http"
	"os"
	"testing"
)

type healthResponse struct {
	Status string `json:"status"`
	DB     string `json:"db"`
}

// TestHealthEndpoint checks the running LIMEN backend health endpoint.
// This test is skipped unless LIMEN_BASE_URL is set (e.g., http://localhost:18443).
func TestHealthEndpoint(t *testing.T) {
	baseURL := os.Getenv("LIMEN_BASE_URL")
	if baseURL == "" {
		t.Skip("LIMEN_BASE_URL not set; skipping integration test")
	}

	resp, err := http.Get(baseURL + "/api/health")
	if err != nil {
		t.Fatalf("failed to call health endpoint: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status code: %d", resp.StatusCode)
	}

	var hr healthResponse
	if err := json.NewDecoder(resp.Body).Decode(&hr); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if hr.Status == "" {
		t.Errorf("expected status field to be set")
	}
}
