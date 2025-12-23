.PHONY: test test-cover test-unit test-integration build run

# Run all tests
test:
	go test ./... -v

# Run tests with coverage
test-cover:
	go test ./... -coverprofile=coverage.out
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

# Run unit tests only
test-unit:
	go test ./internal/validator -v
	go test ./internal/models -v
	go test ./internal/config -v

# Run integration tests
test-integration:
	go test ./cmd/server -v

# Build the server
build:
	go build -o server ./cmd/server

# Build optimized release version
build-release:
	go build -ldflags="-s -w" -trimpath -o server ./cmd/server
	@echo "Optimized release build complete"

# Build with race detector (for testing)
build-race:
	go build -race -o server ./cmd/server

# Run the server
run: build
	./server

# Clean build artifacts
clean:
	rm -f server coverage.out coverage.html


