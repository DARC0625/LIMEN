/**
 * Jest UI Configuration (jsdom Environment)
 * 
 * 정석 원칙: app/** 테스트와 브라우저 API 의존 테스트는 jsdom 환경에서 실행
 * *.ui.test.ts 파일은 jsdom 환경에서만 실행
 */
import type { Config } from 'jest';

const config: Config = {
  displayName: 'ui',
  testEnvironment: 'jsdom',
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
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
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
};

export default config;
