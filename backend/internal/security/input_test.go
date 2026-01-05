package security

import (
	"strings"
	"testing"
)

func TestSanitizeString(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"normal string", "hello world", "hello world"},
		{"with spaces", "  hello  world  ", "hello world"},
		{"with newlines", "hello\nworld", "hello world"},
		{"with tabs", "hello\tworld", "hello world"},
		{"with carriage return", "hello\rworld", "hello world"},
		{"with multiple spaces", "hello    world", "hello world"},
		{"with control chars", "hello\x00world", "helloworld"},
		{"empty string", "", ""},
		{"only spaces", "   ", ""},
		{"mixed whitespace", "hello\n\t\rworld", "hello world"},
		{"unicode", "안녕하세요", "안녕하세요"},
		{"special chars", "hello@world#test", "hello@world#test"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeString(tt.input)
			if result != tt.expected {
				t.Errorf("SanitizeString(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestValidateInput(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		maxLength int
		wantErr   bool
	}{
		{"valid input", "hello", 10, false},
		{"exact length", "hello", 5, false},
		{"too long", "hello world", 5, true},
		{"empty string", "", 10, false},
		{"null byte", "hello\x00world", 20, true},
		{"control char", "hello\nworld", 20, true},
		{"tab char", "hello\tworld", 20, true},
		{"carriage return", "hello\rworld", 20, true},
		{"valid unicode", "안녕하세요", 20, false},
		{"max length zero", "hello", 0, true},
		{"negative max length", "hello", -1, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateInput(tt.input, tt.maxLength)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateInput(%q, %d) error = %v, wantErr %v", tt.input, tt.maxLength, err, tt.wantErr)
			}
		})
	}
}

func TestSanitizeString_PreservesContent(t *testing.T) {
	// Test that sanitization doesn't remove important content
	input := "user@example.com"
	result := SanitizeString(input)
	if !strings.Contains(result, "@") {
		t.Error("SanitizeString should preserve @ symbol")
	}
	if !strings.Contains(result, ".") {
		t.Error("SanitizeString should preserve . symbol")
	}
}

func TestValidateInput_MaxLength(t *testing.T) {
	// Test various max lengths
	maxLengths := []int{1, 5, 10, 50, 100, 256, 1024}

	for _, maxLen := range maxLengths {
		t.Run(string(rune(maxLen)), func(t *testing.T) {
			// Valid input at max length
			input := strings.Repeat("a", maxLen)
			err := ValidateInput(input, maxLen)
			if err != nil {
				t.Errorf("ValidateInput with exact max length %d failed: %v", maxLen, err)
			}

			// Invalid input exceeding max length
			if maxLen > 0 {
				longInput := strings.Repeat("a", maxLen+1)
				err = ValidateInput(longInput, maxLen)
				if err == nil {
					t.Errorf("ValidateInput should fail for input exceeding max length %d", maxLen)
				}
			}
		})
	}
}

func TestValidateInput_ControlCharacters(t *testing.T) {
	// Control characters that should be rejected (excluding newline 0x0A and tab 0x09 which are allowed)
	controlChars := []byte{0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F}

	for _, char := range controlChars {
		t.Run(string(rune(char)), func(t *testing.T) {
			input := "hello" + string(char) + "world"
			err := ValidateInput(input, 20)
			if err == nil {
				t.Errorf("ValidateInput should reject control character 0x%02X", char)
			}
		})
	}

	// Test that newline and tab are allowed
	allowedChars := []byte{0x09, 0x0A} // tab and newline
	for _, char := range allowedChars {
		t.Run(string(rune(char)), func(t *testing.T) {
			input := "hello" + string(char) + "world"
			err := ValidateInput(input, 20)
			if err != nil {
				t.Errorf("ValidateInput should allow control character 0x%02X (newline/tab), got error: %v", char, err)
			}
		})
	}
}

