/**
 * app/(protected)/layout.tsx 테스트
 */

import { render } from '@testing-library/react'
import ProtectedLayout from '../layout'

jest.mock('../../../components/AuthGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-guard">{children}</div>,
}))

describe('ProtectedLayout', () => {
  it('renders children', () => {
    const { getByText, getByTestId } = render(
      <ProtectedLayout>
        <div>Protected Content</div>
      </ProtectedLayout>
    )
    expect(getByText('Protected Content')).toBeInTheDocument()
    expect(getByTestId('auth-guard')).toBeInTheDocument()
  })

  it('wraps children with AuthGuard', () => {
    const { getByTestId } = render(
      <ProtectedLayout>
        <div>Test</div>
      </ProtectedLayout>
    )
    const authGuard = getByTestId('auth-guard')
    expect(authGuard).toBeInTheDocument()
    expect(authGuard).toHaveTextContent('Test')
  })
})

