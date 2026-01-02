# 변경 이력 (Changelog)

## [2026-01-01] 최근 업데이트

### 🔐 인증 및 세션 관리 개선

#### 세션 체크 API 개선
- **GET /api/auth/session**: CSRF 토큰 검증 실패 시에도 세션 정보 반환 (GET 요청은 읽기 전용이므로)
- 세션 체크 응답에 `refresh_token` 및 `csrf_token` 쿠키 재설정 추가
  - 브라우저에 쿠키가 저장되지 않았거나 손실된 경우 자동 복구
- 로그인 페이지 감지 로직 제거 (프론트엔드에서 처리)

#### 쿠키 설정 통일
- 모든 세션 관련 쿠키에 `SameSite=Lax` 및 `Domain=""` 설정 통일
- `refresh_token`: HttpOnly=true, SameSite=Lax, Path=/
- `csrf_token`: HttpOnly=false, SameSite=Lax, Path=/
- HTTPS 환경에서 자동으로 Secure=true 설정

#### 인증 미들웨어 개선
- 쿠키 로깅 강화: 요청에 포함된 모든 쿠키 이름 및 Cookie 헤더 로깅
- refresh_token 쿠키 기반 인증 상세 로깅
- 인증 실패 시 상세 정보 로깅

### 🌐 VNC WebSocket 인증 개선

#### 다중 인증 방법 지원
VNC WebSocket 연결 시 다음 순서로 인증 시도:
1. Query parameter: `?token=...` (하위 호환)
2. Authorization header: `Authorization: Bearer ...` (프론트엔드 권장)
3. refresh_token cookie: 쿠키에서 읽어 access token 생성 (세션 기반)

#### 경로 지원 확대
- `/vnc` - Query parameter로 UUID 전달
- `/vnc/{uuid}` - Path parameter로 UUID 전달 (신규)
- `/ws/vnc` - WebSocket 경로

#### 인증 로깅 강화
- 모든 쿠키 이름 로깅
- refresh_token 쿠키 존재 여부 명시적 로깅
- refresh_token 쿠키 인증 시도 과정 상세 로깅
- 성공/실패 각 단계별 로깅

### ⚡ 성능 최적화

#### 이벤트 기반 작업 전환
주기적 작업을 이벤트 기반(트리거)으로 전환하여 효율성 향상:

1. **세션 정리**
   - 이전: 5분마다 주기적 정리
   - 변경: 세션 생성/조회 시 만료된 세션 즉시 정리
   - 효과: 불필요한 주기 작업 제거, 즉시 정리로 메모리 효율 향상

2. **Rate limit 정리**
   - 이전: 10분마다 주기적 정리
   - 변경: Rate limit 체크 시 만료된 항목만 정리
   - 효과: 요청 시에만 정리로 CPU 사용량 감소

3. **하드웨어 모니터링**
   - 이전: 5분마다 주기적 체크
   - 변경: 서버 시작 시 1회 체크 (이벤트 기반)
   - 효과: 하드웨어 변경은 드물므로 주기 체크 불필요

4. **보안 체인 모니터링**
   - 이전: 10분마다 주기적 체크
   - 변경: 서버 시작 시 1회 체크 (이벤트 기반)
   - 효과: 보안 설정 변경은 드물므로 주기 체크 불필요

#### 로깅 최적화
- 인증 미들웨어 상세 로그를 Debug 레벨로 변경
- CORS preflight 성공 로그를 Debug 레벨로 변경
- Health check 엔드포인트 로그를 Debug 레벨로 변경
- 쿠키 설정 로그를 Debug 레벨로 변경
- 로그 볼륨 감소로 성능 향상 및 디버깅 효율성 개선

### 📁 경로 처리 개선

#### 절대경로 → 상대경로 변경
- **하드웨어 스펙 파일**: `/home/darc0/projects/LIMEN/.server-spec.json` → `.server-spec.json` (작업 디렉토리 기준)
- **로그 디렉토리 기본값**: `/var/log/limen` → `./logs` (상대경로)
- **VM 이미지 경로**: 하드코딩된 절대경로 제거, 상대경로로 변환 및 처리

#### 제외된 경로
- `/usr/bin/qemu-system-x86_64`: 시스템 바이너리 경로이므로 절대경로 유지

#### 효과
- 이식성 향상: 다른 환경에서도 동작 가능
- 배포 용이성: 절대경로 의존성 제거
- 유지보수성: 환경별 경로 설정 불필요

### 🧪 테스트 커버리지 향상

#### 추가된 테스트
- **security 패키지**: 0% → 33.2%
  - `zerotrust_test.go`: 입력 검증, CSRF 토큰, 경로 검증 등
  - `user_security_test.go`: 비밀번호 정책, 계정 잠금, 사용자 감사 등
- **middleware 패키지**: 28.2% → 72.8%
  - `middleware_test.go`: Admin, RateLimit, IPWhitelist, EnhancedLogging 등
- **auth 패키지**: 84.8% (이미 높은 커버리지)
- **errors 패키지**: 95.2% (거의 완료)

#### 현재 전체 커버리지
- 전체: 15.4%
- 목표: 100%

### 🔧 기타 개선사항

#### DB 연결 풀 최적화
- MaxIdleConns: 25 (기존 10에서 증가)
- MaxOpenConns: 100
- ConnMaxLifetime: 30분 (기존 1시간에서 감소)
- ConnMaxIdleTime: 5분 (기존 10분에서 감소)

#### DB 쿼리 최적화
- Select로 필요한 필드만 가져오기
- N+1 쿼리 문제 해결
- 병렬 VM 상태 동기화 (최대 5개 동시 처리)

#### 에러 핸들링 강화
- Panic recovery 미들웨어 구현
- 에러 핸들링 표준화 (errors 패키지)
- 리소스 누수 방지 (defer cancel, defer Close)
- Race condition 테스트 통과

#### 보안 강화
- 입력 검증 (validator 패키지)
- SQL 인젝션 방지 (화이트리스트 접근)
- XSS 방지 (입력 sanitization)
- Zero-trust 원칙 적용

---

## API 변경사항

### 인증 엔드포인트

#### POST /api/auth/refresh
- **변경**: 쿠키와 body 모두에서 refresh_token 읽기 지원
- **우선순위**: 쿠키 → body
- **Request Body** (선택사항):
  ```json
  {
    "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
  }
  ```

#### GET /api/auth/session
- **변경**: CSRF 토큰 검증 실패 시에도 세션 정보 반환 (GET 요청)
- **변경**: 응답에 `refresh_token` 및 `csrf_token` 쿠키 재설정

### VNC WebSocket 엔드포인트

#### GET /vnc/{uuid}
- **신규**: Path parameter로 UUID 전달 지원
- **인증**: Query parameter, Authorization header, refresh_token cookie 모두 지원

#### GET /vnc
- **변경**: Query parameter 또는 Authorization header로 인증 가능
- **인증**: refresh_token cookie 지원 추가

#### GET /ws/vnc
- **변경**: Authorization header 및 refresh_token cookie 지원 추가

---

## 마이그레이션 가이드

### 절대경로 사용 중인 경우
기존에 절대경로를 사용하던 설정이 있다면 상대경로로 변경하세요:

**하드웨어 스펙 파일**
- 이전: `/home/darc0/projects/LIMEN/.server-spec.json`
- 변경: `.server-spec.json` (작업 디렉토리 기준)

**로그 디렉토리**
- 이전: `/var/log/limen`
- 변경: `./logs` 또는 환경 변수 `LOG_DIR` 설정

### VNC 접근 방법
기존 query parameter 방식도 계속 지원하지만, 권장 방법은 Authorization header 또는 쿠키입니다:

**기존 방식 (하위 호환)**
```
ws://localhost:18443/vnc?token=eyJhbGciOiJIUzI1NiIs...
```

**권장 방식**
```
ws://localhost:18443/vnc/{uuid}
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
  Cookie: refresh_token=eyJhbGciOiJIUzI1NiIs...
```

---

## 성능 개선 효과

### CPU 사용량
- 주기적 작업 제거로 백그라운드 부하 감소
- 이벤트 기반 작업으로 필요 시에만 처리

### 메모리 효율
- 필요 시에만 정리로 메모리 사용 최적화
- 세션 정리 즉시 수행으로 메모리 효율 향상

### 응답 속도
- 불필요한 작업 제거로 리소스 여유 확보
- 로그 볼륨 감소로 I/O 부하 감소

---

## 알려진 이슈

### VNC WebSocket 연결
- 프론트엔드에서 `/vnc/{uuid}`로 접근 시 WebSocket 업그레이드 요청이어야 함
- 일반 HTTP GET 요청은 WebSocket 연결이 되지 않음
- `Upgrade: websocket` 헤더 필요

---

## 향후 계획

### 테스트 커버리지
- 목표: 100%
- 현재: 15.4%
- 진행 중: 핵심 패키지부터 테스트 추가

### 추가 최적화
- 캐싱 전략 구현
- 추가 성능 벤치마크
- 메모리 프로파일링


