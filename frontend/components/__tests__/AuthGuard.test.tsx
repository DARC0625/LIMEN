/**
 * AuthGuard 컴포넌트 테스트
 */

import { render, screen, waitFor, act } from '@testing-library/react'
import { usePathname, useRouter } from 'next/navigation'
import AuthGuard from '../AuthGuard'
import { checkAuth } from '../../lib/auth'
import { tokenManager } from '../../lib/tokenManager'

// 의존성 모킹
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('../../lib/auth', () => ({
  checkAuth: jest.fn(),
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

const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockCheckAuth = checkAuth as jest.MockedFunction<typeof checkAuth>
const mockTokenManager = tokenManager as jest.Mocked<typeof tokenManager>

describe('AuthGuard', () => {
  const mockRouter = {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUsePathname.mockReturnValue('/dashboard')
    mockUseRouter.mockReturnValue(mockRouter as any)
    mockTokenManager.hasValidToken.mockReturnValue(false)
    mockTokenManager.getExpiresAt.mockReturnValue(null)
    mockCheckAuth.mockResolvedValue({ valid: false, reason: 'Not authenticated' })
  })

  it('renders loading state initially', () => {
    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByText(/authenticating/i)).toBeInTheDocument()
  })

  it('redirects to login when not authenticated', async () => {
    mockTokenManager.hasValidToken.mockReturnValue(false)

    await act(async () => {
      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      )
    })

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/login')
    }, { timeout: 3000 })
  })

  it('renders children when authenticated', async () => {
    mockTokenManager.hasValidToken.mockReturnValue(true)
    mockCheckAuth.mockResolvedValue({ valid: true })

    await act(async () => {
      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})

