#!/usr/bin/env bash
set -euo pipefail

cd /opt/limen/repo
git fetch origin main
git reset --hard origin/main

# 게이트: backend/ 폴더가 없으면 실패 (Backend 서버 필수)
if [ ! -d "backend" ]; then
  echo "[FATAL][POLICY:BACKEND] backend/ folder is missing. This is required on BACKEND server."
  exit 1
fi

# 게이트: edge 코드가 존재하면 즉시 실패
if [ -d "apps/edge" ]; then
  echo "[FATAL][POLICY:EDGE] apps/edge exists on BACKEND server. Aborting."
  exit 1
fi

# 게이트: frontend 폴더가 존재하면 즉시 실패
if [ -d "frontend" ]; then
  echo "[FATAL][POLICY:D1] frontend/ exists on BACKEND server. Aborting."
  exit 1
fi

# 게이트: 루트 src/ 폴더가 존재하면 즉시 실패 (D1에서 frontend/src와 backend/src로 분리됨)
if [ -d "src" ]; then
  echo "[FATAL][POLICY:D1] root src/ exists. Must be split into frontend/src and backend/src."
  exit 1
fi

# 게이트: 루트에 .md 파일이 존재하면 실패 (D0에서 RAG로 이관됨, README.md 제외)
root_md_count=$(find . -maxdepth 1 -name "*.md" -type f ! -name "README.md" | wc -l)
if [ "$root_md_count" -gt 0 ]; then
  echo "[FATAL][POLICY:D0] Found $root_md_count .md file(s) in root. All documents must be moved to RAG/ (except README.md)."
  find . -maxdepth 1 -name "*.md" -type f ! -name "README.md"
  exit 1
fi

# 게이트: CI/DEV 전용 폴더가 존재하면 실패 (서버 배포 금지)
if [ -d ".github" ]; then
  echo "[FATAL][POLICY:CI] .github/ exists on server. This is CI-only and must not be deployed."
  exit 1
fi

if [ -d ".vscode" ]; then
  echo "[FATAL][POLICY:DEV] .vscode/ exists on server. This is DEV-only and must not be deployed."
  exit 1
fi

# 게이트: RAG/ 폴더가 존재하면 실패 (런타임 불필요, 배포 제외)
if [ -d "RAG" ]; then
  echo "[FATAL][POLICY:RAG] RAG/ exists on server. This is runtime unnecessary and must not be deployed."
  exit 1
fi

echo "[OK] BACK sync done"
