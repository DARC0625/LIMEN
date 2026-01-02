# 프론트엔드 쿠키 설정 확인 가이드

백엔드 조치 완료 후 프론트엔드에서 확인할 사항들을 정리했습니다.

## ✅ 프론트엔드 코드 확인 완료

모든 인증 관련 요청에 `credentials: 'include'`가 올바르게 설정되어 있습니다:

### 1. 로그인 요청 (`/api/auth/login`)
```42:44:lib/api/auth.ts
      credentials: 'include',
      body: JSON.stringify(credentials),
    });
```

### 2. 세션 생성 요청 (`/api/auth/session` POST)
```133:133:lib/api/auth.ts
        credentials: 'include', // 쿠키 포함 필수
```

### 3. 세션 확인 요청 (`/api/auth/session` GET)
```97:97:lib/auth/index.ts
      credentials: 'include',
```

### 4. 일반 API 요청 (`apiRequest`)
```113:113:lib/api/client.ts
        credentials: 'include', // 쿠키 포함 (Refresh Token)
```

## 🔍 브라우저에서 확인할 사항

### 1. 로그인 요청 확인 (Network 탭)

1. 브라우저 개발자 도구 열기 (F12)
2. **Network** 탭 선택
3. 로그인 시도
4. `POST /api/auth/login` 요청 선택
5. **Response Headers**에서 다음 헤더 확인:

```
Set-Cookie: refresh_token=...; Path=/; SameSite=Lax
Set-Cookie: csrf_token=...; Path=/; SameSite=Lax
Access-Control-Allow-Credentials: true
Access-Control-Allow-Origin: https://limen.kr
```

### 2. 쿠키 저장 확인 (Application 탭)

1. 브라우저 개발자 도구 → **Application** 탭
2. 왼쪽 메뉴에서 **Cookies** → `https://limen.kr` 선택
3. 다음 쿠키들이 존재하는지 확인:
   - `refresh_token` (HttpOnly: true)
   - `csrf_token` (HttpOnly: true)

### 3. 세션 확인 요청 확인 (Network 탭)

1. 로그인 후 대시보드로 이동
2. **Network** 탭에서 `GET /api/auth/session` 요청 찾기
3. **Request Headers**에서 `Cookie` 헤더 확인:
   ```
   Cookie: refresh_token=...; csrf_token=...
   ```
4. **Response**에서 `200 OK` 및 유효한 세션 데이터 확인

## 🧪 테스트 시나리오

### 시나리오 1: 로그인 → 쿠키 설정 확인

1. 로그인 페이지에서 로그인 시도
2. Network 탭에서 `POST /api/auth/login` 확인
   - ✅ Response Headers에 `Set-Cookie` 헤더 2개 존재
   - ✅ `Access-Control-Allow-Credentials: true`
3. Application 탭에서 Cookies 확인
   - ✅ `refresh_token` 쿠키 존재
   - ✅ `csrf_token` 쿠키 존재

### 시나리오 2: 세션 확인 요청 → 쿠키 전송 확인

1. 로그인 성공 후 대시보드 접근
2. Network 탭에서 `GET /api/auth/session` 확인
   - ✅ Request Headers에 `Cookie` 헤더 포함
   - ✅ Response가 `200 OK`이고 `valid: true` 반환

### 시나리오 3: 페이지 새로고침 → 세션 유지 확인

1. 대시보드에서 페이지 새로고침 (F5)
2. Network 탭에서 `GET /api/auth/session` 확인
   - ✅ Request Headers에 `Cookie` 헤더 포함
   - ✅ Response가 `200 OK`이고 `valid: true` 반환
   - ✅ 로그아웃되지 않고 대시보드 유지

## 🐛 문제 발생 시 확인 사항

### 문제 1: `Set-Cookie` 헤더가 Response에 없음

**원인:**
- 백엔드에서 쿠키를 설정하지 않음
- 프록시(Envoy/Next.js middleware)에서 `Set-Cookie` 헤더가 손실됨

**확인 방법:**
1. Next.js middleware 로그 확인:
   ```bash
   pm2 logs limen-frontend --lines 50 | grep "Set-Cookie"
   ```
2. 백엔드 로그 확인 (백엔드 서버에서):
   ```bash
   # 백엔드 로그에서 쿠키 설정 로그 확인
   ```

### 문제 2: 쿠키가 Application 탭에 나타나지 않음

**원인:**
- `SameSite` 설정 문제
- `Secure` 플래그 문제 (HTTPS 필요)
- 도메인/경로 설정 문제

**확인 방법:**
1. Network 탭에서 `Set-Cookie` 헤더의 전체 내용 확인
2. 브라우저 콘솔에서 쿠키 확인:
   ```javascript
   console.log(document.cookie);
   ```

### 문제 3: `GET /api/auth/session` 요청에 쿠키가 없음

**원인:**
- `credentials: 'include'`가 누락됨 (이미 확인 완료 ✅)
- CORS 설정 문제
- 브라우저가 쿠키를 차단함

**확인 방법:**
1. Network 탭에서 Request Headers의 `Cookie` 헤더 확인
2. 브라우저 콘솔에서 쿠키 확인:
   ```javascript
   console.log(document.cookie);
   ```
3. Next.js middleware 로그 확인:
   ```bash
   pm2 logs limen-frontend --lines 50 | grep "session"
   ```

## 📝 Next.js Middleware 로그 확인

세션 관련 요청은 Next.js middleware에서 상세 로깅됩니다:

```bash
# 실시간 로그 확인
pm2 logs limen-frontend --lines 100

# 세션 관련 로그만 필터링
pm2 logs limen-frontend --lines 200 | grep -i "session\|cookie"
```

로그에서 확인할 내용:
- `hasCookies: true/false` - 요청에 쿠키가 포함되어 있는지
- `setCookieCount: N` - 응답에 `Set-Cookie` 헤더가 몇 개인지
- `cookies: ...` - 실제 쿠키 내용 (처음 200자)

## ✅ 예상되는 정상 동작

1. **로그인 시:**
   - `POST /api/auth/login` → `200 OK`
   - Response Headers에 `Set-Cookie` 2개 (refresh_token, csrf_token)
   - Application 탭에 쿠키 2개 저장됨

2. **세션 확인 시:**
   - `GET /api/auth/session` → `200 OK`
   - Request Headers에 `Cookie` 헤더 포함
   - Response에 `{ valid: true, ... }` 반환

3. **페이지 새로고침 시:**
   - `GET /api/auth/session` → `200 OK`
   - 쿠키가 자동으로 전송되어 세션 유지

## 🔗 관련 파일

- `/home/darc/LIMEN/frontend/lib/api/auth.ts` - 로그인 및 세션 API
- `/home/darc/LIMEN/frontend/lib/auth/index.ts` - 세션 확인 로직
- `/home/darc/LIMEN/frontend/lib/api/client.ts` - 일반 API 요청
- `/home/darc/LIMEN/frontend/middleware.ts` - Next.js 프록시 미들웨어
- `/home/darc/LIMEN/frontend/components/LoginForm.tsx` - 로그인 폼



