/**
 * Jest Core Configuration (Node 환경)
 * 
 * ✅ P0-3: next/jest transform 사용
 */
const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });

module.exports = createJestConfig({
  displayName: 'core',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/lib/**/__tests__/**/*.test.ts',
    '<rootDir>/lib/**/__tests__/**/*.test.tsx',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/',
    'browser.test',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    '!lib/**/*.d.ts',
    '!lib/**/*.test.{ts,tsx}',
    '!lib/**/*.browser.test.{ts,tsx}',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.core.setup.js'], // ✅ P1-Next-Fix-1: analytics 테스트를 위해 window mock 추가
});
