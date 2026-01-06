# LIMEN 서비스 상세 최적화 계획

**작성일**: 2025-01-14  
**버전**: 1.0  
**상태**: 실행 계획

---

## 📋 목차

1. [프론트엔드 최적화](#프론트엔드-최적화)
2. [백엔드 최적화](#백엔드-최적화)
3. [데이터베이스 최적화](#데이터베이스-최적화)
4. [네트워크 최적화](#네트워크-최적화)
5. [인프라 최적화](#인프라-최적화)
6. [모니터링 최적화](#모니터링-최적화)

---

## 프론트엔드 최적화

### 1. 번들 크기 최적화

#### 현재 상태
- **총 번들 크기**: ~9.7MB
- **목표**: < 500KB (gzipped)
- **최대 의존성**: noVNC (~2-3MB 예상)

#### 실행 계획

##### 1.1 번들 분석
```bash
# 번들 분석 실행
cd frontend
npm run build:analyze

# 결과 분석
# - 각 청크 크기 확인
# - 중복 의존성 식별
# - 사용하지 않는 코드 식별
```

**예상 결과**:
- noVNC: ~2-3MB
- React/Next.js: ~500KB
- TanStack Query: ~100KB
- 기타: ~6MB

##### 1.2 noVNC 최적화
**문제**: noVNC가 가장 큰 번들

**해결 방안**:
1. **동적 로딩 강화**
```typescript
// components/VNCViewer.tsx
// 현재: 이미 동적 import 사용 중
// 개선: 더 세밀한 코드 스플리팅

// Before
import RFB from '@novnc/novnc/core/rfb';

// After
const RFB = dynamic(() => import('@novnc/novnc/core/rfb'), {
  ssr: false,
  loading: () => <VNCViewerSkeleton />,
});
```

2. **noVNC 커스텀 빌드**
```bash
# 필요한 모듈만 포함하는 커스텀 빌드
# - RFB 클라이언트만 포함
# - 불필요한 UI 컴포넌트 제외
```

3. **대안 검토**
- 경량 VNC 클라이언트 라이브러리 조사
- WebSocket 기반 직접 구현 검토

##### 1.3 Tree-shaking 최적화
```typescript
// next.config.js
module.exports = {
  // Tree-shaking 최적화
  webpack: (config) => {
    config.optimization = {
      ...config.optimization,
      usedExports: true,
      sideEffects: false,
    };
    return config;
  },
};
```

##### 1.4 코드 스플리팅 강화
```typescript
// app/page.tsx
// 라우트 기반 스플리팅
const VMCard = dynamic(() => import('@/components/VMCard'), {
  loading: () => <CardSkeleton />,
});

// 컴포넌트 기반 스플리팅
const VNCViewer = dynamic(() => import('@/components/VNCViewer'), {
  ssr: false,
  loading: () => <VNCViewerSkeleton />,
});
```

**예상 효과**:
- 초기 번들: 9.7MB → 500KB (gzipped)
- 초기 로딩 시간: 60-70% 감소

### 2. 이미지 및 에셋 최적화

#### 현재 상태
- SVG 아이콘: icon-192.svg, icon-512.svg
- 최적화 미적용

#### 실행 계획

##### 2.1 SVG 최적화
```bash
# SVGO로 SVG 압축
npm install -g svgo
svgo icon-192.svg icon-512.svg

# 예상 효과: 30-50% 크기 감소
```

##### 2.2 Next.js Image 컴포넌트 적용
```typescript
// Before
<img src="/icon-192.svg" alt="Icon" />

// After
import Image from 'next/image';

<Image
  src="/icon-192.svg"
  alt="Icon"
  width={192}
  height={192}
  loading="lazy"
  priority={false}
/>
```

##### 2.3 WebP 형식 전환
```bash
# 이미지를 WebP로 변환
# - PNG/JPG → WebP
# - 폴백 제공 (Next.js 자동 처리)
```

**예상 효과**:
- 이미지 크기: 30-50% 감소
- 로딩 시간: 20-30% 개선

### 3. CSS 최적화

#### 실행 계획

##### 3.1 Tailwind CSS Purge
```javascript
// tailwind.config.js
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  // 사용하지 않는 CSS 자동 제거
};
```

##### 3.2 Critical CSS 인라인화
```typescript
// next.config.js
module.exports = {
  experimental: {
    optimizeCss: true,
  },
};
```

**예상 효과**:
- CSS 번들 크기: 30-40% 감소
- FCP: 10-15% 개선

### 4. React 성능 최적화

#### 실행 계획

##### 4.1 React.memo 적용
```typescript
// components/VMCard.tsx
export const VMCard = React.memo(({ vm }: { vm: VM }) => {
  // 컴포넌트 로직
}, (prevProps, nextProps) => {
  // 커스텀 비교 함수
  return prevProps.vm.id === nextProps.vm.id &&
         prevProps.vm.status === nextProps.vm.status;
});
```

##### 4.2 useMemo/useCallback 최적화
```typescript
// hooks/useVMs.ts
const filteredVMs = useMemo(() => {
  return vms.filter(vm => vm.status === 'running');
}, [vms]);

const handleVMStart = useCallback((vmId: string) => {
  // 핸들러 로직
}, []);
```

##### 4.3 불필요한 리렌더링 제거
```typescript
// Context 최적화
const VMContext = createContext<VMContextValue | null>(null);

// Provider에서 메모이제이션
const value = useMemo(() => ({
  vms,
  isLoading,
  error,
}), [vms, isLoading, error]);
```

**예상 효과**:
- 리렌더링 횟수: 30-50% 감소
- UI 반응성: 20-30% 개선

---

## 백엔드 최적화

### 1. 데이터베이스 쿼리 최적화

#### 현재 상태
- N+1 쿼리 문제 존재
- 인덱스 부족 가능성
- Connection pool 설정 미최적화

#### 실행 계획

##### 1.1 N+1 쿼리 해결
```go
// internal/handlers/api.go
// Before
vms := []models.VM{}
db.Find(&vms)
for _, vm := range vms {
    db.Model(&vm).Association("User").Find(&vm.User) // N+1
}

// After
vms := []models.VM{}
db.Preload("User").Find(&vms) // Single query with join
```

**영향받는 핸들러**:
- `GET /api/vms` - VM 목록 조회
- `GET /api/users/:id` - 사용자 정보 조회
- `GET /api/vms/:id` - VM 상세 조회

##### 1.2 인덱스 추가
```sql
-- 자주 조회되는 컬럼에 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_vms_user_id ON vms(user_id);
CREATE INDEX IF NOT EXISTS idx_vms_status ON vms(status);
CREATE INDEX IF NOT EXISTS idx_vms_created_at ON vms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vms_uuid ON vms(uuid);

-- 복합 인덱스 (자주 함께 조회되는 컬럼)
CREATE INDEX IF NOT EXISTS idx_vms_user_status ON vms(user_id, status);
```

**인덱스 전략**:
- 고유 인덱스: `uuid`, `id`
- 조회 인덱스: `user_id`, `status`, `created_at`
- 복합 인덱스: `(user_id, status)`

##### 1.3 Connection Pool 최적화
```go
// internal/database/db.go
func InitDB() (*gorm.DB, error) {
    // ... 기존 코드 ...
    
    sqlDB, err := db.DB()
    if err != nil {
        return nil, err
    }
    
    // Connection pool 최적화
    sqlDB.SetMaxOpenConns(25)        // 최대 연결 수
    sqlDB.SetMaxIdleConns(5)         // 유휴 연결 수
    sqlDB.SetConnMaxLifetime(5 * time.Minute) // 연결 수명
    sqlDB.SetConnMaxIdleTime(1 * time.Minute) // 유휴 시간
    
    return db, nil
}
```

**최적화 기준**:
- `MaxOpenConns`: CPU 코어 수 * 2 + 1
- `MaxIdleConns`: MaxOpenConns의 20%
- `ConnMaxLifetime`: 5분 (데이터베이스 타임아웃보다 짧게)

##### 1.4 쿼리 성능 분석
```go
// 쿼리 로깅 활성화 (개발 환경)
db = db.Debug()

// 느린 쿼리 로깅
db.Callback().Query().Register("slow_query", func(db *gorm.DB) {
    if db.Statement.SQL.String() != "" {
        duration := time.Since(db.Statement.StartTime)
        if duration > 100*time.Millisecond {
            logger.Log.Warn("Slow query detected",
                zap.String("sql", db.Statement.SQL.String()),
                zap.Duration("duration", duration),
            )
        }
    }
})
```

**예상 효과**:
- API 응답 시간: 30-50% 개선
- 데이터베이스 부하: 20-30% 감소

### 2. 메모리 최적화

#### 실행 계획

##### 2.1 버퍼 풀 구현
```go
// internal/handlers/api.go
// 현재 주석: // Optimized: Use buffer pool to reduce memory allocations

var bufferPool = sync.Pool{
    New: func() interface{} {
        return make([]byte, 0, 1024)
    },
}

func someHandler(w http.ResponseWriter, r *http.Request) {
    buf := bufferPool.Get().([]byte)
    defer bufferPool.Put(buf[:0])
    
    // 버퍼 사용
}
```

##### 2.2 맵 사전 할당
```go
// internal/handlers/metrics.go
// 현재 주석: // Optimized: Pre-allocate maps with estimated capacity

// Before
stats := make(map[string]int)

// After
stats := make(map[string]int, estimatedSize)
```

##### 2.3 슬라이스 사전 할당
```go
// Before
var results []VM

// After
results := make([]VM, 0, estimatedSize)
```

**예상 효과**:
- 메모리 사용량: 20-30% 감소
- GC 압박: 15-25% 감소

### 3. libvirt 작업 최적화

#### 실행 계획

##### 3.1 Context Timeout 통일
```go
// internal/vm/service.go
// 현재 주석: // Optimized: Use context with timeout instead of fixed sleep

// Before
time.Sleep(2 * time.Second)

// After
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

// 작업 수행
if err := doWork(ctx); err != nil {
    if errors.Is(err, context.DeadlineExceeded) {
        return ErrTimeout
    }
    return err
}
```

##### 3.2 병렬 처리 최적화
```go
// internal/vm/sync.go
// 현재 주석: // Optimized: Use parallel processing with limited concurrency

const maxConcurrency = 10

func syncVMs(vms []VM) error {
    sem := make(chan struct{}, maxConcurrency)
    var wg sync.WaitGroup
    errCh := make(chan error, len(vms))
    
    for _, vm := range vms {
        wg.Add(1)
        go func(v VM) {
            defer wg.Done()
            sem <- struct{}{} // Acquire
            defer func() { <-sem }() // Release
            
            if err := syncVM(v); err != nil {
                errCh <- err
            }
        }(vm)
    }
    
    wg.Wait()
    close(errCh)
    
    // 에러 처리
    return collectErrors(errCh)
}
```

##### 3.3 libvirt 연결 풀링
```go
// libvirt 연결 재사용
type LibvirtPool struct {
    conn *libvirt.Connect
    mu   sync.RWMutex
}

func (p *LibvirtPool) GetConnection() (*libvirt.Connect, error) {
    p.mu.RLock()
    if p.conn != nil {
        p.mu.RUnlock()
        return p.conn, nil
    }
    p.mu.RUnlock()
    
    p.mu.Lock()
    defer p.mu.Unlock()
    
    // 이중 체크
    if p.conn != nil {
        return p.conn, nil
    }
    
    conn, err := libvirt.NewConnect("qemu:///system")
    if err != nil {
        return nil, err
    }
    
    p.conn = conn
    return conn, nil
}
```

**예상 효과**:
- VM 작업 응답 시간: 20-30% 개선
- 동시 작업 처리 능력: 2-3배 향상

### 4. WebSocket 최적화

#### 실행 계획

##### 4.1 연결 풀 최적화
```go
// internal/handlers/websocket.go
// 현재: 연결 관리 개선 필요

type ConnectionPool struct {
    connections map[string]*websocket.Conn
    mu          sync.RWMutex
    broadcast   chan []byte
}

func (p *ConnectionPool) Add(id string, conn *websocket.Conn) {
    p.mu.Lock()
    defer p.mu.Unlock()
    p.connections[id] = conn
}

func (p *ConnectionPool) Remove(id string) {
    p.mu.Lock()
    defer p.mu.Unlock()
    delete(p.connections, id)
}

func (p *ConnectionPool) Broadcast(message []byte) {
    p.mu.RLock()
    defer p.mu.RUnlock()
    
    for id, conn := range p.connections {
        if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
            // 연결 실패 시 제거
            go p.Remove(id)
        }
    }
}
```

##### 4.2 메시지 Throttling
```go
// 과도한 메시지 전송 방지
type ThrottledBroadcaster struct {
    pool      *ConnectionPool
    throttle  time.Duration
    lastSend  time.Time
    mu        sync.Mutex
}

func (tb *ThrottledBroadcaster) Broadcast(message []byte) {
    tb.mu.Lock()
    defer tb.mu.Unlock()
    
    now := time.Now()
    if now.Sub(tb.lastSend) < tb.throttle {
        return // 스킵
    }
    
    tb.lastSend = now
    tb.pool.Broadcast(message)
}
```

**예상 효과**:
- WebSocket 메모리 사용량: 15-25% 감소
- 네트워크 부하: 20-30% 감소

---

## 데이터베이스 최적화

### 1. 스키마 최적화

#### 실행 계획

##### 1.1 테이블 파티셔닝 (필요 시)
```sql
-- 대용량 테이블 파티셔닝 검토
-- 예: 로그 테이블을 날짜별로 파티셔닝
CREATE TABLE vm_logs (
    id SERIAL,
    vm_id UUID,
    log_date DATE,
    message TEXT
) PARTITION BY RANGE (log_date);
```

##### 1.2 데이터 타입 최적화
```sql
-- 불필요한 큰 타입 사용 최소화
-- 예: TEXT 대신 VARCHAR(n) 사용 (가능한 경우)
ALTER TABLE vms ALTER COLUMN description TYPE VARCHAR(500);
```

##### 1.3 NULL 값 최적화
```sql
-- NULL이 아닌 기본값 설정
ALTER TABLE vms ALTER COLUMN status SET DEFAULT 'stopped';
```

### 2. 쿼리 최적화

#### 실행 계획

##### 2.1 EXPLAIN ANALYZE 실행
```sql
-- 모든 주요 쿼리에 EXPLAIN ANALYZE 실행
EXPLAIN ANALYZE
SELECT * FROM vms WHERE user_id = $1 AND status = $2;
```

##### 2.2 느린 쿼리 로깅
```sql
-- PostgreSQL 설정
-- postgresql.conf
log_min_duration_statement = 100  -- 100ms 이상 쿼리 로깅
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

##### 2.3 쿼리 힌트 (필요 시)
```go
// GORM에서 힌트 사용
db.Clauses(hints.Comment("/*+ USE_INDEX(vms, idx_vms_user_status) */")).
    Find(&vms)
```

### 3. 백업 및 복구 최적화

#### 실행 계획

##### 3.1 자동 백업 설정
```bash
# cron 작업으로 자동 백업
0 2 * * * pg_dump -U postgres LIMEN > /backup/limen_$(date +\%Y\%m\%d).sql
```

##### 3.2 WAL 아카이빙
```sql
-- postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /archive/%f'
```

---

## 네트워크 최적화

### 1. HTTP/2 및 HTTP/3

#### 실행 계획

##### 1.1 HTTP/2 활성화
```go
// Go 서버에서 HTTP/2 지원
import "golang.org/x/net/http2"

server := &http.Server{
    Addr:    ":18443",
    Handler: router,
}

http2.ConfigureServer(server, &http2.Server{})
```

##### 1.2 HTTP/3 검토 (선택사항)
- QUIC 프로토콜 지원 검토
- 네트워크 환경에 따른 성능 향상 가능

### 2. 압축 최적화

#### 실행 계획

##### 2.1 Gzip 압축
```go
// 미들웨어에서 Gzip 압축
import "github.com/klauspost/compress/gzip"

func GzipMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
            next.ServeHTTP(w, r)
            return
        }
        
        gz := gzip.NewWriter(w)
        defer gz.Close()
        
        w.Header().Set("Content-Encoding", "gzip")
        next.ServeHTTP(&gzipResponseWriter{Writer: gz, ResponseWriter: w}, r)
    })
}
```

##### 2.2 Brotli 압축 (선택사항)
- Gzip보다 더 나은 압축률
- 클라이언트 지원 확인 필요

### 3. CDN 통합 (선택사항)

#### 실행 계획

##### 3.1 정적 에셋 CDN
- 이미지, CSS, JS 파일을 CDN에 배포
- 지리적 분산으로 로딩 시간 개선

##### 3.2 API CDN (선택사항)
- API 응답 캐싱 (적용 가능한 경우)
- Edge 컴퓨팅 활용

---

## 인프라 최적화

### 1. Docker 최적화

#### 실행 계획

##### 1.1 멀티 스테이지 빌드
```dockerfile
# Backend Dockerfile
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/server .
EXPOSE 18443
CMD ["./server"]
```

##### 1.2 이미지 크기 최적화
- Alpine Linux 사용
- 불필요한 패키지 제거
- 레이어 캐싱 최적화

**예상 효과**:
- 이미지 크기: 50-70% 감소
- 빌드 시간: 20-30% 개선

### 2. 리소스 제한

#### 실행 계획

##### 2.1 컨테이너 리소스 제한
```yaml
# docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

##### 2.2 시스템 리소스 모니터링
- CPU, 메모리, 디스크 사용량 모니터링
- 임계값 설정 및 알림

### 3. 로그 관리

#### 실행 계획

##### 3.1 로그 로테이션
```yaml
# docker-compose.yml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

##### 3.2 로그 집계
- ELK Stack 또는 Loki 통합
- 중앙화된 로그 관리

---

## 모니터링 최적화

### 1. 메트릭 수집

#### 실행 계획

##### 1.1 Prometheus 메트릭 확장
```go
// 커스텀 메트릭 추가
var (
    vmOperationsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "vm_operations_total",
            Help: "Total number of VM operations",
        },
        []string{"operation", "status"},
    )
    
    apiRequestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "api_request_duration_seconds",
            Help: "API request duration",
        },
        []string{"method", "endpoint", "status"},
    )
)
```

##### 1.2 비즈니스 메트릭
- VM 생성 수
- VM 실행 시간
- 사용자 활동
- 리소스 사용률

### 2. 알림 설정

#### 실행 계획

##### 2.1 알림 규칙
```yaml
# prometheus/alerts.yml
groups:
  - name: limen_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
        for: 5m
        annotations:
          summary: "High error rate detected"
      
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, api_request_duration_seconds_bucket) > 1
        for: 5m
        annotations:
          summary: "High API response time"
```

##### 2.2 알림 채널
- 이메일
- Slack
- PagerDuty (선택사항)

### 3. 대시보드 구축

#### 실행 계획

##### 3.1 Grafana 대시보드
- 시스템 메트릭
- 애플리케이션 메트릭
- 비즈니스 메트릭
- 사용자 정의 대시보드

---

## 실행 일정

### Week 1-2: 프론트엔드 최적화
- [ ] 번들 분석 및 최적화
- [ ] 이미지 최적화
- [ ] CSS 최적화

### Week 3-4: 백엔드 최적화
- [ ] 데이터베이스 쿼리 최적화
- [ ] 메모리 최적화
- [ ] libvirt 작업 최적화

### Week 5-6: 인프라 및 모니터링
- [ ] Docker 최적화
- [ ] 모니터링 강화
- [ ] 알림 설정

---

## 성공 지표

### 성능 지표
- **API 응답 시간**: < 200ms (평균)
- **데이터베이스 쿼리 시간**: < 100ms (평균)
- **메모리 사용량**: 20-30% 감소
- **CPU 사용률**: 15-25% 감소

### 사용자 경험 지표
- **초기 로딩 시간**: 60-70% 감소
- **번들 크기**: < 500KB (gzipped)
- **에러율**: < 0.1%

---

**작성자**: AI Assistant  
**검토 필요**: 개발팀 리뷰  
**업데이트 주기**: 주 1회 또는 주요 최적화 완료 시




