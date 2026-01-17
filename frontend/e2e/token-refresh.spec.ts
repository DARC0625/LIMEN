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
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ✅ Hermetic E2E 표준: route-fulfill로 "가짜 HTTP origin" 생성 + harness.js 제공
 * 
 * 핵심: 실서버 없이도 http://local.test 같은 origin을 Playwright가 '문서로 인식'하도록 fulfill
 * - localStorage/쿠키/탭 동기화 테스트를 정석대로 계속 밀어붙일 수 있음
 * - hermetic 원칙 유지 (실서버 의존 없음)
 */
async function bootHermeticOrigin(page: Page, harnessJs: string) {
  // ✅ 네트워크 모킹: document와 harness.js만 fulfill, 나머지는 abort
  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = route.request().url();
    
    // document 요청은 harness.js를 포함한 HTML로
    if (req.resourceType() === 'document') {
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `<!doctype html>
<html>
<head>
  <script>
    ${harnessJs}
  </script>
</head>
<body>
  <h1>Hermetic E2E Test</h1>
</body>
</html>`,
      });
    }
    
    // harness.js 요청은 이미 HTML에 포함되어 있으므로 처리 불필요
    // 다른 모든 요청은 abort (refresh endpoint는 테스트에서 별도 처리)
    await route.abort();
  });

  // ✅ HTTP origin 확보 (실서버 불필요: route가 fulfill)
  await page.goto('http://local.test/', { waitUntil: 'domcontentloaded' });
}

test.describe('토큰 꼬임 P0 - Refresh 경합 및 실패 처리 (Hermetic)', () => {
  // harness.js 로드 (한 번만)
  const harnessJsPath = join(__dirname, 'harness.js');
  let harnessJs: string;
  
  test.beforeAll(() => {
    harnessJs = readFileSync(harnessJsPath, 'utf-8');
  });

  /**
   * S4: refresh 실패 시 강제 로그아웃 테스트
   * 
   * 시나리오:
   * 1. 로그인 상태 유지 (localStorage에 토큰 설정)
   * 2. refresh 엔드포인트를 401로 강제 실패
   * 3. window.runS4() 호출 (tokenManager.getAccessToken() 트리거)
   * 4. 기대: 모든 저장소 정리 + /login?reason=... 리다이렉트
   */
  test('S4: refresh 실패 시 전역 세션 정리 및 강제 로그아웃', async ({ page, context }) => {
    // ✅ Hermetic origin 부팅 (harness.js 포함)
    await bootHermeticOrigin(page, harnessJs);
    
    // ✅ 네트워크 모킹: refresh endpoint만 정확히 fulfill (전부 204 금지)
    let refreshCallCount = 0;
    
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      const req = route.request();
      
      // document 요청은 bootHermeticOrigin에서 처리
      if (req.resourceType() === 'document') {
        return route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: `<!doctype html>
<html>
<head>
  <script>
    ${harnessJs}
  </script>
</head>
<body>
  <h1>Hermetic E2E Test</h1>
</body>
</html>`,
        });
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

    // ✅ localStorage 접근은 boot 이후에만 (HTTP origin 확보 후)
    await page.evaluate(() => {
      localStorage.setItem('refresh_token', 'test-refresh-token');
      localStorage.setItem('token_expires_at', (Date.now() - 1000).toString()); // 만료된 상태 (refresh 트리거)
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

    // ✅ When: harness.runS4() 호출 (함수 호출로 트리거, 페이지 이동으로 트리거 ❌)
    // tokenManager를 주입 (harness.js가 사용)
    await page.evaluate(async () => {
      const { tokenManager } = await import('/lib/tokenManager.js');
      (window as any).__TOKEN_MANAGER = tokenManager;
    });
    
    const result = await page.evaluate(async () => {
      // runS4 실행
      if (typeof (window as any).runS4 === 'function') {
        return await (window as any).runS4();
      } else {
        throw new Error('runS4 function not found');
      }
    });

    // ✅ Then: 명시적 이벤트/결과로 검증 (localStorage polling 금지)
    // 세션 정리 플래그 확인
    const sessionCleared = await page.evaluate(() => {
      return (window as any).__SESSION_CLEARED === true;
    });
    
    // 리다이렉트 확인
    const redirectToLogin = await page.evaluate(() => {
      return (window as any).__REDIRECT_TO_LOGIN;
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
   * 
   * 시나리오:
   * 1. 같은 context에서 2개 page 생성 (localStorage 공유)
   * 2. 동시에 window.runS3() 호출 (access token 만료 상태)
   * 3. 기대: refresh 호출 최소화 (single-flight) + 둘 다 정상 토큰 획득
   */
  test('S3: 멀티탭 동시 refresh 경합 방지 (single-flight)', async ({ context }) => {
    // ✅ Given: 같은 context에서 2개 page 생성 (localStorage 공유)
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // ✅ Hermetic origin 부팅 (같은 context면 origin 공유)
    await bootHermeticOrigin(page1, harnessJs);
    await bootHermeticOrigin(page2, harnessJs);

    // ✅ 네트워크 모킹: refresh endpoint만 정확히 fulfill
    let refreshCallCount = 0;
    const refreshCalls: Array<{ timestamp: number }> = [];
    
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      const req = route.request();
      
      // document 요청은 bootHermeticOrigin에서 처리
      if (req.resourceType() === 'document') {
        return route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: `<!doctype html>
<html>
<head>
  <script>
    ${harnessJs}
  </script>
</head>
<body>
  <h1>Hermetic E2E Test</h1>
</body>
</html>`,
        });
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

    // ✅ localStorage 접근은 boot 이후에만 (HTTP origin 확보 후)
    // 같은 context면 page1에서 설정해도 page2에서 공유됨
    await page1.evaluate(() => {
      localStorage.setItem('refresh_token', 'test-refresh-token');
      localStorage.setItem('token_expires_at', (Date.now() - 1000).toString()); // 만료된 상태
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

    // ✅ When: 두 페이지에서 동시에 window.runS3() 호출 (함수 호출로 트리거)
    // tokenManager를 주입 (harness.js가 사용)
    await page1.evaluate(async () => {
      const { tokenManager } = await import('/lib/tokenManager.js');
      (window as any).__TOKEN_MANAGER = tokenManager;
    });
    
    await page2.evaluate(async () => {
      const { tokenManager } = await import('/lib/tokenManager.js');
      (window as any).__TOKEN_MANAGER = tokenManager;
    });
    
    const promise1 = page1.evaluate(async () => {
      if (typeof (window as any).runS3 === 'function') {
        return await (window as any).runS3();
      } else {
        throw new Error('runS3 function not found');
      }
    });
    
    const promise2 = page2.evaluate(async () => {
      if (typeof (window as any).runS3 === 'function') {
        return await (window as any).runS3();
      } else {
        throw new Error('runS3 function not found');
      }
    });
    
    await Promise.all([promise1, promise2]);
    
    // ✅ Then: refresh 호출 횟수 확인 (정확히 1회 - single-flight)
    console.log(`[E2E] Refresh call count: ${refreshCallCount}, calls:`, refreshCalls);
    expect(refreshCallCount).toBe(1);
    
    // ✅ Then: 명시적 이벤트/결과로 검증 (localStorage polling 금지)
    const refreshCompleted1 = await page1.evaluate(() => {
      return (window as any).__REFRESH_COMPLETED === true;
    });
    
    const refreshCompleted2 = await page2.evaluate(() => {
      return (window as any).__REFRESH_COMPLETED === true;
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
    
    // ✅ 상태 전이는 observable 결과로만 검증 (사용자 행위 중심)
    expect(storageStateAfter.refreshToken).toBe('new-refresh-token');
    expect(storageStateAfter2.refreshToken).toBe('new-refresh-token');
    
    await page1.close();
    await page2.close();
  });
});
