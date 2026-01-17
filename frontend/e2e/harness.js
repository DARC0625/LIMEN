/**
 * ✅ Hermetic E2E 테스트 전용 Harness
 * 
 * PR Gate hermetic은 "브라우저 + origin + storage + 네트워크"만 쓰고,
 * Next 앱 라우팅/번들/페이지(/login, /dashboard)에 기대지 않음.
 * 
 * 이 harness가 tokenManager 흐름을 직접 호출해서 refresh/정리/브로드캐스트를 발생시킴
 */

// 전역 상태 플래그 (테스트에서 관측 가능)
window.__SESSION_CLEARED = false;
window.__REFRESH_COMPLETED = false;
window.__REDIRECT_TO_LOGIN = null;
window.__REFRESH_CALL_COUNT = 0;

// location.href monkeypatch (리다이렉트 감지)
Object.defineProperty(window.location, 'href', {
  set: function(url) {
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
let broadcastChannel = null;
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
let tokenManagerInstance = null;

async function loadTokenManager() {
  if (tokenManagerInstance) return tokenManagerInstance;
  
  // E2E 테스트 환경에서는 실제 프로덕션 코드를 사용
  // 테스트 코드에서 주입된 tokenManager 사용
  if (window.__TOKEN_MANAGER) {
    tokenManagerInstance = window.__TOKEN_MANAGER;
    console.log('[HARNESS] tokenManager loaded from window.__TOKEN_MANAGER');
    return tokenManagerInstance;
  }
  
  // fallback: 직접 import 시도
  try {
    // 실제 프로덕션 코드 경로 (빌드된 파일 또는 소스)
    const module = await import('/lib/tokenManager.js');
    tokenManagerInstance = module.tokenManager;
    console.log('[HARNESS] tokenManager loaded from import');
    return tokenManagerInstance;
  } catch (error) {
    console.error('[HARNESS] Failed to load tokenManager:', error);
    throw error;
  }
}

/**
 * S4: refresh 실패 시 전역 세션 정리 및 강제 로그아웃
 * 
 * 시나리오:
 * 1. refresh 엔드포인트를 401로 강제 실패
 * 2. tokenManager.getAccessToken() 호출 (자동 refresh 트리거)
 * 3. 기대: 모든 저장소 정리 + /login?reason=... 리다이렉트
 */
window.runS4 = async function() {
  console.log('[HARNESS] runS4: Starting refresh failure test');
  
  try {
    // tokenManager 로드
    const tokenManager = await loadTokenManager();
    
    // 초기 상태 설정
    window.__SESSION_CLEARED = false;
    window.__REDIRECT_TO_LOGIN = null;
    
    // 만료된 토큰 상태로 설정 (refresh 트리거)
    const expiresAt = Date.now() - 1000;
    localStorage.setItem('refresh_token', 'test-refresh-token');
    localStorage.setItem('token_expires_at', expiresAt.toString());
    sessionStorage.setItem('csrf_token', 'test-csrf-token');
    
    // tokenManager.getAccessToken() 호출 → 자동 refresh 시도
    // refresh가 401로 실패하면 clearTokens() 호출됨
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
    // 실제로는 setTimeout으로 지연되므로 약간 대기
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      sessionCleared: window.__SESSION_CLEARED,
      redirectToLogin: window.__REDIRECT_TO_LOGIN,
    };
  } catch (error) {
    console.error('[HARNESS] runS4: Error:', error);
    throw error;
  }
};

/**
 * S3: 멀티탭 동시 refresh 경합 방지 (single-flight)
 * 
 * 시나리오:
 * 1. 같은 context에서 2개 page 생성 (localStorage 공유)
 * 2. 동시에 tokenManager.getAccessToken() 호출 (access token 만료 상태)
 * 3. 기대: refresh 호출 최소화 (single-flight) + 둘 다 정상 토큰 획득
 */
window.runS3 = async function() {
  console.log('[HARNESS] runS3: Starting multi-tab refresh test');
  
  try {
    // tokenManager 로드
    const tokenManager = await loadTokenManager();
    
    // 초기 상태 설정
    window.__REFRESH_COMPLETED = false;
    
    // 만료된 토큰 상태로 설정 (refresh 트리거)
    const expiresAt = Date.now() - 1000;
    localStorage.setItem('refresh_token', 'test-refresh-token');
    localStorage.setItem('token_expires_at', expiresAt.toString());
    sessionStorage.setItem('csrf_token', 'test-csrf-token');
    
    // refresh 호출 카운트 증가 (route handler에서도 증가하지만, 여기서도 추적)
    window.__REFRESH_CALL_COUNT++;
    
    // tokenManager.getAccessToken() 호출 → 자동 refresh 시도
    const accessToken = await tokenManager.getAccessToken();
    
    // refresh 완료 플래그 설정
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
      refreshCompleted: window.__REFRESH_COMPLETED,
    };
  } catch (error) {
    console.error('[HARNESS] runS3: Error:', error);
    throw error;
  }
};

console.log('[HARNESS] Test harness loaded');
