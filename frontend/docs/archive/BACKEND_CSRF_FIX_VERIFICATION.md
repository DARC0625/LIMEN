# 백엔드 CSRF 토큰 검증 수정 사항 확인

## 백엔드 변경 사항

### 문제
- `GET /api/auth/session` 요청에서 CSRF 토큰 검증 실패 시 `403 Forbidden` 반환
- GET 요청은 읽기 전용이므로 CSRF 보호가 불필요함

### 해결
- GET 요청에서 CSRF 토큰 검증 실패 시에도 세션 정보를 반환하도록 변경
- CSRF 토큰 불일치 시 로그만 기록하고 계속 진행
- 로그인 응답에 쿠키 설정 정보 로그 추가

### 현재 상태
- `has_refresh_token_cookie: true` - refresh_token 쿠키 전송됨
- `has_csrf_token: true` - csrf_token 쿠키 전송됨
- 이전: CSRF 토큰 불일치로 403 반환
- 현재: CSRF 토큰 불일치 시에도 세션 정보 반환 (GET 요청)

## 프론트엔드 확인 사항

### 1. GET /api/auth/session 요청 테스트

브라우저 개발자 도구에서 확인:

1. **Network 탭** → `GET /api/auth/session` 요청 선택
2. **Response** 확인:
   - ✅ 상태 코드: `200 OK`
   - ✅ 응답 본문: `{ "valid": true, ... }` 또는 유효한 세션 정보
3. **Request Headers** 확인:
   - `Cookie: refresh_token=...; csrf_token=...` 포함 여부
   - `X-CSRF-Token: ...` 포함 여부 (있으면 좋지만 없어도 괜찮음)

### 2. 백엔드 로그 확인

백엔드 로그에서 다음을 확인:

```
[WARN] Invalid CSRF token for GET /api/auth/session (expected: ..., provided: ...)
```

이 경고가 있어도 요청은 성공해야 합니다 (200 OK 반환).

### 3. 프론트엔드 코드 동작

프론트엔드 코드는 이미 다음과 같이 처리합니다:

```typescript
// GET /api/auth/session 요청
const response = await fetch('/api/auth/session', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    // CSRF 토큰이 있으면 포함, 없어도 괜찮음 (GET 요청)
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
  },
});

if (response.ok) {
  const data: SessionResponse = await response.json();
  if (data.valid === true) {
    return { valid: true };
  }
}
```

## 테스트 시나리오

### 시나리오 1: 정상 세션 확인

1. 로그인 성공
2. 대시보드 접근
3. `GET /api/auth/session` 요청 확인
   - ✅ `200 OK` 응답
   - ✅ `{ "valid": true, ... }` 반환
   - ✅ Request Headers에 `Cookie` 헤더 포함

### 시나리오 2: CSRF 토큰 없이 세션 확인

1. 로그인 성공
2. 브라우저 콘솔에서 직접 요청:
   ```javascript
   fetch('/api/auth/session', {
     method: 'GET',
     credentials: 'include',
     headers: { 'Content-Type': 'application/json' }
   }).then(r => r.json()).then(console.log);
   ```
3. 확인:
   - ✅ `200 OK` 응답 (이전에는 403이었음)
   - ✅ 세션 정보 반환
   - ⚠️ 백엔드 로그에 CSRF 토큰 경고가 있을 수 있지만 요청은 성공

### 시나리오 3: 페이지 새로고침 후 세션 확인

1. 대시보드에서 페이지 새로고침 (F5)
2. `GET /api/auth/session` 요청 확인
   - ✅ `200 OK` 응답
   - ✅ 쿠키가 자동으로 전송되어 세션 유지
   - ✅ 로그아웃되지 않고 대시보드 유지

## 프론트엔드 로깅 개선

프론트엔드 코드에 다음 로깅이 추가되었습니다:

### 개발 환경 로깅

```typescript
// 세션 확인 시작
console.log('[checkBackendSession] Checking session', {
  hasCSRFToken: !!csrfToken,
});

// 응답 확인
console.log('[checkBackendSession] Session check response:', {
  status: response.status,
  ok: response.ok,
  statusText: response.statusText,
});

// 세션 데이터 확인
console.log('[checkBackendSession] Session data:', {
  valid: data.valid,
  reason: data.reason,
});
```

### 프로덕션 환경

프로덕션 환경에서는 로깅이 최소화되어 성능에 영향을 주지 않습니다.

## 예상되는 정상 동작

1. **로그인 후:**
   - `POST /api/auth/login` → `200 OK`
   - Response Headers에 `Set-Cookie` 2개 (refresh_token, csrf_token)
   - Application 탭에 쿠키 2개 저장

2. **세션 확인:**
   - `GET /api/auth/session` → `200 OK`
   - Request Headers에 `Cookie` 헤더 포함
   - Response에 `{ valid: true, ... }` 반환
   - CSRF 토큰이 없어도 정상 동작 (GET 요청)

3. **페이지 새로고침:**
   - `GET /api/auth/session` → `200 OK`
   - 쿠키가 자동으로 전송되어 세션 유지

## 문제 해결

### 문제: 여전히 403 Forbidden 반환

**확인 사항:**
1. 백엔드 코드가 최신 버전으로 배포되었는지 확인
2. 백엔드 로그에서 CSRF 토큰 검증 로직 확인
3. GET 요청인지 확인 (POST 요청은 여전히 CSRF 토큰 필요)

**해결 방법:**
- 백엔드 서버 재시작
- 백엔드 코드에서 GET 요청 처리 로직 확인

### 문제: 세션 정보가 반환되지 않음

**확인 사항:**
1. 쿠키가 브라우저에 저장되어 있는지 확인 (Application 탭)
2. Request Headers에 `Cookie` 헤더가 포함되어 있는지 확인
3. Next.js middleware 로그에서 쿠키 전달 여부 확인

**해결 방법:**
- 브라우저 캐시 및 쿠키 삭제 후 재로그인
- Next.js middleware 로그 확인:
  ```bash
  pm2 logs limen-frontend --lines 50 | grep "session"
  ```

## 관련 파일

- `/home/darc/LIMEN/frontend/lib/auth/index.ts` - 세션 확인 로직
- `/home/darc/LIMEN/frontend/middleware.ts` - Next.js 프록시 미들웨어
- `/home/darc/LIMEN/frontend/lib/api/auth.ts` - 인증 API 클라이언트



