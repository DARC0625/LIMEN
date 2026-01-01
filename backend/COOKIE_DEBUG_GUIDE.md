# 쿠키 전송 문제 디버깅 가이드

## 문제 상황
프론트엔드에서 로그인 후 쿠키가 전송되지 않음

## 백엔드 확인 사항

### 1. 로그인 성공 시 Set-Cookie 헤더 확인
백엔드 로그에서 다음을 확인:
```
"User logged in" - 로그인 성공
"Login response cookies" - 쿠키 설정 정보
"Refresh token cookie set" - refresh_token 쿠키 설정
```

### 2. CORS 설정 확인
- `Access-Control-Allow-Credentials: true` ✅
- `Access-Control-Allow-Origin: https://limen.kr` (정확한 origin) ✅
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token` ✅

### 3. 쿠키 설정 확인
백엔드에서 설정된 쿠키:
- `refresh_token`: HttpOnly=true, SameSite=Lax, Path=/, Domain=""
- `csrf_token`: HttpOnly=false, SameSite=Lax, Path=/, Domain=""
- HTTPS인 경우: Secure=true

## 프론트엔드 확인 사항

### 1. fetch/axios 요청에 credentials 옵션 확인
```javascript
// ✅ 올바른 설정
fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // 중요!
  body: JSON.stringify({ username, password })
})

// ❌ 잘못된 설정
fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  // credentials 옵션 없음
  body: JSON.stringify({ username, password })
})
```

### 2. 브라우저 개발자 도구 확인

#### Network 탭
1. `POST /api/auth/login` 요청 선택
2. **Response Headers** 확인:
   ```
   Set-Cookie: refresh_token=...; Path=/; SameSite=Lax
   Set-Cookie: csrf_token=...; Path=/; SameSite=Lax
   Access-Control-Allow-Credentials: true
   Access-Control-Allow-Origin: https://limen.kr
   ```
3. **Request Headers** 확인:
   ```
   Origin: https://limen.kr
   ```

#### Application 탭
1. **Cookies** → `https://limen.kr` 확인
2. 다음 쿠키가 있어야 함:
   - `refresh_token` (HttpOnly)
   - `csrf_token`

### 3. Next.js Middleware 확인
Next.js middleware에서 쿠키를 전달하는지 확인:
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // 쿠키 전달 확인
  const cookies = request.cookies.getAll()
  console.log('Cookies in middleware:', cookies)
  
  return response
}
```

## 문제 해결 체크리스트

- [ ] 프론트엔드에서 `credentials: 'include'` 사용
- [ ] 브라우저 개발자 도구 → Network → Response Headers에서 Set-Cookie 확인
- [ ] 브라우저 개발자 도구 → Application → Cookies에서 쿠키 존재 확인
- [ ] CORS preflight (OPTIONS) 요청 성공 확인
- [ ] Origin 헤더가 올바르게 전송되는지 확인
- [ ] HTTPS 환경에서 Secure 쿠키 문제 없는지 확인
- [ ] SameSite=Lax 설정이 올바른지 확인

## 테스트 방법

### 1. 백엔드 직접 테스트
```bash
cd /home/darc0/projects/LIMEN/backend
./test_login_cookies.sh
```

### 2. curl로 테스트
```bash
curl -X POST "http://localhost:18443/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: https://limen.kr" \
  -d '{"username":"admin","password":"admin"}' \
  -v 2>&1 | grep -E "(Set-Cookie|Access-Control)"
```

## 추가 디버깅

백엔드 로그 확인:
```bash
tail -f /tmp/limen-server.log | grep -E "(login|cookie|CORS)"
```

로그인 성공 시 다음 로그가 있어야 함:
- "User logged in"
- "Login response cookies"
- "Refresh token cookie set"


