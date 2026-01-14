const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Next.js 앱의 경로를 제공하여 next.config.js와 .env 파일을 로드합니다
  dir: './',
})

// Jest에 전달할 커스텀 설정을 추가합니다
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // E2E 테스트 제외 (Playwright 전용)
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/', // Playwright E2E 전부 제외
  ],
  // API/유틸 테스트는 각 파일에 /** @jest-environment node */ 주석 추가
  // 또는 testEnvironment를 조건부로 설정 (nextJest 제약으로 주석 방식 권장)
}

// createJestConfig는 next/jest가 비동기적으로 Next.js 구성을 로드할 수 있도록 하는 함수를 내보냅니다
module.exports = createJestConfig(customJestConfig)
