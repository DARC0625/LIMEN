/**
 * app/(protected)/layout.tsx 테스트
 */

import { render } from '@testing-library/react'
import ProtectedLayout from '../layout'

// 의존성 모킹
jest.mock('../../components/AuthGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('../../components/VersionInfo', () => ({
  VersionInfo: () => <div>Version Info</div>,
}))

describe('ProtectedLayout', () => {
  it('renders children', () => {
    const { getByText } = render(
      <ProtectedLayout>
        <div>Test Content</div>
      </ProtectedLayout>
    )

    expect(getByText('Test Content')).toBeInTheDocument()
  })

  it('renders VersionInfo', () => {
    const { getByText } = render(
      <ProtectedLayout>
        <div>Test</div>
      </ProtectedLayout>
    )

    expect(getByText('Version Info')).toBeInTheDocument()
  })
})
