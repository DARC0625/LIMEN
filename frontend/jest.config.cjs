/**
 * Jest Main Configuration
 * 
 * ✅ 정석: Jest를 core(node) / ui(jsdom) 2프로젝트로 분리
 * - core: lib/** 테스트 (node 환경)
 * - ui: app/** 테스트 및 브라우저 의존 테스트 (jsdom 환경)
 * 
 * Next.js 통합: nextJest를 사용하여 Next.js 설정 로드
 * 
 * ✅ Jest config를 JS로 유지하여 ts-node 요구사항 제거
 */
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Next.js 앱의 경로를 제공하여 next.config.js와 .env 파일을 로드
  dir: './',
});

// Core 프로젝트 설정 (node 환경)
const coreConfig = {
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
};

// UI 프로젝트 설정 (jsdom 환경)
const uiConfig = {
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
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

// Jest 설정 생성 (비동기)
module.exports = async () => {
  // UI 프로젝트에만 nextJest 설정 적용
  const baseConfig = await createJestConfig(uiConfig);
  
  // Core 프로젝트에도 TypeScript transform 설정 추가
  const coreWithTransform = {
    ...coreConfig,
    transform: baseConfig.transform,
    moduleNameMapper: {
      ...coreConfig.moduleNameMapper,
      ...baseConfig.moduleNameMapper,
    },
  };
  
  // UI 프로젝트 설정 병합
  const uiWithNext = {
    ...baseConfig,
    ...uiConfig,
    testEnvironment: 'jest-environment-jsdom', // 프로젝트별 설정 유지
  };
  
  return {
    projects: [coreWithTransform, uiWithNext],
  };
};
