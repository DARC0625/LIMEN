#!/usr/bin/env bash
set -euo pipefail

# Backend 서버 sparse-checkout 설정 스크립트
# 실행: bash scripts/setup-backend-sparse-checkout.sh

echo "=== Backend Server Sparse-Checkout Setup ==="

# 1. 디렉토리로 이동
echo "[1/5] Changing to /opt/limen..."
cd /opt/limen || {
    echo "⚠ /opt/limen does not exist. Creating..."
    sudo mkdir -p /opt/limen
    sudo chown -R $USER:$USER /opt/limen
    cd /opt/limen
}

# 2. 저장소 클론 (이미 있으면 스킵)
echo "[2/5] Cloning repository..."
if [ -d "repo" ]; then
    echo "⚠ Repository already exists. Skipping clone."
    cd repo
    echo "  → Updating existing repository..."
    git fetch origin main || true
else
    git clone git@github.com:DARC0625/LIMEN.git repo
    cd repo
fi

# 3. Sparse checkout 초기화
echo "[3/5] Initializing sparse checkout..."
git sparse-checkout init --cone

# 4. 필요한 경로만 설정 (Backend 서버 전용 정책)
# backend/ - BACKEND ONLY (API, Auth, RBAC, libvirt 제어)
# config/ - EDGE + BACK (공통 설정)
# infra/ - EDGE + BACK (운영/배포)
# scripts/ - EDGE + BACK (sync, gate)
# RAG/ - EDGE + BACK (필수, 문서 = RAG)
# ⚠️ .github/, .vscode/는 CI/DEV 전용이므로 포함하지 않음
echo "[4/5] Setting sparse checkout paths..."
git sparse-checkout set backend config infra scripts/backend scripts/shared

# 5. Main 브랜치 체크아웃
echo "[5/5] Checking out main branch..."
git checkout main

echo ""
echo "=== Setup Complete ==="
echo "Repository location: /opt/limen/repo"
echo "Sparse checkout paths:"
git sparse-checkout list
echo ""
echo "Current branch:"
git branch --show-current
echo ""
echo "To update later:"
echo "  cd /opt/limen/repo"
echo "  git fetch origin main"
echo "  git reset --hard origin/main"
