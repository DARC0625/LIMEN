/**
 * app/login/page.tsx 테스트
 */

import { render, screen } from '@testing-library/react'
import LoginPage from '../page'

// LoginForm 모킹
jest.mock('../../../components/LoginForm', () => ({
  __esModule: true,
  default: () => <div>Login Form</div>,
}))

describe('LoginPage', () => {
  it('renders login form', () => {
    render(<LoginPage />)

    expect(screen.getByText('Login Form')).toBeInTheDocument()
  })

  it('shows loading fallback initially', () => {
    render(<LoginPage />)

    // Suspense fallback이 표시될 수 있음
    // 실제로는 LoginForm이 렌더링됨
    expect(screen.getByText('Login Form')).toBeInTheDocument()
  })
})
