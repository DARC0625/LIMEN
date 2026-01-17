/**
 * ✅ Hermetic E2E 테스트 전용 Harness Entry
 * 
 * 이 파일을 esbuild로 IIFE로 번들링하여 window에 전역 함수를 등록
 * 
 * 중요:
 * - export 있으면 안 됨 (IIFE가 아니라 ESM이 됨)
 * - 최상단에서 window.runS3 = 로 명시적으로 붙여야 함
 * 
 * ✅ 1) harness-entry 최상단에 "무조건 찍히는 비콘" 박기
 * - window.__HARNESS_LOADED_AT = Date.now() 무조건 설정
 * - try/catch로 감싸서 에러를 window.__HARNESS_ERROR에 저장
 * - 핵심: runS3/runS4 정의 전에 찍히게
 * 
 * ✅ 4) harness-entry를 의존성 0으로 먼저 만들어서 바인딩만 성공
 * - 원인 찾을 때까지는 욕심내지 마
 * - runS3/runS4 내부에서 tokenManager를 쓰더라도, 바인딩 자체는 반드시 성공해야 함
 */

// ✅ 1) harness-entry 최상단에 "무조건 찍히는 비콘" 박기
// window.__HARNESS_LOADED_AT = Date.now() 무조건 설정
// 핵심: runS3/runS4 정의 전에 찍히게
window.__HARNESS_LOADED_AT = Date.now();
window.__HARNESS_ERROR = null;
window.__HARNESS_READY = false;

  // ✅ try/catch로 감싸서 에러를 window.__HARNESS_ERROR에 저장
try {
  // 전역 상태 플래그 (테스트에서 관측 가능)
  // ✅ global.d.ts로 타입 선언되어 있으므로 any 불필요
  window.__SESSION_CLEARED = false;
  window.__REFRESH_COMPLETED = false;
  window.__REFRESH_CALL_COUNT = 0;

  // ✅ 금지: Location 프로퍼티 defineProperty / patch
  // Object.defineProperty(window.location, 'href', ...) 전면 금지
  // 크로스브라우저/향후 브라우저 업데이트에서 더 깨짐
  // 정석 대체안: Playwright 이벤트/라우팅을 관측 (page.waitForURL, page.on('framenavigated'))
  // 또는 window.location.assign/replace를 스파이 (함수만 스파이, href 프로퍼티는 건드리지 않음)

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
  // ✅ T+2h ~ T+6h: harness에 강제 트리거 함수 추가
  // tokenManager.getAccessToken() 또는 await tokenManager.refresh() 등 "반드시 refresh 경로를 타는 호출" 사용
  // runS4/runS3는 "페이지 이동/가짜 API"로 유도하지 말고, tokenManager의 refresh 경로를 강제로 타는 호출로 고정
  
  async function loadTokenManager(): Promise<unknown> {
    if (!window.__TOKEN_MANAGER) {
      throw new Error('tokenManager not found in window.__TOKEN_MANAGER. Make sure to inject tokenManager before calling runS4/runS3.');
    }
    return window.__TOKEN_MANAGER;
  }

  // ✅ 4) harness-entry를 의존성 0으로 먼저 만들어서 바인딩만 성공
  // 원인 찾을 때까지는 욕심내지 마
  // runS3/runS4 내부에서 tokenManager를 쓰더라도, 바인딩 자체는 반드시 성공해야 함
  // 즉, 바인딩은 이렇게라도 먼저 성공:
  
  /**
   * S4: refresh 실패 시 전역 세션 정리 및 강제 로그아웃
   * 
   * ✅ T+2h ~ T+6h: harness에 강제 트리거 함수 추가
   * await tokenManager.getAccessToken() 등 "반드시 refresh 경로를 타는 호출" 사용
   */
  window.runS4 = async function() {
    try {
      const tokenManager = await loadTokenManager();
      
      // ✅ 만료된 토큰 상태로 설정 (refresh 트리거)
      const expiresAt = Date.now() - 1000; // 이미 만료됨
      localStorage.setItem('refresh_token', 'test-refresh-token');
      localStorage.setItem('token_expires_at', expiresAt.toString());
      sessionStorage.setItem('csrf_token', 'test-csrf-token');
      
      window.__SESSION_CLEARED = false;
      
      // ✅ tokenManager.getAccessToken() 호출 → 자동 refresh 시도
      // 만료된 토큰이므로 refreshAccessToken()이 자동으로 호출됨
      if (tokenManager && typeof tokenManager === 'object' && 'getAccessToken' in tokenManager) {
        const getAccessToken = (tokenManager as { getAccessToken: () => Promise<string | null> }).getAccessToken;
        try {
          await getAccessToken();
        } catch (error) {
          console.log('[HARNESS] runS4: Refresh failed as expected:', error);
        }
      } else {
        throw new Error('tokenManager.getAccessToken is not available');
      }
      
      // 세션 정리 완료 확인
      const refreshToken = localStorage.getItem('refresh_token');
      const expiresAtAfter = localStorage.getItem('token_expires_at');
      const csrfToken = sessionStorage.getItem('csrf_token');
      
      if (!refreshToken && !expiresAtAfter && !csrfToken) {
        window.__SESSION_CLEARED = true;
        console.log('[HARNESS] runS4: Session cleared successfully');
      }
      
      return {
        sessionCleared: window.__SESSION_CLEARED ?? false,
      };
    } catch (error) {
      console.error('[HARNESS] runS4: Error:', error);
      throw error;
    }
  };

  /**
   * S3: 멀티탭 동시 refresh 경합 방지 (single-flight)
   * 
   * ✅ T+2h ~ T+6h: harness에 강제 트리거 함수 추가
   * page1/page2에서 동시에 동일 트리거 호출
   * await tokenManager.getAccessToken() 등 "반드시 refresh 경로를 타는 호출" 사용
   */
  window.runS3 = async function() {
    try {
      const tokenManager = await loadTokenManager();
      
      window.__REFRESH_COMPLETED = false;
      
      // ✅ 만료된 토큰 상태로 설정 (refresh 트리거)
      const expiresAt = Date.now() - 1000; // 이미 만료됨
      localStorage.setItem('refresh_token', 'test-refresh-token');
      localStorage.setItem('token_expires_at', expiresAt.toString());
      sessionStorage.setItem('csrf_token', 'test-csrf-token');
      
      window.__REFRESH_CALL_COUNT = (window.__REFRESH_CALL_COUNT ?? 0) + 1;
      
      // ✅ tokenManager.getAccessToken() 호출 → 자동 refresh 시도
      // 만료된 토큰이므로 refreshAccessToken()이 자동으로 호출됨
      if (tokenManager && typeof tokenManager === 'object' && 'getAccessToken' in tokenManager) {
        const getAccessToken = (tokenManager as { getAccessToken: () => Promise<string | null> }).getAccessToken;
        const accessToken = await getAccessToken();
        
        window.__REFRESH_COMPLETED = true;
        
        // BroadcastChannel로 다른 탭에 알림
        if (typeof BroadcastChannel !== 'undefined') {
          const broadcastChannel = new BroadcastChannel('token-refresh');
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

  // ✅ 바인딩 완료 플래그
  window.__HARNESS_READY = true;
  console.log('[HARNESS] Test harness loaded');
} catch (e) {
  // ✅ try/catch로 감싸서 에러를 window.__HARNESS_ERROR에 저장
  window.__HARNESS_ERROR = String(e);
  console.error('[HARNESS] Error during harness initialization:', e);
}
