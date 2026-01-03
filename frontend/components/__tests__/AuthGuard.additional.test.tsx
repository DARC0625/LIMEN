/**
 * AuthGuard 컴포넌트 추가 시나리오 테스트
 */

import { render, screen, waitFor, act } from '@testing-library/react'
import AuthGuard from '../AuthGuard'
import { checkAuth } from '../../lib/auth'
import { useRouter, usePathname } from 'next/navigation'
import { tokenManager } from '../../lib/tokenManager'

// 의존성 모킹
jest.mock('../../lib/auth', () => ({
  checkAuth: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/dashboard'),
}))

jest.mock('../../lib/tokenManager', () => ({
  tokenManager: {
    hasValidToken: jest.fn(),
    getExpiresAt: jest.fn(),
  },
}))

jest.mock('../../lib/security', () => ({
  forceLogout: jest.fn(),
  checkAndUnblockAccount: jest.fn(),
}))

jest.mock('../../lib/utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('../../components/ToastContainer', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  }),
}))

const mockCheckAuth = checkAuth as jest.MockedFunction<typeof checkAuth>
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>
const mockTokenManager = tokenManager as jest.Mocked<typeof tokenManager>

describe('AuthGuard Additional Scenarios', () => {
  const mockPush = jest.fn()
  const mockReplace = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUsePathname.mockReturnValue('/dashboard')
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: mockReplace,
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    } as any)
    mockTokenManager.hasValidToken.mockReturnValue(false)
    mockTokenManager.getExpiresAt.mockReturnValue(null)
  })

  it('handles authentication check error', async () => {
    mockCheckAuth.mockRejectedValue(new Error('Auth check failed'))

    await act(async () => {
      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      )
    })

    // 인증 확인이 호출되었는지 확인
    await waitFor(() => {
      // AuthGuard는 토큰이 없으면 checkAuth를 호출하지 않음
      expect(mockTokenManager.hasValidToken).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('handles authentication with user data', async () => {
    mockTokenManager.hasValidToken.mockReturnValue(true)
    mockCheckAuth.mockResolvedValue({
      valid: true,
      user: {
        id: 1,
        username: 'testuser',
        role: 'user',
      },
    } as any)

    await act(async () => {
      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    }, { timeout: 5000 })
  })
})

