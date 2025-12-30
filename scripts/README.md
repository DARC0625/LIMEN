# LIMEN 스크립트 가이드

## 개요

LIMEN 백엔드 및 에이전트를 관리하기 위한 통합 스크립트 모음입니다.

## 주요 스크립트

### 1. `start-limen.sh` - 서비스 제어
백엔드와 에이전트를 시작/중지/재시작하는 통합 스크립트입니다.

```bash
# 시작
./scripts/start-limen.sh start

# 중지
./scripts/start-limen.sh stop

# 재시작
./scripts/start-limen.sh restart

# 상태 확인
./scripts/start-limen.sh status
```

**특징:**
- PID 파일 기반 프로세스 관리
- 자동 빌드 (바이너리가 없을 경우)
- 로그 파일 자동 관리 (`backend/logs/`)
- 중복 실행 방지

### 2. `build-all.sh` - 통합 빌드
백엔드와 에이전트를 빌드하는 스크립트입니다.

```bash
# 전체 빌드
./scripts/build-all.sh all

# 백엔드만 빌드
./scripts/build-all.sh backend

# 에이전트만 빌드
./scripts/build-all.sh agent

# 빌드 아티팩트 정리
./scripts/build-all.sh clean
```

### 3. `setup-auto-start.sh` - 자동 시작 설정
WSL 부팅 시 자동으로 LIMEN 서비스를 시작하도록 설정합니다.

```bash
# 자동 시작 설정
./scripts/setup-auto-start.sh setup

# 자동 시작 제거
./scripts/setup-auto-start.sh remove

# 상태 확인
./scripts/setup-auto-start.sh status
```

**설정 방법:**
1. Systemd 사용자 서비스 설정 (가능한 경우)
2. `.bashrc`에 자동 시작 코드 추가 (백업)

### 4. `limen-control.sh` - Systemd 서비스 제어
Systemd를 통한 서비스 제어 스크립트입니다.

```bash
# 시작
./scripts/limen-control.sh start

# 중지
./scripts/limen-control.sh stop

# 재시작
./scripts/limen-control.sh restart

# 상태 확인
./scripts/limen-control.sh status
```

## 디렉토리 구조

```
LIMEN/
├── backend/
│   ├── logs/          # 로그 파일
│   │   ├── server.log
│   │   └── agent.log
│   ├── pids/          # PID 파일
│   │   ├── backend.pid
│   │   └── agent.pid
│   ├── server         # 백엔드 바이너리
│   └── ...
├── scripts/
│   ├── start-limen.sh
│   ├── build-all.sh
│   ├── setup-auto-start.sh
│   ├── limen-control.sh
│   └── limen.service
└── ...
```

## 자동 시작 설정

### WSL 자동 시작

WSL이 시작될 때 자동으로 LIMEN 서비스를 시작하려면:

```bash
./scripts/setup-auto-start.sh setup
```

이 명령은 다음을 수행합니다:
1. Systemd 사용자 서비스 설정 (가능한 경우)
2. `.bashrc`에 자동 시작 코드 추가

### Systemd 서비스 설치

Systemd를 사용하는 경우:

```bash
# 서비스 파일 복사
cp scripts/limen.service ~/.config/systemd/user/

# Systemd 재로드
systemctl --user daemon-reload

# 서비스 활성화
systemctl --user enable limen.service

# 서비스 시작
systemctl --user start limen.service
```

## 로그 확인

### 백엔드 로그
```bash
tail -f backend/logs/server.log
```

### 에이전트 로그
```bash
tail -f backend/logs/agent.log
```

### Systemd 로그
```bash
journalctl --user -u limen.service -f
```

## 문제 해결

### 서비스가 시작되지 않는 경우

1. **포트 확인**
   ```bash
   ss -tuln | grep -E "(18443|9000)"
   ```

2. **프로세스 확인**
   ```bash
   ps aux | grep -E "(server|agent)"
   ```

3. **로그 확인**
   ```bash
   tail -50 backend/logs/server.log
   tail -50 backend/logs/agent.log
   ```

### 빌드 실패 시

1. **의존성 확인**
   ```bash
   # Go 모듈
   cd backend && go mod tidy
   
   # Rust 의존성
   cd backend/agent && cargo update
   ```

2. **빌드 정리 후 재빌드**
   ```bash
   ./scripts/build-all.sh clean
   ./scripts/build-all.sh all
   ```

## 최적화

### 빌드 최적화
- Go: `-ldflags="-s -w"` (심볼 제거, 디버그 정보 제거)
- Rust: `--release` (최적화 빌드)

### 실행 최적화
- PID 파일 기반 프로세스 관리
- 로그 파일 자동 로테이션
- 중복 실행 방지
