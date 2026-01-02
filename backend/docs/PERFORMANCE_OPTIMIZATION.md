# 성능 최적화 가이드

## 개요

LIMEN 백엔드는 효율성과 성능을 위해 지속적으로 최적화되고 있습니다. 이 문서는 현재 적용된 최적화 사항과 모범 사례를 설명합니다.

## 이벤트 기반 작업

### 원칙
주기적 작업(polling) 대신 이벤트 기반(트리거) 작업을 사용하여 불필요한 리소스 사용을 방지합니다.

### 구현된 이벤트 기반 작업

#### 1. 세션 정리
**이전**: 5분마다 주기적 정리
**현재**: 세션 생성/조회 시 만료된 세션 즉시 정리

```go
// 세션 생성 시
func (s *SessionStore) CreateSession(...) {
    s.cleanupExpiredSessionsNow() // 즉시 정리
    // ...
}

// 세션 조회 시
func (s *SessionStore) GetSessionByRefreshToken(...) {
    s.cleanupExpiredSessionsNow() // 즉시 정리
    // ...
}
```

**효과**: 불필요한 주기 작업 제거, 즉시 정리로 메모리 효율 향상

#### 2. Rate Limit 정리
**이전**: 10분마다 주기적 정리
**현재**: Rate limit 체크 시 만료된 항목만 정리

```go
func (i *IPRateLimiter) getLimiter(ip string) *rate.Limiter {
    i.cleanupExpiredNow() // 요청 시에만 정리
    // ...
}
```

**효과**: 요청 시에만 정리로 CPU 사용량 감소

#### 3. 하드웨어 모니터링
**이전**: 5분마다 주기적 체크
**현재**: 서버 시작 시 1회 체크

```go
// 서버 시작 시
if err := hardware.CheckHardwareChanges(); err != nil {
    logger.Log.Warn("Failed to check hardware changes", zap.Error(err))
}
```

**효과**: 하드웨어 변경은 드물므로 주기 체크 불필요

#### 4. 보안 체인 모니터링
**이전**: 10분마다 주기적 체크
**현재**: 서버 시작 시 1회 체크

```go
// 서버 시작 시
if _, err := security.CheckSecurityChain(ctx); err != nil {
    logger.Log.Warn("Failed to check security chain", zap.Error(err))
}
```

**효과**: 보안 설정 변경은 드물므로 주기 체크 불필요

## 데이터베이스 최적화

### 연결 풀 설정
```go
sqlDB.SetMaxIdleConns(25)                  // 유휴 연결 수
sqlDB.SetMaxOpenConns(100)                 // 최대 열린 연결 수
sqlDB.SetConnMaxLifetime(30 * time.Minute) // 연결 최대 수명
sqlDB.SetConnMaxIdleTime(5 * time.Minute)  // 유휴 연결 최대 시간
```

**최적화 포인트**:
- `MaxIdleConns`: 10 → 25 (연결 재사용 향상)
- `ConnMaxLifetime`: 1시간 → 30분 (오래된 연결 방지)
- `ConnMaxIdleTime`: 10분 → 5분 (빠른 정리)

### 쿼리 최적화

#### Select로 필요한 필드만 가져오기
```go
// ❌ 비효율적
h.DB.Find(&vms)

// ✅ 최적화
h.DB.Select("id", "uuid", "name", "status", "cpu", "memory", "owner_id", "created_at", "updated_at").Find(&vms)
```

#### N+1 쿼리 문제 해결
```go
// ❌ 비효율적 (N+1 쿼리)
for _, vm := range vms {
    h.DB.Where("owner_id = ?", vm.OwnerID).First(&user)
}

// ✅ 최적화 (단일 쿼리)
h.DB.Select("owner_id, cpu, memory").Find(&allVMs)
```

### 병렬 처리
```go
// VM 상태 동기화 병렬 처리
const maxConcurrency = 5
sem := make(chan struct{}, maxConcurrency)
var wg sync.WaitGroup

for i := range vms {
    wg.Add(1)
    go func(idx int) {
        defer wg.Done()
        sem <- struct{}{} // Acquire semaphore
        defer func() { <-sem }() // Release semaphore
        
        h.VMService.SyncVMStatus(&vms[idx])
    }(i)
}
wg.Wait()
```

## 로깅 최적화

### 로그 레벨 조정
불필요한 로그를 Debug 레벨로 변경하여 로그 볼륨 감소:

- **인증 미들웨어**: 상세 로그 → Debug 레벨
- **CORS preflight**: 성공 로그 → Debug 레벨
- **Health check**: 로그 → Debug 레벨
- **쿠키 설정**: 로그 → Debug 레벨

### 로그 레벨별 사용
- **Error**: 서버 오류 (500+)
- **Warn**: 클라이언트 오류 (400-499), 보안 이슈
- **Info**: 일반적인 요청 로그, 중요한 이벤트
- **Debug**: 상세 디버깅 정보, 성공적인 작업

## 메모리 최적화

### 버퍼 풀 사용
```go
// VNC 연결용 버퍼 풀
var vncBufferPool = sync.Pool{
    New: func() interface{} {
        return make([]byte, 32768) // 32KB
    },
}

// 사용
buf := vncBufferPool.Get().([]byte)
defer vncBufferPool.Put(buf)
```

### 리소스 누수 방지
```go
// Context 타임아웃 및 defer cancel
ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
defer cancel() // 항상 취소

// 연결 종료
defer conn.Close()
defer dom.Free()
```

## 성능 모니터링

### 메트릭 수집
- HTTP 요청 수 및 응답 시간
- 데이터베이스 쿼리 시간
- VM 작업 시간

### 로그 분석
```bash
# 성능 관련 로그 확인
tail -f /tmp/limen-server.log | grep -E "(duration|performance|slow)"

# HTTP 요청 통계
tail -f /tmp/limen-server.log | grep "HTTP request" | awk '{print $NF}'
```

## 모범 사례

### 1. 이벤트 기반 작업 사용
✅ **좋은 예**: 이벤트 발생 시에만 작업 수행
```go
func (s *SessionStore) CreateSession(...) {
    s.cleanupExpiredSessionsNow() // 이벤트 기반
}
```

❌ **나쁜 예**: 주기적 작업
```go
ticker := time.NewTicker(5 * time.Minute)
for range ticker.C {
    cleanup() // 주기적 작업
}
```

### 2. 필요한 필드만 선택
✅ **좋은 예**: Select로 필요한 필드만
```go
h.DB.Select("id", "name", "status").Find(&vms)
```

❌ **나쁜 예**: 모든 필드 가져오기
```go
h.DB.Find(&vms) // 모든 필드
```

### 3. 적절한 로그 레벨 사용
✅ **좋은 예**: 중요 정보만 Info
```go
logger.Log.Info("User logged in", zap.String("username", username))
logger.Log.Debug("Cookie set", zap.String("name", cookie.Name)) // Debug
```

❌ **나쁜 예**: 모든 것을 Info
```go
logger.Log.Info("Cookie set", zap.String("name", cookie.Name)) // 너무 상세
```

### 4. 리소스 정리
✅ **좋은 예**: defer로 확실한 정리
```go
ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
defer cancel() // 항상 취소
```

❌ **나쁜 예**: 정리 누락
```go
ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
// cancel() 호출 누락 - 리소스 누수!
```

## 성능 벤치마크

### 현재 성능 지표
- HTTP 요청 처리: 평균 < 100ms
- 데이터베이스 쿼리: 평균 < 50ms
- VM 상태 동기화: 병렬 처리로 5배 향상

### 벤치마크 실행
```bash
cd backend
go test -bench=. -benchmem ./internal/handlers/...
```

## 향후 최적화 계획

1. **캐싱 전략**: 자주 조회되는 데이터 캐싱
2. **연결 풀 튜닝**: 실제 부하에 맞춰 조정
3. **메모리 프로파일링**: 메모리 사용 패턴 분석
4. **추가 벤치마크**: 성능 회귀 방지


