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
  // refresh 요청 실제 URL을 확정하기 위해 fetch 호출을 캡처
  await context.addInitScript({
    content: `
      window.__FETCH_CALLS = [];
      const _fetch = window.fetch;
      window.fetch = function(...args) {
        const url = args[0] instanceof Request ? args[0].url : String(args[0]);
        window.__FETCH_CALLS.push(url);
        return _fetch.apply(this, args);
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
    // ✅ 네트워크 모킹: refresh endpoint만 정확히 fulfill (전부 204 금지)
    // ✅ PR Gate Hermetic에서는 절대 임의 도메인 실네트워크 접속 금지
    let refreshCallCount = 0;
    
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      
      // ✅ http://local.test/*는 injectHarness에서 처리하므로 여기서는 건너뛰기
      if (url.startsWith('http://local.test/')) {
        // injectHarness의 page.route가 처리
        return;
      }
      
      // ✅ S4: refresh 엔드포인트만 401로 강제 실패
      // ✅ T+0 ~ T+2h: page.route 패턴을 실제 URL에 맞게 수정
      // fetch 캡처로 실제 refresh URL을 확인한 후 패턴 수정
      if (url.includes('/auth/refresh') || url.includes('/api/auth/refresh')) {
        refreshCallCount++;
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Invalid or expired refresh token',
            message: 'Token refresh failed'
          }),
        });
        return;
      }
      
      // ✅ 다른 모든 요청은 abort (hermetic: 실서버 의존 제거)
      await route.abort();
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

    // ✅ 명령 3) S4는 window.runS4() 호출로 트리거 (페이지 이동으로 트리거 ❌)
    // injectHarness에서 이미 expect.poll로 보장했으므로 바로 호출 가능
    await page.evaluate(async () => {
      if (window.runS4) {
        await window.runS4();
      } else {
        throw new Error('runS4 function not found');
      }
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
    // 지금은 로그가 안 보이니, 실패 시 console.error(__FETCH_CALLS)를 반드시 찍고 끝내게 해
    const fetchCalls1 = await page1.evaluate(() => window.__FETCH_CALLS || []);
    const fetchCalls2 = await page2.evaluate(() => window.__FETCH_CALLS || []);
    
    const refreshCalls1 = fetchCalls1.filter((url: string) => 
      typeof url === 'string' && url.includes('refresh')
    );
    const refreshCalls2 = fetchCalls2.filter((url: string) => 
      typeof url === 'string' && url.includes('refresh')
    );
    
    // ✅ 테스트 실패 시 무조건 로그로 찍기
    if (refreshCallCount !== 1 || !refreshCompleted1 || !refreshCompleted2) {
      console.error('[E2E] S3 TEST FAILED - PAGE1 FETCH_CALLS:', fetchCalls1);
      console.error('[E2E] S3 TEST FAILED - PAGE2 FETCH_CALLS:', fetchCalls2);
      console.error('[E2E] S3 TEST FAILED - PAGE1 REFRESH_CALLS:', refreshCalls1);
      console.error('[E2E] S3 TEST FAILED - PAGE2 REFRESH_CALLS:', refreshCalls2);
      console.error('[E2E] S3 TEST FAILED - refreshCallCount:', refreshCallCount);
      console.error('[E2E] S3 TEST FAILED - refreshCompleted1:', refreshCompleted1);
      console.error('[E2E] S3 TEST FAILED - refreshCompleted2:', refreshCompleted2);
    } else {
      console.log('[E2E] S3 PAGE1 FETCH_CALLS:', fetchCalls1);
      console.log('[E2E] S3 PAGE2 FETCH_CALLS:', fetchCalls2);
      console.log('[E2E] S3 PAGE1 REFRESH_CALLS:', refreshCalls1);
      console.log('[E2E] S3 PAGE2 REFRESH_CALLS:', refreshCalls2);
    }
    
  });

  /**
   * S3: 멀티탭 동시 refresh 경합 테스트
   */
  test('S3: 멀티탭 동시 refresh 경합 방지 (single-flight)', async ({ context }) => {
    // ✅ Given: 같은 context에서 2개 page 생성 (localStorage 공유)
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // ✅ 네트워크 모킹: refresh endpoint만 정확히 fulfill
    let refreshCallCount = 0;
    const refreshCalls: Array<{ timestamp: number }> = [];
    
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      
      // ✅ http://local.test/*는 injectHarness에서 처리하므로 여기서는 건너뛰기
      // 멀티탭(S3)면 page1, page2 둘 다 route를 걸어야 한다 (라우트는 Page 단위로 등록되니까)
      // injectHarness 내부에서 각 page.route를 설정하므로 여기서는 건너뛰기
      if (url.startsWith('http://local.test/')) {
        // injectHarness의 page.route가 처리
        return;
      }
      
      // ✅ S3: refresh 엔드포인트만 200 + 성공 응답
      // ✅ T+0 ~ T+2h: page.route 패턴을 실제 URL에 맞게 수정
      // fetch 캡처로 실제 refresh URL을 확인한 후 패턴 수정
      if (url.includes('/auth/refresh') || url.includes('/api/auth/refresh')) {
        refreshCallCount++;
        refreshCalls.push({ timestamp: Date.now() });
        
        // 약간의 지연을 두어 동시 호출 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 900,
          }),
        });
        return;
      }
      
      // ✅ 다른 모든 요청은 abort (hermetic: 실서버 의존 제거)
      await route.abort();
    });
    
    // ✅ 정석 harness 주입 템플릿
    // ✅ S3는 page1/page2 둘 다 동일하게 주입 + 각각 존재성 체크
    // ✅ 3) 주입은 무조건 context.addInitScript({ content })로 통일
    // 멀티탭(S3)면 page1, page2 둘 다 route를 걸어야 한다 (라우트는 Page 단위로 등록되니까)
    // 하지만 context.addInitScript는 context 단위로 등록되므로 한 번만 호출하면 됨
    await context.addInitScript({ content: tokenManagerIIFE });
    await context.addInitScript({ content: harnessIIFE });
    
    // page1, page2 각각 route 설정
    await page1.route('http://local.test/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body>e2e</body></html>',
      });
    });
    await page2.route('http://local.test/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body>e2e</body></html>',
      });
    });
    
    // 그 다음에 "새 문서"를 열어서 initScript가 적용되게 함
    await page1.goto('http://local.test/', { waitUntil: 'domcontentloaded' });
    await page2.goto('http://local.test/', { waitUntil: 'domcontentloaded' });
    
    // ✅ assert 순서를 바꿔라 (원인 분리)
    // page1 검증
    expect(await page1.evaluate(() => typeof window.__TOKEN_MANAGER !== 'undefined')).toBe(true);
    expect(await page1.evaluate(() => window.__HARNESS_LOADED_AT)).toBeDefined();
    expect(await page1.evaluate(() => window.__HARNESS_ERROR)).toBeNull();
    expect(await page1.evaluate(() => typeof window.runS3)).toBe('function');
    
    // page2 검증
    expect(await page2.evaluate(() => typeof window.__TOKEN_MANAGER !== 'undefined')).toBe(true);
    expect(await page2.evaluate(() => window.__HARNESS_LOADED_AT)).toBeDefined();
    expect(await page2.evaluate(() => window.__HARNESS_ERROR)).toBeNull();
    expect(await page2.evaluate(() => typeof window.runS3)).toBe('function');

    // ✅ localStorage 접근은 boot 이후에만 (HTTP origin 확보 후)
    await page1.evaluate(() => {
      localStorage.setItem('refresh_token', 'test-refresh-token');
      localStorage.setItem('token_expires_at', (Date.now() - 1000).toString());
      sessionStorage.setItem('csrf_token', 'test-csrf-token');
    });
    
    // ✅ Given: 초기 저장소 상태 확인
    const storageStateBefore = await page1.evaluate(() => {
      return {
        refreshToken: localStorage.getItem('refresh_token'),
        expiresAt: localStorage.getItem('token_expires_at'),
        csrfToken: sessionStorage.getItem('csrf_token'),
      };
    });
    
    expect(storageStateBefore.refreshToken).toBe('test-refresh-token');
    expect(storageStateBefore.expiresAt).toBeTruthy();
    expect(storageStateBefore.csrfToken).toBe('test-csrf-token');

    // ✅ 명령 3) 두 페이지에서 동시에 window.runS3() 호출 (함수 호출로 트리거)
    const promise1 = page1.evaluate(async () => {
      if (window.runS3) {
        await window.runS3();
      } else {
        throw new Error('runS3 function not found');
      }
    });
    
    const promise2 = page2.evaluate(async () => {
      if (window.runS3) {
        await window.runS3();
      } else {
        throw new Error('runS3 function not found');
      }
    });
    
    await Promise.all([promise1, promise2]);
    
    // ✅ Then: refresh 호출 횟수 확인 (정확히 1회 - single-flight)
    console.log(`[E2E] Refresh call count: ${refreshCallCount}, calls:`, refreshCalls);
    expect(refreshCallCount).toBe(1);
    
    // ✅ 명령 3) 검증은 명시적 이벤트/결과로 (localStorage polling 금지)
    const refreshCompleted1 = await page1.evaluate(() => {
      return window.__REFRESH_COMPLETED === true;
    });
    
    const refreshCompleted2 = await page2.evaluate(() => {
      return window.__REFRESH_COMPLETED === true;
    });
    
    expect(refreshCompleted1).toBe(true);
    expect(refreshCompleted2).toBe(true);
    
    // ✅ 최종 토큰 상태 확인
    const storageStateAfter = await page1.evaluate(() => {
      return {
        refreshToken: localStorage.getItem('refresh_token'),
        expiresAt: localStorage.getItem('token_expires_at'),
        csrfToken: sessionStorage.getItem('csrf_token'),
      };
    });
    
    const storageStateAfter2 = await page2.evaluate(() => {
      return {
        refreshToken: localStorage.getItem('refresh_token'),
        expiresAt: localStorage.getItem('token_expires_at'),
        csrfToken: sessionStorage.getItem('csrf_token'),
      };
    });
    
    expect(storageStateAfter.refreshToken).toBe('new-refresh-token');
    expect(storageStateAfter2.refreshToken).toBe('new-refresh-token');
    
    await page1.close();
    await page2.close();
  });
});
