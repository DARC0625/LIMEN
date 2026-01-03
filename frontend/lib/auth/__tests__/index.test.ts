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

const mockTokenManager = tokenManager as jest.Mocked<typeof tokenManager>
const mockAuthAPI = authAPI as jest.Mocked<typeof authAPI>

describe('checkAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTokenManager.hasValidToken.mockReturnValue(false)
    mockTokenManager.getCSRFToken.mockReturnValue(null)
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
})

describe('getUserRole', () => {
  it('returns null on server side', async () => {
    const originalWindow = global.window
    // @ts-ignore
    delete global.window

    const result = await getUserRole()

    expect(result).toBeNull()
    global.window = originalWindow
  })
})

describe('isUserApproved', () => {
  it('returns false on server side', async () => {
    const originalWindow = global.window
    // @ts-ignore
    delete global.window

    const result = await isUserApproved()

    expect(result).toBe(false)
    global.window = originalWindow
  })
})

describe('isAdmin', () => {
  it('returns false for non-admin role', async () => {
    mockTokenManager.getAccessToken.mockResolvedValue('test-token')
    
    // getUserRoleFromToken 모킹
    jest.mock('../../utils/token', () => ({
      ...jest.requireActual('../../utils/token'),
      getUserRoleFromToken: jest.fn().mockReturnValue('user'),
    }))

    const result = await isAdmin()

    expect(result).toBe(false)
  })
})

describe('logout', () => {
  it('clears tokens and deletes session on client side', () => {
    mockAuthAPI.deleteSession.mockResolvedValue(undefined)

    logout()

    expect(mockTokenManager.clearTokens).toHaveBeenCalled()
  })
})
