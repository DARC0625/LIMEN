#!/usr/bin/env bash
set -euo pipefail

cd /opt/limen/repo
git fetch origin main
git reset --hard origin/main

# 게이트: edge 코드가 존재하면 즉시 실패
if [ -d "apps/edge" ]; then
  echo "[FATAL] apps/edge exists on BACKEND server. Aborting."
  exit 1
fi

# 게이트: frontend 폴더가 존재하면 즉시 실패
if [ -d "frontend" ]; then
  echo "[FATAL] frontend/ exists on BACKEND server. Aborting."
  exit 1
fi

# 게이트: 루트 src/ 폴더가 존재하면 즉시 실패 (D1에서 frontend/src와 backend/src로 분리됨)
if [ -d "src" ]; then
  echo "[FATAL] root src/ exists. Must be split into frontend/src and backend/src."
  exit 1
fi

echo "[OK] BACK sync done"
