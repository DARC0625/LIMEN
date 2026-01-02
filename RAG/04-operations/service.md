# LIMEN 정식 서비스 가이드

## 서비스 위치
- **서비스 루트**: `/home/darc0/LIMEN`
- **백엔드**: `/home/darc0/LIMEN/backend`
- **데이터베이스**: `/home/darc0/LIMEN/database`
- **로그**: `/home/darc0/LIMEN/backend/logs`

## 서비스 구조

```
/home/darc0/LIMEN/
├── backend/              # Go 백엔드 서버
│   ├── cmd/server/       # 서버 진입점
│   ├── internal/         # 내부 패키지
│   ├── agent/            # Rust 에이전트
│   ├── logs/             # 로그 파일
│   ├── pids/             # PID 파일
│   └── .env              # 환경 변수 (생성 필요)
├── database/             # 데이터 저장소
│   ├── iso/              # ISO 이미지
│   └── vms/              # VM 디스크 이미지
├── scripts/              # 서비스 관리 스크립트
│   ├── start-limen.sh    # 서비스 시작/중지 스크립트
│   ├── limen-control.sh  # systemd 통합 제어 스크립트
│   └── limen.service     # systemd 서비스 파일
├── config/                # 설정 파일
├── RAG/                  # 문서
└── docker-compose.yml     # Docker 배포 설정
```

## 빠른 시작

### 1. 환경 변수 설정

```bash
cd /home/darc0/LIMEN/backend
cp env.example .env
# .env 파일을 편집하여 실제 값으로 업데이트
```

**중요 설정:**
- `ISO_DIR=/home/darc0/LIMEN/database/iso`
- `VM_DIR=/home/darc0/LIMEN/database/vms`
- `DB_*`: PostgreSQL 연결 정보
- `JWT_SECRET`: 강력한 시크릿 키 설정
- `ADMIN_PASSWORD`: 관리자 비밀번호 변경

### 2. 데이터베이스 준비

```bash
# PostgreSQL 데이터베이스 생성
createdb LIMEN

# 또는 기존 데이터베이스 사용
```

### 3. 서비스 빌드

```bash
cd /home/darc0/LIMEN/backend
make build-all
```

### 4. 서비스 실행

#### 방법 1: 직접 실행 (개발/테스트)

```bash
cd /home/darc0/LIMEN
./scripts/start-LIMEN.sh start
```

#### 방법 2: systemd 서비스로 실행 (프로덕션)

```bash
# systemd 서비스 파일 설치
sudo cp /home/darc0/LIMEN/scripts/limen.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable limen
sudo systemctl start limen
```

### 5. 서비스 상태 확인

```bash
# 직접 실행 시
./scripts/start-LIMEN.sh status

# systemd 서비스 시
sudo systemctl status limen
# 또는
./scripts/LIMEN-control.sh status
```

## 서비스 관리

### 직접 실행 모드

```bash
cd /home/darc0/LIMEN

# 시작
./scripts/start-LIMEN.sh start

# 중지
./scripts/start-LIMEN.sh stop

# 재시작
./scripts/start-LIMEN.sh restart

# 상태 확인
./scripts/start-LIMEN.sh status
```

### systemd 서비스 모드

```bash
# 시작
sudo systemctl start limen
# 또는
./scripts/LIMEN-control.sh start

# 중지
sudo systemctl stop limen
# 또는
./scripts/LIMEN-control.sh stop

# 재시작
sudo systemctl restart limen
# 또는
./scripts/LIMEN-control.sh restart

# 상태 확인
sudo systemctl status limen
# 또는
./scripts/LIMEN-control.sh status

# 자동 시작 설정
sudo systemctl enable limen
```

## 포트 정보

- **Backend API**: `18443`
- **Agent**: `9000`
- **PostgreSQL**: `5432`

## 로그 확인

```bash
# 백엔드 로그
tail -f /home/darc0/LIMEN/backend/logs/server.log

# 에이전트 로그
tail -f /home/darc0/LIMEN/backend/logs/agent.log

# systemd 로그 (systemd 사용 시)
sudo journalctl -u limen -f
```

## 의존성 서비스

LIMEN 서비스는 다음 시스템 서비스에 의존합니다:

- **PostgreSQL**: 데이터베이스
- **libvirtd**: KVM 가상화 관리

이 서비스들이 실행 중이어야 LIMEN이 정상 작동합니다.

```bash
# PostgreSQL 시작
sudo systemctl start postgresql

# libvirtd 시작
sudo systemctl start libvirtd
```

## 문제 해결

### 포트 충돌

```bash
# 포트 사용 확인
sudo lsof -i :18443
sudo lsof -i :9000

# 프로세스 종료
sudo kill -9 <PID>
```

### 권한 문제

```bash
# libvirt 그룹에 사용자 추가
sudo usermod -a -G libvirt $USER
# 재로그인 필요
```

### 데이터베이스 연결 오류

```bash
# PostgreSQL 상태 확인
sudo systemctl status postgresql

# 데이터베이스 연결 테스트
psql -U postgres -d LIMEN
```

## 프로덕션 배포 체크리스트

- [ ] 환경 변수 파일 (`.env`) 설정 완료
- [ ] `JWT_SECRET` 강력한 값으로 변경
- [ ] `ADMIN_PASSWORD` 변경
- [ ] PostgreSQL 데이터베이스 생성 및 설정
- [ ] libvirt 권한 설정
- [ ] 방화벽 규칙 설정 (포트 18443)
- [ ] systemd 서비스 설치 및 활성화
- [ ] 로그 로테이션 설정
- [ ] 백업 스크립트 설정

## 업데이트

```bash
cd /home/darc0/LIMEN

# 코드 업데이트 (git 사용 시)
git pull

# 재빌드
cd backend
make build-all

# 서비스 재시작
cd ..
./scripts/start-LIMEN.sh restart
# 또는 (systemd 사용 시)
sudo systemctl restart limen
```

---

**서비스 루트**: `/home/darc0/LIMEN`  
**최종 업데이트**: $(date +%Y-%m-%d)

