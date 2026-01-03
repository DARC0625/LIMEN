/**
 * LoginForm 컴포넌트 테스트
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import LoginForm from '../LoginForm'
import { authAPI } from '../../lib/api'

// 의존성 모킹
const mockPush = jest.fn()
const mockGet = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: mockGet,
  }),
}))

jest.mock('../../lib/api', () => ({
  authAPI: {
    login: jest.fn(),
  },
  setToken: jest.fn(),
  setTokens: jest.fn(),
}))

// fetch 모킹
global.fetch = jest.fn()

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGet.mockReturnValue(null)

    // 기본적으로 헬스체크 성공
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    } as Response)
  })

  it('renders login form', () => {
    render(<LoginForm />)
    
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('displays error from URL parameter', () => {
    mockGet.mockReturnValue('Authentication failed')
    
    render(<LoginForm />)
    
    expect(screen.getByText(/authentication failed/i)).toBeInTheDocument()
  })

  it('handles form submission', async () => {
    const mockLogin = authAPI.login as jest.MockedFunction<typeof authAPI.login>
    mockLogin.mockResolvedValue({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 900,
    } as any)

    render(<LoginForm />)

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'testpass' } })

    await act(async () => {
      fireEvent.click(submitButton)
    })

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'testpass',
      })
    }, { timeout: 3000 })
  })

  it('displays error when login fails', async () => {
    const mockLogin = authAPI.login as jest.MockedFunction<typeof authAPI.login>
    mockLogin.mockRejectedValue(new Error('Invalid credentials'))

    render(<LoginForm />)

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } })

    await act(async () => {
      fireEvent.click(submitButton)
    })

    await waitFor(() => {
      expect(screen.queryByText(/invalid credentials|authentication failed/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('validates empty username', async () => {
    render(<LoginForm />)

    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(passwordInput, { target: { value: 'testpass' } })

    await act(async () => {
      fireEvent.click(submitButton)
    })

    // 유효성 검증 메시지가 표시되는지 확인 (한국어 또는 영어)
    await waitFor(() => {
      const errorMessage = screen.queryByText(/사용자 이름|username|입력해주세요|required/i)
      expect(errorMessage).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('validates empty password', async () => {
    render(<LoginForm />)

    const usernameInput = screen.getByLabelText(/username/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })

    await act(async () => {
      fireEvent.click(submitButton)
    })

    // 유효성 검증 메시지가 표시되는지 확인 (한국어 또는 영어)
    await waitFor(() => {
      const errorMessage = screen.queryByText(/비밀번호|password|입력해주세요|required/i)
      expect(errorMessage).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})
