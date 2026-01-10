#!/usr/bin/env bash
set -euo pipefail

# Backend 서버 세팅 스크립트
# 실행: bash scripts/setup-backend-server.sh

echo "=== LIMEN Backend Server Setup ==="

# 1. 디렉토리 생성 및 권한 설정
echo "[1/5] Creating /opt/limen directory..."
sudo mkdir -p /opt/limen
sudo chown -R $USER:$USER /opt/limen
echo "✓ Directory created: /opt/limen"

# 2. Git 저장소 클론
echo "[2/5] Cloning repository..."
cd /opt/limen
if [ -d "repo" ]; then
    echo "⚠ Repository already exists. Skipping clone."
    cd repo
else
    git clone git@github.com:DARC0625/LIMEN.git repo
    cd repo
fi

# 3. Sparse checkout 설정 (Backend 서버 전용 정책)
# backend/ - BACKEND ONLY (API, Auth, RBAC, libvirt 제어)
# config/ - EDGE + BACK (공통 설정)
# infra/ - EDGE + BACK (운영/배포)
# scripts/ - EDGE + BACK (sync, gate)
# RAG/ - EDGE + BACK (필수, 문서 = RAG)
# ⚠️ .github/, .vscode/는 CI/DEV 전용이므로 포함하지 않음
echo "[3/5] Setting up sparse checkout..."
git sparse-checkout init --cone
git sparse-checkout set backend config infra scripts RAG

# 4. Main 브랜치 체크아웃
echo "[4/5] Checking out main branch..."
git checkout main

# 5. 동기화 스크립트 생성
echo "[5/5] Creating sync script..."
mkdir -p scripts
cat > scripts/sync-backend.sh << 'SYNC_SCRIPT'
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

echo "[OK] BACK sync done"
SYNC_SCRIPT

chmod +x scripts/sync-backend.sh
echo "✓ Sync script created: scripts/sync-backend.sh"

# 6. Systemd 서비스 및 타이머 생성
echo "[6/6] Creating systemd service and timer..."
sudo tee /etc/systemd/system/limen-backend-sync.service > /dev/null << 'SERVICE_SCRIPT'
[Unit]
Description=LIMEN Backend Repository Sync Service
After=network.target

[Service]
Type=oneshot
User=darc0
Group=darc0
WorkingDirectory=/opt/limen/repo
ExecStart=/opt/limen/repo/scripts/sync-backend.sh
StandardOutput=journal
StandardError=journal
SERVICE_SCRIPT

sudo tee /etc/systemd/system/limen-backend-sync.timer > /dev/null << 'TIMER_SCRIPT'
[Unit]
Description=LIMEN Backend Repository Sync Timer
Requires=limen-backend-sync.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=10min
AccuracySec=1min

[Install]
WantedBy=timers.target
TIMER_SCRIPT

# Systemd 리로드 및 타이머 활성화
sudo systemctl daemon-reload
sudo systemctl enable limen-backend-sync.timer
sudo systemctl start limen-backend-sync.timer

echo "✓ Systemd timer created and enabled"
echo ""
echo "=== Setup Complete ==="
echo "Repository location: /opt/limen/repo"
echo "Sync script: /opt/limen/repo/scripts/sync-backend.sh"
echo ""
echo "Timer status:"
sudo systemctl status limen-backend-sync.timer --no-pager | head -n 10
echo ""
echo "Manual sync: bash /opt/limen/repo/scripts/sync-backend.sh"
echo "View timer: sudo systemctl status limen-backend-sync.timer"
echo "View logs: sudo journalctl -u limen-backend-sync.service -f"
