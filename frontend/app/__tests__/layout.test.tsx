/**
 * app/layout.tsx 테스트
 */

import { render } from '@testing-library/react'
import RootLayout from '../layout'

// 의존성 모킹
jest.mock('../../components/ToastContainer', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('../../components/QueryProvider', () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('../../components/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('../../components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('../../components/WebVitalsClient', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('../../components/PWARegister', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('../../components/VersionInfo', () => ({
  VersionInfo: () => null,
}))

jest.mock('next/script', () => ({
  __esModule: true,
  default: () => null,
}))

describe('RootLayout', () => {
  it('renders children', () => {
    const { getByText } = render(
      <RootLayout>
        <div>Test Content</div>
      </RootLayout>
    )

    expect(getByText('Test Content')).toBeInTheDocument()
  })

  it('renders with metadata', () => {
    const { container } = render(
      <RootLayout>
        <div>Test</div>
      </RootLayout>
    )

    // children이 렌더링되는지 확인
    expect(container.textContent).toContain('Test')
  })
})
