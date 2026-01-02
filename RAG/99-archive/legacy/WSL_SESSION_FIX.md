# WSL 세션 끊김 문제 해결

> [← 홈](../../00-home.md) | [아카이브](../) | [Legacy 기록](./) | [WSL 세션 끊김 문제 해결](./WSL_SESSION_FIX.md)

## ⚠️ 참고사항

이 문서는 과거 프로젝트 기록입니다. 현재 LIMEN 프로젝트는 위키 형식으로 재구성되었으며, 이 문서는 참고용으로 보관됩니다.

---

## 문제
WSL에서 명령어 실행 시 세션이 끊기는 현상

## 원인
1. 백그라운드 프로세스 실행 방식 문제
2. 특정 명령어가 세션을 종료시키는 경우
3. WSL 터미널 설정 문제

## 해결 방법

### 방법 1: 안전한 서버 시작 스크립트 사용

```bash
# 포그라운드 실행 (세션 유지)
./scripts/start_backend_safe.sh

# 또는 데몬 모드 (백그라운드)
./scripts/start_backend_daemon.sh
```

### 방법 2: 수동 실행 (권장)

```bash
cd /home/darc0/projects/LIMEN/backend

# 1. 기존 프로세스 종료
pkill -f "./server" || true

# 2. 서버 실행 (포그라운드)
./server

# 또는 백그라운드로 실행하려면:
# ./server > /tmp/limen/backend.log 2>&1 &
# disown
```

### 방법 3: systemd 서비스 생성 (영구적, 권장) ⭐

자동 스크립트 사용:
```bash
cd /home/darc0/projects/LIMEN
./scripts/create_systemd_service.sh
```

수동 생성:
```bash
sudo nano /etc/systemd/system/limen-backend.service
```

서비스 파일 내용:
```ini
[Unit]
Description=LIMEN Backend Server
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=darc0
Group=darc0
WorkingDirectory=/home/darc0/projects/LIMEN/backend
ExecStart=/home/darc0/projects/LIMEN/backend/server
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=limen-backend
EnvironmentFile=/home/darc0/projects/LIMEN/backend/.env
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

활성화:
```bash
sudo systemctl daemon-reload
sudo systemctl enable limen-backend
sudo systemctl start limen-backend
sudo systemctl status limen-backend
```

## 확인 방법

```bash
# systemd 서비스 사용 시
sudo systemctl status limen-backend
sudo journalctl -u limen-backend -f

# 수동 실행 시
ps aux | grep "./server" | grep -v grep
ss -tuln | grep 18443
tail -f /tmp/limen/backend.log
```

## 주의사항

- `nohup`과 `&`를 함께 사용할 때는 `disown`도 함께 사용
- 포그라운드 실행 시 Ctrl+C로 종료 가능
- 백그라운드 실행 시 `jobs` 명령어로 확인


---

## 관련 문서

- [Legacy 기록](./)

---

**태그**: `#아카이브` `#Legacy` `#네트워크-인프라` `#과거-기록`

**카테고리**: 아카이브 > Legacy 기록 > 네트워크/인프라

**상태**: 과거 기록

**마지막 업데이트**: 2024-12-23
