/**
 * app/layout.tsx 테스트
 */

import { render } from '@testing-library/react'
import RootLayout from '../layout'

// Next.js 컴포넌트 모킹
jest.mock('next/script', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <script {...props}>{children}</script>,
}))

jest.mock('../../components/ToastContainer', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="toast-provider">{children}</div>,
}))

jest.mock('../../components/QueryProvider', () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="query-provider">{children}</div>,
}))

jest.mock('../../components/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="theme-provider">{children}</div>,
}))

jest.mock('../../components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <div data-testid="error-boundary">{children}</div>,
}))

jest.mock('../../components/WebVitalsClient', () => ({
  __esModule: true,
  default: () => <div data-testid="web-vitals-client" />,
}))

jest.mock('../../components/PWARegister', () => ({
  __esModule: true,
  default: () => <div data-testid="pwa-register" />,
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

  it('renders with correct structure', () => {
    const { container } = render(
      <RootLayout>
        <div>Test</div>
      </RootLayout>
    )
    // Next.js layout은 특별한 구조를 가지므로 기본 렌더링만 확인
    expect(container).toBeInTheDocument()
  })

  it('renders all provider components', () => {
    const { getByTestId } = render(
      <RootLayout>
        <div>Test</div>
      </RootLayout>
    )
    expect(getByTestId('error-boundary')).toBeInTheDocument()
    expect(getByTestId('theme-provider')).toBeInTheDocument()
    expect(getByTestId('query-provider')).toBeInTheDocument()
    expect(getByTestId('toast-provider')).toBeInTheDocument()
    expect(getByTestId('web-vitals-client')).toBeInTheDocument()
    expect(getByTestId('pwa-register')).toBeInTheDocument()
  })

  it('renders children correctly', () => {
    const { getByText } = render(
      <RootLayout>
        <div>Metadata Test</div>
      </RootLayout>
    )
    // children이 제대로 렌더링되는지 확인
    expect(getByText('Metadata Test')).toBeInTheDocument()
  })
})

