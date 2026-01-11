#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"

# shellcheck disable=SC1091
source "${ROOT}/scripts/shared/cleanup-allowlist.sh"

cleanup_allowlist "${ROOT}" \
  "backend" "config" "infra" "scripts" "RAG" ".github" "README.md" "LICENSE"
