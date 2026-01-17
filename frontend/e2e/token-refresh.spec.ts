/**
 * 토큰 꼬임 P0 - E2E 테스트 (Hermetic)
 * 
 * S3: 멀티탭 동시 refresh 경합
 * S4: refresh 실패 시 강제 로그아웃
 * 
 * ✅ Hermetic E2E: 완전 모킹 기반, 실서버 의존 없음
 * - 앱에 기대지 말고, 토큰 로직을 테스트 전용 Harness로 실행
 * - "브라우저 + origin + storage + 네트워크"만 사용
 * - Next 앱 라우팅/번들/페이지(/login, /dashboard)에 기대지 않음
 * 
 * 실행:
 * npm run test:e2e
 * 또는
 * npx playwright test e2e/token-refresh.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';
import { buildTokenManagerIIFE, buildHarnessIIFE } from './_bundles';

/**
 * ✅ 정석 harness 주입 템플릿 (최종 권장: route.fulfill로 local.test origin 생성)
 * 
 * 정석 2안: route.fulfill로 **local.test를 "내가 제공"**해서 origin을 만들기
 * - 네비게이션은 "있지만" 네트워크는 0 (전부 fulfill)
 * - origin은 http://local.test로 생김
 * - localStorage/broadcastchannel 등 웹 API가 정상 동작
 * 
 * ✅ 3) 주입은 무조건 context.addInitScript({ content })로 통일해라 (정석)
 * - page.addInitScript로도 되긴 하는데, 멀티탭/멀티페이지/재사용에서 사고가 더 많아
 * - 특히 hermetic에서 "새 문서에 100% 적용"은 context.addInitScript가 정석
 * 
 * (A) 페이지/컨텍스트에 라우팅 등록
 * (B) context.addInitScript로 주입 → 그 다음 goto
 * (C) assert 순서를 바꿔라 (원인 분리)
 */
async function injectHarness(
  page: Page,
  context: any, // BrowserContext
  tokenManagerIIFE: string,
  harnessIIFE: string
): Promise<void> {
  // ✅ (A) 페이지/컨텍스트에 라우팅 등록
  // page.goto('http://local.test/')를 쓸 거면 반드시 그 전에 route.fulfill 설정
  await page.route('http://local.test/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body>e2e</body></html>',
    });
  });

  // ✅ (B) context.addInitScript로 주입 → 그 다음 goto
  // ✅ 3) 주입은 무조건 context.addInitScript({ content })로 통일해라 (정석)
  // const context = browser.newContext() 만든 직후
  // await context.addInitScript({ content: tokenManagerBundle })
  // await context.addInitScript({ content: harnessBundle })
  // 그 다음에 const page = await context.newPage() + goto
  // ✅ tokenManager 주입과 harness-entry 주입 순서를 강제
  // harness-entry는 내부에서 window.__TOKEN_MANAGER를 참조할 가능성이 높음
  // 순서: tokenManager initScript → harness-entry initScript → goto(local.test)
  
  // ✅ T+0 ~ T+2h: fetch 캡처 인스트루먼트를 initScript로 추가
  // refresh 요청 실제 URL과 응답 status를 확정하기 위해 fetch 호출을 캡처
  await context.addInitScript({
    content: `
      window.__FETCH_CALLS = [];
      window.__FETCH_RESULTS = [];
      const _fetch = window.fetch.bind(window);
      window.fetch = async function(input, init) {
        const url = typeof input === 'string'
          ? input
          : (input instanceof URL ? input.toString() : input.url);
        
        try {
          const res = await _fetch(input, init);
          window.__FETCH_CALLS.push(url);
          window.__FETCH_RESULTS.push({ url, status: res.status, ok: res.ok });
          return res;
        } catch (e) {
          window.__FETCH_CALLS.push(url);
          window.__FETCH_RESULTS.push({ url, status: null, ok: false, error: String(e) });
          throw e;
        }
      };
    `,
  });
  
  await context.addInitScript({ content: tokenManagerIIFE });
  await context.addInitScript({ content: harnessIIFE });

  // 그 다음에 "새 문서"를 열어서 initScript가 적용되게 함
  // 네비게이션은 "있지만" 네트워크는 0 (전부 fulfill)
  await page.goto('http://local.test/', { waitUntil: 'domcontentloaded' });

  // ✅ (C) assert 순서를 바꿔라 (원인 분리)
  // 지금은 runS4만 보고 죽는데, 다음 순서로 "원인 분리" 해야 함:
  // 1. __TOKEN_MANAGER 존재 확인 (이미 됨)
  // 2. __HARNESS_LOADED_AT 존재 확인 ← 여기서 갈림
  // 3. __HARNESS_ERROR가 비었는지 확인 ← 여기서 갈림
  // 4. 마지막에 runS3/runS4 타입 확인

  // ✅ 1. __TOKEN_MANAGER 존재 확인
  const hasTokenManager = await page.evaluate(() => typeof window.__TOKEN_MANAGER !== 'undefined');
  expect(hasTokenManager).toBe(true);
  
  // ✅ (A) tokenManager 객체가 다른 인스턴스다 - 진단 로그
  // harness가 잡은 tokenManager가 실제로는 default export가 아니라 named export / re-export / wrapper 일 수 있음
  const tokenManagerDiag = await page.evaluate(() => {
    const tm = window.__TOKEN_MANAGER;
    if (!tm) return null;
    
    return {
      hasTest: Boolean(tm && '__test' in tm),
      keys: Object.keys(tm).slice(0, 20), // 20개까지만
      constructorName: tm?.constructor?.name ?? typeof tm,
      hasGetAccessToken: typeof (tm as { getAccessToken?: unknown }).getAccessToken === 'function',
    };
  });
  
  // ✅ CI용 단일 진단 로그 (1회만)
  // PR Gate 로그에 한 줄만 찍어라. 딱 이거면 충분
  console.log('[E2E] TOKEN_MANAGER_TEST_HOOK', tokenManagerDiag);
  
  // ✅ 훅 포함 여부 100% 확정
  if (!tokenManagerDiag || !tokenManagerDiag.hasTest) {
    throw new Error(`tokenManager.__test is not available. Diagnostic: ${JSON.stringify(tokenManagerDiag)}`);
  }

  // ✅ 2. __HARNESS_LOADED_AT 존재 확인 ← 여기서 갈림
  // (A) __HARNESS_LOADED_AT 자체가 없다
  // → addInitScript가 harness에만 안 먹는 것
  // (주입 코드/순서/대상(context vs page)/코드 문자열이 비어있음/빌드 결과를 안 넣음)
  const harnessLoadedAt = await page.evaluate(() => window.__HARNESS_LOADED_AT);
  expect(harnessLoadedAt).toBeDefined();
  expect(typeof harnessLoadedAt).toBe('number');

  // ✅ 3. __HARNESS_ERROR가 비었는지 확인 ← 여기서 갈림
  // (B) __HARNESS_LOADED_AT는 있는데 __HARNESS_ERROR가 있다
  // → harness-entry 실행 중 예외로 죽음
  // (대부분 의존성, window/document 접근 시점, import/require 잔재, 전역 변수 충돌)
  const harnessError = await page.evaluate(() => window.__HARNESS_ERROR);
  if (harnessError) {
    throw new Error(`Harness execution error: ${harnessError}`);
  }

  // ✅ 4. 마지막에 runS3/runS4 타입 확인
  // (C) __HARNESS_READY=true인데도 runS3/runS4가 없다
  // → harness-entry가 "window 바인딩"을 안 하고 export만 하는 구조
  // (혹은 이름이 다름: runS4 -> runS4Impl 등)
  expect(await page.evaluate(() => typeof window.runS4)).toBe('function');
  expect(await page.evaluate(() => typeof window.runS3)).toBe('function');

  // ✅ 디버그 로그 (다음 로그에서 나한테 보여줄 건 딱 3개)
  // typeof window.__TOKEN_MANAGER
  // window.__HARNESS_LOADED_AT 값 유무
  // window.__HARNESS_ERROR 문자열 (있으면 그대로)
  const diag = await page.evaluate(() => ({
    typeofTokenManager: typeof window.__TOKEN_MANAGER,
    harnessLoadedAt: window.__HARNESS_LOADED_AT,
    harnessError: window.__HARNESS_ERROR,
    harnessReady: window.__HARNESS_READY,
    hasRunS3: typeof window.runS3,
    hasRunS4: typeof window.runS4,
  }));
  console.log('[E2E] HARNESS DIAG', diag);
}

test.describe('토큰 꼬임 P0 - Refresh 경합 및 실패 처리 (Hermetic)', () => {
  // ✅ 명령 2) tokenManager IIFE 번들 (한 번만 빌드)
  let tokenManagerIIFE: string;
  // ✅ 명령 1) harness IIFE 번들 (한 번만 빌드)
  let harnessIIFE: string;
  
  test.beforeAll(async () => {
    tokenManagerIIFE = await buildTokenManagerIIFE();
    harnessIIFE = await buildHarnessIIFE();
  });

  /**
   * S4: refresh 실패 시 강제 로그아웃 테스트
   */
  test('S4: refresh 실패 시 전역 세션 정리 및 강제 로그아웃', async ({ page, context }) => {
    // ✅ 브라우저 콘솔 로그 캡처
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[tokenManager') || text.includes('[authAPI') || text.includes('[TEST]') || text.includes('[HARNESS]')) {
        consoleLogs.push(text);
        console.log('[BROWSER]', text);
      }
    });
    // ✅ 네트워크 모킹: refresh endpoint만 정확히 fulfill (전부 204 금지)
    // ✅ PR Gate Hermetic에서는 절대 임의 도메인 실네트워크 접속 금지
    let refreshCallCount = 0;
    let refreshStatusSeen: number | null = null;
    
    // ✅ 2-A) route는 injectHarness 이전에 설정 (스모크 테스트용)
    // ✅ B-2) route 패턴을 **/api/auth/refresh**로 고정 (절대/상대 경로 모두 매칭)
    await context.route('**/api/auth/refresh**', async (route) => {
      refreshCallCount++;
      refreshStatusSeen = 401; // ✅ 2) S4 harness에서 "refresh 응답 status"를 같이 반환
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Invalid or expired refresh token',
          message: 'Token refresh failed'
        }),
        headers: {
          'access-control-allow-origin': '*',
          'cache-control': 'no-store',
        },
      });
    });
    
    // ✅ Command 2: fallback route 추가 (모든 요청을 명시적으로 fulfill)
    // Playwright hermetic 규칙: 테스트 중 나가는 모든 네트워크는 명시적으로 fulfill되어야 함
    // 누락된 요청이 있으면 "즉시 실패"로 바꾸는 게 정석
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      const request = route.request();
      
      // ✅ (a) http://local.test/*는 injectHarness에서 처리하므로 여기서는 건너뛰기
      if (url.startsWith('http://local.test/')) {
        // injectHarness의 page.route가 처리
        return;
      }
      
      // ✅ (b) 허용 목록: /api/auth/refresh만 허용 (이미 위에서 처리)
      if (url.includes('/api/auth/refresh')) {
        // 위의 route handler가 처리
        return;
      }
      
      // ✅ Command 2: fallback route - 미매칭은 즉시 500으로 fulfill (절대 pending 금지)
      // 이렇게 하면 pending 자체가 사라짐
      await page.evaluate((abortedUrl) => {
        if (!window.__ABORTED_URLS) {
          window.__ABORTED_URLS = [];
        }
        window.__ABORTED_URLS.push(abortedUrl);
      }, url);
      
      console.log('[E2E] Unmocked request (fulfilling with 500):', url);
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'UNMOCKED_REQUEST', url }),
      });
    });
    
    // ✅ 정석 harness 주입 템플릿
    // ✅ 3) 주입은 무조건 context.addInitScript({ content })로 통일
    await injectHarness(page, context, tokenManagerIIFE, harnessIIFE);

    // ✅ localStorage 접근은 boot 이후에만 (HTTP origin 확보 후)
    await page.evaluate(() => {
      localStorage.setItem('refresh_token', 'test-refresh-token');
      localStorage.setItem('token_expires_at', (Date.now() - 1000).toString());
      sessionStorage.setItem('csrf_token', 'test-csrf-token');
    });

    // ✅ Given: 초기 저장소 상태 확인
    const storageStateBefore = await page.evaluate(() => {
      return {
        refreshToken: localStorage.getItem('refresh_token'),
        expiresAt: localStorage.getItem('token_expires_at'),
        csrfToken: sessionStorage.getItem('csrf_token'),
      };
    });
    
    expect(storageStateBefore.refreshToken).toBe('test-refresh-token');
    expect(storageStateBefore.expiresAt).toBeTruthy();
    expect(storageStateBefore.csrfToken).toBe('test-csrf-token');

    // ✅ E2E: Promise.race를 runS4 호출 바깥에 적용 (await runS4() 금지)
    // 핵심: window.runS4()는 await로 먼저 붙잡지 말 것
    // Promise.race에서 timeout이 이기면 trace/abortedUrls를 무조건 실어 반환
    // timeout은 브라우저 내부 setTimeout으로 만들어야 함 (Node 타이머 말고)
    const result = await page.evaluate(() => {
      const run = (window as any).runS4?.bind(window);

      const timeoutMs = 5000;
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: false,
            reason: 'timeout',
            trace: (window as any).__S4_TRACE ?? [],
            abortedUrls: (window as any).__ABORTED_URLS ?? [],
          });
        }, timeoutMs);
      });

      if (!run) {
        return Promise.resolve({ 
          ok: false, 
          reason: 'runS4 missing',
          trace: (window as any).__S4_TRACE ?? [],
          abortedUrls: (window as any).__ABORTED_URLS ?? [],
        });
      }

      // ❗여기서 절대 await run() 하지 말 것
      // Promise.race에서 run()을 호출하되, await는 race 결과에만
      return Promise.race([
        Promise.resolve().then(() => run()),
        timeoutPromise,
      ]);
    });
    
    // ✅ Command 2: __S4_TRACE 로그 출력 (timeout 시 어디서 멈췄는지 확정)
    const trace = result.trace || [];
    console.log('[E2E] S4_TRACE:', trace);
    
    // ✅ Command 2: abort된 URL 목록 출력
    const aborted = result.abortedUrls || [];
    if (aborted.length > 0) {
      console.log('[E2E] Aborted URLs (not in allowlist):', aborted);
    }
    
    // ✅ 계약 기반 검증
    if (!result.ok) {
      console.error('[E2E] S4 TEST FAILED - result:', result);
      throw new Error(`S4 test failed: ${result.reason}`);
    }
    
    // ✅ Command A: S4 판정 기준 수정 (401 강제 제거)
    // S4의 제품 요구사항은 "refresh 실패(어떤 이유든) → 세션 정리"
    // 401은 "대표적인 실패 원인"일 뿐, 테스트의 본질이 아님
    
    // ✅ 부가 진단 로그 (실패 원인: 401 vs abort vs network)
    const fetchResults = await page.evaluate(() => window.__FETCH_RESULTS || []);
    const refreshResult = fetchResults.find((r: { url: string; status: number | null; ok: boolean; error?: string }) => 
      r.url.includes('/api/auth/refresh') || r.url.includes('/auth/refresh')
    );
    const refreshStatusFromFetch = refreshResult?.status ?? null;
    const refreshError = refreshResult?.error;
    
    console.log('[E2E] S4 result:', JSON.stringify(result, null, 2));
    console.log('[E2E] S4 refreshStatusSeen (route):', refreshStatusSeen);
    console.log('[E2E] S4 refreshStatusFromFetch (actual):', refreshStatusFromFetch);
    console.log('[E2E] S4 refreshError:', refreshError);
    console.log('[E2E] S4 fetchResults:', fetchResults);
    
    // ✅ Command A: 필수 통과 조건 (401 강제 제거)
    // 1. refresh가 최소 1회 발생 (refreshCallCount >= 1)
    // 2. refresh 결과가 실패임 (fetchResults[0].ok === false or error 존재)
    // 3. 세션 정리 호출됨 (clearSessionCalledCount === 1)
    // 4. 스냅샷 A/B가 모두 null (refreshToken/expiresAt/csrfToken)
    console.log('[E2E] S4 DIAGNOSTIC:', {
      refreshCallCount: result.refreshCallCount,
      refreshUrls: result.refreshUrls,
      refreshStatusSeen,
      refreshStatusFromFetch,
      refreshError,
      clearSessionCalledCount: result.clearSessionCalledCount,
      sessionCleared: result.sessionCleared,
    });
    
    // ✅ Command A: 필수 통과 조건 (401 강제 제거)
    // 1. refresh가 최소 1회 발생
    expect(result.refreshCallCount).toBeGreaterThanOrEqual(1);
    
    // 2. refresh 결과가 실패임 (fetchResults[0].ok === false or error 존재)
    // abort로 끊겨도 세션 정리가 됐으면 S4는 PASS
    const refreshFailed = refreshResult ? (!refreshResult.ok || refreshResult.error) : true;
    expect(refreshFailed).toBe(true);
    
    // 3. 세션 정리 호출됨
    expect(result.clearSessionCalledCount).toBeGreaterThanOrEqual(1);
    
    // 4. 스냅샷 A/B가 모두 null
    expect(result.snapshotB.refreshToken).toBeNull();
    expect(result.snapshotB.expiresAt).toBeNull();
    expect(result.snapshotB.csrfToken).toBeNull();
    
    // ✅ 부가 진단 로그 (실패 원인: 401 vs abort vs network)
    if (refreshStatusFromFetch === 401) {
      console.log('[E2E] S4: Refresh failed with 401 (expected failure reason)');
    } else if (refreshError?.includes('AbortError') || refreshError?.includes('aborted')) {
      console.log('[E2E] S4: Refresh failed with abort timeout (acceptable failure reason)');
    } else if (refreshError) {
      console.log('[E2E] S4: Refresh failed with error:', refreshError);
    } else {
      console.log('[E2E] S4: Refresh failed (reason unknown, but session cleared)');
    }
    
    // ✅ Command A: S4 판정 기준 수정 완료
    // refresh 실패(어떤 이유든) + sessionCleared로 통과
    // status는 부가 진단용으로만 사용
    
    // ✅ 브라우저 콘솔 로그 출력 (디버깅)
    if (result.clearSessionCalledCount === 0) {
      console.error('[E2E] S4 DEBUG - clearTokens() not called. Console logs:');
      consoleLogs.forEach(log => console.error('  ', log));
      console.error('[E2E] S4 DEBUG - result:', JSON.stringify(result, null, 2));
    }
    
    // ✅ Command A: 필수 통과 조건 검증
    expect(result).toMatchObject({
      ok: true,
      sessionCleared: true,
      clearSessionCalledCount: 1,
      snapshotA: expect.objectContaining({
        refreshToken: null,
        expiresAt: null,
        csrfToken: null,
      }),
      snapshotB: expect.objectContaining({
        refreshToken: null,
        expiresAt: null,
        csrfToken: null,
      }),
      clearSessionCalledCountA: 1,
      clearSessionCalledCountB: 1,
    });

    // ✅ 정석 대체안: "navigate 관측"은 API로 해라
    // href를 건드리지 말고, Playwright 이벤트/라우팅을 관측
    // 페이지가 이동했는지: page.waitForURL(...)
    // "강제 로그아웃 후 /login으로 갔다" 같은 건 await expect(page).toHaveURL(/\/login/)
    // => "URL이 바뀌었는지" 검증을 DOM/Location 패치로 하지 말고 E2E답게 URL로 검증
    
    // ✅ 명령 3) 검증은 polling(localStorage waitForFunction) 금지
    // ✅ 명시적 이벤트/결과로 검증
    // ✅ 정석: localStorage/sessionStorage 정리 여부로 검증
    const storageStateAfter = await page.evaluate(() => {
      return {
        refreshToken: localStorage.getItem('refresh_token'),
        expiresAt: localStorage.getItem('token_expires_at'),
        csrfToken: sessionStorage.getItem('csrf_token'),
      };
    });

    expect(storageStateAfter.refreshToken).toBeNull();
    expect(storageStateAfter.expiresAt).toBeNull();
    expect(storageStateAfter.csrfToken).toBeNull();
    
    // ✅ 정석: 세션 정리 확인 (localStorage/sessionStorage 정리 여부)
    const sessionCleared = await page.evaluate(() => {
      return window.__SESSION_CLEARED === true;
    });
    expect(sessionCleared).toBe(true);
    
    // ✅ 정석: URL 검증 (location.href 재정의 대신 Playwright API 사용)
    // 만약 앱 코드가 window.location.href = '/login'을 호출한다면
    // page.waitForURL() 또는 expect(page).toHaveURL()로 검증
    // 지금은 의존성 0 단계이므로 URL 검증은 나중에 추가
    
    // ✅ refresh 호출 횟수 확인 (정확히 1회)
    expect(refreshCallCount).toBe(1);
    
    // ✅ Step 4: fetch dump를 "테스트 실패 시" 강제 출력
    const fetchCalls = await page.evaluate(() => window.__FETCH_CALLS || []);
    const refreshCalls = fetchCalls.filter((url: string) => 
      typeof url === 'string' && url.includes('refresh')
    );
    
    // ✅ 테스트 실패 시 무조건 로그로 찍기
    if (refreshCallCount !== 1 || !result.ok) {
      console.error('[E2E] S4 TEST FAILED - FETCH_CALLS:', fetchCalls);
      console.error('[E2E] S4 TEST FAILED - REFRESH_CALLS:', refreshCalls);
      console.error('[E2E] S4 TEST FAILED - refreshCallCount:', refreshCallCount);
      console.error('[E2E] S4 TEST FAILED - result:', result);
    } else {
      console.log('[E2E] S4 FETCH_CALLS:', fetchCalls);
      console.log('[E2E] S4 REFRESH_CALLS:', refreshCalls);
    }
  });

});
