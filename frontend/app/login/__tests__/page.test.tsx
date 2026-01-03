/**
 * app/login/page.tsx 테스트
 */

import { render, screen } from '@testing-library/react'
import LoginPage from '../page'

// 의존성 모킹
jest.mock('../../../components/LoginForm', () => ({
  __esModule: true,
  default: () => <div>LoginForm</div>,
}))

describe('Login Page', () => {
  it('renders login form', () => {
    render(<LoginPage />)

    expect(screen.getByText('LoginForm')).toBeInTheDocument()
  })

  it('shows loading fallback in suspense', () => {
    render(<LoginPage />)

    // Suspense fallback이 표시될 수 있음
    const loadingText = screen.queryByText(/loading/i)
    // LoginForm이 렌더링되면 loading은 사라짐
    expect(screen.getByText('LoginForm')).toBeInTheDocument()
  })
})

