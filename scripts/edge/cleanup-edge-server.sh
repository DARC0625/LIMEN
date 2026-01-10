#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"

# shellcheck disable=SC1091
source "${ROOT}/scripts/shared/cleanup-allowlist.sh"

# Edge 서버 허용 목록 (필요 시 조정)
cleanup_allowlist "${ROOT}" \
  "frontend" "config" "infra" "scripts" "RAG" ".github" "README.md" "LICENSE"
