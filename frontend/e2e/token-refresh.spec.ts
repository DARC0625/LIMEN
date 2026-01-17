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
 * (A) 페이지/컨텍스트에 라우팅 등록
 * (B) init script 주입 → 그 다음 goto
 * (C) 주입 검증은 evaluate가 아니라 "즉시 observable"로
 */
async function injectHarness(
  page: Page,
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

  // ✅ (B) init script 주입 → 그 다음 goto
  // ✅ tokenManager 주입과 harness-entry 주입 순서를 강제
  // harness-entry는 내부에서 window.__TOKEN_MANAGER를 참조할 가능성이 높음
  // 순서: tokenManager initScript → harness-entry initScript → goto(local.test)
  await page.addInitScript({ content: tokenManagerIIFE });
  await page.addInitScript({ content: harnessIIFE });

  // 그 다음에 "새 문서"를 열어서 initScript가 적용되게 함
  // 네비게이션은 "있지만" 네트워크는 0 (전부 fulfill)
  await page.goto('http://local.test/', { waitUntil: 'domcontentloaded' });

  // ✅ (C) "runS3/runS4 생성"을 기다리지 말고 즉시 assert 하라 (정석)
  // goto 직후 바로 assert
  // 만약 여기서 실패하면 **주입이 안 된 게 아니라 "harness-entry가 실행되지 않았다"**가 확정
  expect(await page.evaluate(() => typeof window.runS4)).toBe('function');
  expect(await page.evaluate(() => typeof window.runS3)).toBe('function');
  expect(await page.evaluate(() => typeof window.__TOKEN_MANAGER !== 'undefined')).toBe(true);

  // ✅ 디버그 로그 (10초 안에 잡는 디버그 2줄)
  const diag = await page.evaluate(() => ({
    readyState: document.readyState,
    hasRunS3: typeof window.runS3,
    hasRunS4: typeof window.runS4,
    keys: Object.keys(window).filter((k) => k.includes('runS')),
    hasTokenManager: typeof window.__TOKEN_MANAGER !== 'undefined',
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
      if (url.includes('/api/auth/refresh')) {
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
    await injectHarness(page, tokenManagerIIFE, harnessIIFE);

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

    // ✅ 명령 3) 검증은 polling(localStorage waitForFunction) 금지
    // ✅ 명시적 이벤트/결과로 검증
    const sessionCleared = await page.evaluate(() => {
      return window.__SESSION_CLEARED === true;
    });
    
    const redirectToLogin = await page.evaluate(() => {
      return window.__REDIRECT_TO_LOGIN ?? null;
    });

    expect(sessionCleared).toBe(true);
    expect(redirectToLogin).toContain('/login');
    
    // ✅ 최종 저장소 상태 확인
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
    
    // ✅ refresh 호출 횟수 확인 (정확히 1회)
    expect(refreshCallCount).toBe(1);
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
      if (url.includes('/api/auth/refresh')) {
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
    await injectHarness(page1, tokenManagerIIFE, harnessIIFE);
    await injectHarness(page2, tokenManagerIIFE, harnessIIFE);

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
