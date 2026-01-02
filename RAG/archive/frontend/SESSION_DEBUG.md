# 세션 문제 디버깅 가이드

## 문제 현상
- 로그인 후 401 Unauthorized 에러 발생
- 세션이 생성되지 않거나 확인되지 않음
- React Error #321 발생

## 진단 방법

### 1. 브라우저 콘솔 로그 확인
로그인 시도 후 다음 로그를 확인:

#### 세션 생성 단계
```
[LoginForm] Creating session with tokens...
[authAPI.createSession] Creating session: { ... }
[Proxy] POST /api/auth/session -> http://10.0.0.100:18443/api/auth/session
[Proxy] POST /api/auth/session -> 200/201/401/500 (duration)
[LoginForm] Session created successfully
```

#### 세션 확인 단계
```
[LoginForm] Session not ready yet (attempt 1/25)
[checkBackendSession] Checking session: { ... }
[Proxy] GET /api/auth/session -> http://10.0.0.100:18443/api/auth/session
[checkBackendSession] Session check response: { status: 200/401, ... }
[LoginForm] Session verified successfully
```

### 2. PM2 로그 확인
```bash
pm2 logs limen-frontend | grep -E "Proxy|session|Session|auth"
```

세션 관련 요청은 상세 로깅됩니다:
- 쿠키 전달 여부
- Set-Cookie 헤더
- 응답 상태 및 데이터

### 3. 백엔드 로그 확인
백엔드 서버에서 세션 생성/확인 로그 확인:
```bash
# 백엔드 로그 확인
tail -f /path/to/backend/logs | grep -E "session|auth"
```

## 가능한 원인

### 1. 세션 생성 실패
**증상**: `[LoginForm] Session creation failed`
**원인**:
- 백엔드 API 엔드포인트 문제
- CSRF 토큰 문제
- Authorization 헤더 문제
- 네트워크 연결 문제

**해결**:
- PM2 로그에서 실제 HTTP 상태 코드 확인
- 백엔드 로그 확인
- 네트워크 연결 테스트: `curl -v http://10.0.0.100:18443/api/auth/session`

### 2. 쿠키 전달 실패
**증상**: 세션 생성은 성공하지만 확인 실패
**원인**:
- Set-Cookie 헤더가 전달되지 않음
- 쿠키 도메인/경로 설정 문제
- SameSite/Secure 설정 문제

**해결**:
- PM2 로그에서 `setCookieCount` 확인
- 브라우저 개발자 도구에서 쿠키 확인
- 백엔드 Set-Cookie 헤더 확인

### 3. 세션 확인 실패
**증상**: `[checkBackendSession] Session not valid (401/403)`
**원인**:
- 쿠키가 백엔드로 전달되지 않음
- 세션이 만료됨
- 백엔드 세션 저장소 문제

**해결**:
- PM2 로그에서 쿠키 전달 여부 확인
- 브라우저 개발자 도구에서 쿠키 확인
- 백엔드 세션 저장소 확인

### 4. React Error #321
**증상**: 무한 렌더링 루프
**원인**:
- 상태 업데이트 중 의존성 순환
- useEffect 무한 루프

**해결**:
- AuthGuard의 의존성 배열 확인
- `isAuthenticatedRef` 사용 확인
- `startTransition` 사용 확인

## 현재 구현

### 세션 생성 플로우
1. 로그인 성공 → 토큰 받음
2. `tokenManager.setTokens()` → 토큰 저장
3. `authAPI.createSession()` → 백엔드 세션 생성
4. 세션 확인 (최대 5초, 25회 재시도)
5. 성공 시 대시보드로 이동

### 세션 확인 플로우
1. `checkAuth()` 호출
2. `tokenManager.getAccessToken()` → Access Token 가져오기
3. `checkBackendSession()` → 백엔드 세션 확인
4. 성공 시 `{ valid: true }` 반환

## 다음 단계

1. **로그인 시도 후 브라우저 콘솔 확인**
   - 세션 생성 로그
   - 세션 확인 로그
   - 에러 메시지

2. **PM2 로그 확인**
   ```bash
   pm2 logs limen-frontend --lines 100 | grep -E "session|Session|auth"
   ```

3. **백엔드 로그 확인**
   - 세션 생성 요청 수신 여부
   - 세션 생성 성공/실패
   - 세션 확인 요청 수신 여부

4. **네트워크 테스트**
   ```bash
   # 프론트엔드 서버에서 직접 테스트
   curl -v -X POST http://10.0.0.100:18443/api/auth/session \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer {token}" \
     -d '{"access_token":"...","refresh_token":"..."}'
   ```

## 예상되는 문제

### 백엔드 API 엔드포인트 불일치
- 프론트엔드: `POST /api/auth/session`
- 백엔드: `POST /auth/session` (prefix 제거 필요)

### 쿠키 설정 문제
- 백엔드에서 Set-Cookie 헤더를 제대로 설정하지 않음
- 도메인/경로 설정이 잘못됨

### CSRF 토큰 문제
- 백엔드에서 CSRF 토큰 검증 실패
- 프론트엔드에서 CSRF 토큰 생성/전달 실패




