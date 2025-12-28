# 로그 품질 강화 가이드

> [← 개발](../02-development/getting-started.md) | [로깅 품질](./logging-quality.md)

## 개요

LIMEN 시스템의 모든 로그는 **통합 모니터링 서비스**가 읽고 해석하여 자동으로 행동할 수 있도록 설계되었습니다. 로그의 품질이 매우 중요하며, 모든 중요 이벤트는 구조화된 형식으로 기록됩니다.

> **로그 품질 원칙**:  
> - 모든 중요 이벤트 로깅
> - 구조화된 로그 (JSON, 파싱 가능)
> - 일관된 로그 형식
> - 충분한 컨텍스트 정보
> - 성능 메트릭 포함
> - 보안 이벤트 추적

---

## 로그 구조

### LogContext 구조

모든 로그는 `LogContext` 구조를 따릅니다:

```go
type LogContext struct {
    // Request context
    RequestID   string
    UserID      uint
    Username    string
    IP          string
    UserAgent   string
    Method      string
    Path        string
    StatusCode  int
    Duration    int64  // milliseconds

    // Business context
    VMID        uint
    VMName      string
    Action      string      // create, delete, start, stop, etc.
    Resource    string      // vm, user, snapshot, etc.
    ResourceID  uint

    // Security context
    SecurityEvent string
    ThreatLevel   string  // low, medium, high, critical

    // Performance context
    DBQueryTime  int64
    CacheHit     bool
    ResponseSize int64

    // Error context
    ErrorType    string
    ErrorCode    string
    ErrorMessage string

    // System context
    Component    string
    Service      string
    Version      string
    Environment  string
    Timestamp    time.Time
}
```

---

## 이벤트 타입

### 표준 이벤트 타입

모든 비즈니스 이벤트는 표준화된 이벤트 타입을 사용합니다:

#### VM 이벤트
- `vm.create` - VM 생성
- `vm.start` - VM 시작
- `vm.stop` - VM 중지
- `vm.delete` - VM 삭제
- `vm.update` - VM 업데이트
- `vm.snapshot` - 스냅샷 생성
- `vm.restore` - 스냅샷 복원
- `vm.resize` - VM 리사이즈

#### 사용자 이벤트
- `user.create` - 사용자 생성
- `user.update` - 사용자 업데이트
- `user.delete` - 사용자 삭제
- `user.login` - 로그인
- `user.logout` - 로그아웃
- `user.approve` - 사용자 승인
- `user.role_change` - 역할 변경

#### 보안 이벤트
- `security.login_failed` - 로그인 실패
- `security.rate_limit` - Rate limit 초과
- `security.ip_blocked` - IP 차단
- `security.unauthorized` - 권한 없음
- `security.password_change` - 비밀번호 변경

#### 시스템 이벤트
- `system.startup` - 시스템 시작
- `system.shutdown` - 시스템 종료
- `system.config_change` - 설정 변경
- `system.backup` - 백업 실행
- `system.restore` - 복원 실행

#### 성능 이벤트
- `performance.slow_query` - 느린 쿼리
- `performance.high_load` - 높은 부하
- `performance.cache_miss` - 캐시 미스

---

## 로깅 패턴

### 1. 비즈니스 이벤트 로깅

```go
import "github.com/DARC0625/LIMEN/backend/internal/logger"

// VM 생성 이벤트
logCtx := logger.LogContext{
    Timestamp: time.Now(),
    RequestID: r.Header.Get("X-Request-ID"),
    UserID:    userID,
    Username:  username,
    IP:        logger.GetClientIP(r),
    Method:    r.Method,
    Path:      r.URL.Path,
    Service:   "limen-backend",
    Component: "vm",
    Action:    "create",
    Resource:  "vm",
    ResourceID: vmID,
}

logger.LogVMEvent(
    logger.EventVMCreate,
    logCtx,
    vmID,
    vmName,
    "VM created successfully",
    zap.Int("cpu", cpu),
    zap.Int("memory", memory),
    zap.String("os_type", osType),
)
```

### 2. 보안 이벤트 로깅

```go
// 로그인 실패 이벤트
logCtx := logger.LogContext{
    Timestamp: time.Now(),
    RequestID: r.Header.Get("X-Request-ID"),
    UserID:    userID,
    Username:  username,
    IP:        logger.GetClientIP(r),
    Method:    r.Method,
    Path:      r.URL.Path,
    Service:   "limen-backend",
    Component: "auth",
}

logger.LogSecurityEvent(
    logger.EventSecurityLoginFailed,
    logCtx,
    "medium",  // threat_level
    "Login failed",
    zap.String("reason", "invalid_password"),
)
```

### 3. 성능 메트릭 로깅

```go
start := time.Now()
// ... 작업 수행 ...
duration := time.Since(start)

logCtx := logger.LogContext{
    Timestamp: time.Now(),
    Component: "database",
    Duration:  duration.Milliseconds(),
}

logger.LogPerformanceEvent(
    logger.EventPerformanceSlowQuery,
    logCtx,
    "database",
    duration.Milliseconds(),
    "Slow database query detected",
    zap.String("query", query),
    zap.Int64("duration_ms", duration.Milliseconds()),
)
```

### 4. 에러 로깅

```go
logCtx := logger.LogContext{
    Timestamp:    time.Now(),
    RequestID:    r.Header.Get("X-Request-ID"),
    UserID:       userID,
    IP:           logger.GetClientIP(r),
    Component:    "vm",
    ErrorType:    "database",
    ErrorCode:    "E001",
    ErrorMessage: "Failed to create VM",
}

logger.LogError(logCtx, "VM creation failed", err,
    zap.String("vm_name", vmName),
    zap.String("error_type", "database"),
)
```

---

## 로그 예시

### VM 생성 로그

```json
{
  "timestamp": "2024-12-23T12:00:00Z",
  "level": "info",
  "message": "VM created successfully",
  "event_type": "vm.create",
  "request_id": "20241223120000-abc12345",
  "user_id": 1,
  "username": "admin",
  "ip": "192.168.1.100",
  "method": "POST",
  "path": "/api/vms",
  "status_code": 201,
  "duration_ms": 1250,
  "vm_id": 5,
  "vm_name": "test-vm",
  "action": "create",
  "resource": "vm",
  "resource_id": 5,
  "component": "vm",
  "service": "limen-backend",
  "environment": "production",
  "cpu": 2,
  "memory": 4096,
  "os_type": "ubuntu"
}
```

### 보안 이벤트 로그

```json
{
  "timestamp": "2024-12-23T12:05:00Z",
  "level": "warn",
  "message": "Login failed",
  "event_type": "security.login_failed",
  "request_id": "20241223120500-def67890",
  "user_id": 2,
  "username": "user1",
  "ip": "192.168.1.200",
  "method": "POST",
  "path": "/api/auth/login",
  "status_code": 401,
  "duration_ms": 45,
  "security_event": "security.login_failed",
  "threat_level": "medium",
  "component": "auth",
  "service": "limen-backend",
  "reason": "invalid_password"
}
```

### 성능 메트릭 로그

```json
{
  "timestamp": "2024-12-23T12:10:00Z",
  "level": "warn",
  "message": "Slow database query detected",
  "event_type": "performance.slow_query",
  "request_id": "20241223121000-ghi11111",
  "component": "database",
  "duration_ms": 2500,
  "service": "limen-backend",
  "query": "SELECT * FROM vms WHERE owner_id = ?",
  "db_query_time_ms": 2500
}
```

---

## 로깅 체크리스트

### 모든 핸들러에서 확인할 사항

- [ ] **Request Context**: RequestID, UserID, Username, IP 포함
- [ ] **Business Context**: Action, Resource, ResourceID 포함
- [ ] **Timing**: Duration (milliseconds) 포함
- [ ] **Status Code**: HTTP 상태 코드 포함
- [ ] **Error Details**: ErrorType, ErrorCode, ErrorMessage 포함
- [ ] **Event Type**: 표준 이벤트 타입 사용
- [ ] **Additional Fields**: 관련된 모든 컨텍스트 정보 포함

### 보안 이벤트

- [ ] 모든 인증 실패 로깅
- [ ] 모든 권한 위반 로깅
- [ ] Rate limit 초과 로깅
- [ ] IP 차단 이벤트 로깅
- [ ] Threat level 설정

### 성능 메트릭

- [ ] 느린 쿼리 (>1초) 로깅
- [ ] 높은 부하 상황 로깅
- [ ] 캐시 히트/미스 로깅
- [ ] 응답 크기 로깅

---

## 통합 모니터링 서비스를 위한 로그 설계

### 자동화 가능한 로그 패턴

통합 모니터링 서비스는 다음 패턴을 인식하여 자동으로 행동할 수 있습니다:

1. **에러 집계**: `error_type`, `error_code`로 에러 분류 및 집계
2. **성능 모니터링**: `duration_ms`로 성능 추적 및 알림
3. **보안 감지**: `security_event`, `threat_level`로 보안 이벤트 감지
4. **리소스 추적**: `resource`, `resource_id`로 리소스 사용 추적
5. **사용자 행동 분석**: `user_id`, `action`으로 사용자 행동 분석

### 로그 파싱 예시

```python
# 통합 모니터링 서비스에서 로그 파싱 예시
import json

log_entry = json.loads(log_line)

# 보안 이벤트 감지
if log_entry.get("event_type", "").startswith("security."):
    threat_level = log_entry.get("threat_level", "low")
    if threat_level in ["high", "critical"]:
        send_alert(log_entry)

# 성능 이슈 감지
if log_entry.get("duration_ms", 0) > 1000:
    send_performance_alert(log_entry)

# 에러 집계
if log_entry.get("level") == "error":
    error_type = log_entry.get("error_type", "unknown")
    aggregate_error(error_type, log_entry)
```

---

## 관련 문서

- [로깅 가이드](../04-operations/logging/logging-guide.md)
- [보안 강화](../04-operations/security/hardening.md)
- [성능 최적화](../03-deployment/performance/optimization.md)

---

**태그**: `#로깅` `#로그-품질` `#구조화된-로깅` `#모니터링`

**마지막 업데이트**: 2024-12-23






