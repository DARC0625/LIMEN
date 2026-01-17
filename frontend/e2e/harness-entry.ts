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
  // ✅ 4) harness-entry를 의존성 0으로 먼저 만들어서 바인딩만 성공
  // 원인 찾을 때까지는 욕심내지 마
  // runS3/runS4 내부에서 tokenManager를 쓰더라도, 바인딩 자체는 반드시 성공해야 함
  // 지금은 의존성 0으로 만들었으므로 loadTokenManager는 나중에 사용
  // (의존성 0 단계에서는 사용하지 않으므로 주석 처리)
  /*
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
  */

  // ✅ 4) harness-entry를 의존성 0으로 먼저 만들어서 바인딩만 성공
  // 원인 찾을 때까지는 욕심내지 마
  // runS3/runS4 내부에서 tokenManager를 쓰더라도, 바인딩 자체는 반드시 성공해야 함
  // 즉, 바인딩은 이렇게라도 먼저 성공:
  
  /**
   * S4: refresh 실패 시 전역 세션 정리 및 강제 로그아웃
   * 
   * ✅ 의존성 0으로 먼저 바인딩만 성공시키기
   * 나중에 tokenManager 연동 로직을 붙임
   */
  window.runS4 = async function() {
    // ✅ 의존성 0으로 먼저 바인딩만 성공
    // 원인 찾을 때까지는 욕심내지 마
    // runS3/runS4 내부에서 tokenManager를 쓰더라도, 바인딩 자체는 반드시 성공해야 함
    // ✅ redirectToLogin 제거 (location.href 재정의 금지)
    // URL 검증은 Playwright API로: page.waitForURL() 또는 expect(page).toHaveURL()
    return {
      sessionCleared: false,
    };
  };

  /**
   * S3: 멀티탭 동시 refresh 경합 방지 (single-flight)
   * 
   * ✅ 의존성 0으로 먼저 바인딩만 성공시키기
   * 나중에 tokenManager 연동 로직을 붙임
   */
  window.runS3 = async function() {
    // ✅ 의존성 0으로 먼저 바인딩만 성공
    // 원인 찾을 때까지는 욕심내지 마
    // runS3/runS4 내부에서 tokenManager를 쓰더라도, 바인딩 자체는 반드시 성공해야 함
    return {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      refreshCompleted: false,
    };
  };

  // ✅ 바인딩 완료 플래그
  window.__HARNESS_READY = true;
  console.log('[HARNESS] Test harness loaded');
} catch (e) {
  // ✅ try/catch로 감싸서 에러를 window.__HARNESS_ERROR에 저장
  window.__HARNESS_ERROR = String(e);
  console.error('[HARNESS] Error during harness initialization:', e);
}
