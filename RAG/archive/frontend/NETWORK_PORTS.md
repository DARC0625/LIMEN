# 네트워크 포트 구성

## 서버 포트 구성

### 프론트엔드 서버 (10.0.0.10)
- **외부 접근 포트**: 인터넷으로 IP 연결 (Envoy 프록시를 통해)
  - HTTP: 80
  - HTTPS: 443
- **내부망 포트**: 백엔드와 통신용
  - Next.js: 9444 (localhost)
  - darc.kr: 9445 (localhost)

### 백엔드 서버 (10.0.0.100)
- **외부 접근 포트**: 인터넷으로 IP 연결
  - API: (외부 포트 - 확인 필요)
- **내부망 포트**: 프론트엔드와 통신용
  - LIMEN 백엔드 API: **18443** (내부망)
  - Agent 서비스: **9000** (내부망)

## 통신 경로

### 클라이언트 → 프론트엔드
```
인터넷 클라이언트
  ↓ HTTPS/HTTP
Envoy 프록시 (10.0.0.10:80/443)
  ↓ localhost
Next.js 프론트엔드 (127.0.0.1:9444)
```

### 프론트엔드 → 백엔드 (세션 통신)
```
Next.js Middleware (10.0.0.10)
  ↓ 내부망 (10.0.0.100:18443)
백엔드 API (10.0.0.100:18443) ← 내부망 포트 사용
```

### Envoy → 백엔드
```
Envoy 프록시 (10.0.0.10)
  ↓ 내부망 (10.0.0.100:18443)
백엔드 API (10.0.0.100:18443) ← 내부망 포트 사용
```

## 중요 사항

### ✅ 올바른 설정
- **모든 세션 관련 통신은 내부망 포트(18443)를 사용해야 함**
- Middleware: `10.0.0.100:18443` (내부망)
- Envoy: `10.0.0.100:18443` (내부망)
- API 클라이언트: 상대 경로 `/api` 사용 (Middleware가 프록시)

### ❌ 잘못된 설정
- 외부 포트를 직접 사용
- `localhost` 또는 `127.0.0.1`을 백엔드 주소로 사용
- 절대 URL에 외부 포트 포함

## 환경 변수 설정

### 프론트엔드 서버 (10.0.0.10)
```bash
# .env.production
BACKEND_HOST=10.0.0.100      # 내부망 IP
BACKEND_PORT=18443           # 내부망 포트
AGENT_HOST=10.0.0.100        # 내부망 IP
AGENT_PORT=9000              # 내부망 포트

# 외부 접근용 (사용하지 않음)
# NEXT_PUBLIC_BACKEND_URL은 설정하지 않음 (상대 경로 사용)
```

### Envoy 설정
- 하드코딩된 IP 사용: `10.0.0.100:18443` (내부망)
- 환경 변수 불필요

## 세션 통신 확인

### 세션 생성 (POST /api/auth/session)
```
클라이언트
  ↓ fetch('/api/auth/session', { method: 'POST' })
Next.js Middleware
  ↓ http://10.0.0.100:18443/api/auth/session
백엔드 (내부망 포트 18443)
  ↓ Set-Cookie 헤더
Next.js Middleware
  ↓ Set-Cookie 헤더 전달
클라이언트 (쿠키 저장)
```

### 세션 확인 (GET /api/auth/session)
```
클라이언트
  ↓ fetch('/api/auth/session', { credentials: 'include' })
Next.js Middleware
  ↓ Cookie 헤더 포함
  ↓ http://10.0.0.100:18443/api/auth/session
백엔드 (내부망 포트 18443)
  ↓ 세션 확인
  ↓ { valid: true/false }
Next.js Middleware
  ↓ 응답 전달
클라이언트
```

## 문제 해결

### 세션이 생성되지 않는 경우
1. **포트 확인**: 백엔드가 내부망 포트(18443)에서 실행 중인지 확인
2. **네트워크 연결**: 프론트엔드 서버에서 `curl http://10.0.0.100:18443/api/health` 테스트
3. **Middleware 로그**: `pm2 logs limen-frontend | grep "Proxy.*session"` 확인

### 쿠키가 전달되지 않는 경우
1. **Set-Cookie 헤더**: 백엔드 응답에 Set-Cookie 헤더가 있는지 확인
2. **Middleware 전달**: Middleware가 Set-Cookie 헤더를 클라이언트로 전달하는지 확인
3. **쿠키 설정**: 도메인, 경로, SameSite, Secure 설정 확인




