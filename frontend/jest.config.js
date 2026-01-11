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
}

// createJestConfig는 next/jest가 비동기적으로 Next.js 구성을 로드할 수 있도록 하는 함수를 내보냅니다
module.exports = createJestConfig(customJestConfig)
