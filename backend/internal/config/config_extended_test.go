package config

import (
	"os"
	"testing"
)

func TestBuildDatabaseURL_WithEnv(t *testing.T) {
	// Test with DATABASE_URL env variable
	os.Setenv("DATABASE_URL", "postgres://user:pass@host:5432/db")
	defer os.Unsetenv("DATABASE_URL")

	cfg := &Config{
		DBHost:     "localhost",
		DBUser:     "postgres",
		DBPassword: "password",
		DBName:     "limen",
		DBPort:     "5432",
		DBSSLMode:  "disable",
	}

	result := buildDatabaseURL(cfg)
	expected := "postgres://user:pass@host:5432/db"
	if result != expected {
		t.Errorf("buildDatabaseURL() with DATABASE_URL = %q, want %q", result, expected)
	}
}

func TestParseInt(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		fallback int
		expected int
	}{
		{"valid number", "123", 0, 123},
		{"zero", "0", 10, 0},
		{"negative", "-5", 10, -5},
		{"invalid string", "abc", 10, 10},
		{"empty string", "", 20, 20},
		{"float string", "12.5", 10, 10},
		{"large number", "999999", 0, 999999},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseInt(tt.input, tt.fallback)
			if result != tt.expected {
				t.Errorf("parseInt(%q, %d) = %d, want %d", tt.input, tt.fallback, result, tt.expected)
			}
		})
	}
}

func TestParseFloat(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		fallback float64
		expected float64
	}{
		{"valid float", "12.5", 0, 12.5},
		{"valid integer", "123", 0, 123.0},
		{"zero", "0", 10, 0},
		{"negative", "-5.5", 10, -5.5},
		{"invalid string", "abc", 10, 10},
		{"empty string", "", 20, 20},
		{"scientific notation", "1.5e2", 0, 150},
		{"large number", "999999.99", 0, 999999.99},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseFloat(tt.input, tt.fallback)
			if result != tt.expected {
				t.Errorf("parseFloat(%q, %f) = %f, want %f", tt.input, tt.fallback, result, tt.expected)
			}
		})
	}
}

func TestParseStringSlice(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{"single value", "value1", []string{"value1"}},
		{"multiple values", "value1,value2,value3", []string{"value1", "value2", "value3"}},
		{"with spaces", "value1, value2 , value3", []string{"value1", "value2", "value3"}},
		{"empty string", "", []string{}},
		{"only spaces", "   ,  ,  ", []string{}},
		{"single with spaces", "  value1  ", []string{"value1"}},
		{"empty values", "value1,,value3", []string{"value1", "value3"}},
		{"trailing comma", "value1,value2,", []string{"value1", "value2"}},
		{"leading comma", ",value1,value2", []string{"value1", "value2"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseStringSlice(tt.input)
			if len(result) != len(tt.expected) {
				t.Errorf("parseStringSlice(%q) length = %d, want %d", tt.input, len(result), len(tt.expected))
				return
			}
			for i, v := range result {
				if v != tt.expected[i] {
					t.Errorf("parseStringSlice(%q)[%d] = %q, want %q", tt.input, i, v, tt.expected[i])
				}
			}
		})
	}
}

func TestConfig_IsProduction(t *testing.T) {
	tests := []struct {
		name string
		env  string
		want bool
	}{
		{"production", "production", true},
		{"development", "development", false},
		{"test", "test", false},
		{"empty", "", false},
		{"staging", "staging", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &Config{Env: tt.env}
			if got := cfg.IsProduction(); got != tt.want {
				t.Errorf("Config.IsProduction() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestConfig_IsDevelopment(t *testing.T) {
	tests := []struct {
		name string
		env  string
		want bool
	}{
		{"development", "development", true},
		{"production", "production", false},
		{"test", "test", false},
		{"empty", "", false},
		{"staging", "staging", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &Config{Env: tt.env}
			if got := cfg.IsDevelopment(); got != tt.want {
				t.Errorf("Config.IsDevelopment() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestLoad_AllowedOrigins(t *testing.T) {
	// Test parsing allowed origins
	os.Setenv("ALLOWED_ORIGINS", "https://limen.kr,http://localhost:3000, https://example.com ")
	defer os.Unsetenv("ALLOWED_ORIGINS")

	cfg := Load()
	if len(cfg.AllowedOrigins) != 3 {
		t.Errorf("Expected 3 allowed origins, got %d", len(cfg.AllowedOrigins))
	}

	expected := []string{"https://limen.kr", "http://localhost:3000", "https://example.com"}
	for i, origin := range cfg.AllowedOrigins {
		if origin != expected[i] {
			t.Errorf("AllowedOrigins[%d] = %q, want %q", i, origin, expected[i])
		}
	}
}

func TestLoad_AlertEmailTo(t *testing.T) {
	// Test parsing alert email recipients
	os.Setenv("ALERT_EMAIL_TO", "admin@example.com, user@example.com , alert@example.com")
	defer os.Unsetenv("ALERT_EMAIL_TO")

	cfg := Load()
	if len(cfg.AlertEmailTo) != 3 {
		t.Errorf("Expected 3 email recipients, got %d", len(cfg.AlertEmailTo))
	}

	expected := []string{"admin@example.com", "user@example.com", "alert@example.com"}
	for i, email := range cfg.AlertEmailTo {
		if email != expected[i] {
			t.Errorf("AlertEmailTo[%d] = %q, want %q", i, email, expected[i])
		}
	}
}

func TestLoad_EmptyAllowedOrigins(t *testing.T) {
	os.Setenv("ALLOWED_ORIGINS", "")
	defer os.Unsetenv("ALLOWED_ORIGINS")

	cfg := Load()
	if len(cfg.AllowedOrigins) != 0 {
		t.Errorf("Expected empty allowed origins, got %d", len(cfg.AllowedOrigins))
	}
}

func TestLoad_EmptyAlertEmailTo(t *testing.T) {
	os.Setenv("ALERT_EMAIL_TO", "")
	defer os.Unsetenv("ALERT_EMAIL_TO")

	cfg := Load()
	if len(cfg.AlertEmailTo) != 0 {
		t.Errorf("Expected empty alert email recipients, got %d", len(cfg.AlertEmailTo))
	}
}
