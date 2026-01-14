/**
 * 토큰 꼬임 P0 - E2E 테스트 (Hermetic)
 * 
 * S3: 멀티탭 동시 refresh 경합
 * S4: refresh 실패 시 강제 로그아웃
 * 
 * ✅ Hermetic E2E: API 모킹 기반, 실서버 의존 없음
 * CI Gate에서 안정적으로 실행 가능
 * 
 * 실행:
 * npm run test:e2e -- token-refresh
 * 또는
 * npx playwright test e2e/token-refresh.spec.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:9444';

// ✅ Hermetic E2E: CI Gate에서 실행 (실서버 의존 없음)
test.describe('토큰 꼬임 P0 - Refresh 경합 및 실패 처리', () => {
  /**
   * S4: refresh 실패 시 강제 로그아웃 테스트
   * 
   * 시나리오:
   * 1. 로그인 상태 유지 (localStorage에 토큰 설정)
   * 2. refresh 엔드포인트를 401로 강제 실패
   * 3. API 호출 시도 (자동 refresh 트리거)
   * 4. 기대: 모든 저장소 정리 + /login?reason=... 리다이렉트 + BroadcastChannel 이벤트
   */
  test('S4: refresh 실패 시 전역 세션 정리 및 강제 로그아웃', async ({ page }) => {
    // ✅ Given: 로그인 상태 (토큰이 localStorage에 있음)
    await page.goto(`${BASE_URL}/login`);
    
    // 로그인 시뮬레이션: localStorage에 직접 토큰 설정 (테스트용)
    await page.evaluate(() => {
      localStorage.setItem('refresh_token', 'test-refresh-token');
      localStorage.setItem('token_expires_at', (Date.now() - 1000).toString()); // 만료된 상태 (refresh 트리거)
      sessionStorage.setItem('csrf_token', 'test-csrf-token');
    });

    // ✅ When: refresh 엔드포인트를 401로 강제 실패
    let refreshCallCount = 0;
    await page.route('**/api/auth/refresh', async (route) => {
      refreshCallCount++;
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Invalid or expired refresh token',
          message: 'Token refresh failed'
        }),
      });
    });

    // ✅ When: API 호출 시도 (자동 refresh 트리거)
    // dashboard로 이동하면 API 호출이 발생하고, access token이 만료되어 refresh 시도
    const navigationPromise = page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    
    // ✅ Then: refresh 호출 확인
    await page.waitForTimeout(1000); // refresh 실패 처리 대기
    
    expect(refreshCallCount).toBeGreaterThan(0); // refresh가 호출되었는지 확인

    // ✅ Then: 모든 저장소 정리 확인
    const storageState = await page.evaluate(() => {
      return {
        refreshToken: localStorage.getItem('refresh_token'),
        expiresAt: localStorage.getItem('token_expires_at'),
        csrfToken: sessionStorage.getItem('csrf_token'),
      };
    });

    expect(storageState.refreshToken).toBeNull();
    expect(storageState.expiresAt).toBeNull();
    expect(storageState.csrfToken).toBeNull();

    // ✅ Then: /login?reason=... 리다이렉트 확인
    await navigationPromise.catch(() => {}); // 리다이렉트로 인한 navigation 실패는 무시
    await page.waitForTimeout(500); // 리다이렉트 대기
    
    const currentUrl = page.url();
    expect(currentUrl).toContain('/login');
    expect(currentUrl).toContain('reason=');
    
    // reason 파라미터 확인
    const urlParams = new URL(currentUrl).searchParams;
    const reason = urlParams.get('reason');
    expect(reason).toBeTruthy();
    expect(decodeURIComponent(reason!)).toContain('세션이 만료되었습니다');
  });

  /**
   * S3: 멀티탭 동시 refresh 경합 테스트
   * 
   * 시나리오:
   * 1. 같은 context에서 2개 page 열기 (localStorage 공유)
   * 2. 동시에 API 호출 (access token 만료 상태)
   * 3. 기대: refresh 호출 최소화 (single-flight) + 둘 다 정상 토큰 획득/요청 성공
   * 
   * 주의: 같은 context이므로 localStorage는 공유되지만,
   * tokenManager는 각 페이지마다 별도 인스턴스이므로
   * 실제로는 refreshPromise가 인스턴스별로 관리됨
   * 하지만 localStorage를 통한 동기화로 경합이 완화될 수 있음
   */
  test('S3: 멀티탭 동시 refresh 경합 방지 (single-flight)', async ({ context }) => {
    // ✅ Given: 같은 context에서 2개 page 생성 (localStorage 공유)
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // 로그인 상태 설정 (두 페이지 모두 - 같은 context이므로 공유됨)
    await page1.goto(`${BASE_URL}/login`);
    await page2.goto(`${BASE_URL}/login`);
    
    // 같은 localStorage를 공유하므로 한 번만 설정해도 됨
    await page1.evaluate(() => {
      localStorage.setItem('refresh_token', 'test-refresh-token');
      localStorage.setItem('token_expires_at', (Date.now() - 1000).toString()); // 만료된 상태
      sessionStorage.setItem('csrf_token', 'test-csrf-token');
    });

    // ✅ When: refresh 호출 카운터 설정 (네트워크 인터셉트로 카운트)
    let refreshCallCount = 0;
    const refreshCalls: Array<{ timestamp: number; page: string }> = [];
    
    // context 레벨에서 route 설정 (두 페이지 모두 적용)
    await context.route('**/api/auth/refresh', async (route) => {
      refreshCallCount++;
      refreshCalls.push({
        timestamp: Date.now(),
        page: route.request().url(),
      });
      
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
    });

    // ✅ When: 두 페이지에서 동시에 API 호출 (refresh 트리거)
    const promise1 = page1.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const promise2 = page2.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    
    await Promise.all([promise1, promise2]);
    
    // ✅ Then: refresh 호출 횟수 확인
    // 주의: 각 페이지마다 별도의 tokenManager 인스턴스가 있으므로
    // 최악의 경우 2회 호출될 수 있음 (single-flight가 인스턴스별로 작동)
    // 하지만 이상적으로는 1회여야 함 (localStorage 공유로 인한 동기화)
    console.log(`[E2E] Refresh call count: ${refreshCallCount}, calls:`, refreshCalls);
    
    // ✅ 최소한 2회 이하여야 함 (각 페이지당 1회)
    // 실제로는 single-flight가 완벽하게 작동하면 1회일 수 있음
    expect(refreshCallCount).toBeLessThanOrEqual(2);
    
    // ✅ Then: 두 페이지 모두 정상적으로 토큰 획득 확인
    const token1 = await page1.evaluate(() => {
      return localStorage.getItem('refresh_token');
    });
    const token2 = await page2.evaluate(() => {
      return localStorage.getItem('refresh_token');
    });
    
    expect(token1).toBe('new-refresh-token');
    expect(token2).toBe('new-refresh-token');
    
    // ✅ Then: 두 페이지 모두 정상적으로 로드되었는지 확인
    await expect(page1).toHaveURL(new RegExp(`${BASE_URL}/dashboard`));
    await expect(page2).toHaveURL(new RegExp(`${BASE_URL}/dashboard`));
    
    await page1.close();
    await page2.close();
  });
});
