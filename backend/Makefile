.PHONY: build clean test run optimize

# Build optimized backend server
build:
	@echo "Building optimized backend server..."
	@go build -ldflags="-s -w" -trimpath -o server ./cmd/server
	@echo "Build complete: server"

# Build optimized agent
build-agent:
	@echo "Building optimized agent..."
	@cd agent && cargo build --release
	@echo "Build complete: agent/target/release/agent"

# Build both
build-all: build build-agent
	@echo "All builds complete"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -f server
	@rm -rf agent/target/debug
	@cd agent && cargo clean
	@echo "Clean complete"

# Run tests
test:
	@echo "Running tests..."
	@go test -v ./...

# Run server
run: build
	@./server

# Optimize dependencies
optimize:
	@echo "Optimizing dependencies..."
	@go mod tidy
	@go mod verify
	@cd agent && cargo update
	@echo "Dependencies optimized"

# Format code
fmt:
	@echo "Formatting code..."
	@go fmt ./...
	@cd agent && cargo fmt
	@echo "Format complete"

# Lint code
lint:
	@echo "Linting code..."
	@golangci-lint run ./... || echo "Install golangci-lint: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest"
	@cd agent && cargo clippy || echo "Clippy not available"

# Full optimization
full-optimize: clean optimize build-all
	@echo "Full optimization complete"
