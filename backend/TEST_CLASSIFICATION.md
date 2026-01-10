# LIMEN Backend 테스트 분류

## Step 1: 테스트 3종 분류

### P0 Smoke (필수, PR마다) - 1~3분
**목적**: 핵심 기능이 작동하는지 빠르게 확인
**실행**: 모든 PR에서 필수

#### 포함 테스트:
- `cmd/server/main_test.go` - Health endpoint, 기본 API 응답
- `internal/handlers/health_test.go` - Health check
- `internal/handlers/auth_test.go` - 기본 인증 (로그인/토큰)
- `internal/middleware/auth_min_test.go` - 인증 미들웨어 기본
- `internal/validator/validator_test.go` - 입력 검증 기본

#### 실행 방법:
```bash
go test -tags smoke -short ./cmd/server/... ./internal/handlers/health_test.go ./internal/handlers/auth_test.go ./internal/validator/...
```

---

### Core Regression (중요, PR마다 또는 main merge마다) - 3~10분
**목적**: 핵심 비즈니스 로직과 API 계약 검증
**실행**: PR마다 또는 main merge마다

#### 포함 테스트:
- **Auth/JWT/refresh/RBAC**:
  - `internal/auth/auth_test.go` - JWT 생성/검증
  - `internal/auth/auth_extended_test.go` - Refresh token
  - `internal/middleware/auth_extended_test.go` - RBAC
  - `internal/middleware/rbac_test.go` (있으면)

- **VM lifecycle** (libvirt 제외, stub 사용):
  - `internal/handlers/api_test.go` - VM CRUD 핸들러
  - `internal/handlers/vm_action_test.go` - VM 액션 (start/stop/delete)
  - `internal/handlers/snapshot_test.go` - 스냅샷 핸들러 (libvirt 제외)

- **Console token 발급 + WS 연결**:
  - `internal/handlers/api_websocket_test.go` - WebSocket 핸들러
  - Console token 발급 테스트 (추가 필요)

- **DB FK/트랜잭션/삭제 제약**:
  - `internal/models/models_test.go` - 모델 제약
  - `internal/database/db_test.go` - DB 트랜잭션

- **요청 제한/타임아웃/에러 처리**:
  - `internal/middleware/ratelimit_test.go` - Rate limiting
  - `internal/errors/errors_test.go` - 에러 처리

#### 실행 방법:
```bash
go test -tags regression -short ./internal/... ./cmd/...
```

---

### Extended / Flaky (선택, nightly/manual)
**목적**: 통합 테스트, 성능 테스트, 환경 의존 테스트
**실행**: nightly 또는 수동 트리거

#### 포함 테스트:

- **libvirt 의존 테스트** (self-hosted runner):
  - `internal/vm/service_test.go` - libvirt 실제 연결 필요
  - `internal/vm/snapshot_test.go` - libvirt 스냅샷
  - `internal/vm/stats_test.go` - libvirt 통계
  - `internal/vm/sync_test.go` - libvirt 동기화

- **성능/부하 테스트**:
  - `internal/handlers/api_bench_test.go` - 벤치마크

- **Playwright E2E** (별도 워크플로우):
  - 프론트엔드 E2E 테스트

#### 실행 방법:
```bash
# libvirt 테스트 (self-hosted runner)
go test -tags libvirt,extended ./internal/vm/...

# 벤치마크
go test -tags extended -bench=. ./internal/handlers/api_bench_test.go
```

---

## Step 2: 쓰는 테스트 (살릴 것)

### ✅ 유지할 테스트 카테고리:

1. **Auth/JWT/refresh/RBAC** ✅
   - `internal/auth/*_test.go`
   - `internal/middleware/auth*_test.go`

2. **VM create/start/stop/delete** ✅
   - `internal/handlers/api_test.go`
   - `internal/handlers/vm_action_test.go`
   - (libvirt stub 사용)

3. **Console token 발급 + WS 연결** ✅
   - `internal/handlers/api_websocket_test.go`
   - Console endpoint 테스트 추가 필요

4. **DB FK/트랜잭션/삭제 제약** ✅
   - `internal/models/*_test.go`
   - `internal/database/*_test.go`

5. **요청 제한/타임아웃/에러 처리** ✅
   - `internal/middleware/ratelimit_test.go`
   - `internal/errors/errors_test.go`

---

## Step 3: 안 쓰는 테스트 (버릴 것/격리)

### ❌ 제외/격리 대상:

1. **중복 테스트**:
   - `*_extended_test.go` 중 핵심 기능과 중복되는 것
   - 동일 시나리오 반복 테스트

2. **환경 의존 테스트** (libvirt) → `tags libvirt,extended`:
   - `internal/vm/service_test.go` - libvirt 실호스트 필요
   - `internal/vm/snapshot_test.go` - libvirt 필요
   - `internal/vm/stats_test.go` - libvirt 필요
   - `internal/vm/sync_test.go` - libvirt 필요

3. **Flaky한 E2E** → nightly/manual:
   - Playwright 브라우저 테스트
   - 네트워크 타이밍 의존 테스트

4. **의미 없는 스냅샷/UI 픽셀 테스트**:
   - 기관망 환경에서는 가치 낮음
   - 제거 또는 nightly로 이동

---

## 테스트 태그 사용법

### Build Tags:
- `//go:build smoke` - P0 Smoke 테스트
- `//go:build regression` - Core Regression 테스트
- `//go:build extended` - Extended/Flaky 테스트
- `//go:build libvirt` - libvirt 의존 테스트

### Short Flag:
- `-short` - 빠른 테스트만 실행 (smoke + regression 일부)

---

## CI 워크플로우 구조

1. **PR 체크** (필수):
   ```bash
   go test -tags smoke -short ./...
   ```

2. **Main merge** (필수):
   ```bash
   go test -tags smoke,regression -short ./...
   ```

3. **Nightly** (선택):
   ```bash
   go test -tags extended ./...
   ```

4. **Libvirt 검증** (수동, self-hosted):
   ```bash
   go test -tags libvirt,extended ./internal/vm/...
   ```
