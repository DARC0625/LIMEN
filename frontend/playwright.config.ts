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
  // integration E2E는 별도 러너/야간으로 분리
  testMatch: isCI
    ? ['**/token-refresh.spec.ts']           // CI Gate: hermetic only
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
  projects: [
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
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:9444',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
