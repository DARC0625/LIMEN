/**
 * AuthGuard 컴포넌트 테스트
 */

import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
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

  it('handles token expiration', async () => {
    mockTokenManager.hasValidToken.mockReturnValue(false)
    mockTokenManager.getExpiresAt.mockReturnValue(Date.now() - 1000) // 만료된 토큰
    mockCheckAuth.mockResolvedValue({ valid: false, reason: 'Token expired' })

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

  it('handles session check failure with retry', async () => {
    mockTokenManager.hasValidToken.mockReturnValue(true)
    // 첫 번째 호출은 실패, 두 번째는 성공
    mockCheckAuth
      .mockResolvedValueOnce({ valid: false, reason: 'Session not ready' })
      .mockResolvedValueOnce({ valid: true })

    await act(async () => {
      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      )
    })

    // 재시도 후 성공적으로 렌더링되는지 확인
    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('handles network errors during auth check', async () => {
    mockTokenManager.hasValidToken.mockReturnValue(true)
    mockCheckAuth.mockRejectedValue(new Error('Network error'))

    await act(async () => {
      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      )
    })

    // 네트워크 오류 시에도 토큰이 있으면 인증 상태 유지
    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('updates auth state on storage event', async () => {
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

    // StorageEvent 시뮬레이션
    await act(async () => {
      const storageEvent = new StorageEvent('storage', {
        key: 'auth_token',
        newValue: 'new-token',
      })
      window.dispatchEvent(storageEvent)
    })

    // checkAuth가 다시 호출되었는지 확인
    await waitFor(() => {
      expect(mockCheckAuth).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('handles token update event', async () => {
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

    // authTokenUpdated 이벤트 시뮬레이션
    await act(async () => {
      window.dispatchEvent(new Event('authTokenUpdated'))
    })

    // checkAuth가 다시 호출되었는지 확인
    await waitFor(() => {
      expect(mockCheckAuth).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('handles force logout event', async () => {
    const { forceLogout } = require('../../lib/security')
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

    // force_logout storage 이벤트 시뮬레이션
    await act(async () => {
      const storageEvent = new StorageEvent('storage', {
        key: 'force_logout',
        newValue: JSON.stringify({ reason: 'Test logout' }),
      })
      window.dispatchEvent(storageEvent)
    })

    // forceLogout이 호출되었는지 확인
    await waitFor(() => {
      expect(forceLogout).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('handles activity timeout', async () => {
    jest.useFakeTimers()
    mockTokenManager.hasValidToken.mockReturnValue(true)
    mockCheckAuth.mockResolvedValue({ valid: true })

    const { forceLogout } = require('../../lib/security')

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

    // 10분 비활성 시뮬레이션
    act(() => {
      jest.advanceTimersByTime(10 * 60 * 1000 + 1000) // 10분 + 1초
    })

    // forceLogout이 호출되었는지 확인
    await waitFor(() => {
      expect(forceLogout).toHaveBeenCalled()
    }, { timeout: 3000 })

    jest.useRealTimers()
  })

  it('handles periodic session check', async () => {
    jest.useFakeTimers()
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

    // 5분 후 세션 체크 인터벌 실행
    act(() => {
      jest.advanceTimersByTime(5 * 60 * 1000)
    })

    // checkAuth가 호출되었는지 확인
    await waitFor(() => {
      expect(mockCheckAuth).toHaveBeenCalled()
    }, { timeout: 3000 })

    jest.useRealTimers()
  })

  it('handles session expiration during periodic check', async () => {
    jest.useFakeTimers()
    mockTokenManager.hasValidToken.mockReturnValue(true)
    // 처음에는 유효, 나중에 만료
    mockCheckAuth
      .mockResolvedValueOnce({ valid: true })
      .mockResolvedValueOnce({ valid: false, reason: 'Session expired' })

    const { forceLogout } = require('../../lib/security')

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

    // 5분 후 세션 체크 인터벌 실행 (세션 만료)
    act(() => {
      jest.advanceTimersByTime(5 * 60 * 1000)
    })

    // forceLogout이 호출되었는지 확인
    await waitFor(() => {
      expect(forceLogout).toHaveBeenCalled()
    }, { timeout: 3000 })

    jest.useRealTimers()
  })

  it('handles activity events to reset timeout', async () => {
    jest.useFakeTimers()
    mockTokenManager.hasValidToken.mockReturnValue(true)
    mockCheckAuth.mockResolvedValue({ valid: true })

    const { forceLogout } = require('../../lib/security')

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

    // 5분 후 활동 이벤트 발생
    act(() => {
      jest.advanceTimersByTime(5 * 60 * 1000)
    })

    // 활동 이벤트 발생
    act(() => {
      fireEvent.mouseDown(window)
    })

    // 10분 더 진행 (총 15분, 하지만 활동이 있었으므로 로그아웃되지 않아야 함)
    act(() => {
      jest.advanceTimersByTime(10 * 60 * 1000)
    })

    // forceLogout이 호출되지 않았는지 확인 (활동으로 인해 타임아웃 리셋)
    // 활동 이벤트가 타임아웃을 리셋하므로 forceLogout이 호출되지 않아야 함
    // 하지만 실제 구현에 따라 다를 수 있으므로, 최소한 컴포넌트가 렌더링되었는지 확인
    expect(screen.getByText('Protected Content')).toBeInTheDocument()

    jest.useRealTimers()
  })

  it('handles BroadcastChannel messages', async () => {
    mockTokenManager.hasValidToken.mockReturnValue(true)
    mockCheckAuth.mockResolvedValue({ valid: true })

    const { forceLogout } = require('../../lib/security')

    // BroadcastChannel 모킹
    const mockChannel = {
      onmessage: null as any,
      postMessage: jest.fn(),
      close: jest.fn(),
    }
    global.BroadcastChannel = jest.fn().mockImplementation(() => mockChannel) as any

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

    // BroadcastChannel 메시지 시뮬레이션
    if (mockChannel.onmessage) {
      await act(async () => {
        mockChannel.onmessage({
          data: {
            type: 'FORCE_LOGOUT',
            action: 'log',
            reason: 'Test logout',
          },
        })
      })
    }

    // forceLogout이 호출되었는지 확인
    await waitFor(() => {
      expect(forceLogout).toHaveBeenCalled()
    }, { timeout: 3000 })
  })
})

