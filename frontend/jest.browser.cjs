/**
 * Jest Browser Configuration (jsdom 환경)
 * 
 * ✅ P0-3: next/jest transform 사용
 */
const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });

module.exports = createJestConfig({
  displayName: 'browser',
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/**/?(*.)browser.test.ts?(x)'],
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
    'lib/auth/**/*.{ts,tsx}',
    '!app/**/*.d.ts',
    '!app/**/*.test.{ts,tsx}',
    '!components/**/*.test.{ts,tsx}',
    '!hooks/**/*.test.{ts,tsx}',
    '!lib/**/*.browser.test.{ts,tsx}',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
});
