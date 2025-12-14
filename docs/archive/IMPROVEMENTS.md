# LIMEN - 개선 필요 사항

코드베이스 분석 결과, 다음과 같은 개선이 필요합니다.

## 🔴 긴급 (보안 및 안정성)

### 1. 보안 취약점
- **하드코딩된 데이터베이스 연결 정보** (`backend/internal/database/db.go:14`)
  ```go
  dsn := "host=localhost user=postgres password=password dbname=project_alpha..."
  ```
  - ✅ **해결**: 환경 변수 사용 (`config` 패키지 활용)

- **하드코딩된 경로** (`backend/internal/vm/service.go:22-23`)
  ```go
  isoDir = "/home/darc0/projects/LIMEN/database/iso"
  vmDir  = "/home/darc0/projects/LIMEN/database/vms"
  ```
  - ✅ **해결**: 환경 변수 또는 설정 파일로 관리

- **기본 admin 계정 하드코딩** (`backend/cmd/server/main.go:59`)
  ```go
  Password: "password"
  ```
  - ✅ **해결**: 초기 설정 시 강제 비밀번호 변경 또는 환경 변수

- **CORS 모든 Origin 허용** (`backend/internal/handlers/api.go:30`)
  ```go
  w.Header().Set("Access-Control-Allow-Origin", "*")
  ```
  - ✅ **해결**: 환경 변수로 허용 Origin 목록 관리

- **WebSocket Origin 체크 없음** (`backend/internal/handlers/api.go:200`)
  ```go
  CheckOrigin: func(r *http.Request) bool { return true }
  ```
  - ✅ **해결**: Origin 검증 로직 추가

### 2. 에러 핸들링 개선
- **일관성 없는 에러 처리**
  - 일부는 `log.Printf`, 일부는 `http.Error`, 일부는 `fmt.Errorf`
  - ✅ **해결**: 구조화된 에러 응답 및 로깅 시스템 도입

- **에러 메시지에 내부 정보 노출**
  ```go
  http.Error(w, fmt.Sprintf("Failed to create VM: %v", err), ...)
  ```
  - ✅ **해결**: 사용자 친화적 메시지 + 내부 로깅 분리

### 3. 로깅 시스템
- **표준 라이브러리 `log`만 사용**
  - 구조화된 로깅 없음
  - 로그 레벨 관리 없음
  - ✅ **해결**: `zap` 또는 `logrus` 도입

## 🟡 중요 (코드 품질 및 유지보수성)

### 4. 설정 관리
- **`config` 패키지 미사용**
  - `database/db.go`에서 직접 하드코딩
  - `vm/service.go`에서 직접 하드코딩
  - ✅ **해결**: 모든 설정을 `config` 패키지로 통합

### 5. 라우팅 구조
- **`main.go`에 라우팅 하드코딩**
  ```go
  http.HandleFunc("/api/health", ...)
  http.HandleFunc("/api/vms", ...)
  ```
  - ✅ **해결**: 라우터 패키지 분리 (gorilla/mux 또는 chi)

### 6. 미들웨어 부족
- **로깅 미들웨어 없음**
- **인증 미들웨어 없음**
- **요청 ID 추적 없음**
- **Rate limiting 없음**
- ✅ **해결**: 미들웨어 체인 구축

### 7. 테스트 코드
- **단위 테스트 없음** (0개)
- **통합 테스트 없음**
- ✅ **해결**: 핵심 기능에 대한 테스트 작성

### 8. API 문서화
- **Swagger/OpenAPI 없음**
- **엔드포인트 문서 없음**
- ✅ **해결**: Swagger/OpenAPI 스펙 작성

## 🟢 권장 (기능 확장)

### 9. 인증/인가 시스템
- **현재 인증 없음**
- **모든 요청이 공개**
- ✅ **해결**: JWT 기반 인증 + RBAC

### 10. 입력 검증
- **VM 생성 시 검증 부족**
  - CPU/Memory 범위 체크 없음
  - 이름 중복 체크 (DB 레벨만)
  - ✅ **해결**: 입력 검증 미들웨어 (validator)

### 11. 트랜잭션 관리
- **VM 생성 시 DB와 libvirt 동기화 문제 가능**
  - VM 생성 실패 시 DB 롤백 없음
  - ✅ **해결**: 트랜잭션 또는 보상 트랜잭션 패턴

### 12. 리소스 제한
- **VM 리소스 제한 없음**
  - 무제한 CPU/Memory 할당 가능
  - ✅ **해결**: 리소스 할당량 관리

### 13. 모니터링 및 메트릭
- **메트릭 수집 없음**
- **헬스체크 기본적**
- ✅ **해결**: Prometheus 메트릭 + Grafana 대시보드

### 14. 백업 및 복구
- **VM 스냅샷 기능 없음**
- **데이터베이스 백업 자동화 없음**
- ✅ **해결**: 스냅샷 기능 + 백업 스케줄러

### 15. 코드 중복
- **에러 처리 패턴 반복**
- **VM 조회 로직 반복**
- ✅ **해결**: 헬퍼 함수 및 유틸리티 패키지

### 16. 타입 안정성
- **문자열 기반 상태 관리**
  ```go
  Status: "Running"  // 오타 가능
  ```
  - ✅ **해결**: 상수 또는 열거형 사용

### 17. 컨텍스트 관리
- **HTTP 요청 컨텍스트 미사용**
- **타임아웃 설정 없음**
- ✅ **해결**: `context.Context` 활용

### 18. 프론트엔드 개선
- **에러 바운더리 없음**
- **로딩 상태 관리 일관성 부족**
- **API 클라이언트 중복 코드**
- ✅ **해결**: React Query 또는 SWR 도입

## 📊 우선순위별 작업 계획

### Phase 1: 보안 강화 (1-2주)
1. 환경 변수로 모든 하드코딩 제거
2. CORS 및 WebSocket Origin 검증
3. 구조화된 로깅 시스템 도입
4. 에러 핸들링 표준화

### Phase 2: 코드 품질 (2-3주)
5. 설정 관리 통합
6. 라우팅 구조 개선
7. 미들웨어 체인 구축
8. 입력 검증 추가
9. 타입 안정성 개선

### Phase 3: 테스트 및 문서화 (2주)
10. 단위 테스트 작성
11. 통합 테스트 작성
12. API 문서화 (Swagger)

### Phase 4: 기능 확장 (3-4주)
13. 인증/인가 시스템
14. 리소스 제한 관리
15. 모니터링 시스템
16. 스냅샷 기능

## 📈 현재 상태 요약

- **총 Go 코드**: ~805 라인
- **테스트 코드**: 0개
- **보안 취약점**: 5개 (긴급)
- **코드 품질 이슈**: 8개 (중요)
- **기능 개선**: 10개 (권장)

## 🎯 즉시 적용 가능한 개선

가장 빠르게 적용할 수 있는 개선사항:

1. **환경 변수 사용** (30분)
   - `database/db.go` 수정
   - `vm/service.go` 수정

2. **CORS 설정 개선** (15분)
   - 환경 변수로 허용 Origin 관리

3. **에러 응답 표준화** (1시간)
   - 공통 에러 응답 구조체
   - 에러 핸들러 함수

4. **로깅 라이브러리 도입** (2시간)
   - `zap` 또는 `logrus` 설치
   - 기존 `log` 호출 교체

