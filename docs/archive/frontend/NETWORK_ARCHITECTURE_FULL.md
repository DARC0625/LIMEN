# 전체 네트워크 아키텍처

## 네트워크 구성

### 서버 구성
- **프론트엔드 서버**
  - **내부망 IP**: `10.0.0.10` (enp1s0 인터페이스) - 백엔드와 통신용
  - **인터넷 IP**: `14.54.57.159` (enp3s0 인터페이스) - 외부 사용자 접근용
  - **포트**: 
    - Next.js: `9444` (localhost)
    - darc.kr: `9445` (localhost)
    - Envoy: `80/443` (외부 접근, 인터넷 IP 사용)

- **백엔드 서버**
  - **인터넷 IP**: `61.73.245.105` (eth0) - 외부 접근용 (프론트엔드가 프록시하므로 직접 사용 안 함)
  - **인터넷 게이트웨이**: `61.73.245.1`
  - **내부망 IP**: 
    - `10.0.0.100` (eth1) - 주요 내부망 IP, 프론트엔드와 통신용
    - `10.0.0.110` (eth0) - 추가 내부망 IP
  - **리스닝**: `0.0.0.0:18443` (모든 인터페이스)
  - **포트**:
    - LIMEN 백엔드 API: `18443` (내부망)
    - Agent 서비스: `9000` (내부망)

## 통신 경로

### 1. 외부 사용자 → 프론트엔드 → 백엔드

```
외부 사용자 (인터넷)
  ↓ HTTPS/HTTP
프론트엔드 인터넷 IP (xxx.xxx.xxx.xxx:443/80)
  ↓ Envoy 프록시
Next.js 프론트엔드 (127.0.0.1:9444)
  ↓ Next.js Middleware
  ↓ 내부망 (10.0.0.100:18443)
백엔드 API (10.0.0.100:18443) ← 내부망 포트 사용
```

### 2. 외부 사용자 → Envoy → 백엔드 (직접 프록시)

```
외부 사용자 (인터넷)
  ↓ HTTPS/HTTP
프론트엔드 인터넷 IP (14.54.57.159:443/80, enp3s0)
  ↓ Envoy 프록시
  ↓ 내부망 (10.0.0.10 → 10.0.0.100:18443, enp1s0 → eth1)
백엔드 API (10.0.0.100:18443, eth1, 리스닝: 0.0.0.0:18443) ← 내부망 포트 사용
```

## 세션 통신 흐름

### 로그인 (POST /api/auth/session)

```
외부 사용자 브라우저
  ↓ fetch('/api/auth/session', { method: 'POST' })
프론트엔드 인터넷 IP (14.54.57.159:443, enp3s0)
  ↓ Envoy 프록시 (포트 443)
Next.js 프론트엔드 (127.0.0.1:9444)
  ↓ Next.js Middleware
  ↓ 내부망 HTTP (10.0.0.10 → 10.0.0.100:18443/api/auth/session, enp1s0 → eth1)
백엔드 API (10.0.0.100:18443, eth1, 리스닝: 0.0.0.0:18443)
  ↓ Set-Cookie 헤더 (Refresh Token)
Next.js Middleware
  ↓ Set-Cookie 헤더 전달
Envoy 프록시
  ↓ Set-Cookie 헤더 전달
외부 사용자 브라우저 (쿠키 저장)
```

### 세션 확인 (GET /api/auth/session)

```
외부 사용자 브라우저
  ↓ fetch('/api/auth/session', { credentials: 'include' })
프론트엔드 인터넷 IP (14.54.57.159:443, enp3s0)
  ↓ Cookie 헤더 포함
  ↓ Envoy 프록시 (포트 443)
Next.js 프론트엔드 (127.0.0.1:9444)
  ↓ Next.js Middleware
  ↓ Cookie 헤더 포함
  ↓ 내부망 HTTP (10.0.0.10 → 10.0.0.100:18443/api/auth/session, enp1s0 → eth1)
백엔드 API (10.0.0.100:18443, eth1, 리스닝: 0.0.0.0:18443)
  ↓ 세션 확인
  ↓ { valid: true/false }
Next.js Middleware
  ↓ 응답 전달
Envoy 프록시
  ↓ 응답 전달
외부 사용자 브라우저
```

## 중요 사항

### ✅ 올바른 설정

1. **외부 사용자는 프론트엔드 인터넷 IP로 접근**
   - 브라우저: `https://limen.kr` 또는 프론트엔드 인터넷 IP
   - Envoy가 외부 접근을 받음

2. **프론트엔드는 내부망을 통해 백엔드와 통신**
   - Middleware: `10.0.0.100:18443` (내부망)
   - Envoy: `10.0.0.100:18443` (내부망)
   - 절대 외부 IP나 외부 포트를 사용하지 않음

3. **API 클라이언트는 상대 경로 사용**
   - `fetch('/api/auth/session')` ← 상대 경로
   - Middleware가 내부망으로 프록시

### ❌ 잘못된 설정

1. **외부 IP를 직접 사용**
   ```typescript
   // ❌ 잘못됨
   const apiUrl = 'https://yyy.yyy.yyy.yyy:18443/api';
   ```

2. **외부 포트를 사용**
   ```typescript
   // ❌ 잘못됨
   const backendUrl = 'http://10.0.0.100:외부포트';
   ```

3. **절대 URL에 인터넷 IP 포함**
   ```typescript
   // ❌ 잘못됨
   const wsUrl = 'ws://xxx.xxx.xxx.xxx:18443/ws/vnc';
   ```

## 현재 구현

### Next.js Middleware (`middleware.ts`)
```typescript
// 내부망 IP와 포트 사용
const backendUrl = `http://10.0.0.100:18443`; // 내부망
const targetUrl = `${backendUrl}${pathname}`; // /api/auth/session
```

### Envoy 프록시 (`envoy.yaml`)
```yaml
# 백엔드 클러스터 (내부망 포트)
backend_cluster:
  address: 10.0.0.100  # 내부망 IP
  port: 18443          # 내부망 포트
```

### API 클라이언트 (`lib/api/client.ts`)
```typescript
// 상대 경로 사용 (Middleware가 프록시)
const getAPIUrl = (): string => {
  return '/api'; // 상대 경로
};
```

### 세션 확인 (`lib/auth/index.ts`)
```typescript
// 상대 경로 사용
const response = await fetch('/api/auth/session', {
  method: 'GET',
  credentials: 'include', // 쿠키 포함
});
```

## 쿠키 전달 경로

### Set-Cookie (백엔드 → 클라이언트)
```
백엔드 (10.0.0.100:18443)
  ↓ Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=None
Next.js Middleware
  ↓ Set-Cookie 헤더 전달
Envoy 프록시
  ↓ Set-Cookie 헤더 전달
외부 사용자 브라우저
  ↓ 쿠키 저장 (도메인: limen.kr)
```

### Cookie (클라이언트 → 백엔드)
```
외부 사용자 브라우저
  ↓ Cookie: refresh_token=...
프론트엔드 인터넷 IP (xxx.xxx.xxx.xxx:443)
  ↓ Cookie 헤더 포함
Envoy 프록시
  ↓ Cookie 헤더 전달
Next.js Middleware
  ↓ Cookie 헤더 전달
  ↓ 내부망 (10.0.0.100:18443)
백엔드 API
  ↓ 쿠키 확인
```

## 환경 변수 설정

### 프론트엔드 서버 (10.0.0.10)
```bash
# .env.production
# 내부망 통신용 (백엔드와 직접 통신)
BACKEND_HOST=10.0.0.100      # 내부망 IP
BACKEND_PORT=18443           # 내부망 포트
AGENT_HOST=10.0.0.100        # 내부망 IP
AGENT_PORT=9000              # 내부망 포트

# 외부 접근용 (사용하지 않음)
# NEXT_PUBLIC_BACKEND_URL은 설정하지 않음
# (상대 경로 /api 사용)
```

## 확인 사항

### 1. 외부 사용자 접근 테스트
```bash
# 외부에서 프론트엔드 접근
curl -v https://limen.kr/api/health

# 또는 프론트엔드 인터넷 IP
curl -v https://xxx.xxx.xxx.xxx/api/health
```

### 2. 내부망 통신 테스트
```bash
# 프론트엔드 서버에서 백엔드 접근
curl -v http://10.0.0.100:18443/api/health
```

### 3. 세션 통신 테스트
```bash
# 외부에서 로그인 시도
curl -v -X POST https://limen.kr/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# 세션 확인
curl -v https://limen.kr/api/auth/session \
  -H "Cookie: refresh_token=..."
```

## 문제 해결

### 세션이 생성되지 않는 경우
1. **쿠키 도메인 확인**: 백엔드가 Set-Cookie에 올바른 도메인 설정
2. **SameSite 설정**: `SameSite=None; Secure` (HTTPS 필수)
3. **프록시 헤더 전달**: Middleware와 Envoy가 Set-Cookie 헤더 전달 확인

### 쿠키가 전달되지 않는 경우
1. **credentials: 'include'**: 모든 fetch 요청에 포함
2. **Cookie 헤더 전달**: Middleware가 Cookie 헤더를 백엔드로 전달
3. **브라우저 쿠키 확인**: 개발자 도구에서 쿠키 저장 여부 확인

