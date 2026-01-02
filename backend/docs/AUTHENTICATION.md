# 인증 시스템 문서

## 개요

LIMEN 백엔드는 JWT(JSON Web Token) 기반 인증 시스템을 사용합니다. Access Token과 Refresh Token을 통해 안전하고 효율적인 인증을 제공합니다.

## 인증 흐름

### 1. 로그인
```
Client → POST /api/auth/login
         { username, password }
         
Server → 200 OK
         {
           access_token: "...",
           expires_in: 900
         }
         Set-Cookie: refresh_token=...
         Set-Cookie: csrf_token=...
```

### 2. 세션 확인
```
Client → GET /api/auth/session
         Cookie: refresh_token=...
         
Server → 200 OK
         {
           valid: true,
           access_token: "...",
           user: { id, username, role }
         }
         Set-Cookie: refresh_token=... (재설정)
         Set-Cookie: csrf_token=... (재설정)
```

### 3. API 요청
```
Client → GET /api/vms
         Authorization: Bearer <access_token>
         Cookie: refresh_token=... (fallback)
         
Server → 200 OK
         [...]
```

### 4. 토큰 갱신
```
Client → POST /api/auth/refresh
         Cookie: refresh_token=...
         (또는 body에 refresh_token)
         
Server → 200 OK
         {
           access_token: "...",
           expires_in: 900
         }
         Set-Cookie: refresh_token=... (새로운 토큰, 로테이션)
```

## 토큰 구조

### Access Token
- **수명**: 15분 (900초)
- **용도**: API 요청 인증
- **전송 방법**: Authorization header 또는 query parameter
- **포함 정보**: user_id, username, role, approved

### Refresh Token
- **수명**: 7일 (604800초)
- **용도**: Access token 갱신
- **전송 방법**: HttpOnly cookie (권장) 또는 request body
- **토큰 로테이션**: 갱신 시마다 새로운 refresh token 발급

### CSRF Token
- **수명**: 7일 (604800초)
- **용도**: CSRF 공격 방지
- **전송 방법**: Cookie (JavaScript 접근 가능)
- **사용**: POST/PUT/DELETE 요청 시 X-CSRF-Token header에 포함

## 인증 방법

### 1. Authorization Header (권장)
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**장점**:
- 명시적이고 명확함
- 쿠키보다 제어하기 쉬움
- CORS 문제 없음

**사용 예시**:
```javascript
fetch('/api/vms', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  credentials: 'include'
})
```

### 2. refresh_token 쿠키 (세션 기반)
```http
Cookie: refresh_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**장점**:
- 자동으로 전송됨
- XSS 공격으로부터 보호 (HttpOnly)
- 사용자 편의성

**동작 방식**:
1. 로그인 시 `refresh_token` 쿠키 설정
2. API 요청 시 쿠키 자동 전송
3. Access token이 없으면 쿠키에서 refresh token 읽기
4. Refresh token으로 새로운 access token 생성

**사용 예시**:
```javascript
fetch('/api/vms', {
  credentials: 'include' // 쿠키 전송 필수
})
```

### 3. Query Parameter (하위 호환)
```
?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**주의**: 보안상 권장하지 않음 (URL에 토큰 노출)

## 인증 미들웨어

### Public Endpoints
다음 엔드포인트는 인증이 필요하지 않습니다:
- `GET /api/health`
- `GET /api/health_proxy`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/session`
- `POST /api/auth/session`
- `DELETE /api/auth/session`
- `POST /api/auth/refresh`
- `GET /ws/vnc` (VNC 핸들러에서 자체 인증)
- `GET /vnc` (VNC 핸들러에서 자체 인증)
- `GET /vnc/{uuid}` (VNC 핸들러에서 자체 인증)

### Protected Endpoints
위에 나열되지 않은 모든 엔드포인트는 인증이 필요합니다.

### 인증 우선순위
인증 미들웨어는 다음 순서로 토큰을 확인합니다:
1. Authorization header: `Authorization: Bearer ...`
2. refresh_token cookie: 쿠키에서 읽어 access token 생성

## VNC WebSocket 인증

VNC WebSocket 연결은 별도의 인증 로직을 사용합니다:

### 지원하는 인증 방법
1. Query parameter: `?token=...`
2. Authorization header: `Authorization: Bearer ...`
3. refresh_token cookie: 쿠키에서 access token 생성

### 인증 우선순위
```
Query parameter → Authorization header → refresh_token cookie
```

### 예시
```javascript
// 방법 1: Query parameter
const ws = new WebSocket('ws://localhost:18443/vnc/7b20e9e6-...?token=...')

// 방법 2: Authorization header (권장)
const ws = new WebSocket('ws://localhost:18443/vnc/7b20e9e6-...', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
})

// 방법 3: refresh_token cookie
const ws = new WebSocket('ws://localhost:18443/vnc/7b20e9e6-...')
// 쿠키는 자동으로 전송됨 (credentials: 'include' 필요)
```

## 쿠키 설정

### refresh_token 쿠키
```
Name: refresh_token
Value: <JWT token>
HttpOnly: true
SameSite: Lax
Path: /
MaxAge: 604800 (7일)
Secure: true (HTTPS 환경)
Domain: "" (현재 도메인)
```

### csrf_token 쿠키
```
Name: csrf_token
Value: <random string>
HttpOnly: false (JavaScript 접근 필요)
SameSite: Lax
Path: /
MaxAge: 604800 (7일)
Secure: true (HTTPS 환경)
Domain: "" (현재 도메인)
```

## 보안 고려사항

### 1. 토큰 로테이션
Refresh token은 갱신 시마다 새로운 토큰으로 교체됩니다. 이전 토큰은 무효화됩니다.

### 2. CSRF 보호
- CSRF token은 모든 상태 변경 요청(POST/PUT/DELETE)에 필요합니다
- GET 요청은 CSRF 검증을 건너뜁니다 (읽기 전용)

### 3. 세션 관리
- 세션은 메모리에 저장됩니다 (프로덕션에서는 Redis 권장)
- 만료된 세션은 자동으로 정리됩니다 (이벤트 기반)

### 4. Zero-Trust 원칙
- 모든 입력 검증
- 내부 오류 정보 노출 방지
- 최소 권한 원칙

## 문제 해결

### 쿠키가 전송되지 않는 경우
1. `credentials: 'include'` 옵션 확인
2. CORS 설정 확인 (`Access-Control-Allow-Credentials: true`)
3. 브라우저 개발자 도구 → Application → Cookies 확인
4. SameSite 설정 확인 (Lax 권장)

### 토큰이 만료된 경우
1. `POST /api/auth/refresh`로 토큰 갱신
2. refresh_token 쿠키가 있으면 자동으로 갱신 시도
3. refresh_token도 만료된 경우 재로그인 필요

### VNC 연결 실패
1. 인증 로그 확인: `tail -f /tmp/limen-server.log | grep VNC`
2. 쿠키 또는 Authorization header 전송 확인
3. WebSocket 업그레이드 요청 확인 (`Upgrade: websocket` 헤더)

## 참고 자료

- [쿠키 디버깅 가이드](../COOKIE_DEBUG_GUIDE.md)
- [API 문서](./API_DOCUMENTATION.md)
- [성능 최적화 가이드](./PERFORMANCE_OPTIMIZATION.md)


