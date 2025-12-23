# LIMEN 운영 가이드

> [← 홈](../00-home.md) | [운영](./) | [운영 가이드](./operations-guide.md) | [문제 해결](./troubleshooting/common-issues.md)

## 목차

1. [시스템 개요](#시스템-개요)
2. [서비스 관리](#서비스-관리)
3. [보안 설정](#보안-설정)
4. [모니터링 및 로깅](#모니터링-및-로깅)
5. [성능 최적화](#성능-최적화)
6. [문제 해결](#문제-해결)
7. [백업 및 복구](#백업-및-복구)

---

## 시스템 개요

LIMEN은 가상머신 관리 시스템으로, 다음 컴포넌트로 구성됩니다:

- **Backend (Go)**: 메인 API 서버 (포트: 18443)
- **Agent (Rust)**: 시스템 메트릭 수집 (포트: 9000)
- **PostgreSQL**: 데이터베이스 (포트: 5432)
- **Libvirt**: 가상화 관리 라이브러리

### 아키텍처

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────┐
│  Reverse Proxy  │  (Nginx/Envoy)
│   (HTTPS)       │
└──────┬──────────┘
       │ HTTP
       ▼
┌─────────────────┐      ┌──────────────┐
│  Backend (Go)    │◄─────┤  PostgreSQL  │
│   Port: 18443    │      │  Port: 5432  │
└──────┬───────────┘      └──────────────┘
       │
       ├──► /agent/* ──► Agent (Rust) Port: 9000
       │
       └──► Libvirt (qemu:///system)
```

---

## 서비스 관리

### systemd 서비스

LIMEN은 통합된 `limen.service`로 관리됩니다.

#### 서비스 상태 확인

```bash
sudo systemctl status limen.service
```

#### 서비스 시작/중지/재시작

```bash
# 시작
sudo systemctl start limen.service

# 중지
sudo systemctl stop limen.service

# 재시작
sudo systemctl restart limen.service

# 부팅 시 자동 시작 활성화
sudo systemctl enable limen.service
```

#### 편리한 스크립트 사용

```bash
cd /home/darc0/projects/LIMEN/scripts
./limen-control.sh start    # 시작
./limen-control.sh stop     # 중지
./limen-control.sh restart  # 재시작
./limen-control.sh status   # 상태 확인
```

### 서비스 로그 확인

#### 실시간 로그 확인

```bash
sudo journalctl -u limen.service -f
```

#### 최근 로그 확인

```bash
sudo journalctl -u limen.service -n 100
```

#### 특정 시간대 로그 확인

```bash
sudo journalctl -u limen.service --since "2024-01-01 00:00:00" --until "2024-01-02 00:00:00"
```

#### 에러 로그만 확인

```bash
sudo journalctl -u limen.service -p err
```

---

## 보안 설정

### CORS 설정

프로덕션 환경에서는 허용된 오리진만 설정해야 합니다.

#### 환경 변수 설정

```bash
# /etc/systemd/system/limen.service
[Service]
Environment=ALLOWED_ORIGINS=https://www.darc.kr,https://darc.kr
```

#### 현재 설정 확인

```bash
sudo systemctl show limen.service | grep ALLOWED_ORIGINS
```

### 보안 헤더

다음 보안 헤더가 자동으로 적용됩니다:

- `X-Content-Type-Options: nosniff` - MIME 타입 스니핑 방지
- `X-Frame-Options: DENY` - Clickjacking 방지
- `X-XSS-Protection: 1; mode=block` - XSS 보호
- `Referrer-Policy: strict-origin-when-cross-origin` - Referrer 정보 제어
- `Permissions-Policy` - 브라우저 기능 제한
- `Content-Security-Policy` - 콘텐츠 보안 정책
- `Strict-Transport-Security` - HSTS (HTTPS 사용 시)

### JWT 토큰

- 기본 만료 시간: 24시간
- 토큰은 `Authorization: Bearer <token>` 헤더로 전송
- VNC WebSocket 연결 시 토큰 필수

### HTTPS 설정

프로덕션 환경에서는 반드시 HTTPS를 사용해야 합니다.

#### Nginx 리버스 프록시 예시

```nginx
server {
    listen 443 ssl http2;
    server_name api.darc.kr;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:18443;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 모니터링 및 로깅

### 로그 관리

#### journald 설정

로그는 systemd journald에 저장되며, 다음 설정이 적용됩니다:

- 최대 디스크 사용량: 1GB
- 보관 기간: 14일
- 자동 압축: 활성화
- 최소 여유 공간: 100MB

설정 파일: `/etc/systemd/journald.conf.d/limen.conf`

#### 로그 레벨

- **ERROR**: 5xx 서버 에러
- **WARN**: 4xx 클라이언트 에러 (404 제외)
- **INFO**: 정상 요청 및 2xx/3xx 응답

### 메트릭스

Prometheus 메트릭스 엔드포인트: `/api/metrics`

#### 주요 메트릭스

- `http_requests_total`: 총 HTTP 요청 수
- `http_request_duration_seconds`: 요청 처리 시간
- `vm_total`: 총 VM 수
- `vm_running`: 실행 중인 VM 수

### 에이전트 메트릭스

에이전트는 시스템 리소스 메트릭스를 제공합니다:

- 엔드포인트: `/agent/metrics`
- 제공 메트릭스:
  - CPU 사용률
  - 메모리 사용량
  - 디스크 사용량

---

## 성능 최적화

### HTTP 서버 최적화

다음 설정이 적용되어 있습니다:

- ReadTimeout: 15초
- WriteTimeout: 15초
- IdleTimeout: 120초
- MaxHeaderBytes: 1MB

### 데이터베이스 연결 풀

- MaxIdleConns: 10
- MaxOpenConns: 100
- ConnMaxLifetime: 1시간
- ConnMaxIdleTime: 10분

### 빌드 최적화

#### Go 빌드

```bash
cd /home/darc0/projects/LIMEN/backend
go build -ldflags="-s -w" -trimpath -o server ./cmd/server
```

#### Rust 에이전트 빌드

```bash
cd /home/darc0/projects/LIMEN/backend/agent
cargo build --release
```

### Rate Limiting

기본 설정:
- 활성화: true
- RPS: 10 (초당 요청 수)
- Burst: 20

환경 변수로 변경 가능:
```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_RPS=10
RATE_LIMIT_BURST=20
```

---

## 문제 해결

### 서비스가 시작되지 않음

1. **포트 충돌 확인**
```bash
sudo netstat -tulpn | grep -E '18443|9000'
```

2. **권한 확인**
```bash
ls -la /home/darc0/projects/LIMEN/backend/server
ls -la /home/darc0/projects/LIMEN/backend/agent/target/release/agent
```

3. **로그 확인**
```bash
sudo journalctl -u limen.service -n 50
```

### 데이터베이스 연결 실패

1. **PostgreSQL 상태 확인**
```bash
sudo systemctl status postgresql
```

2. **연결 테스트**
```bash
psql -h localhost -U postgres -d limen
```

3. **환경 변수 확인**
```bash
sudo systemctl show limen.service | grep -i db
```

### VM 생성 실패

1. **Libvirt 상태 확인**
```bash
sudo systemctl status libvirtd
virsh list --all
```

2. **디스크 공간 확인**
```bash
df -h /home/darc0/projects/LIMEN/database/vms
```

3. **권한 확인**
```bash
groups $USER | grep libvirt
```

### CORS 에러

1. **허용된 오리진 확인**
```bash
sudo systemctl show limen.service | grep ALLOWED_ORIGINS
```

2. **요청 오리진 확인**
브라우저 개발자 도구에서 Network 탭 확인

3. **CORS 로그 확인**
```bash
sudo journalctl -u limen.service | grep -i cors
```

### WebSocket 연결 실패

1. **토큰 확인**
- VNC 연결 시 JWT 토큰이 필수입니다
- 토큰이 유효한지 확인

2. **프록시 설정 확인**
- 리버스 프록시에서 WebSocket 업그레이드 지원 확인
- `Upgrade` 및 `Connection` 헤더 전달 확인

3. **방화벽 확인**
```bash
sudo ufw status
```

---

## 백업 및 복구

### 데이터베이스 백업

#### 전체 백업

```bash
pg_dump -h localhost -U postgres -d limen -F c -f limen_backup_$(date +%Y%m%d).dump
```

#### 스키마만 백업

```bash
pg_dump -h localhost -U postgres -d limen -s -f limen_schema_$(date +%Y%m%d).sql
```

### VM 이미지 백업

```bash
# VM 디렉토리 백업
tar -czf vm_backup_$(date +%Y%m%d).tar.gz /home/darc0/projects/LIMEN/database/vms

# ISO 이미지 백업
tar -czf iso_backup_$(date +%Y%m%d).tar.gz /home/darc0/projects/LIMEN/database/iso
```

### 데이터베이스 복구

```bash
# 백업에서 복구
pg_restore -h localhost -U postgres -d limen -c limen_backup_YYYYMMDD.dump
```

### 자동 백업 스크립트 예시

```bash
#!/bin/bash
BACKUP_DIR="/backup/limen"
DATE=$(date +%Y%m%d_%H%M%S)

# 데이터베이스 백업
pg_dump -h localhost -U postgres -d limen -F c -f "$BACKUP_DIR/db_$DATE.dump"

# VM 이미지 백업
tar -czf "$BACKUP_DIR/vms_$DATE.tar.gz" /home/darc0/projects/LIMEN/database/vms

# 오래된 백업 삭제 (30일 이상)
find $BACKUP_DIR -type f -mtime +30 -delete
```

---

## 환경 변수 참조

### 필수 환경 변수

- `DATABASE_URL` 또는 DB 구성 요소들 (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)
- `JWT_SECRET`: JWT 토큰 서명용 시크릿 키
- `ALLOWED_ORIGINS`: CORS 허용 오리진 (프로덕션 필수)

### 선택적 환경 변수

- `PORT`: 서버 포트 (기본값: 18443)
- `BIND_ADDRESS`: 바인드 주소 (기본값: 0.0.0.0)
- `LOG_LEVEL`: 로그 레벨 (기본값: info)
- `RATE_LIMIT_ENABLED`: Rate limiting 활성화 (기본값: true)
- `RATE_LIMIT_RPS`: 초당 요청 수 (기본값: 10)
- `RATE_LIMIT_BURST`: 버스트 크기 (기본값: 20)

전체 환경 변수 목록은 `backend/.env.example` 참조

---

## 검증 시나리오

### 기본 기능 검증

1. **헬스 체크**
```bash
curl http://localhost:18443/api/health
```

2. **로그인**
```bash
curl -X POST http://localhost:18443/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'
```

3. **VM 목록 조회**
```bash
curl http://localhost:18443/api/vms \
  -H "Authorization: Bearer <token>"
```

4. **에이전트 메트릭스**
```bash
curl http://localhost:18443/agent/metrics
```

### 보안 검증

1. **CORS 헤더 확인**
```bash
curl -H "Origin: https://www.darc.kr" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS http://localhost:18443/api/vms \
  -v
```

2. **보안 헤더 확인**
```bash
curl -I http://localhost:18443/api/health | grep -i "x-content-type-options\|x-frame-options\|strict-transport-security"
```

3. **인증 없이 접근 시도**
```bash
curl http://localhost:18443/api/vms
# 401 Unauthorized 응답 확인
```

---

## 추가 리소스

- API 문서: `/swagger` 또는 `/docs`
- Swagger JSON: `/api/swagger.json`
- Prometheus 메트릭스: `/api/metrics`
- 에이전트 메트릭스: `/agent/metrics`

---

## 관련 문서

- [문제 해결](./troubleshooting/common-issues.md)
- [FAQ](./troubleshooting/faq.md)
- [모니터링 전략](./monitoring/strategy.md)
- [알림 설정](./alerting/setup.md)
- [Docker 배포](../03-deployment/docker/deployment.md)

---

**태그**: `#운영` `#가이드` `#서비스-관리` `#보안` `#모니터링` `#백업`

**카테고리**: 운영 > 운영 가이드

**마지막 업데이트**: 2024-12-23
