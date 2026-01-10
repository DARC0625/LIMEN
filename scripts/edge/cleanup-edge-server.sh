#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"

# shellcheck disable=SC1091
source "${ROOT}/scripts/shared/cleanup-allowlist.sh"

# Edge 서버 허용 목록 (필요 시 조정)
# 레포 워킹 카피 유지를 위해 .gitignore, .gitattributes 포함
# 배포 파이프라인 참조를 위해 .deployignore 포함
cleanup_allowlist "${ROOT}" \
  "frontend" "config" "infra" "scripts" "RAG" ".github" \
  "README.md" "LICENSE" ".deployignore" ".gitignore" ".gitattributes"
