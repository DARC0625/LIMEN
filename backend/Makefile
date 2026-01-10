.PHONY: lint test build smoke all

# Go tools
GOLANGCI_LINT := $(shell which golangci-lint 2>/dev/null)
GO := go

# Default target
all: lint test build smoke

# Lint
lint:
	@echo "=== Running linter ==="
	@if [ -z "$(GOLANGCI_LINT)" ]; then \
		echo "golangci-lint not found, installing..."; \
		curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(shell go env GOPATH)/bin v1.55.2; \
	fi
	@$(GOLANGCI_LINT) run ./internal/... ./cmd/... || (echo "Lint failed" && exit 1)
	@echo "✓ Lint passed"

# Test
test:
	@echo "=== Running tests ==="
	@$(GO) test -v -race -coverprofile=coverage.out ./internal/... ./cmd/... || (echo "Tests failed" && exit 1)
	@echo "✓ Tests passed"

# Build
build:
	@echo "=== Building ==="
	@$(GO) build -o server ./cmd/server || (echo "Build failed" && exit 1)
	@echo "✓ Build passed"

# Smoke test (health + metrics)
smoke:
	@echo "=== Running smoke tests ==="
	@echo "Starting server for smoke test..."
	@$(GO) build -o /tmp/limen-smoke ./cmd/server
	@timeout 10s /tmp/limen-smoke > /tmp/limen-smoke.log 2>&1 & \
	SMOKE_PID=$$!; \
	sleep 3; \
	echo "Testing health endpoint..."; \
	curl -s http://localhost:18443/api/health > /dev/null || (echo "Health check failed" && kill $$SMOKE_PID 2>/dev/null && exit 1); \
	echo "Testing metrics endpoint..."; \
	curl -s http://localhost:18443/api/metrics | grep -q "http_requests_total" || (echo "Metrics check failed" && kill $$SMOKE_PID 2>/dev/null && exit 1); \
	kill $$SMOKE_PID 2>/dev/null; \
	echo "✓ Smoke tests passed"

# Clean
clean:
	@rm -f server coverage.out
	@rm -f /tmp/limen-smoke /tmp/limen-smoke.log
