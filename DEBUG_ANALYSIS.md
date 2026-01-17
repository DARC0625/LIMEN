# S4 테스트 실패 원인 분석

## 현재 상황
- `clearSessionCalledCount === 0` → `clearTokens()`가 호출되지 않음
- 테스트는 정상적으로 실행됨 (harness 로드, runS4 호출)

## 코드 분석 결과

### 1️⃣ refresh 응답이 정말 401이냐?

**확인 위치**: `frontend/lib/api/auth.ts:283`
```typescript
if (!response.ok) {
  const errorData = await response.json().catch(() => ({ message: 'Token refresh failed' }));
  logger.error(...);
  throw new Error(errorData.message || 'Token refresh failed');
}
```

✅ **authAPI.refreshToken()은 이미 `res.ok` 체크를 하고 throw함**

**테스트 설정**: `frontend/e2e/token-refresh.spec.ts:190`
```typescript
await route.fulfill({
  status: 401,
  contentType: 'application/json',
  body: JSON.stringify({ 
    error: 'Invalid or expired refresh token',
    message: 'Token refresh failed'
  }),
});
```

✅ **테스트에서 401을 반환하도록 설정됨**

### 2️⃣ tokenManager가 "실패"를 실패로 인식하나?

**확인 위치**: `frontend/lib/tokenManager.ts:159-218`

```typescript
private async refreshAccessToken(): Promise<string> {
  try {
    const { authAPI } = await import('./api/auth');
    const data = await authAPI.refreshToken(this.refreshToken); // ← 여기서 throw되면 catch로
    // ...
  } catch (error) {
    logger.error(...);
    this.clearTokens(); // ← 여기서 호출되어야 함
    // ...
    throw error;
  } finally {
    this.refreshPromise = null;
  }
}
```

✅ **catch에서 `clearTokens()` 호출하고 있음**

**문제 가능성**: `getAccessToken()`에서 `refreshAccessToken()`이 호출되지 않았을 수 있음

**확인 위치**: `frontend/lib/tokenManager.ts:118-156`
```typescript
async getAccessToken(): Promise<string | null> {
  // Access Token이 유효하면 반환
  if (this.accessToken && this.expiresAt > Date.now() + 60000) {
    return this.accessToken; // ← 여기서 리턴되면 refreshAccessToken() 호출 안 됨
  }
  
  // Refresh Token이 없으면 null
  if (!this.refreshToken) {
    return null; // ← 여기서 리턴되면 refreshAccessToken() 호출 안 됨
  }
  
  // 이미 갱신 중이면 대기
  if (this.refreshPromise) {
    return this.refreshPromise; // ← 여기서 리턴되면 refreshAccessToken() 호출 안 됨
  }
  
  // 토큰 갱신
  this.refreshPromise = this.refreshAccessToken();
  // ...
}
```

### 3️⃣ 실패 후 토큰이 "다시 살아나는 경로"가 있나?

**확인 필요**: snapshot A/B 비교

## 핵심 문제 추정

**가장 유력한 원인**: `getAccessToken()`이 `refreshAccessToken()`을 호출하지 않음

**가능한 시나리오**:
1. `this.accessToken`이 존재하고 유효함 (만료되지 않음)
2. `this.refreshToken`이 null임
3. `this.refreshPromise`가 이미 존재함

**테스트 설정 확인 필요**: `harness-entry.ts`에서 `setRefreshToken()`과 `setExpiresAt()`을 호출하지만, `accessToken`이 이미 유효한 상태일 수 있음.

## 다음 단계

1. `getAccessToken()` 호출 전에 `accessToken` 상태 확인
2. `refreshAccessToken()`이 실제로 호출되는지 확인 (로그 추가)
3. `authAPI.refreshToken()`이 실제로 401을 받는지 확인 (로그 추가)
