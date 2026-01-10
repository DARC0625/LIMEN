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

# 3. Sparse checkout 설정
echo "[3/5] Setting up sparse checkout..."
git sparse-checkout init --cone
git sparse-checkout set apps/backend RAG docs packages/shared

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

# 게이트: edge 코드가 존재하면 즉시 실패
if [ -d "apps/edge" ]; then
  echo "[FATAL] apps/edge exists on BACKEND server. Aborting."
  exit 1
fi

echo "[OK] Sync complete. Restart backend service here."
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
