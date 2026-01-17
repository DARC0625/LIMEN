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
 * ✅ 정석 harness 주입 템플릿
 * 
 * (A) 테스트에서 페이지 만들기
 * (B) init script로 IIFE 주입 (중요: addInitScript는 탐색 전)
 * (C) 주입 검증은 evaluate가 아니라 "즉시 observable"로
 */
async function injectHarness(
  page: Page,
  tokenManagerIIFE: string,
  harnessIIFE: string
): Promise<void> {
  // ✅ (A) 테스트에서 페이지 만들기
  await page.goto('about:blank');
  await page.setContent('<!doctype html><html><body>e2e</body></html>', {
    waitUntil: 'domcontentloaded',
  });

  // ✅ (B) init script로 IIFE 주입 (중요: addInitScript는 탐색 전)
  // harness 번들은 반드시 IIFE로 만들고, addInitScript로 주입
  await page.addInitScript({ content: tokenManagerIIFE });
  await page.addInitScript({ content: harnessIIFE });

  // 그 다음에 "새 문서"를 열어서 initScript가 적용되게 함
  await page.goto('http://local.test/', { waitUntil: 'domcontentloaded' });

  // ✅ (C) 주입 검증은 evaluate가 아니라 "즉시 observable"로
  // page.waitForFunction보다 expect.poll이 더 "테스트 코드답고" 디버깅도 쉬워
  await expect.poll(async () => {
    return await page.evaluate(() => ({
      s3: typeof window.runS3,
      s4: typeof window.runS4,
      hasTokenManager: typeof window.__TOKEN_MANAGER !== 'undefined',
    }));
  }).toEqual({ s3: 'function', s4: 'function', hasTokenManager: true });

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
    let refreshCallCount = 0;
    
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      
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
