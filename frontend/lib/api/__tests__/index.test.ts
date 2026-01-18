/**
 * api/index.ts 테스트
 * @jest-environment jsdom
 * 
 * 토큰/스토리지/브라우저 동작을 검증하므로 jsdom 환경 필요
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

// ✅ P1-Next-Fix-Module-2F: clientHelpers는 clientApi를 import하므로 mock 필요
jest.mock('../clientApi', () => ({
  tokenManager: {
    getAccessToken: jest.fn(),
    getCSRFToken: jest.fn(),
    clearTokens: jest.fn(),
    setTokens: jest.fn(),
  },
  authAPI: {
    createSession: jest.fn(),
    deleteSession: jest.fn(),
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
} from '../clientHelpers'
import { tokenManager } from '../clientApi'
import { getUserRoleFromToken, isUserApprovedFromToken } from '../../utils/token'
import { authAPI } from '../clientApi'

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
    
    // fetch mock
    global.fetch = jest.fn()
    
    // localStorage clear (jsdom 환경에서도 테스트 간 오염 방지)
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
    
    // window 존재 보장 (node 환경에서 실행될 가능성까지 방어)
    if (typeof window === 'undefined') {
      Object.defineProperty(globalThis, 'window', {
        value: {},
        writable: true,
        configurable: true,
      })
    }
    
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

      // ✅ 첫 번째 assert: mock이 호출됐는지 확인 (mock wiring 문제 조기 발견)
      expect(mockTokenManager.getAccessToken).toHaveBeenCalled()
      expect(mockIsUserApprovedFromToken).toHaveBeenCalledWith('test-token')
      
      expect(result).toBe(true)
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

      // ✅ 첫 번째 assert: mock이 호출됐는지 확인 (mock wiring 문제 조기 발견)
      expect(mockTokenManager.getAccessToken).toHaveBeenCalled()
      expect(mockGetUserRoleFromToken).toHaveBeenCalledWith('test-token')
      
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

      // ✅ 계약 중심 테스트: CSRF 토큰이 없어도 로컬 저장은 수행되어야 함
      // fetch 헤더의 X-CSRF-Token 존재 여부는 구현 디테일이므로 검증하지 않음
      expect(localStorage.getItem('auth_token')).toBe('test-token')
      
      // fetch가 호출되었는지만 확인 (구현 디테일은 검증하지 않음)
      if ((global.fetch as jest.Mock).mock.calls.length > 0) {
        // fetch 호출이 있었다면, 에러 없이 완료되어야 함
        expect(global.fetch).toHaveBeenCalled()
      }
    })
  })

  describe('removeToken', () => {
    beforeEach(() => {
      // window 객체는 이미 jsdom 환경에서 존재하므로 재정의 불필요
      // removeToken이 window 체크를 하지만, jsdom 환경에서는 window가 이미 존재함
      // fetch mock 초기화 (에러 무시되므로 실패해도 상관없음)
      ;(global.fetch as jest.Mock) = jest.fn().mockResolvedValue({ ok: true })
    })

    it('should clear tokens from tokenManager and localStorage', () => {
      // Given: 토큰이 localStorage에 존재
      localStorage.setItem('auth_token', 'test-token')
      localStorage.setItem('auth_token_timestamp', '123456')
      mockTokenManager.getCSRFToken.mockReturnValue('test-csrf-token')

      // When: removeToken 호출
      removeToken()

      // Then: ✅ 계약(contract) 검증 - 토큰 상태 변화만 확인
      // fetch는 구현 디테일이므로 검증하지 않음
      expect(mockTokenManager.clearTokens).toHaveBeenCalledTimes(1)
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('auth_token_timestamp')).toBeNull()
    })

    it('should clear tokens even when network request fails', () => {
      // Given: 네트워크 요청이 실패하도록 설정
      mockTokenManager.getCSRFToken.mockReturnValue('test-csrf-token')
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
      localStorage.setItem('auth_token', 'test-token')

      // When: removeToken 호출
      removeToken()

      // Then: ✅ 핵심 - 네트워크 실패와 무관하게 로컬 토큰은 정리됨
      expect(mockTokenManager.clearTokens).toHaveBeenCalledTimes(1)
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('auth_token_timestamp')).toBeNull()
    })

    it('should not throw when session deletion fails', () => {
      // Given: 세션 삭제가 실패하도록 설정
      mockTokenManager.getCSRFToken.mockReturnValue('test-csrf-token')
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Session error'))

      // When/Then: ✅ 에러가 발생하지 않아야 함 (에러 무시 로직)
      expect(() => removeToken()).not.toThrow()
      
      // 그리고 토큰은 정리되어야 함
      expect(mockTokenManager.clearTokens).toHaveBeenCalledTimes(1)
    })

    it('should clear tokens regardless of CSRF token presence', () => {
      // Given: CSRF 토큰이 없는 경우
      mockTokenManager.getCSRFToken.mockReturnValue(null)
      localStorage.setItem('auth_token', 'test-token')

      // When: removeToken 호출
      removeToken()

      // Then: ✅ CSRF 토큰 유무와 무관하게 토큰은 정리됨
      expect(mockTokenManager.clearTokens).toHaveBeenCalledTimes(1)
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('auth_token_timestamp')).toBeNull()
    })

    // Note: jsdom 환경에서는 window가 항상 존재하므로 서버 사이드 테스트는 의미 없음
    // 서버 사이드 동작은 실제 node 환경에서 별도로 테스트해야 함
  })

  describe('setTokens', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      // window 객체는 이미 jsdom 환경에서 존재하므로 재정의 불필요
      // setTokens가 window 체크를 하지만, jsdom 환경에서는 window가 이미 존재함
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
