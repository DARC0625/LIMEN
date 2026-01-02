# 쿠키 전송 문제 디버깅 가이드

## 백엔드 변경 사항
- **SameSite 설정**: `Strict` → `Lax`로 변경
- **목적**: 크로스 도메인 쿠키 전송 문제 완화
- **CSRF 보호**: 유지됨

## 프론트엔드 확인 사항

### 1. 로그인 후 쿠키 저장 확인

#### 브라우저 개발자 도구에서 확인
1. **Application 탭** → **Cookies** → `limen.kr`
2. 확인할 쿠키:
   - `refresh_token` (HttpOnly, Secure, SameSite=Lax)
   - 기타 세션 쿠키

#### 확인 명령어 (브라우저 콘솔)
```javascript
// 쿠키 확인
document.cookie

// 특정 쿠키 확인 (HttpOnly 쿠키는 보이지 않음)
// 개발자 도구 Application 탭에서 확인
```

### 2. credentials: 'include' 설정 확인

#### 현재 설정 위치
- ✅ `lib/api/client.ts`: 모든 API 요청에 `credentials: 'include'` 설정됨
- ✅ `lib/auth/index.ts`: 세션 확인 요청에 `credentials: 'include'` 설정됨
- ✅ `components/LoginForm.tsx`: 로그인 후 세션 확인에 `credentials: 'include'` 설정됨

#### 확인 방법
브라우저 개발자 도구 → Network 탭 → 요청 클릭 → Headers 탭:
- **Request Headers**에 `Cookie` 헤더가 있는지 확인
- **Response Headers**에 `Set-Cookie` 헤더가 있는지 확인

### 3. 쿠키 만료 확인

#### 브라우저 개발자 도구에서 확인
1. **Application 탭** → **Cookies** → `limen.kr`
2. `refresh_token` 쿠키의 **Expires** 또는 **Max-Age** 확인
3. 만료 시간이 적절한지 확인 (일반적으로 7일 이상)

### 4. SameSite 설정 확인

#### 브라우저 개발자 도구에서 확인
1. **Application 탭** → **Cookies** → `limen.kr`
2. `refresh_token` 쿠키의 **SameSite** 속성 확인
3. 예상 값: `Lax` (백엔드에서 변경됨)

## 문제 해결 체크리스트

### 로그인 플로우 확인
- [ ] 로그인 성공 후 `Set-Cookie` 헤더 수신
- [ ] 브라우저에 `refresh_token` 쿠키 저장됨
- [ ] 쿠키의 `SameSite` 속성이 `Lax`로 설정됨
- [ ] 쿠키의 `HttpOnly` 속성이 `true`로 설정됨
- [ ] 쿠키의 `Secure` 속성이 `true`로 설정됨 (HTTPS)

### 세션 확인 요청 확인
- [ ] `GET /api/auth/session` 요청에 `Cookie` 헤더 포함
- [ ] `Cookie` 헤더에 `refresh_token` 포함
- [ ] 백엔드에서 `has_refresh_token_cookie: true` 확인

### 네트워크 요청 확인
브라우저 개발자 도구 → Network 탭:
1. 로그인 요청 (`POST /api/auth/login`)
   - Response Headers에 `Set-Cookie` 확인
2. 세션 확인 요청 (`GET /api/auth/session`)
   - Request Headers에 `Cookie` 확인
   - Response Headers에 `Set-Cookie` 확인 (필요시)

## 디버깅 명령어

### 프론트엔드 서버에서 테스트
```bash
# 로그인 요청 테스트
curl -v -X POST https://limen.kr/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  -c cookies.txt

# 쿠키 확인
cat cookies.txt

# 세션 확인 요청 (쿠키 포함)
curl -v https://limen.kr/api/auth/session \
  -b cookies.txt \
  -H "Content-Type: application/json"
```

### 브라우저 콘솔에서 테스트
```javascript
// 로그인 후 세션 확인
fetch('/api/auth/session', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
})
  .then(r => r.json())
  .then(data => console.log('Session:', data))
  .catch(err => console.error('Error:', err));
```

## 예상 문제 및 해결

### 문제 1: 쿠키가 저장되지 않음
**원인**: 
- SameSite=Strict (이미 Lax로 변경됨)
- Secure 쿠키가 HTTP에서 설정됨 (HTTPS 필요)

**해결**:
- HTTPS 사용 확인
- 브라우저 쿠키 설정 확인

### 문제 2: 쿠키가 전송되지 않음
**원인**:
- `credentials: 'include'` 누락
- CORS 설정 문제

**해결**:
- 모든 fetch 요청에 `credentials: 'include'` 확인
- CORS 설정 확인 (백엔드)

### 문제 3: 쿠키가 만료됨
**원인**:
- 쿠키 만료 시간이 너무 짧음
- 브라우저 쿠키 정리

**해결**:
- 백엔드에서 쿠키 만료 시간 확인
- 브라우저 쿠키 설정 확인

## 현재 프론트엔드 설정

### API 클라이언트 (`lib/api/client.ts`)
```typescript
const response = await fetch(url, {
  ...fetchOptions,
  headers,
  credentials: 'include', // ✅ 설정됨
  signal: controller?.signal,
});
```

### 세션 확인 (`lib/auth/index.ts`)
```typescript
const response = await fetch('/api/auth/session', {
  method: 'GET',
  credentials: 'include', // ✅ 설정됨
  headers: {
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
  },
});
```

### 로그인 후 세션 확인 (`components/LoginForm.tsx`)
```typescript
const sessionCheck = await fetch('/api/auth/session', {
  method: 'GET',
  credentials: 'include', // ✅ 설정됨
  headers: {
    'Content-Type': 'application/json',
  },
});
```

## 다음 단계

1. **백엔드 서버 재시작** (새 바이너리 적용)
2. **브라우저 캐시 및 쿠키 삭제**
3. **로그인 시도 후 확인**:
   - 브라우저 개발자 도구 → Application → Cookies
   - `refresh_token` 쿠키 확인
4. **세션 확인 요청 확인**:
   - 브라우저 개발자 도구 → Network → `/api/auth/session`
   - Request Headers에 `Cookie` 헤더 확인




