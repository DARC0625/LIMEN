# Backend 서버 세팅 가이드

## 개요
Backend 전용 서버에서 LIMEN 저장소를 sparse-checkout으로 클론하고, 자동 동기화를 설정합니다.

## 실행 방법

### 방법 1: 자동 스크립트 (권장)
```bash
cd /home/darc0/LIMEN
bash scripts/setup-backend-server.sh
```

### 방법 2: 수동 실행
```bash
# 1. 디렉토리 생성
sudo mkdir -p /opt/limen
sudo chown -R $USER:$USER /opt/limen

# 2. 저장소 클론
cd /opt/limen
git clone git@github.com:DARC0625/LIMEN.git repo
cd repo

# 3. Sparse checkout 설정
git sparse-checkout init --cone
git sparse-checkout set apps/backend RAG docs packages/shared

# 4. Main 브랜치 체크아웃
git checkout main

# 5. 동기화 스크립트 생성
mkdir -p scripts
cat > scripts/sync-backend.sh << 'EOF'
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
EOF
chmod +x scripts/sync-backend.sh
```

## Systemd Timer 설정

### 서비스 파일 생성
```bash
sudo tee /etc/systemd/system/limen-backend-sync.service > /dev/null << 'EOF'
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
EOF
```

### 타이머 파일 생성
```bash
sudo tee /etc/systemd/system/limen-backend-sync.timer > /dev/null << 'EOF'
[Unit]
Description=LIMEN Backend Repository Sync Timer
Requires=limen-backend-sync.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=10min
AccuracySec=1min

[Install]
WantedBy=timers.target
EOF
```

### 타이머 활성화
```bash
sudo systemctl daemon-reload
sudo systemctl enable limen-backend-sync.timer
sudo systemctl start limen-backend-sync.timer
```

## 확인 및 관리

### 타이머 상태 확인
```bash
sudo systemctl status limen-backend-sync.timer
```

### 수동 동기화 실행
```bash
bash /opt/limen/repo/scripts/sync-backend.sh
```

### 로그 확인
```bash
# 실시간 로그
sudo journalctl -u limen-backend-sync.service -f

# 최근 로그
sudo journalctl -u limen-backend-sync.service -n 50
```

### 타이머 비활성화 (필요시)
```bash
sudo systemctl stop limen-backend-sync.timer
sudo systemctl disable limen-backend-sync.timer
```

## Sparse Checkout 확인

현재 체크아웃된 경로 확인:
```bash
cd /opt/limen/repo
git sparse-checkout list
```

예상 출력:
```
apps/backend
RAG
docs
packages/shared
```

## 보안 게이트

`sync-backend.sh` 스크립트는 `apps/edge` 디렉토리가 존재하면 즉시 실패합니다.
이는 Backend 서버에 Edge 코드가 실수로 포함되는 것을 방지합니다.

## 주의사항

1. **Git SSH 키**: `git@github.com`을 사용하므로 SSH 키가 설정되어 있어야 합니다.
2. **사용자 이름**: 스크립트의 `User=darc0`를 실제 사용자명으로 변경하세요.
3. **타이머 주기**: `OnUnitActiveSec=10min`은 10분마다 실행됩니다. 필요시 조정하세요.
