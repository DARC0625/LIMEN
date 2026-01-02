# 쿠키 전송 문제 해결 가이드

## 현재 상황
- 백엔드에서 `SameSite=Lax`, `Domain=""` 설정 완료
- 프론트엔드에서 `credentials: 'include'` 설정 확인
- 하지만 `GET /api/auth/session` 요청에 쿠키가 전송되지 않음

## 확인 사항

### 1. 로그인 후 쿠키 저장 확인

#### 브라우저 개발자 도구에서 확인
1. **Application 탭** → **Cookies** → `limen.kr`
2. 로그인 후 다음 쿠키가 있는지 확인:
   - `refresh_token` (HttpOnly, Secure, SameSite=Lax)
   - 기타 세션 쿠키

#### 로그인 요청 응답 확인
1. **Network 탭** → `POST /api/auth/login` 요청 클릭
2. **Response Headers** 탭에서 `Set-Cookie` 헤더 확인:
   ```
   Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Lax; Path=/; Domain=
   ```

### 2. 세션 체크 요청 확인

#### Request Headers 확인
1. **Network 탭** → `GET /api/auth/session` 요청 클릭
2. **Request Headers** 탭에서 다음 확인:
   - `Cookie` 헤더가 있는지
   - `Cookie` 헤더에 `refresh_token`이 포함되어 있는지

#### 쿠키 탭 확인
1. **Network 탭** → `GET /api/auth/session` 요청 클릭
2. **Cookies** 탭에서:
   - "이 요청에는 쿠키가 없음" 메시지가 나오면 쿠키가 전송되지 않은 것

### 3. 가능한 원인 및 해결

#### 원인 1: 로그인 후 쿠키가 설정되지 않음
**증상**: 로그인 후에도 `Application` → `Cookies`에 `refresh_token`이 없음

**해결**:
- 백엔드 로그 확인: `HandleLogin`에서 `Set-Cookie` 헤더가 제대로 설정되는지
- 프록시(Envoy)가 `Set-Cookie` 헤더를 제거하지 않는지 확인

#### 원인 2: 쿠키 Domain/Path 설정 문제
**증상**: 쿠키는 있지만 세션 요청에 전송되지 않음

**확인**:
- 쿠키의 `Domain` 속성이 `limen.kr` 또는 비어있어야 함
- 쿠키의 `Path` 속성이 `/` 또는 `/api`여야 함
- 쿠키의 `SameSite` 속성이 `Lax` 또는 `None`이어야 함

**해결**:
- 백엔드에서 `Domain=""` 설정 확인 (빈 문자열 = 현재 도메인)
- 백엔드에서 `Path="/"` 설정 확인

#### 원인 3: Secure 쿠키가 HTTP에서 설정됨
**증상**: HTTPS가 아닌 환경에서 `Secure` 쿠키가 설정되지 않음

**확인**:
- 현재 URL이 `https://limen.kr`인지 확인
- `Secure` 쿠키는 HTTPS에서만 설정됨

**해결**:
- HTTPS 사용 확인
- 개발 환경에서는 `Secure` 플래그 제거 고려

#### 원인 4: 브라우저 쿠키 정책
**증상**: 쿠키는 있지만 전송되지 않음

**확인**:
- 브라우저 설정에서 쿠키가 차단되지 않았는지
- 시크릿 모드/프라이빗 모드에서 테스트
- 다른 브라우저에서 테스트

#### 원인 5: credentials: 'include' 누락
**증상**: 쿠키는 있지만 요청에 포함되지 않음

**확인**:
- `lib/auth/index.ts`의 `checkBackendSession` 함수에서 `credentials: 'include'` 확인
- `lib/api/client.ts`의 `apiRequest` 함수에서 `credentials: 'include'` 확인

**해결**:
- 모든 fetch 요청에 `credentials: 'include'` 추가 확인

### 4. 디버깅 단계

#### Step 1: 로그인 후 쿠키 확인
```javascript
// 브라우저 콘솔에서 실행
document.cookie
// 또는
// Application 탭 → Cookies → limen.kr 확인
```

#### Step 2: 세션 체크 요청 수동 테스트
```javascript
// 브라우저 콘솔에서 실행
fetch('/api/auth/session', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
})
  .then(r => {
    console.log('Status:', r.status);
    console.log('Headers:', [...r.headers.entries()]);
    return r.json();
  })
  .then(data => console.log('Response:', data))
  .catch(err => console.error('Error:', err));
```

#### Step 3: 네트워크 요청 상세 확인
1. **Network 탭** → `GET /api/auth/session` 요청 우클릭
2. **Copy** → **Copy as cURL** 선택
3. cURL 명령어에서 `Cookie` 헤더 확인

### 5. 백엔드 확인 사항

#### 로그인 응답 확인
```bash
# 백엔드 로그에서 확인
# HandleLogin에서 Set-Cookie 헤더가 제대로 설정되는지
```

#### 세션 체크 요청 확인
```bash
# 백엔드 로그에서 확인
# HandleGetSession에서 Cookie 헤더가 제대로 수신되는지
# has_refresh_token_cookie 값 확인
```

### 6. 프록시(Envoy) 확인 사항

#### Set-Cookie 헤더 전달 확인
- Envoy가 `Set-Cookie` 헤더를 제거하지 않는지 확인
- Envoy 로그에서 `Set-Cookie` 헤더 확인

#### Cookie 헤더 전달 확인
- Envoy가 `Cookie` 헤더를 백엔드로 전달하는지 확인
- Envoy 로그에서 `Cookie` 헤더 확인

## 예상 해결 방법

### 방법 1: 로그인 후 쿠키 확인 대기
로그인 후 쿠키가 설정되기 전에 세션 체크를 하지 않도록 대기 시간 추가

### 방법 2: 쿠키 Domain/Path 명시적 설정
백엔드에서 `Domain="limen.kr"`, `Path="/"` 명시적 설정

### 방법 3: 프록시 헤더 전달 확인
Envoy 설정에서 `Set-Cookie` 및 `Cookie` 헤더 전달 확인

## 다음 단계

1. **로그인 후 쿠키 확인**: 브라우저 `Application` → `Cookies`에서 `refresh_token` 확인
2. **세션 요청 쿠키 확인**: `Network` → `GET /api/auth/session` → `Cookies` 탭 확인
3. **백엔드 로그 확인**: `has_refresh_token_cookie` 값 확인
4. **프록시 로그 확인**: Envoy가 헤더를 제대로 전달하는지 확인




