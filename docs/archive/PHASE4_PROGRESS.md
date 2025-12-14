# Phase 4: 기능 확장 진행 상황

## 진행 중인 작업

### 1. ✅ JWT 인증/인가 시스템 구현

**완료된 항목:**
- `internal/auth/auth.go`: JWT 토큰 생성/검증, 비밀번호 해싱
- `internal/middleware/auth.go`: 인증 미들웨어
- `internal/handlers/auth.go`: 로그인/회원가입 핸들러
- Admin 계정 비밀번호 해싱 저장

**구현된 기능:**
- 사용자 로그인 (`POST /api/auth/login`)
- 사용자 회원가입 (`POST /api/auth/register`)
- JWT 토큰 기반 인증
- 비밀번호 bcrypt 해싱
- 공개 엔드포인트 (health, auth) 제외한 모든 API 보호

**사용 방법:**
```bash
# 회원가입
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "password123"}'

# 로그인
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "password123"}'

# 인증이 필요한 API 호출
curl -X GET http://localhost:8080/api/vms \
  -H "Authorization: Bearer <token>"
```

### 2. ✅ Rate Limiting 미들웨어 추가

**완료된 항목:**
- `internal/middleware/ratelimit.go`: IP 기반 Rate Limiting
- 환경 변수로 설정 가능
- IP별 요청 제한

**설정:**
- `RATE_LIMIT_ENABLED`: Rate limiting 활성화 여부
- `RATE_LIMIT_RPS`: 초당 최대 요청 수 (기본: 10)
- `RATE_LIMIT_BURST`: 버스트 크기 (기본: 20)

**동작:**
- IP 주소별로 요청 제한
- X-Forwarded-For, X-Real-IP 헤더 지원 (프록시 환경)
- 초과 시 429 Too Many Requests 응답

## 다음 작업

### 3. ✅ VM 스냅샷 기능 구현

**완료된 항목:**
- `internal/models/models.go`: VMSnapshot 모델 추가
- `internal/vm/snapshot.go`: 스냅샷 생성/조회/복원/삭제 기능
- `internal/handlers/snapshot.go`: 스냅샷 API 핸들러
- 라우터에 스냅샷 엔드포인트 추가

**구현된 기능:**
- 스냅샷 생성 (`POST /api/vms/{id}/snapshots`)
- 스냅샷 목록 조회 (`GET /api/vms/{id}/snapshots`)
- 스냅샷으로 VM 복원 (`POST /api/snapshots/{snapshot_id}/restore`)
- 스냅샷 삭제 (`DELETE /api/snapshots/{snapshot_id}`)

**사용 방법:**
```bash
# 스냅샷 생성
curl -X POST http://localhost:8080/api/vms/1/snapshots \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "snapshot-1", "description": "Before update"}'

# 스냅샷 목록 조회
curl -X GET http://localhost:8080/api/vms/1/snapshots \
  -H "Authorization: Bearer <token>"

# 스냅샷으로 복원
curl -X POST http://localhost:8080/api/snapshots/1/restore \
  -H "Authorization: Bearer <token>"

# 스냅샷 삭제
curl -X DELETE http://localhost:8080/api/snapshots/1 \
  -H "Authorization: Bearer <token>"
```

**보안:**
- VM 소유자만 스냅샷 생성/조회/복원/삭제 가능
- 인증된 사용자만 접근 가능

### 4. ✅ 리소스 할당량 관리

**완료된 항목:**
- `internal/models/quota.go`: ResourceQuota 모델 및 할당량 체크 로직
- `internal/handlers/quota.go`: 할당량 조회/수정 API 핸들러
- VM 생성 시 할당량 체크 통합

**구현된 기능:**
- 할당량 조회 (`GET /api/quota`) - 현재 사용자의 할당량 및 사용량
- 할당량 수정 (`PUT /api/quota/{user_id}`) - 관리자 또는 본인만 수정 가능
- VM 생성 시 자동 할당량 체크
- 기본 할당량: 최대 10개 VM, 8 CPU 코어, 16GB 메모리

**사용 방법:**
```bash
# 할당량 조회
curl -X GET http://localhost:8080/api/quota \
  -H "Authorization: Bearer <token>"

# 할당량 수정 (관리자 또는 본인)
curl -X PUT http://localhost:8080/api/quota/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"max_vms": 20, "max_cpu": 16, "max_memory": 32768}'
```

**할당량 체크:**
- VM 생성 시 자동으로 할당량을 체크합니다
- 할당량 초과 시 400 Bad Request 에러 반환
- 에러 메시지에 현재 사용량, 제한, 요청량 포함

### 5. ✅ 모니터링 메트릭 추가 (Prometheus)

**완료된 항목:**
- `internal/metrics/metrics.go`: Prometheus 메트릭 정의
- `internal/handlers/metrics.go`: 메트릭 엔드포인트 및 업데이트 로직
- HTTP 요청 메트릭 (미들웨어 통합)
- VM 관련 메트릭 (생성/삭제/스냅샷)
- 사용자 관련 메트릭 (로그인)

**구현된 메트릭:**
- `http_requests_total` - HTTP 요청 총 수 (method, endpoint, status)
- `http_request_duration_seconds` - HTTP 요청 지속 시간
- `vm_total` - VM 총 수 (상태별)
- `vm_cpu_cores` - 할당된 CPU 코어 수 (상태별)
- `vm_memory_mb` - 할당된 메모리 (상태별)
- `vm_create_total` - 생성된 VM 수
- `vm_delete_total` - 삭제된 VM 수
- `vm_snapshot_total` - 생성된 스냅샷 수
- `vm_snapshot_restore_total` - 복원된 스냅샷 수
- `user_total` - 총 사용자 수
- `user_login_total` - 로그인 총 수
- `libvirt_connection_status` - Libvirt 연결 상태

**사용 방법:**
```bash
# Prometheus 메트릭 엔드포인트 (공개)
curl http://localhost:8080/api/metrics

# Grafana 연동
# Prometheus 데이터 소스로 http://localhost:8080/api/metrics 추가
```

**메트릭 업데이트:**
- 서버 시작 시 초기 메트릭 업데이트
- VM 생성/삭제 시 자동 업데이트
- 스냅샷 생성/복원 시 자동 업데이트
- 로그인 시 자동 업데이트

## 변경 사항

### 새로운 파일
- `backend/internal/auth/auth.go` - 인증 로직
- `backend/internal/middleware/auth.go` - 인증 미들웨어
- `backend/internal/middleware/ratelimit.go` - Rate Limiting 미들웨어
- `backend/internal/handlers/auth.go` - 인증 핸들러
- `backend/internal/vm/snapshot.go` - 스냅샷 서비스 로직
- `backend/internal/handlers/snapshot.go` - 스냅샷 API 핸들러
- `backend/internal/models/quota.go` - 리소스 할당량 모델 및 로직
- `backend/internal/handlers/quota.go` - 할당량 API 핸들러
- `backend/internal/metrics/metrics.go` - Prometheus 메트릭 정의
- `backend/internal/handlers/metrics.go` - 메트릭 엔드포인트

### 수정된 파일
- `backend/cmd/server/main.go` - 미들웨어 체인에 인증 추가
- `backend/internal/router/router.go` - 인증 및 스냅샷 엔드포인트 추가
- `backend/internal/config/config.go` - Rate Limiting 설정 추가
- `backend/internal/models/models.go` - VMSnapshot 모델 추가
- `backend/internal/database/db.go` - VMSnapshot 마이그레이션 추가
- `backend/internal/errors/errors.go` - WriteForbidden 함수 추가
- `backend/internal/middleware/middleware.go` - HTTP 메트릭 수집 추가
- `backend/internal/router/router.go` - 메트릭 엔드포인트 추가
- `backend/cmd/server/main.go` - 메트릭 초기화 추가
- `backend/env.example` - Rate Limiting 환경 변수 추가

## 주의 사항

⚠️ **인증 활성화:**
- 기본적으로 인증이 활성화되어 있습니다
- `/api/health`, `/api/auth/login`, `/api/auth/register`는 공개 엔드포인트입니다
- 다른 모든 API는 JWT 토큰이 필요합니다

⚠️ **기존 사용자:**
- 기존 VM 생성 시 OwnerID가 컨텍스트에서 가져오도록 변경되었습니다
- 인증되지 않은 요청은 OwnerID 1 (admin)으로 폴백됩니다

⚠️ **Rate Limiting:**
- 기본값: 초당 10개 요청, 버스트 20개
- 프로덕션 환경에 맞게 조정 필요

