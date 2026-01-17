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
import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ✅ 명령 1) harness 파일은 레포에 두지 말고 테스트에서 route로 서빙
 * Lint 영구 종결: 파일이 없으니 ESLint/TSConfig/빌드 규칙에 걸리지 않음
 */
const HARNESS_JS = `
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
 */
window.runS4 = async function() {
  console.log('[HARNESS] runS4: Starting refresh failure test');
  
  try {
    const tokenManager = await loadTokenManager();
    
    window.__SESSION_CLEARED = false;
    window.__REDIRECT_TO_LOGIN = null;
    
    // 만료된 토큰 상태로 설정 (refresh 트리거)
    const expiresAt = Date.now() - 1000;
    localStorage.setItem('refresh_token', 'test-refresh-token');
    localStorage.setItem('token_expires_at', expiresAt.toString());
    sessionStorage.setItem('csrf_token', 'test-csrf-token');
    
    // tokenManager.getAccessToken() 호출 → 자동 refresh 시도
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
 */
window.runS3 = async function() {
  console.log('[HARNESS] runS3: Starting multi-tab refresh test');
  
  try {
    const tokenManager = await loadTokenManager();
    
    window.__REFRESH_COMPLETED = false;
    
    // 만료된 토큰 상태로 설정 (refresh 트리거)
    const expiresAt = Date.now() - 1000;
    localStorage.setItem('refresh_token', 'test-refresh-token');
    localStorage.setItem('token_expires_at', expiresAt.toString());
    sessionStorage.setItem('csrf_token', 'test-csrf-token');
    
    window.__REFRESH_CALL_COUNT++;
    
    // tokenManager.getAccessToken() 호출 → 자동 refresh 시도
    const accessToken = await tokenManager.getAccessToken();
    
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
`;

const HARNESS_HTML = `<!doctype html>
<html>
<head>
  <script src="/harness.js"></script>
</head>
<body>
  <h1>Hermetic E2E Test</h1>
</body>
</html>`;

/**
 * ✅ 명령 2) tokenManager는 브라우저에서 import 가능하게 ESM 번들로 만들어 route로 서빙
 */
async function buildTokenManagerESM(): Promise<string> {
  const tokenManagerPath = join(__dirname, '../lib/tokenManager.ts');
  
  const result = await esbuild.build({
    entryPoints: [tokenManagerPath],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    external: ['next'], // Next.js는 외부 의존성으로 처리
  });
  
  return result.outputFiles[0].text;
}

/**
 * ✅ Hermetic E2E 표준: route-fulfill로 "가짜 HTTP origin" 생성 + harness.js 제공
 * 
 * ✅ 명령 4) route 모킹 규칙: "허용 리스트 방식"
 * 반드시 아래 3개는 항상 허용:
 * - / (HTML)
 * - /harness.js
 * - /lib/tokenManager.js
 * 
 * 그리고 나머지 API만 시나리오별로 mock
 */
async function setupHermeticRoutes(
  page: Page,
  tokenManagerESM: string,
  refreshMock: (route: any) => Promise<void>
) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const req = route.request();
    
    // ✅ 허용 리스트 1: / (HTML)
    if (url === 'http://local.test/' && req.resourceType() === 'document') {
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: HARNESS_HTML,
      });
    }
    
    // ✅ 허용 리스트 2: /harness.js
    if (url === 'http://local.test/harness.js') {
      return route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: HARNESS_JS,
      });
    }
    
    // ✅ 허용 리스트 3: /lib/tokenManager.js
    if (url === 'http://local.test/lib/tokenManager.js') {
      return route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: tokenManagerESM,
      });
    }
    
    // ✅ 나머지 API만 시나리오별로 mock
    await refreshMock(route);
  });
}

test.describe('토큰 꼬임 P0 - Refresh 경합 및 실패 처리 (Hermetic)', () => {
  // ✅ 명령 2) tokenManager ESM 번들 (한 번만 빌드)
  let tokenManagerESM: string;
  
  test.beforeAll(async () => {
    tokenManagerESM = await buildTokenManagerESM();
  });

  /**
   * S4: refresh 실패 시 강제 로그아웃 테스트
   */
  test('S4: refresh 실패 시 전역 세션 정리 및 강제 로그아웃', async ({ page, context }) => {
    // ✅ 네트워크 모킹: refresh endpoint만 정확히 fulfill (전부 204 금지)
    let refreshCallCount = 0;
    
    const refreshMock = async (route: any) => {
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
    };
    
    // ✅ 허용 리스트 방식으로 route 설정
    await setupHermeticRoutes(page, tokenManagerESM, refreshMock);
    
    // ✅ 명령 3) hermetic에서 페이지 이동은 local.test 한 번만
    await page.goto('http://local.test/', { waitUntil: 'domcontentloaded' });

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

    // ✅ tokenManager를 주입 (harness.js가 사용)
    await page.evaluate(async () => {
      const mod = await import('/lib/tokenManager.js');
      (window as any).__TOKEN_MANAGER = mod.tokenManager;
    });

    // ✅ 명령 3) S4는 window.runS4() 호출로 트리거 (페이지 이동으로 트리거 ❌)
    await page.evaluate(async () => {
      if (typeof (window as any).runS4 === 'function') {
        await (window as any).runS4();
      } else {
        throw new Error('runS4 function not found');
      }
    });

    // ✅ 명령 3) 검증은 polling(localStorage waitForFunction) 금지
    // ✅ 명시적 이벤트/결과로 검증
    const sessionCleared = await page.evaluate(() => {
      return (window as any).__SESSION_CLEARED === true;
    });
    
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
   */
  test('S3: 멀티탭 동시 refresh 경합 방지 (single-flight)', async ({ context }) => {
    // ✅ Given: 같은 context에서 2개 page 생성 (localStorage 공유)
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // ✅ 네트워크 모킹: refresh endpoint만 정확히 fulfill
    let refreshCallCount = 0;
    const refreshCalls: Array<{ timestamp: number }> = [];
    
    const refreshMock = async (route: any) => {
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
    };
    
    // ✅ 허용 리스트 방식으로 route 설정
    await setupHermeticRoutes(page1, tokenManagerESM, refreshMock);
    await setupHermeticRoutes(page2, tokenManagerESM, refreshMock);

    // ✅ 명령 3) hermetic에서 페이지 이동은 local.test 한 번만
    await page1.goto('http://local.test/', { waitUntil: 'domcontentloaded' });
    await page2.goto('http://local.test/', { waitUntil: 'domcontentloaded' });

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

    // ✅ tokenManager를 주입 (harness.js가 사용)
    await page1.evaluate(async () => {
      const mod = await import('/lib/tokenManager.js');
      (window as any).__TOKEN_MANAGER = mod.tokenManager;
    });
    
    await page2.evaluate(async () => {
      const mod = await import('/lib/tokenManager.js');
      (window as any).__TOKEN_MANAGER = mod.tokenManager;
    });

    // ✅ 명령 3) 두 페이지에서 동시에 window.runS3() 호출 (함수 호출로 트리거)
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
    
    // ✅ 명령 3) 검증은 명시적 이벤트/결과로 (localStorage polling 금지)
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
    
    expect(storageStateAfter.refreshToken).toBe('new-refresh-token');
    expect(storageStateAfter2.refreshToken).toBe('new-refresh-token');
    
    await page1.close();
    await page2.close();
  });
});
