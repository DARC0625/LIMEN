const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Next.js 앱의 경로를 제공하여 next.config.js와 .env 파일을 로드합니다
  dir: './',
})

// Jest에 전달할 커스텀 설정을 추가합니다
const customJestConfig = {
  // ✅ 정석: Jest를 core(node) / ui(jsdom) 2프로젝트로 분리
  projects: [
    // Core 프로젝트 (node 환경)
    {
      displayName: 'core',
      testEnvironment: 'node',
      roots: ['<rootDir>/lib'],
      testMatch: [
        '**/__tests__/**/*.test.ts',
        '**/__tests__/**/*.test.tsx',
      ],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/e2e/',
        '\\.ui\\.test\\.ts$', // UI 테스트는 제외
        '\\.ui\\.test\\.tsx$', // UI 테스트는 제외
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      collectCoverageFrom: [
        'lib/**/*.{ts,tsx}',
        '!lib/**/*.d.ts',
        '!lib/**/*.test.{ts,tsx}',
        '!lib/**/*.ui.test.{ts,tsx}',
      ],
      setupFilesAfterEnv: [], // core는 브라우저 의존 제거
      // TypeScript 파싱을 위해 nextJest의 transform 설정 사용
      transform: {
        '^.+\\.(ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
      },
    },
    // UI 프로젝트 (jsdom 환경)
    {
      displayName: 'ui',
      testEnvironment: 'jest-environment-jsdom',
      roots: ['<rootDir>'],
      testMatch: [
        '**/__tests__/**/*.ui.test.ts',
        '**/__tests__/**/*.ui.test.tsx',
        '**/app/**/__tests__/**/*.test.{ts,tsx}',
        '**/components/**/__tests__/**/*.test.{ts,tsx}',
        '**/hooks/**/__tests__/**/*.test.{ts,tsx}',
      ],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/e2e/',
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      collectCoverageFrom: [
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
        '!app/**/*.d.ts',
        '!app/**/*.test.{ts,tsx}',
        '!components/**/*.test.{ts,tsx}',
        '!hooks/**/*.test.{ts,tsx}',
      ],
    },
  ],
  // E2E 테스트 제외 (Playwright 전용)
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/', // Playwright E2E 전부 제외
  ],
}

// createJestConfig는 next/jest가 비동기적으로 Next.js 구성을 로드할 수 있도록 하는 함수를 내보냅니다
// UI 프로젝트에만 nextJest 설정 적용
module.exports = async () => {
  const baseConfig = await createJestConfig(customJestConfig);
  
  // Core 프로젝트에도 TypeScript transform 설정 추가
  const coreProject = baseConfig.projects?.find((p) => p.displayName === 'core');
  if (coreProject) {
    // nextJest의 transform 설정을 core 프로젝트에도 적용
    if (baseConfig.transform) {
      coreProject.transform = baseConfig.transform;
    }
    // moduleNameMapper도 적용
    if (baseConfig.moduleNameMapper) {
      coreProject.moduleNameMapper = {
        ...coreProject.moduleNameMapper,
        ...baseConfig.moduleNameMapper,
      };
    }
  }
  
  // UI 프로젝트에만 nextJest 설정 적용
  const uiProject = baseConfig.projects?.find((p) => p.displayName === 'ui');
  if (uiProject) {
    // nextJest가 이미 적용된 설정을 UI 프로젝트에 병합
    Object.assign(uiProject, baseConfig);
    // testEnvironment는 프로젝트별 설정 유지
    uiProject.testEnvironment = 'jest-environment-jsdom';
  }
  
  return {
    ...baseConfig,
    projects: baseConfig.projects || customJestConfig.projects,
  };
};
