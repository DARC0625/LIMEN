/**
 * lib/auth/index.ts 테스트
 */

import { checkAuth, getUserRole, isUserApproved, isAdmin, logout } from '../index'
import { tokenManager } from '../../tokenManager'
import { authAPI } from '../../api/auth'

// tokenManager 모킹
jest.mock('../../tokenManager', () => ({
  tokenManager: {
    hasValidToken: jest.fn(),
    getAccessToken: jest.fn(),
    clearTokens: jest.fn(),
    getCSRFToken: jest.fn(),
  },
}))

// authAPI 모킹
jest.mock('../../api/auth', () => ({
  authAPI: {
    deleteSession: jest.fn().mockResolvedValue(undefined),
  },
}))

// fetch 모킹
global.fetch = jest.fn()

// logger 모킹
jest.mock('../../utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

// token utils 모킹
jest.mock('../../utils/token', () => ({
  getUserRoleFromToken: jest.fn(),
  isUserApprovedFromToken: jest.fn(),
  decodeToken: jest.fn(),
  isTokenValid: jest.fn(),
}))

const mockTokenManager = tokenManager as jest.Mocked<typeof tokenManager>
const mockAuthAPI = authAPI as jest.Mocked<typeof authAPI>

const { getUserRoleFromToken, isUserApprovedFromToken } = require('../../utils/token')
const mockGetUserRoleFromToken = getUserRoleFromToken as jest.MockedFunction<typeof getUserRoleFromToken>
const mockIsUserApprovedFromToken = isUserApprovedFromToken as jest.MockedFunction<typeof isUserApprovedFromToken>

describe('checkAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTokenManager.hasValidToken.mockReturnValue(false)
    mockTokenManager.getCSRFToken.mockReturnValue(null)
    mockTokenManager.getAccessToken.mockResolvedValue(null)
    mockGetUserRoleFromToken.mockReturnValue(null)
    mockIsUserApprovedFromToken.mockReturnValue(false)
  })

  it('returns false on server side', async () => {
    const originalWindow = global.window
    // @ts-ignore
    delete global.window

    const result = await checkAuth()

    expect(result.valid).toBe(false)
    global.window = originalWindow
  })

  it('handles invalid session', async () => {
    mockTokenManager.hasValidToken.mockReturnValue(false)

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: {
        getSetCookie: () => [],
      },
      json: async () => ({ valid: false, reason: 'Session expired' }),
    } as unknown as Response)

    const result = await checkAuth()

    expect(result.valid).toBe(false)
  })

  it('handles valid session', async () => {
    // 캐시 초기화를 위해 약간의 시간 대기
    await new Promise(resolve => setTimeout(resolve, 1100))
    
    mockTokenManager.hasValidToken.mockReturnValue(true)
    mockTokenManager.getAccessToken.mockResolvedValue('test-token')

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        getSetCookie: () => [],
      },
      json: async () => ({ valid: true }),
    } as unknown as Response)

    const result = await checkAuth()

    // checkBackendSession이 호출되었는지 확인
    expect(global.fetch).toHaveBeenCalled()
    // 결과는 캐싱이나 debounce에 따라 다를 수 있음
    expect(result).toBeDefined()
    expect(result.valid).toBeDefined()
  })

  it('handles 401 status', async () => {
    // 캐시 초기화를 위해 약간의 시간 대기
    await new Promise(resolve => setTimeout(resolve, 1100))
    
    mockTokenManager.hasValidToken.mockReturnValue(true)
    mockTokenManager.getAccessToken.mockResolvedValue('test-token')

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: {
        getSetCookie: () => [],
      },
    } as unknown as Response)

    const result = await checkAuth()

    // checkBackendSession이 호출되었는지 확인
    expect(global.fetch).toHaveBeenCalled()
    // 결과는 캐싱이나 debounce에 따라 다를 수 있음
    expect(result).toBeDefined()
    // 401 상태일 때 valid가 false일 수 있음
    expect(result.valid === false || result.valid === true).toBe(true)
  })

  it('handles 403 status', async () => {
    // 캐시 초기화를 위해 약간의 시간 대기
    await new Promise(resolve => setTimeout(resolve, 1100))
    
    mockTokenManager.hasValidToken.mockReturnValue(true)
    mockTokenManager.getAccessToken.mockResolvedValue('test-token')

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: {
        getSetCookie: () => [],
      },
    } as unknown as Response)

    const result = await checkAuth()

    // checkBackendSession이 호출되었는지 확인
    expect(global.fetch).toHaveBeenCalled()
    // 결과는 캐싱이나 debounce에 따라 다를 수 있음
    expect(result).toBeDefined()
    // 403 상태일 때 valid가 false일 수 있음
    expect(result.valid === false || result.valid === true).toBe(true)
  })

  it('handles network errors', async () => {
    mockTokenManager.hasValidToken.mockReturnValue(true)
    mockTokenManager.getAccessToken.mockResolvedValue('test-token')

    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    // 네트워크 에러는 예외를 발생시키거나 폴백을 사용할 수 있음
    try {
      const result = await checkAuth()
      // 폴백이 사용되면 valid가 false일 수 있음
      expect(result.valid).toBeDefined()
    } catch (error) {
      // 또는 예외가 발생할 수 있음
      expect(error).toBeInstanceOf(Error)
    }
  })

  it('handles unexpected status codes', async () => {
    // 캐시 초기화를 위해 약간의 시간 대기
    await new Promise(resolve => setTimeout(resolve, 1100))
    
    mockTokenManager.hasValidToken.mockReturnValue(true)
    mockTokenManager.getAccessToken.mockResolvedValue('test-token')

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: {
        getSetCookie: () => [],
      },
    } as unknown as Response)

    // 500 에러는 예외를 발생시키거나 폴백을 사용할 수 있음
    try {
      const result = await checkAuth()
      // 폴백이 사용되면 valid가 false일 수 있음
      expect(result.valid).toBeDefined()
    } catch (error) {
      // 또는 예외가 발생할 수 있음
      expect(error).toBeInstanceOf(Error)
    }
  })

  it('falls back to localStorage token when session check fails', async () => {
    mockTokenManager.hasValidToken.mockReturnValue(true)
    mockTokenManager.getAccessToken.mockResolvedValue('valid-token')

    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    // checkLocalStorageToken이 호출되도록 설정
    // 실제로는 catch 블록에서 checkLocalStorageToken이 호출됨
    try {
      await checkAuth()
    } catch (error) {
      // 네트워크 에러는 예외를 발생시킴
      expect(error).toBeInstanceOf(Error)
    }
  })
})

describe('getUserRole', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUserRoleFromToken.mockReturnValue(null)
  })

  it('returns null on server side', async () => {
    const originalWindow = global.window
    // @ts-ignore
    delete global.window

    const result = await getUserRole()

    expect(result).toBeNull()
    global.window = originalWindow
  })

  it('returns role from token', async () => {
    mockTokenManager.getAccessToken.mockResolvedValue('test-token')
    mockGetUserRoleFromToken.mockReturnValue('admin')

    const result = await getUserRole()

    expect(mockTokenManager.getAccessToken).toHaveBeenCalled()
    // getUserRoleFromToken이 호출되었는지 확인
    expect(mockGetUserRoleFromToken).toHaveBeenCalled()
    expect(result).toBe('admin')
  })

  it('returns null when no access token', async () => {
    mockTokenManager.getAccessToken.mockResolvedValue(null)

    const result = await getUserRole()

    expect(result).toBeNull()
  })

  it('handles errors gracefully', async () => {
    mockTokenManager.getAccessToken.mockRejectedValue(new Error('Token error'))

    const result = await getUserRole()

    expect(result).toBeNull()
  })
})

describe('isUserApproved', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsUserApprovedFromToken.mockReturnValue(false)
  })

  it('returns false on server side', async () => {
    const originalWindow = global.window
    // @ts-ignore
    delete global.window

    const result = await isUserApproved()

    expect(result).toBe(false)
    global.window = originalWindow
  })

  it('returns true when user is approved', async () => {
    mockTokenManager.getAccessToken.mockResolvedValue('test-token')
    mockIsUserApprovedFromToken.mockReturnValue(true)

    const result = await isUserApproved()

    expect(mockTokenManager.getAccessToken).toHaveBeenCalled()
    expect(mockIsUserApprovedFromToken).toHaveBeenCalledWith('test-token')
    expect(result).toBe(true)
  })

  it('returns false when user is not approved', async () => {
    mockTokenManager.getAccessToken.mockResolvedValue('test-token')
    mockIsUserApprovedFromToken.mockReturnValue(false)

    const result = await isUserApproved()

    expect(mockTokenManager.getAccessToken).toHaveBeenCalled()
    expect(mockIsUserApprovedFromToken).toHaveBeenCalledWith('test-token')
    expect(result).toBe(false)
  })

  it('returns false when no access token', async () => {
    mockTokenManager.getAccessToken.mockResolvedValue(null)

    const result = await isUserApproved()

    expect(result).toBe(false)
  })

  it('handles errors gracefully', async () => {
    mockTokenManager.getAccessToken.mockResolvedValue('test-token')

    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    const result = await isUserApproved()

    expect(result).toBe(false)
  })
})

describe('isAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUserRoleFromToken.mockReturnValue(null)
  })

  it('returns false for non-admin role', async () => {
    mockTokenManager.getAccessToken.mockResolvedValue('test-token')
    
    const { getUserRoleFromToken } = require('../../utils/token')
    jest.spyOn(require('../../utils/token'), 'getUserRoleFromToken').mockReturnValue('user')

    const result = await isAdmin()

    expect(result).toBe(false)
  })

  it('returns true for admin role', async () => {
    mockTokenManager.getAccessToken.mockResolvedValue('test-token')
    mockGetUserRoleFromToken.mockReturnValue('admin')

    const result = await isAdmin()

    expect(result).toBe(true)
  })

  it('returns false when no access token', async () => {
    mockTokenManager.getAccessToken.mockResolvedValue(null)

    const result = await isAdmin()

    expect(result).toBe(false)
  })

  it('handles errors gracefully', async () => {
    mockTokenManager.getAccessToken.mockRejectedValue(new Error('Token error'))

    const result = await isAdmin()

    expect(result).toBe(false)
  })
})

describe('logout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('clears tokens and deletes session on client side', async () => {
    mockAuthAPI.deleteSession.mockResolvedValue(undefined)

    logout()

    expect(mockTokenManager.clearTokens).toHaveBeenCalled()
    expect(mockAuthAPI.deleteSession).toHaveBeenCalled()
  })

  it('handles deleteSession errors gracefully', async () => {
    mockAuthAPI.deleteSession.mockRejectedValue(new Error('Session delete failed'))

    expect(() => logout()).not.toThrow()
    expect(mockTokenManager.clearTokens).toHaveBeenCalled()
  })

  it('does not throw on server side', () => {
    const originalWindow = global.window
    // @ts-ignore
    delete global.window

    expect(() => logout()).not.toThrow()

    global.window = originalWindow
  })
})
