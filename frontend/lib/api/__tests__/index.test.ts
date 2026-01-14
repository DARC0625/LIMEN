/**
 * api/index.ts 테스트
 * @jest-environment node
 */

// ✅ Mock dependencies를 import 이전에 선언 (mock 먼저, import 나중)
jest.mock('../../tokenManager', () => ({
  tokenManager: {
    getAccessToken: jest.fn(),
    getCSRFToken: jest.fn(),
    clearTokens: jest.fn(),
    setTokens: jest.fn(),
  },
}))

jest.mock('../../utils/token', () => ({
  getUserRoleFromToken: jest.fn(),
  isUserApprovedFromToken: jest.fn(),
}))

jest.mock('../auth', () => ({
  authAPI: {
    createSession: jest.fn(),
  },
}))

jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
  },
}))

// Mock이 선언된 후에 import
import {
  getUserRole,
  isApproved,
  isAdmin,
  setToken,
  removeToken,
  setTokens,
} from '../index'
import { tokenManager } from '../../tokenManager'
import { getUserRoleFromToken, isUserApprovedFromToken } from '../../utils/token'
import { authAPI } from '../auth'

// Mock이 선언된 후에 타입 캐스팅
const mockTokenManager = tokenManager as jest.Mocked<typeof tokenManager>
const mockGetUserRoleFromToken = getUserRoleFromToken as jest.MockedFunction<typeof getUserRoleFromToken>
const mockIsUserApprovedFromToken = isUserApprovedFromToken as jest.MockedFunction<typeof isUserApprovedFromToken>
const mockAuthAPI = authAPI as jest.Mocked<typeof authAPI>

// Mock fetch
global.fetch = jest.fn()

describe('api/index', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    mockTokenManager.getCSRFToken.mockReturnValue('test-csrf-token')
  })

  describe('getUserRole', () => {
    it('should return user role from token', async () => {
      mockTokenManager.getAccessToken.mockResolvedValue('test-token')
      mockGetUserRoleFromToken.mockReturnValue('admin')

      const result = await getUserRole()

      expect(result).toBe('admin')
      expect(mockTokenManager.getAccessToken).toHaveBeenCalled()
      expect(mockGetUserRoleFromToken).toHaveBeenCalledWith('test-token')
    })

    it('should return null when token is null', async () => {
      mockTokenManager.getAccessToken.mockResolvedValue(null as any)
      mockGetUserRoleFromToken.mockReturnValue(null)

      const result = await getUserRole()

      expect(result).toBeNull()
    })

    it('should return null when token access fails', async () => {
      mockTokenManager.getAccessToken.mockRejectedValue(new Error('Token error'))

      const result = await getUserRole()

      expect(result).toBeNull()
    })
  })

  describe('isApproved', () => {
    it('should return approval status from token', async () => {
      mockTokenManager.getAccessToken.mockResolvedValue('test-token')
      mockIsUserApprovedFromToken.mockReturnValue(true)

      const result = await isApproved()

      expect(result).toBe(true)
      expect(mockTokenManager.getAccessToken).toHaveBeenCalled()
      expect(mockIsUserApprovedFromToken).toHaveBeenCalledWith('test-token')
    })

    it('should return false when token is null', async () => {
      mockTokenManager.getAccessToken.mockResolvedValue(null as any)
      mockIsUserApprovedFromToken.mockReturnValue(false)

      const result = await isApproved()

      expect(result).toBe(false)
    })

    it('should return false when token access fails', async () => {
      mockTokenManager.getAccessToken.mockRejectedValue(new Error('Token error'))

      const result = await isApproved()

      expect(result).toBe(false)
    })
  })

  describe('isAdmin', () => {
    it('should return true for admin role', async () => {
      mockTokenManager.getAccessToken.mockResolvedValue('test-token')
      mockGetUserRoleFromToken.mockReturnValue('admin')

      const result = await isAdmin()

      expect(result).toBe(true)
    })

    it('should return false for non-admin role', async () => {
      mockTokenManager.getAccessToken.mockResolvedValue('test-token')
      mockGetUserRoleFromToken.mockReturnValue('user')

      const result = await isAdmin()

      expect(result).toBe(false)
    })

    it('should return false when role is null', async () => {
      mockTokenManager.getAccessToken.mockResolvedValue('test-token')
      mockGetUserRoleFromToken.mockReturnValue(null)

      const result = await isAdmin()

      expect(result).toBe(false)
    })
  })

  describe('setToken', () => {
    it('should set token in localStorage and create session', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })

      setToken('test-token')

      expect(localStorage.getItem('auth_token')).toBe('test-token')
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/session',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'X-CSRF-Token': 'test-csrf-token',
          }),
        })
      )
    })

    it('should set token even when fetch fails', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      setToken('test-token')

      // localStorage에는 저장되어야 함
      expect(localStorage.getItem('auth_token')).toBe('test-token')
    })

    it('should handle session creation failure gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      expect(() => setToken('test-token')).not.toThrow()
    })

    it('should work without CSRF token', () => {
      mockTokenManager.getCSRFToken.mockReturnValue(null)
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })

      setToken('test-token')

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][1]
      expect(fetchCall.headers['X-CSRF-Token']).toBeUndefined()
    })
  })

  describe('removeToken', () => {
    beforeEach(() => {
      // window 객체 mock (removeToken이 window 체크를 함)
      Object.defineProperty(globalThis, 'window', {
        value: {},
        configurable: true,
        writable: true,
      })
    })

    it('should clear tokens and delete session', () => {
      localStorage.setItem('auth_token', 'test-token')
      localStorage.setItem('auth_token_timestamp', '123456')
      mockTokenManager.getCSRFToken.mockReturnValue('test-csrf-token')
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })

      removeToken()

      // ✅ 핵심: 로컬 토큰 정리는 항상 수행
      expect(mockTokenManager.clearTokens).toHaveBeenCalled()
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('auth_token_timestamp')).toBeNull()
      
      // CSRF 토큰이 있으면 fetch 호출
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/session',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })

    it('should clear tokens even when fetch fails', () => {
      mockTokenManager.getCSRFToken.mockReturnValue('test-csrf-token')
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
      localStorage.setItem('auth_token', 'test-token')

      removeToken()

      // ✅ 핵심: 로컬 토큰 정리는 항상 수행
      expect(mockTokenManager.clearTokens).toHaveBeenCalled()
      expect(localStorage.getItem('auth_token')).toBeNull()
    })

    it('should handle session deletion failure gracefully', () => {
      mockTokenManager.getCSRFToken.mockReturnValue('test-csrf-token')
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      expect(() => removeToken()).not.toThrow()
      expect(mockTokenManager.clearTokens).toHaveBeenCalled()
    })

    it('should work without CSRF token', () => {
      mockTokenManager.getCSRFToken.mockReturnValue(null)
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })

      removeToken()

      // ✅ 핵심: 로컬 토큰 정리는 항상 수행
      expect(mockTokenManager.clearTokens).toHaveBeenCalled()
      expect(localStorage.getItem('auth_token')).toBeNull()
      
      // ✅ 안전한 조건부 체크: fetch 호출 여부 확인 후 헤더 검증
      if ((global.fetch as jest.Mock).mock.calls.length > 0) {
        const [, options] = (global.fetch as jest.Mock).mock.calls[0]
        expect(options?.headers?.['X-CSRF-Token']).toBeUndefined()
      }
    })
  })

  describe('setTokens', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      // window 객체 mock (setTokens가 window 체크를 함)
      Object.defineProperty(globalThis, 'window', {
        value: {},
        configurable: true,
        writable: true,
      })
    })

    it('should set tokens and create session', async () => {
      mockAuthAPI.createSession.mockResolvedValue(undefined)

      await setTokens('access-token', 'refresh-token', 900)

      expect(mockTokenManager.setTokens).toHaveBeenCalledWith('access-token', 'refresh-token', 900)
      expect(mockAuthAPI.createSession).toHaveBeenCalledWith('access-token', 'refresh-token')
    })

    it('should set tokens even when session creation fails', async () => {
      mockAuthAPI.createSession.mockRejectedValue(new Error('Session error'))

      await setTokens('access-token', 'refresh-token', 900)

      // 토큰은 설정되어야 함
      expect(mockTokenManager.setTokens).toHaveBeenCalledWith('access-token', 'refresh-token', 900)
    })

    it('should handle session creation failure gracefully', async () => {
      mockAuthAPI.createSession.mockRejectedValue(new Error('Session error'))

      await setTokens('access-token', 'refresh-token', 900)

      expect(mockTokenManager.setTokens).toHaveBeenCalledWith('access-token', 'refresh-token', 900)
      // 에러가 로깅되어야 함
    })
  })
})
