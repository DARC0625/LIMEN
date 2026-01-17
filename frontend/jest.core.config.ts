/**
 * Jest Core Configuration (Node Environment)
 * 
 * 정석 원칙: lib/** 테스트는 node 환경에서 돌아가야 함
 * 브라우저 API 의존 테스트는 *.ui.test.ts로 분리하여 jsdom 환경에서 실행
 */
import type { Config } from 'jest';

const config: Config = {
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
  // setupFilesAfterEnv는 core에서는 최소화 (브라우저 의존 제거)
  setupFilesAfterEnv: [],
};

export default config;
