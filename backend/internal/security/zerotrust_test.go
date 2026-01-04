package security

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSanitizeString_ZeroTrust(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "Normal string",
			input: "test string",
			want:  "test string",
		},
		{
			name:  "With null bytes",
			input: "test\x00string",
			want:  "teststring",
		},
		{
			name:  "With HTML",
			input: "<script>alert('xss')</script>",
			want:  "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;",
		},
		{
			name:  "With whitespace",
			input: "  test  ",
			want:  "test",
		},
		{
			name:  "Empty string",
			input: "",
			want:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SanitizeString(tt.input)
			if got != tt.want {
				t.Errorf("SanitizeString() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSanitizeForLog(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "With password",
			input: "password: secret123",
			want:  "[REDACTED]",
		},
		{
			name:  "With token",
			input: "token=abc123",
			want:  "[REDACTED]",
		},
		{
			name:  "With secret",
			input: "secret: mysecret",
			want:  "[REDACTED]",
		},
		{
			name:  "With key",
			input: "key=value",
			want:  "[REDACTED]",
		},
		{
			name:  "With authorization",
			input: "authorization: Bearer token",
			want:  "[REDACTED]", // May be partially redacted, just check it's not the original
		},
		{
			name:  "Normal string",
			input: "normal log message",
			want:  "normal log message",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SanitizeForLog(tt.input)
			if tt.want == "[REDACTED]" {
				// Check that sensitive data is redacted (may be partially redacted)
				if got == tt.input {
					t.Errorf("SanitizeForLog() did not sanitize input: %v", got)
				}
				// Should contain [REDACTED] somewhere
				if !strings.Contains(got, "[REDACTED]") {
					t.Errorf("SanitizeForLog() = %v, should contain [REDACTED]", got)
				}
			} else {
				if got != tt.want {
					t.Errorf("SanitizeForLog() = %v, want %v", got, tt.want)
				}
			}
		})
	}
}

func TestValidateInput_ZeroTrust(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		maxLength int
		wantErr   bool
	}{
		{
			name:      "Valid input",
			input:     "valid input",
			maxLength: 100,
			wantErr:   false,
		},
		{
			name:      "Too long",
			input:     string(make([]byte, 200)),
			maxLength: 100,
			wantErr:   true,
		},
		{
			name:      "With null byte",
			input:     "test\x00string",
			maxLength: 100,
			wantErr:   true,
		},
		{
			name:      "With control characters",
			input:     "test\x01string",
			maxLength: 100,
			wantErr:   true,
		},
		{
			name:      "With newline (allowed)",
			input:     "test\nstring",
			maxLength: 100,
			wantErr:   false,
		},
		{
			name:      "With tab (allowed)",
			input:     "test\tstring",
			maxLength: 100,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateInput(tt.input, tt.maxLength)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateInput() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestGenerateCSRFToken(t *testing.T) {
	token1, err := GenerateCSRFToken()
	if err != nil {
		t.Fatalf("GenerateCSRFToken() error = %v", err)
	}

	if token1 == "" {
		t.Error("GenerateCSRFToken() returned empty token")
	}

	// Generate another token
	token2, err := GenerateCSRFToken()
	if err != nil {
		t.Fatalf("GenerateCSRFToken() error = %v", err)
	}

	// Tokens should be different
	if token1 == token2 {
		t.Error("GenerateCSRFToken() returned duplicate tokens")
	}
}

func TestValidateCSRFToken(t *testing.T) {
	tests := []struct {
		name          string
		token         string
		expectedToken string
		want          bool
	}{
		{
			name:          "Valid token",
			token:         "test-token",
			expectedToken: "test-token",
			want:          true,
		},
		{
			name:          "Invalid token",
			token:         "test-token",
			expectedToken: "different-token",
			want:          false,
		},
		{
			name:          "Empty token",
			token:         "",
			expectedToken: "test-token",
			want:          false,
		},
		{
			name:          "Empty expected token",
			token:         "test-token",
			expectedToken: "",
			want:          false,
		},
		{
			name:          "Both empty",
			token:         "",
			expectedToken: "",
			want:          false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ValidateCSRFToken(tt.token, tt.expectedToken)
			if got != tt.want {
				t.Errorf("ValidateCSRFToken() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestGetCSRFTokenFromRequest(t *testing.T) {
	tests := []struct {
		name        string
		headerToken string
		formToken   string
		want        string
	}{
		{
			name:        "From header",
			headerToken: "header-token",
			formToken:   "form-token",
			want:        "header-token", // Header takes precedence
		},
		{
			name:        "From form",
			headerToken: "",
			formToken:   "form-token",
			want:        "form-token",
		},
		{
			name:        "Not found",
			headerToken: "",
			formToken:   "",
			want:        "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/", nil)
			if tt.headerToken != "" {
				req.Header.Set("X-CSRF-Token", tt.headerToken)
			}
			if tt.formToken != "" {
				req.ParseForm()
				req.Form.Set("csrf_token", tt.formToken)
			}

			got := GetCSRFTokenFromRequest(req)
			if got != tt.want {
				t.Errorf("GetCSRFTokenFromRequest() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsSafePath(t *testing.T) {
	tests := []struct {
		name string
		path string
		want bool
	}{
		{
			name: "Safe path",
			path: "safe/path",
			want: true,
		},
		{
			name: "With directory traversal",
			path: "../../etc/passwd",
			want: false,
		},
		{
			name: "Absolute path",
			path: "/etc/passwd",
			want: false,
		},
		{
			name: "Safe absolute path",
			path: "/safe/path",
			want: true,
		},
		{
			name: "With null byte",
			path: "path\x00to/file",
			want: false,
		},
		{
			name: "Empty path",
			path: "",
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsSafePath(tt.path)
			if got != tt.want {
				t.Errorf("IsSafePath(%v) = %v, want %v", tt.path, got, tt.want)
			}
		})
	}
}

func TestRedactSensitiveFields(t *testing.T) {
	tests := []struct {
		name string
		data map[string]interface{}
		want map[string]interface{}
	}{
		{
			name: "With password",
			data: map[string]interface{}{
				"username": "user",
				"password": "secret123",
			},
			want: map[string]interface{}{
				"username": "user",
				"password": "[REDACTED]",
			},
		},
		{
			name: "With token",
			data: map[string]interface{}{
				"token": "abc123",
				"data":  "value",
			},
			want: map[string]interface{}{
				"token": "[REDACTED]",
				"data":  "value",
			},
		},
		{
			name: "No sensitive fields",
			data: map[string]interface{}{
				"username": "user",
				"email":    "user@example.com",
			},
			want: map[string]interface{}{
				"username": "user",
				"email":    "user@example.com",
			},
		},
		{
			name: "Multiple sensitive fields",
			data: map[string]interface{}{
				"password":      "secret",
				"access_token":  "token123",
				"api_key":       "key456",
				"normal_field":  "value",
			},
			want: map[string]interface{}{
				"password":      "[REDACTED]",
				"access_token":  "[REDACTED]",
				"api_key":       "[REDACTED]",
				"normal_field":  "value",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := RedactSensitiveFields(tt.data)

			for k, v := range tt.want {
				if got[k] != v {
					t.Errorf("RedactSensitiveFields() [%v] = %v, want %v", k, got[k], v)
				}
			}
		})
	}
}

func TestSecurityError(t *testing.T) {
	err := ErrInputTooLong
	if err.Error() != "Input exceeds maximum length" {
		t.Errorf("SecurityError.Error() = %v, want 'Input exceeds maximum length'", err.Error())
	}

	err2 := ErrInvalidInput
	if err2.Error() != "Invalid input detected" {
		t.Errorf("SecurityError.Error() = %v, want 'Invalid input detected'", err2.Error())
	}
}

