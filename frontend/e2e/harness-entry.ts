/**
 * ✅ Hermetic E2E 테스트 전용 Harness Entry
 * 
 * 이 파일을 esbuild로 IIFE로 번들링하여 window에 전역 함수를 등록
 * 
 * 중요:
 * - export 있으면 안 됨 (IIFE가 아니라 ESM이 됨)
 * - 최상단에서 window.runS3 = 로 명시적으로 붙여야 함
 */

// 전역 상태 플래그 (테스트에서 관측 가능)
// ✅ global.d.ts로 타입 선언되어 있으므로 any 불필요
window.__SESSION_CLEARED = false;
window.__REFRESH_COMPLETED = false;
window.__REDIRECT_TO_LOGIN = null;
window.__REFRESH_CALL_COUNT = 0;

// location.href monkeypatch (리다이렉트 감지)
Object.defineProperty(window.location, 'href', {
  set: function(url: string) {
    if (url.includes('/login')) {
      window.__REDIRECT_TO_LOGIN = url;
      console.log('[HARNESS] location.href set to:', url);
      // 실제 리다이렉트는 하지 않음 (테스트 환경)
    }
  },
  get: function() {
    return window.__CURRENT_URL || 'http://local.test/';
  },
  configurable: true,
});

// BroadcastChannel 메시지 수신 (멀티탭 동기화 감지)
let broadcastChannel: BroadcastChannel | null = null;
if (typeof BroadcastChannel !== 'undefined') {
  broadcastChannel = new BroadcastChannel('token-refresh');
  broadcastChannel.onmessage = (event) => {
    console.log('[HARNESS] BroadcastChannel message received:', event.data);
    if (event.data.type === 'refresh-completed') {
      window.__REFRESH_COMPLETED = true;
    }
  };
}

// tokenManager 인스턴스 (동적 로드)
// ✅ unknown으로 타입 안전성 확보
let tokenManagerInstance: unknown = null;

async function loadTokenManager(): Promise<unknown> {
  if (tokenManagerInstance) return tokenManagerInstance;
  
  // E2E 테스트 환경에서는 실제 프로덕션 코드를 사용
  // 테스트 코드에서 주입된 tokenManager 사용
  if (window.__TOKEN_MANAGER) {
    tokenManagerInstance = window.__TOKEN_MANAGER;
    console.log('[HARNESS] tokenManager loaded from window.__TOKEN_MANAGER');
    return tokenManagerInstance;
  }
  
  // fallback: window.__TOKEN_MANAGER가 없으면 에러
  // (page.setContent()에서는 origin이 없어서 import가 실패할 수 있음)
  throw new Error('tokenManager not found in window.__TOKEN_MANAGER. Make sure to inject tokenManager before calling runS4/runS3.');
}

/**
 * S4: refresh 실패 시 전역 세션 정리 및 강제 로그아웃
 */
window.runS4 = async function() {
  console.log('[HARNESS] runS4: Starting refresh failure test');
  
  try {
    const tokenManager = await loadTokenManager();
    
    window.__SESSION_CLEARED = false;
    window.__REDIRECT_TO_LOGIN = null;
    
    // 만료된 토큰 상태로 설정 (refresh 트리거)
    const expiresAt = Date.now() - 1000;
    localStorage.setItem('refresh_token', 'test-refresh-token');
    localStorage.setItem('token_expires_at', expiresAt.toString());
    sessionStorage.setItem('csrf_token', 'test-csrf-token');
    
    // tokenManager.getAccessToken() 호출 → 자동 refresh 시도
    try {
      await tokenManager.getAccessToken();
    } catch (error) {
      console.log('[HARNESS] runS4: Refresh failed as expected:', error);
    }
    
    // 세션 정리 완료 확인
    const refreshToken = localStorage.getItem('refresh_token');
    const expiresAtAfter = localStorage.getItem('token_expires_at');
    const csrfToken = sessionStorage.getItem('csrf_token');
    
    if (!refreshToken && !expiresAtAfter && !csrfToken) {
      window.__SESSION_CLEARED = true;
      console.log('[HARNESS] runS4: Session cleared successfully');
    }
    
    // 리다이렉트 확인 (tokenManager가 location.href = '/login' 호출)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      sessionCleared: window.__SESSION_CLEARED ?? false,
      redirectToLogin: window.__REDIRECT_TO_LOGIN ?? null,
    };
  } catch (error) {
    console.error('[HARNESS] runS4: Error:', error);
    throw error;
  }
};

/**
 * S3: 멀티탭 동시 refresh 경합 방지 (single-flight)
 */
window.runS3 = async function() {
  console.log('[HARNESS] runS3: Starting multi-tab refresh test');
  
  try {
    const tokenManager = await loadTokenManager();
    
    window.__REFRESH_COMPLETED = false;
    
    // 만료된 토큰 상태로 설정 (refresh 트리거)
    const expiresAt = Date.now() - 1000;
    localStorage.setItem('refresh_token', 'test-refresh-token');
    localStorage.setItem('token_expires_at', expiresAt.toString());
    sessionStorage.setItem('csrf_token', 'test-csrf-token');
    
    window.__REFRESH_CALL_COUNT = (window.__REFRESH_CALL_COUNT ?? 0) + 1;
    
    // tokenManager.getAccessToken() 호출 → 자동 refresh 시도
    // ✅ unknown 타입이므로 타입 가드 필요
    if (tokenManager && typeof tokenManager === 'object' && 'getAccessToken' in tokenManager) {
      const getAccessToken = (tokenManager as { getAccessToken: () => Promise<string> }).getAccessToken;
      const accessToken = await getAccessToken();
      
      window.__REFRESH_COMPLETED = true;
      
      // BroadcastChannel로 다른 탭에 알림
      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'refresh-completed' });
      }
      
      // 최종 토큰 상태 확인
      const refreshToken = localStorage.getItem('refresh_token');
      const expiresAtAfter = localStorage.getItem('token_expires_at');
      
      return {
        accessToken: accessToken ? 'present' : null,
        refreshToken: refreshToken,
        expiresAt: expiresAtAfter,
        refreshCompleted: window.__REFRESH_COMPLETED ?? false,
      };
    } else {
      throw new Error('tokenManager.getAccessToken is not available');
    }
  } catch (error) {
    console.error('[HARNESS] runS3: Error:', error);
    throw error;
  }
};

console.log('[HARNESS] Test harness loaded');
