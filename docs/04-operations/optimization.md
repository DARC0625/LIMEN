# LIMEN 서비스 최적화 가이드

## 개요

LIMEN 백엔드와 에이전트 서비스의 성능, 메모리, 빌드 크기 최적화에 대한 가이드입니다.

## 빌드 최적화

### 백엔드 (Go)

#### 최적화된 빌드 명령어
```bash
go build -ldflags="-s -w" -trimpath -o server ./cmd/server
```

**옵션 설명**:
- `-ldflags="-s -w"`: 디버그 심볼 제거 (`-s`), DWARF 정보 제거 (`-w`)
- `-trimpath`: 빌드 경로 정보 제거

**결과**: 바이너리 크기 약 25% 감소 (38M → 29M)

#### Makefile 사용
```bash
make build          # 백엔드 빌드
make build-agent    # 에이전트 빌드
make build-all      # 모두 빌드
make full-optimize  # 전체 최적화
```

### 에이전트 (Rust)

#### Cargo.toml 최적화 설정
```toml
[profile.release]
opt-level = 3          # 최대 최적화
lto = "thin"          # Thin Link-Time Optimization
codegen-units = 1     # 더 나은 최적화
strip = true          # 심볼 제거로 바이너리 크기 감소
panic = "abort"       # 더 작은 바이너리 크기
```

#### 빌드 명령어
```bash
cd agent
cargo build --release
```

**결과**: 바이너리 크기 1.2M (최적화됨)

## 메모리 최적화

### Rate Limiter 메모리 누수 방지

Rate limiter가 오래된 IP 엔트리를 자동으로 정리하도록 개선:

```go
// 5분마다 10분 이상 접근하지 않은 IP 엔트리 제거
func (l *IPRateLimiter) cleanup() {
    go func() {
        ticker := time.NewTicker(5 * time.Minute)
        defer ticker.Stop()
        for range ticker.C {
            l.mu.Lock()
            cutoff := time.Now().Add(-10 * time.Minute)
            for ip, limiter := range l.limiters {
                if limiter.lastAccess.Before(cutoff) {
                    delete(l.limiters, ip)
                }
            }
            l.mu.Unlock()
        }
    }()
}
```

### 에이전트 시스템 리프레시 최적화

필요한 컴포넌트만 리프레시하여 CPU 사용량 감소:

```rust
// 전체 리프레시 대신 필요한 것만
sys.refresh_cpu();
sys.refresh_memory();
// sys.refresh_all() 대신
```

## 디스크 공간 최적화

### 불필요한 파일 제거

#### Debug 빌드 아티팩트
```bash
rm -rf agent/target/debug
```

#### Rust 빌드 캐시 정리
```bash
cd agent
cargo clean
```

**결과**: 약 294MB 공간 확보

#### Go 바이너리
```bash
rm -f server  # 재빌드 전에 제거
```

### .gitignore 최적화

다음 파일들이 Git에 포함되지 않도록 설정:
- 빌드 아티팩트 (`server`, `agent/target/`)
- 로그 파일 (`*.log`)
- 임시 파일 (`*.tmp`, `*.bak`)
- VM 디스크 이미지 (`*.qcow2`)
- ISO 파일 (`*.iso`)

## 성능 최적화

### 1. Go 모듈 의존성 정리
```bash
go mod tidy
go mod verify
```

### 2. Rust 의존성 업데이트
```bash
cd agent
cargo update
```

### 3. 로그 로테이션

큰 로그 파일은 자동으로 로테이션되도록 설정:
- `lumberjack` 라이브러리 사용 (이미 설정됨)
- 최대 파일 크기: 100MB
- 보관 기간: 7일

## 코드 최적화

### 1. 불필요한 import 제거
```bash
go vet ./...
```

### 2. 사용하지 않는 코드 제거
- Debug 코드 제거
- 주석 처리된 코드 제거
- TODO/FIXME 주석 정리

### 3. 에러 처리 최적화
- 불필요한 에러 래핑 제거
- 에러 메시지 간소화

## 모니터링

### 빌드 크기 모니터링
```bash
ls -lh server agent/target/release/agent
```

### 디스크 사용량 모니터링
```bash
du -sh backend/*
```

### 메모리 사용량 모니터링
```bash
ps aux | grep -E "server|agent"
```

## 최적화 체크리스트

- [x] Go 빌드 최적화 (`-ldflags="-s -w" -trimpath`)
- [x] Rust 빌드 최적화 (release profile)
- [x] Debug 빌드 아티팩트 제거
- [x] Rate limiter 메모리 누수 방지
- [x] 에이전트 시스템 리프레시 최적화
- [x] .gitignore 최적화
- [x] Makefile 추가
- [x] 의존성 정리

## 최적화 결과

### 빌드 크기
- **백엔드**: 38M → 29M (약 24% 감소)
- **에이전트**: 1.2M (최적화됨)

### 디스크 공간
- **Debug 빌드 제거**: 약 294MB 확보
- **빌드 캐시 정리**: 추가 공간 확보

### 메모리
- **Rate limiter**: 자동 정리로 메모리 누수 방지
- **에이전트**: 필요한 컴포넌트만 리프레시

## 유지보수

### 정기적인 최적화
```bash
# 주간 정리
make clean
make optimize
make build-all
```

### 모니터링
- 빌드 크기 추적
- 메모리 사용량 모니터링
- 디스크 공간 확인

## 관련 문서

- [빌드 가이드](../02-development/getting-started.md)
- [배포 가이드](../03-deployment/docker/quick-start.md)



