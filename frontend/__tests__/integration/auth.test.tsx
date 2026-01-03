/**
 * 인증 통합 테스트
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginForm from '../../components/LoginForm'
import RegisterForm from '../../components/RegisterForm'
import { authAPI } from '../../lib/api'

// 의존성 모킹
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}))

jest.mock('../../lib/api', () => ({
  authAPI: {
    login: jest.fn(),
    register: jest.fn(),
  },
  setToken: jest.fn(),
  setTokens: jest.fn(),
}))

jest.mock('../../components/ToastContainer', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  }),
}))

global.fetch = jest.fn()

const mockAuthAPI = authAPI as jest.Mocked<typeof authAPI>

describe('Authentication Integration', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    } as Response)
  })

  it('renders login form in query provider', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <LoginForm />
      </QueryClientProvider>
    )

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('renders register form in query provider', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <RegisterForm />
      </QueryClientProvider>
    )

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    // password 필드가 여러 개이므로 getAllByLabelText 사용
    const passwordFields = screen.getAllByLabelText(/password/i)
    expect(passwordFields.length).toBeGreaterThan(0)
  })
})

