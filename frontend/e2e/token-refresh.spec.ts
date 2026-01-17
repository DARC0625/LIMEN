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
 * ✅ 명령 2) tokenManager는 브라우저에서 import 가능하게 ESM 번들로 만들어 route로 서빙
 * 
 * ✅ A안: esbuild 번들링에서 process/env 완전 치환
 * 브라우저 번들에서 process 자체가 사라지게 만들기
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
    // ✅ process.env 완전 치환 (브라우저에서 process가 사라지게)
    define: {
      'process.env.NODE_ENV': '"test"',
      'process.env.NEXT_PUBLIC_API_URL': '"/api"',
      'process.env.NEXT_PUBLIC_SENTRY_DSN': 'undefined',
      'process.env.NEXT_PUBLIC_ERROR_TRACKING_API': 'undefined',
      'process.env': '{}', // 나머지 모든 process.env 접근은 {}로 치환
    },
  });
  
  return result.outputFiles[0].text;
}

/**
 * ✅ 명령 1) harness는 IIFE로 번들링하여 window에 전역 함수 등록
 * 
 * 원인 A 해결: esbuild 번들이 ESM(export) 형태라 <script>로 넣어도 전역이 안 생김
 * 해결: harness 번들을 IIFE로 만들고 window에 명시적으로 붙이기
 */
async function buildHarnessIIFE(): Promise<string> {
  const harnessPath = join(__dirname, 'harness-entry.ts');
  
  const result = await esbuild.build({
    entryPoints: [harnessPath],
    bundle: true,
    write: false,
    format: 'iife', // ✅ IIFE로 변경 (전역 함수 생성)
    platform: 'browser',
    target: 'es2020',
    globalName: '__E2E__', // 필요시 전역 이름 지정
  });
  
  return result.outputFiles[0].text;
}

/**
 * ✅ 명령 3) page.setContent()로 완전 격리된 페이지 생성
 * 
 * 서버/라우팅/네트워크 없이도 100% 재현 가능
 * CI에서 네트워크/라우팅/정적파일/도메인 관련 변수가 싹 사라짐
 */
async function injectHarness(
  page: Page,
  tokenManagerESM: string,
  harnessIIFE: string
): Promise<void> {
  // ✅ 완전 격리된 페이지 생성
  await page.setContent('<html><head></head><body></body></html>', {
    waitUntil: 'domcontentloaded',
  });
  
  // ✅ tokenManager 주입 (ESM)
  await page.addScriptTag({
    content: tokenManagerESM,
    type: 'module',
  });
  
  // ✅ harness 주입 (IIFE - 전역 함수 자동 등록)
  await page.addScriptTag({
    content: harnessIIFE,
  });
  
  // ✅ 명령 1) harness는 반드시 페이지에 주입되고, 전역 함수가 생길 때까지 기다린다
  // harness JS가 실행됨
  // window.runS4 === 'function' / window.runS3 === 'function'이 됨
  // 그 다음에만 호출
  await page.waitForFunction(() => {
    return typeof (window as any).runS4 === 'function' &&
           typeof (window as any).runS3 === 'function';
  }, { timeout: 5000 });
}

/**
 * ✅ 명령 2) tokenManager는 브라우저에서 import 가능하게 ESM 번들로 만들어 route로 서빙
 * 
 * ✅ A안: esbuild 번들링에서 process/env 완전 치환
 * 브라우저 번들에서 process 자체가 사라지게 만들기
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
    // ✅ process.env 완전 치환 (브라우저에서 process가 사라지게)
    define: {
      'process.env.NODE_ENV': '"test"',
      'process.env.NEXT_PUBLIC_API_URL': '"/api"',
      'process.env.NEXT_PUBLIC_SENTRY_DSN': 'undefined',
      'process.env.NEXT_PUBLIC_ERROR_TRACKING_API': 'undefined',
      'process.env': '{}', // 나머지 모든 process.env 접근은 {}로 치환
    },
  });
  
  return result.outputFiles[0].text;
}


test.describe('토큰 꼬임 P0 - Refresh 경합 및 실패 처리 (Hermetic)', () => {
  // ✅ 명령 2) tokenManager ESM 번들 (한 번만 빌드)
  let tokenManagerESM: string;
  // ✅ 명령 1) harness IIFE 번들 (한 번만 빌드)
  let harnessIIFE: string;
  
  test.beforeAll(async () => {
    tokenManagerESM = await buildTokenManagerESM();
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
    
    // ✅ 명령 3) page.setContent()로 완전 격리된 페이지 생성
    await injectHarness(page, tokenManagerESM, harnessIIFE);

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
  // page.setContent()에서는 origin이 없어서 import가 실패할 수 있으므로
  // 주입된 ESM 번들을 직접 실행하여 window에 할당
  await page.evaluate(async (tokenManagerCode) => {
    // ESM 코드를 실행하여 모듈 가져오기
    const blob = new Blob([tokenManagerCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      const mod = await import(url);
      (window as any).__TOKEN_MANAGER = mod.tokenManager;
    } finally {
      URL.revokeObjectURL(url);
    }
  }, tokenManagerESM);

    // ✅ 명령 1) harness는 반드시 페이지에 주입되고, 전역 함수가 생길 때까지 기다린다
    // injectHarness에서 이미 waitForFunction으로 보장했지만, 추가 확인
    await page.waitForFunction(() => typeof (window as any).runS4 === 'function', { timeout: 5000 });

    // ✅ 명령 3) S4는 window.runS4() 호출로 트리거 (페이지 이동으로 트리거 ❌)
    await page.evaluate(async () => {
      await (window as any).runS4();
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
    
    // ✅ 명령 3) page.setContent()로 완전 격리된 페이지 생성
    // ✅ S3는 page1/page2 둘 다 동일하게 주입 + 각각 존재성 체크
    await injectHarness(page1, tokenManagerESM, harnessIIFE);
    await injectHarness(page2, tokenManagerESM, harnessIIFE);

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
    // page.setContent()에서는 origin이 없어서 import가 실패할 수 있으므로
    // 주입된 ESM 번들을 직접 실행하여 window에 할당
    await page1.evaluate(async (tokenManagerCode) => {
      const blob = new Blob([tokenManagerCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      try {
        const mod = await import(url);
        (window as any).__TOKEN_MANAGER = mod.tokenManager;
      } finally {
        URL.revokeObjectURL(url);
      }
    }, tokenManagerESM);
    
    await page2.evaluate(async (tokenManagerCode) => {
      const blob = new Blob([tokenManagerCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      try {
        const mod = await import(url);
        (window as any).__TOKEN_MANAGER = mod.tokenManager;
      } finally {
        URL.revokeObjectURL(url);
      }
    }, tokenManagerESM);

    // ✅ 명령 1) harness는 반드시 페이지에 주입되고, 전역 함수가 생길 때까지 기다린다
    // injectHarness에서 이미 waitForFunction으로 보장했지만, 추가 확인
    await page1.waitForFunction(() => typeof (window as any).runS3 === 'function', { timeout: 5000 });
    await page2.waitForFunction(() => typeof (window as any).runS3 === 'function', { timeout: 5000 });

    // ✅ 명령 3) 두 페이지에서 동시에 window.runS3() 호출 (함수 호출로 트리거)
    const promise1 = page1.evaluate(async () => {
      await (window as any).runS3();
    });
    
    const promise2 = page2.evaluate(async () => {
      await (window as any).runS3();
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
