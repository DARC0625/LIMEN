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
  // ✅ Hermetic: page.goto 제거로 webServer 불필요
  // setContent로 빈 페이지 생성하므로 실제 서버 불필요
  // 모든 네트워크는 page.route()로 완전 모킹
  webServer: undefined, // ✅ Hermetic은 실제 서버 의존 없음
});
