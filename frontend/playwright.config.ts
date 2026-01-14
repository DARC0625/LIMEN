import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 설정 - 브라우저 호환성 진단용
 * 
 * BASE_URL 환경 변수로 테스트 대상 URL 지정
 * 예: BASE_URL="https://limen.kr" npm run test:compatibility
 */
const baseURL = process.env.BASE_URL || 'http://localhost:9444';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  // ✅ CI Gate: hermetic만 실행 (파일 단위 exclude)
  // - PR Gate (ci-frontend.yml): token-refresh.spec.ts만 실행
  // - Nightly (nightly-e2e.yml): token-refresh.spec.ts만 실행 (hermetic cross-browser)
  // - Integration: nightly-e2e.yml에서 별도 job으로 실행 (vm-console-e2e.spec.ts, compatibility.spec.ts)
  // integration E2E는 별도 러너/야간으로 분리
  testMatch: isCI
    ? ['**/token-refresh.spec.ts']           // CI/Nightly: hermetic only
    : ['**/*.spec.ts'],                      // 로컬: 전체
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 0 : 0, // ✅ hermetic은 retry=0 (deterministic이어야 함)
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL,
    trace: isCI ? 'on-first-retry' : 'on-first-retry', // ✅ hermetic은 trace on first failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // ✅ CI Gate: chromium-only (firefox/webkit는 nightly로 분리)
  // PR CI는 빠르고 안정적인 hermetic만 실행
  projects: isCI
    ? [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ]
    : [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'firefox',
          use: { ...devices['Desktop Firefox'] },
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
        },
      ],
  // ✅ Hermetic: 최소한의 dev server는 필요 (localStorage 접근을 위한 유효한 origin)
  // 백엔드는 모킹하지만, 프론트 dev server는 필요
  // CI에서도 webServer 실행 (hermetic은 백엔드 모킹이지, 프론트 서버까지 제거하는 게 아님)
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npm run dev -- --port 9444',
    url: 'http://127.0.0.1:9444',
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
