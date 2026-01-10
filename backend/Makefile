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

# Test (CI-safe, no libvirt)
test:
	@echo "=== Running tests (CI-safe, no libvirt) ==="
	@$(GO) test -v -race -coverprofile=coverage.out ./internal/... ./cmd/... || (echo "Tests failed" && exit 1)
	@echo "✓ Tests passed"

# P0 Smoke tests (1~3분, PR 필수)
test-smoke:
	@echo "=== P0 Smoke Tests (1~3분) ==="
	@$(GO) test -tags smoke -short -v \
		./cmd/server/... \
		./internal/handlers/health_test.go \
		./internal/handlers/auth_test.go \
		./internal/validator/... || (echo "Smoke tests failed" && exit 1)
	@echo "✓ Smoke tests passed"

# Core Regression tests (3~10분, PR/main merge)
test-regression:
	@echo "=== Core Regression Tests (3~10분) ==="
	@$(GO) test -tags regression -short -v \
		./internal/auth/... \
		./internal/middleware/... \
		./internal/handlers/... \
		./internal/models/... \
		./internal/database/... \
		./internal/errors/... || (echo "Regression tests failed" && exit 1)
	@echo "✓ Regression tests passed"

# Extended/Flaky tests (nightly/manual)
test-extended:
	@echo "=== Extended/Flaky Tests (nightly/manual) ==="
	@$(GO) test -tags extended -v ./internal/handlers/api_bench_test.go || (echo "Extended tests failed" && exit 1)
	@echo "✓ Extended tests passed"

# Test with libvirt (for production/hypervisor environments)
test-libvirt:
	@echo "=== Running tests with libvirt ==="
	@$(GO) test -v -race -tags libvirt -coverprofile=coverage.out ./internal/... ./cmd/... || (echo "Tests failed" && exit 1)
	@echo "✓ Tests passed"

# Build (CI-safe, no libvirt)
build:
	@echo "=== Building (CI-safe, no libvirt) ==="
	@$(GO) build -o server ./cmd/server || (echo "Build failed" && exit 1)
	@echo "✓ Build passed"

# Build with libvirt (for production/hypervisor environments)
build-libvirt:
	@echo "=== Building with libvirt ==="
	@$(GO) build -tags libvirt -o server ./cmd/server || (echo "Build failed" && exit 1)
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
