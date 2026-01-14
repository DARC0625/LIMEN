import { test, expect } from '@playwright/test';

/**
 * 브라우저 호환성 진단 테스트
 * 
 * DoD:
 * (1) 페이지 접속 성공 여부
 * (2) API 호출(health/me 등) 성공 여부
 * (3) 콘솔 버튼 클릭 후 WS 연결 시도 여부
 * 
 * 실행:
 * BASE_URL="https://limen.kr" npm run test:compatibility
 * BASE_URL="https://limen.kr" npm run test:compatibility -- --project=chromium
 * BASE_URL="https://limen.kr" npm run test:compatibility -- --project=firefox
 * BASE_URL="https://limen.kr" npm run test:compatibility -- --project=webkit
 */

const TEST_USERNAME = process.env.TEST_USERNAME || 'test';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'test';

// ✅ 통합 E2E 태그: CI Gate에서 제외
// 실서버/계정 의존이 있으므로 CI에서는 제외, 별도 러너/야간으로 분리
test.describe('브라우저 호환성 진단', { tag: '@integration' }, () => {
  test('최소 시나리오: 페이지 로드 + 로그인 + 콘솔 연결 버튼', async ({ page, browserName }) => {
    const logs: string[] = [];
    const errors: string[] = [];
    const networkRequests: { url: string; status?: number; error?: string }[] = [];

    // 콘솔 로그 수집
    page.on('console', (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`;
      logs.push(text);
      console.log(`[Browser Console] ${text}`);
    });

    // 에러 수집
    page.on('pageerror', (error) => {
      const errorText = `${error.name}: ${error.message}`;
      errors.push(errorText);
      console.error(`[Page Error] ${errorText}`);
    });

    // 네트워크 요청 수집
    page.on('response', (response) => {
      const url = response.url();
      const status = response.status();
      networkRequests.push({ url, status });
    });

    page.on('requestfailed', (request) => {
      const url = request.url();
      const failure = request.failure()?.errorText || 'Unknown error';
      networkRequests.push({ url, error: failure });
    });

    // (1) 페이지 접속 성공 여부
    console.log(`[${browserName}] 1. 페이지 접속 시도...`);
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    
    // 페이지가 로드되었는지 확인
    await expect(page).toHaveTitle(/Limen|LIMEN/i, { timeout: 10000 });
    console.log(`[${browserName}] ✅ 페이지 접속 성공`);

    // (2) API 호출(health) 성공 여부
    console.log(`[${browserName}] 2. Health API 호출 시도...`);
    
    // Health API 호출 확인 (로그인 페이지에서 자동 호출됨)
    const healthRequest = networkRequests.find(req => 
      req.url.includes('/api/health') || req.url.includes('/health')
    );
    
    if (healthRequest) {
      if (healthRequest.status && healthRequest.status < 400) {
        console.log(`[${browserName}] ✅ Health API 호출 성공 (${healthRequest.status})`);
      } else {
        console.warn(`[${browserName}] ⚠️ Health API 호출 실패: ${healthRequest.error || healthRequest.status}`);
      }
    } else {
      console.warn(`[${browserName}] ⚠️ Health API 호출을 찾을 수 없음`);
    }

    // 로그인 페이지 확인
    const isLoginPage = await page.locator('input[type="text"], input[type="email"], input[name*="user"], input[name*="name"]').count() > 0;
    
    if (isLoginPage) {
      console.log(`[${browserName}] 3. 로그인 시도...`);
      
      // 로그인 폼 찾기
      const usernameInput = page.locator('input[type="text"], input[type="email"], input[name*="user"], input[name*="name"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("로그인"), button:has-text("Login")').first();

      if (await usernameInput.count() > 0 && await passwordInput.count() > 0) {
        await usernameInput.fill(TEST_USERNAME);
        await passwordInput.fill(TEST_PASSWORD);
        
        // 로그인 버튼 클릭
        await submitButton.click();
        
        // 로그인 완료 대기 (대시보드 또는 VM 목록 페이지로 이동)
        await page.waitForURL(/\/(dashboard|vms|protected)/, { timeout: 15000 }).catch(() => {
          console.warn(`[${browserName}] ⚠️ 로그인 후 리다이렉트 대기 시간 초과`);
        });
        
        console.log(`[${browserName}] ✅ 로그인 시도 완료 (현재 URL: ${page.url()})`);
      } else {
        console.warn(`[${browserName}] ⚠️ 로그인 폼을 찾을 수 없음`);
      }
    } else {
      console.log(`[${browserName}] 이미 로그인된 상태로 보임`);
    }

    // 대시보드 또는 VM 목록 페이지에서 API 호출 확인
    console.log(`[${browserName}] 4. /api/me 호출 확인...`);
    await page.waitForTimeout(2000); // API 호출 대기
    
    const meRequest = networkRequests.find(req => 
      req.url.includes('/api/me') || req.url.includes('/me')
    );
    
    if (meRequest) {
      if (meRequest.status && meRequest.status < 400) {
        console.log(`[${browserName}] ✅ /api/me 호출 성공 (${meRequest.status})`);
      } else {
        console.warn(`[${browserName}] ⚠️ /api/me 호출 실패: ${meRequest.error || meRequest.status}`);
      }
    } else {
      console.warn(`[${browserName}] ⚠️ /api/me 호출을 찾을 수 없음`);
    }

    // (3) 콘솔 연결 버튼 클릭 후 WS 연결 시도 여부
    console.log(`[${browserName}] 5. 콘솔 연결 버튼 찾기...`);
    
    // VNC 콘솔 버튼 찾기 (aria-label 또는 href에 vnc가 포함된 링크/버튼)
    const consoleButton = page.locator(
      'a[href*="/vnc/"], button[aria-label*="VNC"], button[aria-label*="console"], button[aria-label*="콘솔"]'
    ).first();

    if (await consoleButton.count() > 0) {
      console.log(`[${browserName}] 콘솔 버튼 발견, 클릭 시도...`);
      
      // WebSocket 연결 시도 감지를 위한 리스너
      let wsConnected = false;
      const wsListener = (request: any) => {
        const url = request.url();
        if (url.startsWith('ws://') || url.startsWith('wss://')) {
          wsConnected = true;
          console.log(`[${browserName}] ✅ WebSocket 연결 시도 감지: ${url}`);
        }
      };
      page.on('request', wsListener);

      // 콘솔 버튼 클릭
      await consoleButton.click();
      
      // VNC 페이지로 이동 대기
      await page.waitForURL(/\/vnc\//, { timeout: 10000 }).catch(() => {
        console.warn(`[${browserName}] ⚠️ VNC 페이지로 이동하지 않음`);
      });

      // WebSocket 연결 대기
      await page.waitForTimeout(3000);
      
      if (wsConnected) {
        console.log(`[${browserName}] ✅ WebSocket 연결 시도 확인됨`);
      } else {
        console.warn(`[${browserName}] ⚠️ WebSocket 연결 시도가 감지되지 않음`);
      }

      page.off('request', wsListener);
    } else {
      console.warn(`[${browserName}] ⚠️ 콘솔 연결 버튼을 찾을 수 없음 (VM이 없거나 실행 중이지 않을 수 있음)`);
    }

    // 결과 요약 출력
    console.log(`\n[${browserName}] ====== 진단 결과 요약 ======`);
    console.log(`[${browserName}] 페이지 접속: ✅`);
    console.log(`[${browserName}] Health API: ${healthRequest && healthRequest.status && healthRequest.status < 400 ? '✅' : '⚠️'}`);
    console.log(`[${browserName}] /api/me: ${meRequest && meRequest.status && meRequest.status < 400 ? '✅' : '⚠️'}`);
    console.log(`[${browserName}] 콘솔 버튼: ${await consoleButton.count() > 0 ? '✅' : '⚠️'}`);
    console.log(`[${browserName}] 에러 개수: ${errors.length}`);
    console.log(`[${browserName}] 네트워크 요청 개수: ${networkRequests.length}`);
    
    if (errors.length > 0) {
      console.log(`[${browserName}] 에러 목록:`);
      errors.forEach((error, index) => {
        console.log(`[${browserName}]   ${index + 1}. ${error}`);
      });
    }
  });
});
