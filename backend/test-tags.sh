#!/usr/bin/env bash
# LIMEN Backend 테스트 분류 실행 스크립트

set -euo pipefail

case "${1:-help}" in
  smoke)
    echo "=== P0 Smoke Tests (1~3분) ==="
    go test -tags smoke -short -v \
      ./cmd/server/... \
      ./internal/handlers/health_test.go \
      ./internal/handlers/auth_test.go \
      ./internal/validator/...
    ;;
  regression)
    echo "=== Core Regression Tests (3~10분) ==="
    go test -tags regression -short -v \
      ./internal/auth/... \
      ./internal/middleware/... \
      ./internal/handlers/... \
      ./internal/models/... \
      ./internal/database/... \
      ./internal/errors/... \
      -exclude ./internal/vm/service_test.go \
      -exclude ./internal/vm/snapshot_test.go \
      -exclude ./internal/vm/stats_test.go \
      -exclude ./internal/vm/sync_test.go
    ;;
  extended)
    echo "=== Extended/Flaky Tests (nightly/manual) ==="
    go test -tags extended -v \
      ./internal/handlers/api_bench_test.go
    ;;
  libvirt)
    echo "=== Libvirt Tests (self-hosted only) ==="
    go test -tags libvirt,extended -v ./internal/vm/...
    ;;
  all)
    echo "=== All Tests (CI-safe) ==="
    go test -tags smoke,regression -short -v ./...
    ;;
  *)
    echo "Usage: $0 {smoke|regression|extended|libvirt|all}"
    echo ""
    echo "  smoke      - P0 Smoke tests (1~3분, PR 필수)"
    echo "  regression - Core Regression tests (3~10분, PR/main merge)"
    echo "  extended   - Extended/Flaky tests (nightly/manual)"
    echo "  libvirt    - Libvirt tests (self-hosted only)"
    echo "  all        - All CI-safe tests"
    exit 1
    ;;
esac
