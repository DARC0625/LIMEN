# 프론트엔드 NetworkError 해결 가이드

## 문제 상황

프론트엔드에서 `NetworkError when attempting to fetch resource` 에러가 반복적으로 발생하는 경우, 다음을 확인해야 합니다.

## 원인 분석

### 1. 무한 재시도 루프

**증상**: 동일한 에러가 수십 번 반복됨

**원인**: 
- 에러 발생 시 자동 재시도 로직이 무한 반복
- 재시도 간격이 너무 짧음
- 최대 재시도 횟수 제한 없음

**해결 방법**:

```typescript
// ❌ 잘못된 예시: 무한 재시도
async function checkVMStatus(vmUUID: string) {
  try {
    const response = await fetch(`/api/vms/${vmUUID}`);
    return await response.json();
  } catch (error) {
    // 무한 재시도 - 문제!
    setTimeout(() => checkVMStatus(vmUUID), 1000);
  }
}

// ✅ 올바른 예시: 최대 재시도 횟수 제한
async function checkVMStatus(
  vmUUID: string,
  maxRetries: number = 3,
  retryCount: number = 0
): Promise<any> {
  try {
    const response = await fetch(`/api/vms/${vmUUID}`, {
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    if (retryCount >= maxRetries) {
      console.error('Max retries reached:', error);
      throw error;
    }
    
    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, retryCount) * 1000;
    console.warn(`Retry ${retryCount + 1}/${maxRetries} after ${delay}ms`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return checkVMStatus(vmUUID, maxRetries, retryCount + 1);
  }
}
```

### 2. CORS 문제

**증상**: NetworkError 발생, 브라우저 콘솔에 CORS 관련 에러

**원인**:
- `credentials: 'include'` 없이 쿠키 전송 시도
- 잘못된 Origin 헤더
- CORS preflight 실패

**해결 방법**:

```typescript
// ✅ 올바른 fetch 설정
const response = await fetch(`/api/vms/${vmUUID}`, {
  method: 'GET',
  credentials: 'include', // 쿠키 전송 필수
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken // CSRF 토큰 필요 시
  }
});
```

### 3. 인증 토큰 문제

**증상**: 401 Unauthorized 후 NetworkError

**원인**:
- Access token 만료
- 토큰이 올바르게 전송되지 않음
- refresh_token 쿠키 없음

**해결 방법**:

```typescript
// ✅ 토큰 갱신 로직 포함
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  let accessToken = getAccessToken();
  
  // 첫 시도
  let response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  // 401 에러 시 토큰 갱신 후 재시도
  if (response.status === 401) {
    try {
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        accessToken = data.access_token;
        setAccessToken(accessToken);
        
        // 갱신된 토큰으로 재시도
        response = await fetch(url, {
          ...options,
          credentials: 'include',
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${accessToken}`
          }
        });
      } else {
        // 토큰 갱신 실패 - 로그인 페이지로 리다이렉트
        window.location.href = '/login';
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      window.location.href = '/login';
      throw error;
    }
  }
  
  return response;
}
```

### 4. 네트워크 연결 문제

**증상**: 간헐적 NetworkError

**원인**:
- 서버 다운
- 네트워크 불안정
- 타임아웃

**해결 방법**:

```typescript
// ✅ 타임아웃 설정
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}
```

### 5. 잘못된 URL

**증상**: NetworkError, 404 에러

**원인**:
- 잘못된 엔드포인트 경로
- 잘못된 쿼리 파라미터

**해결 방법**:

```typescript
// ✅ 올바른 API 엔드포인트 사용
// VM 상태 확인
const response = await fetch(`/api/vms/${vmUUID}`, {
  credentials: 'include',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

// VM 목록 조회
const response = await fetch('/api/vms', {
  credentials: 'include',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

## 권장 구현 패턴

### 완전한 예시: VM 상태 확인

```typescript
interface VMStatus {
  id: number;
  uuid: string;
  name: string;
  status: string;
  // ...
}

class VMService {
  private maxRetries = 3;
  private retryDelay = 1000; // 1초
  
  async getVMStatus(vmUUID: string): Promise<VMStatus> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const accessToken = this.getAccessToken();
        
        const response = await this.fetchWithTimeout(
          `/api/vms/${vmUUID}`,
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          },
          10000 // 10초 타임아웃
        );
        
        if (response.status === 401) {
          // 토큰 갱신 시도
          await this.refreshToken();
          continue; // 재시도
        }
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        lastError = error as Error;
        console.warn(`VM status check attempt ${attempt + 1} failed:`, error);
        
        // 마지막 시도가 아니면 대기
        if (attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }
    
    // 모든 재시도 실패
    throw new Error(`Failed to get VM status after ${this.maxRetries} attempts: ${lastError?.message}`);
  }
  
  private async refreshToken(): Promise<void> {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Token refresh failed');
    }
    
    const data = await response.json();
    this.setAccessToken(data.access_token);
  }
  
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private getAccessToken(): string {
    // localStorage나 state에서 가져오기
    return localStorage.getItem('access_token') || '';
  }
  
  private setAccessToken(token: string): void {
    localStorage.setItem('access_token', token);
  }
}
```

## 디버깅 방법

### 1. 네트워크 탭 확인

브라우저 개발자 도구 → Network 탭에서:
- 요청이 실제로 전송되는지 확인
- 응답 상태 코드 확인 (200, 401, 404, 500 등)
- 요청 헤더 확인 (Authorization, Cookie 등)
- 응답 헤더 확인 (CORS 관련 헤더)

### 2. 콘솔 로그 확인

```typescript
// 상세한 로깅 추가
async function checkVMStatus(vmUUID: string) {
  console.log('[VM Status] Starting check for:', vmUUID);
  
  try {
    const url = `/api/vms/${vmUUID}`;
    console.log('[VM Status] Request URL:', url);
    
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    console.log('[VM Status] Response status:', response.status);
    console.log('[VM Status] Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[VM Status] Error response:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('[VM Status] Success:', data);
    return data;
  } catch (error) {
    console.error('[VM Status] Fetch error:', error);
    throw error;
  }
}
```

### 3. 백엔드 로그 확인

백엔드 서버 로그에서 요청이 도착하는지 확인:

```bash
# 실시간 로그 확인
tail -f /tmp/limen-server.log | grep -E "(GET /api/vms|VM status|error)"

# 또는 systemd 서비스인 경우
journalctl -u limen-backend -f | grep -E "(GET /api/vms|VM status|error)"
```

## 체크리스트

프론트엔드 개발자가 확인해야 할 사항:

- [ ] `credentials: 'include'` 옵션 사용
- [ ] Authorization header에 올바른 토큰 전송
- [ ] 최대 재시도 횟수 제한 (3-5회 권장)
- [ ] Exponential backoff 사용 (1s, 2s, 4s, ...)
- [ ] 타임아웃 설정 (10초 권장)
- [ ] 401 에러 시 토큰 갱신 로직
- [ ] 에러 발생 시 무한 재시도 방지
- [ ] 사용자에게 에러 메시지 표시
- [ ] 네트워크 탭에서 실제 요청 확인
- [ ] 백엔드 로그에서 요청 도착 확인

## 추가 리소스

- [VNC 연결 가이드](./VNC_CONNECTION_GUIDE.md)
- [인증 시스템 문서](./AUTHENTICATION.md)
- [API 문서](./API_DOCUMENTATION.md)

