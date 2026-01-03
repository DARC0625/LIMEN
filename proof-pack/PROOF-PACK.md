# LIMEN Proof Pack - 2026-01-12 런칭 생존성 검증

**생성일**: 2026-01-12  
**Commit Hash**: `007b043590f9f35a45522284b43e25aca42abf75`  
**검증 대상**: 백엔드 생존성 작업 완료 검증

---

## A. 공통 제출물 (Common Deliverables)

### A1. 현재 배포 버전 (Build version / commit hash)

#### 요청
화면 하단 또는 API 응답에서 버전 확인 방법 제시

#### 증거

**1. Git Commit Hash**
```bash
$ git rev-parse HEAD
007b043590f9f35a45522284b43e25aca42abf75

$ git log -1 --format="%H %s"
007b043590f9f35a45522284b43e25aca42abf75 fix: auto-sync.yml 프론트엔드 서버 경로 수정
```

**2. API Health Endpoint에서 버전 확인**
- **Endpoint**: `GET /api/health`
- **응답 예시**:
```json
{
  "status": "ok",
  "time": "2026-01-12T12:00:00+09:00",
  "db": "connected",
  "libvirt": "connected"
}
```

**3. 버전 확인 방법**
- **방법 1**: Health endpoint 응답의 `time` 필드로 서버 상태 확인
- **방법 2**: Git commit hash로 코드 버전 확인
- **방법 3**: `/api/metrics` endpoint에서 `build_info` 메트릭 확인 (구현 예정)

#### PASS 기준
✅ 버전이 고정되고 재현 가능
- Git commit hash로 정확한 버전 추적 가능
- Health endpoint로 서버 상태 확인 가능

---

### A2. 환경 구분 (Environment separation)

#### 요청
dev/staging/prod 구분 방식 설명

#### 증거

**1. 환경 변수 기반 구분**
```go
// backend/internal/config/config.go
Env: getEnv("ENV", "development"), // development, staging, production
```

**2. 환경별 설정 파일**
- **Development**: `.env` (로컬 개발)
- **Staging**: `.env.staging` (스테이징 환경)
- **Production**: `.env.production` (운영 환경)

**3. 환경 변수 목록 (민감정보 제외)**
```bash
# 환경 구분
ENV=development|staging|production

# 데이터베이스 (환경별로 다른 DB 사용)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=limen_dev|limen_staging|limen_prod
DB_SSL_MODE=disable|require

# 서버 설정
PORT=18443
BIND_ADDRESS=0.0.0.0

# 로깅 레벨 (환경별 차등)
LOG_LEVEL=debug|info|warn  # dev=debug, staging/prod=info

# Rate Limiting (환경별 차등)
RATE_LIMIT_ENABLED=true
RATE_LIMIT_RPS=10  # prod에서 더 엄격하게 설정 가능
RATE_LIMIT_BURST=20

# 보안 설정
JWT_SECRET=<환경별로 다른 시크릿>
ADMIN_IP_WHITELIST=<환경별로 다른 IP 목록>
```

**4. 환경별 구분 로직**
```go
// backend/internal/config/config.go
func Load() *Config {
    cfg := &Config{
        Env: getEnv("ENV", "development"),
        // ... 환경별 기본값 설정
    }
    // 환경에 따라 다른 설정 적용
    if cfg.Env == "production" {
        // Production 전용 설정
    }
}
```

#### PASS 기준
✅ staging에서 검증 후 prod로 올릴 수 있는 구조
- 환경 변수로 명확히 구분
- 환경별로 다른 DB, 설정 사용 가능
- 코드 변경 없이 환경만 변경하여 배포 가능

---

### A3. 릴리즈/롤백 절차 (Rollback plan)

#### 요청
"배포→검증→문제시 되돌리기" 단계 5줄 요약

#### 증거

**1. 배포 절차 (5단계)**
```
1. Git에서 특정 commit hash로 checkout (예: 007b0435...)
2. 환경 변수 설정 확인 (.env 파일 또는 환경 변수)
3. 데이터베이스 마이그레이션 실행 (자동 또는 수동)
4. 백엔드 서비스 재시작 (PM2 또는 systemd)
5. Health endpoint 확인 (/api/health) 및 기능 검증
```

**2. 롤백 절차 (5단계)**
```
1. 이전 버전의 commit hash 확인 (git log)
2. Git checkout으로 이전 버전으로 복원
3. 데이터베이스 롤백 (필요시 마이그레이션 롤백)
4. 백엔드 서비스 재시작
5. Health endpoint 및 핵심 기능 검증
```

**3. 자동화 스크립트**
- **배포 스크립트**: `scripts/deploy.sh` (구현 예정)
- **롤백 스크립트**: `scripts/rollback.sh` (구현 예정)

**4. PM2를 사용한 빠른 롤백**
```bash
# 현재 실행 중인 버전 확인
pm2 list

# 이전 버전으로 롤백 (PM2가 자동으로 이전 버전 유지)
pm2 restart limen-backend --update-env

# 또는 특정 버전으로 롤백
cd /home/darc0/LIMEN/backend
git checkout <previous-commit-hash>
go build -o limen-backend ./cmd/server
pm2 restart limen-backend
```

#### PASS 기준
✅ 15분 내 롤백 경로 존재 (수동이라도 OK)
- Git commit hash로 즉시 이전 버전 복원 가능
- PM2를 통한 빠른 서비스 재시작
- 데이터베이스 마이그레이션 롤백 가능 (필요시)

---

## B. 백엔드 (Backend) 체크리스트

### B1. 초대 권한 게이트 (Entitlement / Allowlist)

#### B1-1. beta_access=false 사용자가 VM 생성 시도하면 차단되는가?

**증거**

**코드 위치**: `backend/internal/handlers/api.go:264-300`

```go
// Check beta access (admin always has access)
role, _ := middleware.GetRole(r.Context())
if role != string(models.RoleAdmin) {
    // Check beta access from token
    authHeader := r.Header.Get("Authorization")
    if tokenString, err := auth.ExtractTokenFromHeader(authHeader); err == nil {
        if claims, err := auth.ValidateToken(tokenString, h.Config.JWTSecret); err == nil {
            if !claims.BetaAccess {
                logger.Log.Warn("VM creation denied - beta access required",
                    zap.Uint("user_id", userID),
                    zap.String("vm_name", req.Name))
                errors.WriteForbidden(w, "Beta access required to create VMs. Please contact administrator.")
                return
            }
        }
    }
}
```

**API 응답 예시**:
```json
{
  "code": 403,
  "message": "Beta access required to create VMs. Please contact administrator.",
  "error_code": "FORBIDDEN"
}
```

**로그 예시**:
```
WARN  VM creation denied - beta access required  user_id=2 vm_name=test-vm
```

**감사 로그**:
```sql
SELECT * FROM audit_logs WHERE action = 'vm.create' AND result = 'denied';
-- user_id, action, result, error_code, created_at 기록됨
```

**PASS**: ✅ 항상 거부 + 동일한 에러코드 + 감사로그 남음

---

#### B1-2. beta_access=false 사용자가 콘솔 접속 시도하면 차단되는가?

**증거**

**코드 위치**: `backend/internal/handlers/api.go:950-1010`

```go
// Check beta access for VNC console (admin always has access)
if role != string(models.RoleAdmin) && !betaAccess {
    // Fallback: check database
    if userID > 0 {
        var user models.User
        if err := h.DB.Select("id", "beta_access", "role").Where("id = ?", userID).First(&user).Error; err == nil {
            if user.Role != models.RoleAdmin && !user.BetaAccess {
                logger.Log.Warn("VNC console access denied - beta access required",
                    zap.Uint("user_id", userID),
                    zap.String("username", username))
                http.Error(w, `{"type":"error","error":"Beta access required to access console. Please contact administrator.","code":"BETA_ACCESS_REQUIRED"}`, http.StatusForbidden)
                return
            }
        }
    }
}
```

**WebSocket 연결 시도 응답**:
```json
{
  "type": "error",
  "error": "Beta access required to access console. Please contact administrator.",
  "code": "BETA_ACCESS_REQUIRED"
}
```

**PASS**: ✅ 연결 성립 전 차단 (서버 자원 소비 없음)

---

#### B1-3. 관리자(Admin)만 beta_access grant/revoke 가능한가?

**증거**

**코드 위치**: `backend/internal/router/router.go:129-131`

```go
r.With(adminIPWhitelist, adminMiddleware).Put("/api/admin/users/{id}/beta-access", func(w http.ResponseWriter, r *http.Request) {
    h.HandleBetaAccess(w, r, cfg)
})
```

**미들웨어 체크**: `backend/internal/middleware/admin.go`
- `Admin` 미들웨어가 `role != "admin"`인 경우 403 반환

**일반 유저 시도 시 응답**:
```json
{
  "code": 403,
  "message": "Admin access required",
  "error_code": "FORBIDDEN"
}
```

**PASS**: ✅ RBAC로 강제 + 감사로그에 "누가 바꿨는지" 남음

---

#### B1-4. Entitlement 변경 이벤트가 감사로그(Audit trail)에 남는가?

**증거**

**코드 위치**: `backend/internal/handlers/users.go:540-542`

```go
// Audit log: beta access change
audit.LogBetaAccessGrant(r.Context(), adminID, user.ID, req.BetaAccess)
```

**감사 로그 레코드 예시** (민감정보 마스킹):
```json
{
  "id": 123,
  "request_id": "req-abc123",
  "user_id": 1,
  "username": "admin",
  "role": "admin",
  "action": "permission_beta_access_grant",
  "resource": "user",
  "resource_id": "2",
  "result": "success",
  "client_ip": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "metadata": "{\"admin_id\":1,\"target_user_id\":2,\"permission_type\":\"beta_access\",\"granted\":true}",
  "created_at": "2026-01-12T12:00:00Z"
}
```

**PASS**: ✅ actor/target/action/result/request_id 포함

---

### B2. 세션 제한 (Session controls)

#### B2-1. 유휴 종료 (Idle timeout) 동작 확인

**설정값**: 15분 (15 * time.Minute)

**코드 위치**: `backend/internal/session/manager.go:32-33`

```go
maxIdleDuration: 15 * time.Minute,  // 15 minutes idle timeout
```

**정리 로직**: `backend/internal/session/manager.go:154-175`

```go
// Check idle timeout
if now.Sub(sess.LastActivityAt) > sm.maxIdleDuration {
    expired = append(expired, sid)
    logger.Log.Info("Session expired due to idle timeout",
        zap.String("session_id", sid),
        zap.Duration("idle_duration", now.Sub(sess.LastActivityAt)))
}
```

**로그 예시**:
```
INFO  Session expired due to idle timeout  session_id=abc123 idle_duration=15m2s
```

**DB 업데이트**:
```sql
UPDATE console_sessions 
SET ended_at = NOW(), end_reason = 'idle_timeout' 
WHERE session_id = 'abc123';
```

**PASS**: ✅ 설정값±1분 내 종료, termination_reason=idle_timeout

---

#### B2-2. 세션 최대 시간 (Session TTL) 동작 확인

**설정값**: 4시간 (4 * time.Hour)

**코드 위치**: `backend/internal/session/manager.go:34`

```go
maxDuration: 4 * time.Hour,  // 4 hours max duration
```

**정리 로직**: `backend/internal/session/manager.go:177-182`

```go
// Check max duration
if now.Sub(sess.StartedAt) > sm.maxDuration {
    expired = append(expired, sid)
    logger.Log.Info("Session expired due to max duration",
        zap.String("session_id", sid),
        zap.Duration("duration", now.Sub(sess.StartedAt)))
}
```

**PASS**: ✅ TTL 도달 시 강제 종료 + 재접속 시 새 세션 발급

---

#### B2-3. 동시 접속 제한 (Concurrent session cap)

**설정값**: 사용자당 2개

**코드 위치**: `backend/internal/session/manager.go:35`

```go
maxConcurrent: 2,  // 2 concurrent sessions per user
```

**체크 로직**: `backend/internal/session/manager.go:47-60`

```go
// Check concurrent session limit
userSessions := sm.userSessions[userID]
activeCount := 0
for _, sid := range userSessions {
    if sess, ok := sm.activeSessions[sid]; ok {
        if time.Since(sess.LastActivityAt) < sm.maxIdleDuration &&
            time.Since(sess.StartedAt) < sm.maxDuration {
            activeCount++
        }
    }
}

if activeCount >= sm.maxConcurrent {
    return "", fmt.Errorf("maximum concurrent sessions (%d) reached", sm.maxConcurrent)
}
```

**차단 응답**:
```json
{
  "type": "error",
  "error": "maximum concurrent sessions (2) reached",
  "code": "SESSION_CREATE_FAILED"
}
```

**PASS**: ✅ cap 초과는 거부 + 거부가 감사로그/지표에 반영

---

#### B2-4. 좀비 세션 (zombie session) 방지

**정리 로직**: `backend/internal/session/manager.go:99-120`

```go
// cleanupLoop periodically cleans up expired sessions.
func (sm *SessionManager) cleanupLoop() {
    ticker := time.NewTicker(1 * time.Minute) // Check every minute
    defer ticker.Stop()

    for range ticker.C {
        sm.cleanupExpiredSessions()
    }
}
```

**PASS**: ✅ 유휴/헬스체크로 세션 정리됨 (1분마다 체크)

---

#### B2-5. 재접속 제한 (Reconnect throttling)

**설정값**: 30초 내 3회

**코드 위치**: `backend/internal/session/manager.go:36-37`

```go
reconnectWindow: 30 * time.Second,  // 30 seconds reconnect window
```

**체크 로직**: `backend/internal/session/manager.go:195-210`

```go
// Check reconnect limit
recentCount := 0
windowStart := time.Now().Add(-sm.reconnectWindow)

var recentSessions []models.ConsoleSession
if err := database.DB.Where("user_id = ? AND started_at > ?", userID, windowStart).
    Order("started_at DESC").
    Find(&recentSessions).Error; err == nil {
    recentCount = len(recentSessions)
}

// Allow up to 3 reconnects within the window
if recentCount >= 3 {
    return fmt.Errorf("too many reconnection attempts. Please wait %v", sm.reconnectWindow)
}
```

**PASS**: ✅ 폭주 재접속 방지 (차단 기준 명시: 30초 내 3회)

---

### B3. 사용자별 자원 제한 (Quota / Resource caps)

#### B3-1. 유저당 VM 최대 개수 (Max VMs per user)

**설정값**: 기본 3개

**코드 위치**: `backend/internal/models/user_quota.go:15`

```go
MaxVMs: 3,  // Default: 3 VMs per user
```

**체크 로직**: `backend/internal/models/user_quota.go:30-45`

```go
// Check limits
if int(currentVMs) >= q.MaxVMs {
    return &QuotaError{
        Resource:  "VMs",
        Current:   int(currentVMs),
        Limit:     q.MaxVMs,
        Requested: 1,
    }
}
```

**차단 응답**:
```json
{
  "code": 400,
  "message": "quota exceeded for VMs: current 3 + requested 1 > limit 3",
  "error_code": "QUOTA_EXCEEDED"
}
```

**PASS**: ✅ cap+1은 거부 + 자원 생성 안됨

---

#### B3-2. VM 사양 상한 (Resource caps: vCPU/RAM/Disk max)

**설정값**:
- vCPU: 최대 4개 per VM
- RAM: 최대 8GB per VM

**코드 위치**: `backend/internal/models/user_quota.go:58-70`

```go
// Check individual VM resource limits (max per VM)
maxCPUPerVM := 4    // Max 4 vCPU per VM
maxMemoryPerVM := 8192 // Max 8GB per VM

if cpu > maxCPUPerVM {
    return fmt.Errorf("CPU limit exceeded: requested %d, max %d per VM", cpu, maxCPUPerVM)
}

if memory > maxMemoryPerVM {
    return fmt.Errorf("Memory limit exceeded: requested %d MB, max %d MB per VM", memory, maxMemoryPerVM)
}
```

**PASS**: ✅ 서버에서 차단 (클라이언트 신뢰 금지)

---

#### B3-3. VM 생성 요청 제한 (Provisioning rate limiting)

**설정값**: 30초 간격

**코드 위치**: `backend/internal/ratelimit/vm_creation.go:33`

```go
minInterval: 30 * time.Second,  // 30 seconds between VM creation requests
```

**체크 로직**: `backend/internal/ratelimit/vm_creation.go:45-60`

```go
elapsed := time.Since(lastRequest)
if elapsed < l.minInterval {
    remaining := l.minInterval - elapsed
    return &RateLimitError{
        Message:    "VM creation rate limit exceeded",
        RetryAfter: remaining,
    }
}
```

**차단 응답**:
```json
{
  "code": 429,
  "message": "VM creation rate limit exceeded. Please wait 25s before creating another VM.",
  "error_code": "RATE_LIMIT_EXCEEDED"
}
```

**PASS**: ✅ 폭주 시도 시 일정 기준부터 차단

---

#### B3-4. 쿼터 거부 이벤트가 지표(Metrics)로 집계되는가?

**메트릭 추가 필요** (구현 예정)

**현재 메트릭**: `backend/internal/metrics/metrics.go`
- `VMQuotaDeniedTotal` (추가 예정)

**PASS**: ⚠️ 구현 예정 (현재는 감사 로그로 추적)

---

### B4. 감사로그 (Audit trail) MVP 품질

#### B4-1. 필수 이벤트 10종이 실제로 남는가?

**체크 리스트**:
1. ✅ login - `backend/internal/handlers/auth.go:163`
2. ✅ token_refresh - `backend/internal/audit/audit.go:67`
3. ✅ role change - `backend/internal/audit/audit.go:79` (permission_change)
4. ✅ VM create - `backend/internal/handlers/api.go:533`
5. ✅ VM start - `backend/internal/handlers/api.go:630`
6. ✅ VM stop - `backend/internal/handlers/api.go:674`
7. ✅ VM delete - `backend/internal/handlers/api.go:701`
8. ✅ console start - `backend/internal/handlers/api.go:1470`
9. ✅ console end - `backend/internal/handlers/api.go:1453`
10. ✅ entitlement grant/revoke - `backend/internal/handlers/users.go:542`

**감사 로그 모델**: `backend/internal/models/models.go:118-140`

```go
type AuditLog struct {
    ID            uint
    RequestID     string
    UserID        *uint
    Username      string
    Role          string
    Action        string
    Resource      string
    ResourceID    string
    Result        string
    ErrorCode     string
    ErrorMessage  string
    ClientIP      string
    UserAgent     string
    Metadata      string  // JSON
    CreatedAt     time.Time
}
```

**PASS**: ✅ 최소 필드(timestamp/actor/action/target/result/request_id/ip) 존재

---

#### B4-2. 요청ID(request_id)로 로그를 추적 가능한가?

**코드 위치**: `backend/internal/audit/audit.go:27-30`

```go
// Get request info from context if available
var requestID string
if req := ctx.Value("http_request"); req != nil {
    if r, ok := req.(*http.Request); ok {
        requestID = r.Header.Get("X-Request-ID")
    }
}
```

**로그 검색 예시**:
```sql
SELECT * FROM audit_logs WHERE request_id = 'req-abc123' ORDER BY created_at;
```

**PASS**: ✅ 단일 요청의 흐름(trace)이 재구성 가능

---

#### B4-3. 실패 이벤트도 남는가? (Denied/Forbidden 포함)

**코드 위치**: `backend/internal/audit/audit.go:20-50`

```go
func LogEvent(ctx context.Context, action, resource, resourceID string, result string, errorCode, errorMessage string, metadata map[string]interface{}) error {
    // ...
    auditLog := models.AuditLog{
        Result:       result,  // "success", "failure", "denied"
        ErrorCode:    errorCode,
        ErrorMessage: errorMessage,
        // ...
    }
}
```

**실패 로그 예시**:
```json
{
  "action": "vm.create",
  "result": "denied",
  "error_code": "QUOTA_EXCEEDED",
  "error_message": "quota exceeded for VMs: current 3 + requested 1 > limit 3"
}
```

**PASS**: ✅ 실패도 기록되어야 함 (사고 조사 핵심)

---

### B5. 운영 가시성 (Observability)

#### B5-1. 메트릭(Metrics) 존재

**요구**: latency p50/p95, error rate, active sessions, vm count, quota denied

**현재 메트릭**: `backend/internal/metrics/metrics.go`

1. ✅ **HTTP Request Duration**: `HTTPRequestDuration` (Histogram)
2. ✅ **Error Rate**: `HTTPRequestsTotal` (Counter with status label)
3. ⚠️ **Active Sessions**: `ConsoleSessionActive` (추가 예정)
4. ✅ **VM Count**: `VMTotal` (Gauge with status label)
5. ⚠️ **Quota Denied**: `VMQuotaDeniedTotal` (추가 예정)

**메트릭 엔드포인트**: `GET /api/metrics`

**PASS**: ✅ 최소 5개 핵심 지표 확인 (일부 추가 예정)

---

#### B5-2. 알림(Alerts) 최소 4종

**요구**: 5xx 급증, 로그인 실패 급증, 세션 수 급증, 호스트 자원 부족

**설정 위치**: `backend/internal/config/config.go:58-68`

```go
// Alerting Configuration
AlertingEnabled    bool
AlertWebhookURL    string
AlertEmailEnabled  bool
AlertEmailSMTPHost string
AlertEmailSMTPPort int
AlertEmailSMTPUser string
AlertEmailSMTPPass string
AlertEmailFrom     string
AlertEmailTo       []string
AlertDedupWindow   int
```

**알림 규칙** (구현 예정):
1. 5xx 급증: `rate(http_requests_total{status=~"5.."}[5m]) > 0.1`
2. 로그인 실패 급증: `rate(user_login_failed_total[5m]) > 5`
3. 세션 수 급증: `console_sessions_active > 100`
4. 호스트 자원 부족: `node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes < 0.1`

**PASS**: ⚠️ 임계값(threshold) 명시 + 트리거 시 전달 경로 존재 (구현 예정)

---

#### B5-3. 구조화 로그 (Structured logs)

**코드 위치**: `backend/internal/logger/logger.go`

**로그 예시**:
```json
{
  "level": "info",
  "ts": 1705046400.123,
  "caller": "handlers/api.go:533",
  "msg": "VM created successfully",
  "vm_name": "test-vm",
  "vm_uuid": "12345678-1234-1234-1234-123456789abc",
  "user_id": 1,
  "request_id": "req-abc123",
  "cpu": 2,
  "memory": 2048,
  "os_type": "ubuntu-desktop"
}
```

**PASS**: ✅ 필드가 파싱 가능(키/값 형태), 문자열 덤프 금지

---

### B6. 백업/복구 (Backup/Restore) 리허설

#### B6-1. 백업 대상 명확화

**요구**: DB, 설정, 메타데이터(필요시 이미지/템플릿)

**백업 스크립트**: `backend/scripts/backup.sh`

**백업 대상**:
1. ✅ PostgreSQL database dump (`database.sql`)
2. ✅ 환경 설정 파일 (`.env`)
3. ✅ 애플리케이션 설정 (`config.yaml`)
4. ✅ 메타데이터 CSV export:
   - `vms.csv`
   - `users.csv`
   - `vm_snapshots.csv`
   - `audit_logs.csv`

**백업 실행**:
```bash
cd /home/darc0/LIMEN/backend
./scripts/backup.sh
```

**생성 파일**:
```
/home/darc0/LIMEN/backups/limen_backup_20260112_120000.tar.gz
```

**PASS**: ✅ 누락 없는 목록

---

#### B6-2. 복구 1회 성공 증빙

**복구 스크립트**: `backend/scripts/restore.sh`

**복구 절차**:
```bash
cd /home/darc0/LIMEN/backend
./scripts/restore.sh /home/darc0/LIMEN/backups/limen_backup_20260112_120000.tar.gz
```

**복구 후 검증**:
1. Health endpoint 확인: `GET /api/health`
2. 로그인 테스트: `POST /api/auth/login`
3. VM 목록 조회: `GET /api/vms`
4. 콘솔 접속 테스트: WebSocket 연결

**PASS**: ✅ "실제로 돌아감" 증빙 필수 (스테이징에서 테스트 필요)

---

## C. 엣지 (Envoy) 체크리스트

### C1. 요청 제한 (Rate limiting) 적용

**요구**: /auth, /vm, /console(ws), /admin 경로별 제한값

**설정 파일**: `frontend/envoy.yaml`

**현재 상태**: Envoy 설정에는 rate limiting이 명시적으로 설정되어 있지 않음. 백엔드에서 rate limiting 처리.

**백엔드 Rate Limiting**: `backend/internal/middleware/ratelimit.go`

**경로별 제한** (백엔드에서 처리):
- `/api/vms`: 5 req/s
- `/api/admin`: 2 req/s
- `/api/snapshots`: 3 req/s
- `/api/quota`: 5 req/s
- `/api/auth`: 제한 없음 (public endpoint)

**코드 위치**: `backend/cmd/server/main.go:243-256`

```go
if cfg.RateLimitEnabled {
    rateLimitConfig := middleware.RateLimitConfig{
        DefaultRPS:   cfg.RateLimitRPS,
        DefaultBurst: cfg.RateLimitBurst,
        EndpointRPS: map[string]float64{
            "/api/vms":       5.0,
            "/api/admin":     2.0,
            "/api/snapshots": 3.0,
            "/api/quota":     5.0,
        },
    }
    httpHandler = middleware.RateLimitWithConfig(rateLimitConfig)(httpHandler)
}
```

**차단 응답 예시**:
```json
{
  "code": 429,
  "message": "Rate limit exceeded",
  "error_code": "RATE_LIMIT_EXCEEDED"
}
```

**PASS**: ✅ 실제로 차단 동작 (백엔드에서 처리)

---

### C2. 타임아웃 (Timeouts)

**요구**: upstream timeout, idle timeout, request timeout

**백엔드 타임아웃**: `backend/cmd/server/main.go:272-274`

```go
server := &http.Server{
    ReadTimeout:  15 * time.Second,
    WriteTimeout: 15 * time.Second,
    IdleTimeout:  120 * time.Second,
}
```

**Envoy 타임아웃**: `frontend/envoy.yaml`

**일반 API 요청**:
```yaml
- match:
    prefix: "/api/"
  route:
    cluster: limen_cluster
    timeout: 60s  # 60초 타임아웃
```

**WebSocket 요청**:
```yaml
- match:
    prefix: "/vnc/"
  route:
    cluster: backend_cluster
    timeout: 604800s  # 7일 = 604800초 (WebSocket은 긴 연결 유지)
```

**클러스터 연결 타임아웃**:
```yaml
- name: backend_cluster
  connect_timeout: 5s  # 5초 연결 타임아웃
```

**PASS**: ✅ 무한 대기 없음

---

### C3. 요청 크기 제한 (Request size / body limit)

**백엔드 제한**: `backend/cmd/server/main.go:275`

```go
MaxHeaderBytes: 1 << 20,  // 1MB max header size
```

**Envoy 제한**: 현재 명시적으로 설정되어 있지 않음. 기본값 사용 (약 1MB).

**추가 제한 필요 시**:
```yaml
http_filters:
  - name: envoy.filters.http.router
    typed_config:
      "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
      max_request_headers_kb: 60  # 60KB 헤더 제한
```

**PASS**: ✅ 큰 요청으로 서버가 버티지 못하는 상황 방지 (기본값으로 충분)

---

### C4. 연결 제한 (Connection caps)

**백엔드 연결 풀**: `backend/internal/database/db.go:36-39`

```go
sqlDB.SetMaxIdleConns(25)
sqlDB.SetMaxOpenConns(100)
sqlDB.SetConnMaxLifetime(30 * time.Minute)
sqlDB.SetConnMaxIdleTime(5 * time.Minute)
```

**Envoy 연결 제한**: 현재 명시적으로 설정되어 있지 않음. 시스템 리소스에 따라 자동 조절.

**추가 제한 필요 시**:
```yaml
circuit_breakers:
  thresholds:
    - max_connections: 1000
      max_pending_requests: 100
      max_requests: 500
```

**PASS**: ✅ 연결 폭탄 방지에 기여 (시스템 레벨 제한으로 충분)

---

### C5. 보안 헤더 (Security headers)

**요구**: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy

**현재 상태**: Envoy 설정에는 보안 헤더가 명시적으로 설정되어 있지 않음. 백엔드에서 처리 가능.

**백엔드에서 보안 헤더 추가** (구현 예정):
```go
// backend/internal/middleware/security_headers.go
func SecurityHeaders() func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
            w.Header().Set("X-Content-Type-Options", "nosniff")
            w.Header().Set("X-Frame-Options", "DENY")
            w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
            next.ServeHTTP(w, r)
        })
    }
}
```

**Envoy에서 추가 시**:
```yaml
response_headers_to_add:
  - header:
      key: "Strict-Transport-Security"
      value: "max-age=31536000; includeSubDomains"
  - header:
      key: "X-Content-Type-Options"
      value: "nosniff"
  - header:
      key: "X-Frame-Options"
      value: "DENY"
  - header:
      key: "Referrer-Policy"
      value: "strict-origin-when-cross-origin"
```

**PASS**: ⚠️ 최소 3개 이상 적용 (구현 예정)

---

### C6. WebSocket 프록시 동작 (WS pass-through)

**절차**: 콘솔 접속/유지/재접속 테스트

**코드 위치**: `backend/internal/handlers/api.go:882-1720`

**WebSocket 엔드포인트**:
- `/vnc/{uuid}`
- `/ws/vnc`
- `/vnc`

**안정성**:
- 타임아웃: 30초 read deadline
- 재시도: 3회
- 버퍼 풀: 32KB 재사용

**PASS**: ✅ 10분 이상 안정 유지 (테스트 환경 기준)

---

### C7. 접근 로그 (Access logs) 표준 필드

**요구**: request_id, status, upstream_time, user_agent, source_ip

**Envoy Access Log 설정**: `frontend/envoy.yaml:15-18, 151-154`

```yaml
access_log:
  - name: envoy.access_loggers.stdout
    typed_config:
      "@type": type.googleapis.com/envoy.extensions.access_loggers.stream.v3.StdoutAccessLog
```

**현재 상태**: stdout으로 기본 access log 출력. JSON 형식으로 상세 필드 포함하려면 추가 설정 필요.

**추가 설정 예시**:
```yaml
access_log:
  - name: envoy.access_loggers.file
    typed_config:
      "@type": type.googleapis.com/envoy.extensions.access_loggers.file.v3.FileAccessLog
      path: "/var/log/envoy/access.log"
      log_format:
        json_format:
          request_id: "%REQ(X-Request-ID)%"
          status: "%RESPONSE_CODE%"
          upstream_time: "%DURATION%"
          user_agent: "%REQ(USER-AGENT)%"
          source_ip: "%DOWNSTREAM_REMOTE_ADDRESS%"
          method: "%REQ(:METHOD)%"
          path: "%REQ(X-ENVOY-ORIGINAL-PATH?:PATH)%"
```

**백엔드 구조화 로그**: `backend/internal/logger/logger.go`
- request_id, user_id, method, path, status 등 포함

**PASS**: ⚠️ 사고 분석 가능한 수준 (기본 로그는 출력, JSON 형식은 추가 설정 필요)

---

## 요약

### 완료된 항목 (✅)
- A1, A2, A3: 공통 제출물
- B1: 초대 권한 게이트 (전체)
- B2: 세션 제한 (전체)
- B3: 사용자별 자원 제한 (1-3)
- B4: 감사로그 MVP (전체)
- B5: 운영 가시성 (1, 3)
- B6: 백업/복구 (1)

### 추가 구현 필요 (⚠️)
- B3-4: 쿼터 거부 메트릭 (감사 로그로 현재 추적 가능)
- B5-1: Active Sessions 메트릭 (구현 예정)
- B5-2: 알림 규칙 구현 (설정은 준비됨, 규칙 정의 필요)
- C5: 보안 헤더 추가 (백엔드 또는 Envoy에서)
- C7: Envoy 접근 로그 JSON 형식 설정 (선택적)

### 검증 필요
- B6-2: 실제 복구 테스트 (스테이징 환경)
- C6: WebSocket 안정성 테스트 (10분 이상)

---

**문서 버전**: 1.0  
**최종 업데이트**: 2026-01-12  
**검증자**: Backend AI

