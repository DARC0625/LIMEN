import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 설정 - 브라우저 호환성 진단용
 * 
 * BASE_URL 환경 변수로 테스트 대상 URL 지정
 * 예: BASE_URL="https://limen.kr" npm run test:compatibility
 */
const baseURL = process.env.BASE_URL || 'http://localhost:9444';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
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
