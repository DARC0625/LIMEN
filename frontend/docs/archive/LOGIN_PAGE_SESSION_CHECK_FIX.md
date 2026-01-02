# 로그인 페이지 세션 체크 요청 제거

## 문제

로그인 페이지에서도 세션 체크 요청(`GET /api/auth/session`)이 발생하여 불필요한 검증이 수행됨.

## 해결 방법

### 백엔드 변경 사항

백엔드에서 로그인 페이지에서 세션 체크 요청이 오면 조기 반환하도록 수정:

- **Referer 헤더 확인**으로 로그인 페이지 감지
- **로그인 페이지 + refresh_token 없음** → 조기 반환 (불필요한 검증 스킵)
- 로그인 페이지 플래그와 Referer 로깅 추가

**동작 방식:**
- 로그인 페이지에서 세션 체크 요청:
  - Referer에 `/login` 포함
  - refresh_token 없음
  - → 즉시 `{ "valid": false, "reason": "로그인이 필요합니다." }` 반환

### 프론트엔드 변경 사항

프론트엔드에서도 로그인 페이지에서는 세션 체크 요청을 보내지 않도록 수정:

#### 1. `AuthGuard.tsx` - 초기 인증 확인

```typescript
// 공개 경로(로그인, 회원가입)에서는 세션 확인 요청을 보내지 않음
// 로그인 전에는 세션이 없을 것이므로 불필요한 요청 방지
if (isPublicPath) {
  isAuthenticatedRef.current = false;
  queueMicrotask(() => {
    initialAuthCheckDone = true;
    setMounted(true);
    startTransition(() => {
      setIsAuthenticated(false);
    });
  });
  return;
}
```

#### 2. `AuthGuard.tsx` - Storage 이벤트 핸들러

```typescript
const handleStorageChange = async (e: StorageEvent) => {
  if (e.key === 'auth_token' || e.key === 'auth_token_timestamp') {
    // 공개 경로에서는 세션 확인 요청을 보내지 않음
    if (isPublicPath) {
      return;
    }
    // ... 세션 확인 로직
  }
};
```

#### 3. `AuthGuard.tsx` - 토큰 업데이트 핸들러

```typescript
const handleTokenUpdate = async () => {
  // 공개 경로에서는 세션 확인 요청을 보내지 않음
  if (isPublicPath) {
    return;
  }
  // ... 세션 확인 로직
};
```

#### 4. `AuthGuard.tsx` - 주기적 세션 체크

```typescript
const sessionCheckInterval = setInterval(async () => {
  // 공개 경로에서는 세션 확인 요청을 보내지 않음
  if (isPublicPath) {
    return;
  }
  // ... 세션 확인 로직
}, 5 * 60 * 1000);
```

## 동작 방식

### 로그인 페이지 (`/login`, `/register`)

1. **초기 로드:**
   - `AuthGuard`가 `isPublicPath = true` 확인
   - 세션 확인 요청(`checkAuth()`) **스킵**
   - `isAuthenticated = false`로 설정
   - 로그인 폼 표시

2. **Storage 이벤트:**
   - 다른 탭에서 로그인/로그아웃 발생 시
   - 공개 경로에서는 세션 확인 요청 **스킵**

3. **주기적 세션 체크:**
   - 5분마다 실행되는 세션 체크
   - 공개 경로에서는 **스킵**

### 로그인 후 세션 확인 (LoginForm.tsx)

`LoginForm.tsx`에서 로그인 성공 후 세션 생성 확인을 위해 세션 체크를 하는 것은 **정상**입니다:

```typescript
// 로그인 성공 후 세션 생성 확인
const sessionCheck = await fetch('/api/auth/session', {
  method: 'GET',
  credentials: 'include',
  // ...
});
```

이 경우:
- 이미 로그인 성공 후이므로 `refresh_token` 쿠키가 있음
- 백엔드에서 정상적으로 세션 정보 반환
- 세션 생성 확인을 위한 필수 요청

### 인증이 필요한 페이지

1. **초기 로드:**
   - `AuthGuard`가 `isPublicPath = false` 확인
   - 세션 확인 요청(`checkAuth()`) **실행**
   - 세션 유효성 확인 후 페이지 표시

2. **Storage 이벤트:**
   - 다른 탭에서 로그인/로그아웃 발생 시
   - 세션 확인 요청 **실행**

3. **주기적 세션 체크:**
   - 5분마다 실행되는 세션 체크
   - 세션 만료 시 자동 로그아웃

## 확인 방법

### 1. 브라우저 개발자 도구 - Network 탭

1. 로그인 페이지(`/login`) 접속
2. Network 탭 확인
3. **`GET /api/auth/session` 요청이 없어야 함** ✅

### 2. 로그인 후 대시보드 접속

1. 로그인 성공
2. 대시보드 접속
3. Network 탭 확인
4. **`GET /api/auth/session` 요청이 있어야 함** ✅
5. Response: `200 OK` 및 `{ "valid": true, ... }` 반환

### 3. Next.js Middleware 로그 확인

```bash
# 로그인 페이지 접속 시 세션 요청이 없는지 확인
pm2 logs limen-frontend --lines 50 | grep "session"

# 로그인 페이지에서는 세션 관련 로그가 없어야 함
```

## 예상되는 정상 동작

### 로그인 페이지 접속 시

- ✅ `GET /api/auth/session` 요청 **없음**
- ✅ 로그인 폼만 표시
- ✅ 불필요한 네트워크 요청 없음

### 로그인 성공 후

- ✅ `POST /api/auth/login` → `200 OK`
- ✅ `POST /api/auth/session` → 세션 생성
- ✅ `GET /api/auth/session` → 세션 확인 (로그인 폼 내부에서)
- ✅ 대시보드로 이동

### 대시보드 접속 시

- ✅ `GET /api/auth/session` → `200 OK` (AuthGuard에서)
- ✅ 세션 유효성 확인 후 대시보드 표시

## 관련 파일

- `/home/darc/LIMEN/frontend/components/AuthGuard.tsx` - 인증 가드 (수정 완료)
- `/home/darc/LIMEN/frontend/components/LoginForm.tsx` - 로그인 폼 (로그인 후 세션 확인은 정상)
- `/home/darc/LIMEN/frontend/lib/auth/index.ts` - 세션 확인 로직

## 백엔드와의 협력

백엔드에서도 Referer 헤더를 확인하여 로그인 페이지에서 오는 요청을 조기 반환하도록 처리했으므로, 이중 방어가 적용되었습니다:

1. **프론트엔드**: 로그인 페이지에서는 세션 확인 요청을 보내지 않음
2. **백엔드**: 혹시 모를 경우를 대비해 로그인 페이지에서 오는 요청을 조기 반환

이렇게 하면 불필요한 네트워크 요청과 서버 부하를 최소화할 수 있습니다.



