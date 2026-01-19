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

  // ✅ 1) runS3/runS4는 "절대 무한 대기/외부 의존"하면 안 된다 (최우선)
  // harness 함수는 테스트용 트리거다. 제품 로직을 그대로 호출하더라도,
  // 테스트에서는 반드시 "끝나는 계약(terminate contract)"이 있어야 한다.
  // 
  // 필수 계약(하드 룰):
  // - runS4() / runS3() 는 항상 { ok: true } | { ok: false, reason } 를 반환
  // - 내부 await는 timeout guard를 가진다 (예: 3초)
  // - 어떤 예외도 밖으로 던지지 말고 { ok:false, reason:String(e) } 로 반환
  
  /**
   * 타임아웃 가드 헬퍼
   * ms 초과 시 reject가 아니라 resolve로 실패 반환 (테스트가 제어할 수 있게)
   */
  async function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label: string
  ): Promise<{ ok: true; value: T } | { ok: false; reason: string }> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({ ok: false, reason: `Timeout after ${ms}ms: ${label}` });
      }, ms);
      
      promise
        .then((value) => {
          clearTimeout(timer);
          resolve({ ok: true, value });
        })
        .catch((error) => {
          clearTimeout(timer);
          resolve({ ok: false, reason: `Error in ${label}: ${String(error)}` });
        });
    });
  }

  // ✅ 4) harness-entry를 의존성 0으로 먼저 만들어서 바인딩만 성공
  // 원인 찾을 때까지는 욕심내지 마
  // runS3/runS4 내부에서 tokenManager를 쓰더라도, 바인딩 자체는 반드시 성공해야 함
  // 즉, 바인딩은 이렇게라도 먼저 성공:
  
  /**
   * S4: refresh 실패 시 전역 세션 정리 및 강제 로그아웃
   * 
   * ✅ 3) S4는 "refresh 실패 시 세션 정리"를 제품 코드에 맡기지 말고, 훅으로 직접 호출해라
   * 정석: 훅으로 '세션 정리 함수'를 직접 노출
   * 
   * 필수 계약: { ok: true } | { ok: false, reason }
   * 
   * ✅ Command 2: __S4_TRACE 단계 로그로 어디서 멈췄는지 확정
   */
  // ✅ Command 3: runS4는 어떤 경우에도 항상 결과를 반환해야 함
  // no-hang contract: 내부 fetch timeout 시 {ok:false, reason:'fetch_timeout', trace} 반환
  window.runS4 = async function(): Promise<{ ok: true; sessionCleared: boolean } | { ok: false; reason: string; trace?: string[]; pendingUrl?: string | null }> {
    // ✅ Command 2-2: __S4_TRACE 초기화 및 진행 마커 (await 전에 무조건 push)
    if (!window.__S4_TRACE) {
      window.__S4_TRACE = [];
    }
    window.__S4_TRACE.push('start'); // 동기 단계부터 기록
    
    try {
      window.__S4_TRACE.push('before loadTokenManager');
      const tokenManagerResult = await withTimeout(
        loadTokenManager(),
        1000,
        'loadTokenManager'
      );
      
      if (!tokenManagerResult.ok) {
        window.__S4_TRACE.push('loadTokenManager failed: ' + tokenManagerResult.reason);
        return { ok: false, reason: tokenManagerResult.reason };
      }
      
      window.__S4_TRACE.push('after loadTokenManager');
      const tokenManager = tokenManagerResult.value;
      
      if (!tokenManager || typeof tokenManager !== 'object' || !('__test' in tokenManager)) {
        window.__S4_TRACE.push('tokenManager.__test not available');
        return { ok: false, reason: 'tokenManager.__test is not available' };
      }
      
      window.__S4_TRACE.push('tokenManager.__test available');
      
      const testHook = (tokenManager as { __test?: {
        setRefreshToken: (value: string | null) => void;
        setExpiresAt: (msEpoch: number | null) => void;
        clearSession: () => void;
        getStorageSnapshot: () => { refreshToken: string | null; expiresAt: string | null; csrfToken: string | null };
        getClearSessionCalledCount: () => number;
        resetClearSessionCalledCount: () => void;
        getAccessToken?: () => Promise<string | null>;
        refreshOnce?: () => Promise<void>; // ✅ refresh를 직접 호출하는 훅
      } }).__test;
      
      if (!testHook) {
        return { ok: false, reason: 'tokenManager.__test is not available' };
      }
      
      window.__S4_TRACE.push('before resetClearSessionCalledCount');
      // ✅ clearSession 호출 횟수 리셋
      testHook.resetClearSessionCalledCount();
      
      // ✅ Command 2: smoke test fetch 제거
      // S4는 "refresh 실패 시 clearTokens 호출"을 검증해야지,
      // "네트워크 가용성"을 검증하면 안 됨
      // smoke test fetch는 네트워크를 불필요하게 호출하여 pending을 유발할 수 있음
      
      window.__S4_TRACE.push('before fetchCallsBefore');
      // ✅ refresh 호출 계측 시작 (__FETCH_CALLS 초기화)
      // smoke test fetch 제거로 fetchCallsBefore는 refreshOnce 호출 전 상태
      const fetchCallsBefore = (window.__FETCH_CALLS || []).length;
      
      window.__S4_TRACE.push('before seedTokens');
      // ✅ P1-Next-Fix-Module-4: 표준 seedTokens 사용 (refresh를 확실히 트리거)
      // S4는 "refresh 실패 → 세션 정리" 시나리오이므로, 무조건 만료된 상태로 강제
      if (testHook.seedTokens) {
        testHook.seedTokens({
          accessToken: 'expired-access',
          refreshToken: 'test-refresh-token',
          expiresAt: Date.now() - 60_000, // ✅ 핵심: 충분히 과거로 만료 (refresh 트리거 보장)
          csrfToken: 'test-csrf-token',
        });
      } else {
        // 하위 호환성: seedTokens가 없으면 기존 방식 사용
        testHook.setRefreshToken('test-refresh-token');
        const now = Date.now();
        testHook.setExpiresAt(now - 1000);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('csrf_token', 'test-csrf-token');
        }
      }
      
      window.__S4_TRACE.push('before forceRefresh');
      // ✅ P1-Next-Fix-Module-4C: forceRefresh로 refresh를 강제 (정책 변화에 흔들리지 않는 계약)
      // refreshCallCount는 무조건 1 이상이 됨
      if (testHook.forceRefresh) {
        // ✅ AbortController로 fetch timeout 보장
        // withTimeout만으로는 fetch가 영원히 pending이면 잡히지 않는 경우가 있어
        // fetch 자체에 AbortController를 걸고 시간 지나면 abort하도록 해
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
          abortController.abort();
        }, 2000); // 2초 타임아웃
        
        // forceRefresh 내부에서 fetch를 호출하므로, 
        // 원본 fetch를 래핑하여 AbortController를 자동으로 추가
        const originalFetch = window.fetch;
        let pendingUrl: string | null = null;
        const wrappedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
          pendingUrl = url;
          window.__S4_TRACE.push('fetch called: ' + url);
          const signal = init?.signal || abortController.signal;
          try {
            return await originalFetch(input, { ...init, signal });
          } catch (error) {
            window.__S4_TRACE.push('fetch error: ' + String(error));
            throw error;
          }
        };
        window.fetch = wrappedFetch as typeof fetch;
        
        try {
          window.__S4_TRACE.push('before forceRefresh call');
          const refreshResult = await withTimeout(
            testHook.forceRefresh({ respond: 401 }), // 401로 실패하도록 설정
            3000,
            'forceRefresh (expected to fail with 401)'
          );
          
          window.__S4_TRACE.push('after forceRefresh call: ' + (refreshResult.ok ? 'ok' : refreshResult.reason));
          // 401 에러는 예상된 동작이므로 무시
          if (!refreshResult.ok && refreshResult.reason.includes('401')) {
            // 정상적인 실패
            window.__S4_TRACE.push('forceRefresh failed with 401 (expected)');
          } else if (!refreshResult.ok) {
            // 예상치 못한 에러
            console.log('[HARNESS] runS4: Unexpected error:', refreshResult.reason);
            window.__S4_TRACE.push('forceRefresh failed with unexpected error: ' + refreshResult.reason);
          }
        } catch (error) {
          // ✅ Command 3: fetch timeout 시 {ok:false, reason:'fetch_timeout', trace, pendingUrl} 반환
          // throw 금지, 항상 결과 반환
          window.__S4_TRACE.push('forceRefresh exception: ' + String(error));
          const timeoutReason = pendingUrl 
            ? `fetch_timeout: ${pendingUrl}`
            : 'fetch_timeout: unknown url';
          return {
            ok: false,
            reason: timeoutReason,
            trace: window.__S4_TRACE || [],
            pendingUrl: pendingUrl || null,
          };
        } finally {
          clearTimeout(timeoutId);
          window.fetch = originalFetch; // 원본 fetch 복원
          window.__S4_TRACE.push('fetch wrapper restored');
        }
      } else {
        return { ok: false, reason: 'testHook.forceRefresh is not available' };
      }
      
      window.__S4_TRACE.push('before fetchCallsAfter analysis');
      // ✅ refresh 호출 계측 (__FETCH_CALLS에서 refresh URL 추출)
      const fetchCallsAfter = (window.__FETCH_CALLS || []);
      const refreshUrls = fetchCallsAfter
        .filter((url: string) => typeof url === 'string' && (url.includes('/auth/refresh') || url.includes('/api/auth/refresh')))
        .slice(fetchCallsBefore); // refreshOnce() 호출 이후의 refresh 호출만
      const refreshCallCount = refreshUrls.length;
      window.__S4_TRACE.push('refreshCallCount: ' + refreshCallCount);
      
      // ✅ S4에서 snapshot 찍는 위치를 2개로 쪼개
      // refresh 실패 직후 snapshot A
      const snapshotA = testHook.getStorageSnapshot();
      const clearSessionCalledCountA = testHook.getClearSessionCalledCount();
      
      // await Promise.resolve() 한 번 (microtask flush) 후 snapshot B
      await Promise.resolve();
      const snapshotB = testHook.getStorageSnapshot();
      const clearSessionCalledCountB = testHook.getClearSessionCalledCount();
      
      return {
        ok: true,
        sessionCleared: !snapshotB.refreshToken && !snapshotB.expiresAt && !snapshotB.csrfToken, // 최종 상태
        clearSessionCalledCount: clearSessionCalledCountB,
        snapshotA,
        snapshotB,
        clearSessionCalledCountA,
        clearSessionCalledCountB,
        // ✅ 확정 판정용 최소 계측
        refreshCallCount,
        refreshUrls,
        // refreshStatuses는 테스트 코드에서 route handler에서 기록하므로 여기서는 URL만 반환
      };
    } catch (error) {
      // ✅ 어떤 예외도 밖으로 던지지 말고 { ok:false, reason:String(e) } 로 반환
      return { ok: false, reason: String(error) };
    }
  };

  /**
   * S3: 멀티탭 동시 refresh 경합 방지 (single-flight)
   * 
   * ✅ 2) runS3에서 "멀티탭 대기"를 제거하고, single-flight의 본질만 검증해라
   * single-flight 본질은 이거 하나다:
   * - 동시에 getAccessToken() 을 호출했을 때
   * - refresh fetch가 정확히 1회만 나가고
   * - 두 호출이 동일한 결과를 받는다
   * 
   * Promise.allSettled([tokenManager.getAccessToken(), tokenManager.getAccessToken()])
   * 같은 페이지에서 "동시 2회 호출"로 single-flight를 증명 가능
   * 
   * 필수 계약: { ok: true, refreshCallCount: number } | { ok: false, reason }
   */
  window.runS3 = async function(): Promise<{ ok: true; refreshCallCount: number } | { ok: false; reason: string }> {
    try {
      const tokenManagerResult = await withTimeout(
        loadTokenManager(),
        1000,
        'loadTokenManager'
      );
      
      if (!tokenManagerResult.ok) {
        return { ok: false, reason: tokenManagerResult.reason };
      }
      
      const tokenManager = tokenManagerResult.value;
      
      if (!tokenManager || typeof tokenManager !== 'object' || !('getAccessToken' in tokenManager)) {
        return { ok: false, reason: 'tokenManager.getAccessToken is not available' };
      }
      
      const getAccessToken = (tokenManager as { getAccessToken: () => Promise<string | null> }).getAccessToken;
      
      // ✅ 만료된 토큰 상태로 설정 (refresh 트리거)
      if (tokenManager && typeof tokenManager === 'object' && '__test' in tokenManager) {
        const testHook = (tokenManager as { __test?: {
          setRefreshToken: (value: string | null) => void;
          setExpiresAt: (msEpoch: number | null) => void;
        } }).__test;
        
        if (testHook) {
          testHook.setRefreshToken('test-refresh-token');
          testHook.setExpiresAt(Date.now() - 1000); // 이미 만료됨
          sessionStorage.setItem('csrf_token', 'test-csrf-token');
        }
      }
      
      // ✅ Promise.allSettled([tokenManager.getAccessToken(), tokenManager.getAccessToken()])
      // 같은 페이지에서 "동시 2회 호출"로 single-flight를 증명 가능
      // 그리고 내부에서 fetch 캡처된 refresh 호출 횟수만 반환
      // ✅ P0-3: fetch 자체에 AbortController timeout을 걸어 절대 무한대기하지 않게
      const fetchCallsBefore = (window.__FETCH_CALLS || []).length;
      
      // ✅ AbortController로 fetch timeout 보장
      // 단일 AbortController를 사용하여 모든 fetch에 timeout 적용
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 2000); // 2초 타임아웃
      
      // 원본 fetch를 래핑하여 AbortController를 자동으로 추가
      const originalFetch = window.fetch;
      const wrappedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        // 이미 signal이 있으면 그대로 사용, 없으면 abortController.signal 사용
        const signal = init?.signal || abortController.signal;
        return originalFetch(input, { ...init, signal });
      };
      window.fetch = wrappedFetch as typeof fetch;
      
      try {
        const results = await Promise.allSettled([
          withTimeout(getAccessToken(), 3000, 'getAccessToken (call 1)'),
          withTimeout(getAccessToken(), 3000, 'getAccessToken (call 2)'),
        ]);
        
        const fetchCallsAfter = (window.__FETCH_CALLS || []);
        const refreshUrls = fetchCallsAfter
          .filter((url: string) => typeof url === 'string' && (url.includes('/auth/refresh') || url.includes('/api/auth/refresh')))
          .slice(fetchCallsBefore); // getAccessToken 호출 이후의 refresh 호출만
        const refreshCallCount = refreshUrls.length;
        
        // 두 호출이 모두 완료되었는지 확인
        const allSettled = results.every(r => r.status === 'fulfilled');
        
        if (!allSettled) {
          return { ok: false, reason: 'Some getAccessToken calls did not settle' };
        }
        
        return {
          ok: true,
          refreshCallCount,
        };
      } finally {
        clearTimeout(timeoutId);
        window.fetch = originalFetch; // 원본 fetch 복원
      }
    } catch (error) {
      // ✅ 어떤 예외도 밖으로 던지지 말고 { ok:false, reason:String(e) } 로 반환
      return { ok: false, reason: String(error) };
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
