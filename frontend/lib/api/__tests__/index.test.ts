/**
 * lib/api/index.ts 테스트
 */

import { getUserRole, isApproved, isAdmin, setToken, removeToken, setTokens } from '../index'
import { tokenManager } from '../../tokenManager'
import { authAPI } from '../auth'

// 의존성 모킹
jest.mock('../../tokenManager', () => ({
  tokenManager: {
    getAccessToken: jest.fn(),
    getCSRFToken: jest.fn(),
    clearTokens: jest.fn(),
    setTokens: jest.fn(),
  },
}))

jest.mock('../auth', () => ({
  authAPI: {
    createSession: jest.fn(),
  },
}))

jest.mock('../../utils/token', () => ({
  getUserRoleFromToken: jest.fn((token: string) => token ? 'user' : null),
  isUserApprovedFromToken: jest.fn((token: string) => !!token),
}))

const mockTokenManager = tokenManager as jest.Mocked<typeof tokenManager>
const mockAuthAPI = authAPI as jest.Mocked<typeof authAPI>

// window 모킹 (전역)
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})

describe('lib/api/index', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
    mockLocalStorage.getItem.mockClear()
    mockLocalStorage.setItem.mockClear()
    mockLocalStorage.removeItem.mockClear()
  })

  describe('getUserRole', () => {
    it('returns user role when token exists', async () => {
      mockTokenManager.getAccessToken.mockResolvedValue('test-token')

      const role = await getUserRole()

      expect(role).toBe('user')
    })

    it('returns null when no token', async () => {
      mockTokenManager.getAccessToken.mockResolvedValue('')

      const role = await getUserRole()

      expect(role).toBeNull()
    })
  })

  describe('isApproved', () => {
    it('returns true when user is approved', async () => {
      mockTokenManager.getAccessToken.mockResolvedValue('test-token')

      const approved = await isApproved()

      expect(approved).toBe(true)
    })

    it('returns false when no token', async () => {
      mockTokenManager.getAccessToken.mockResolvedValue('')

      const approved = await isApproved()

      expect(approved).toBe(false)
    })
  })

  describe('isAdmin', () => {
    it('returns true when user is admin', async () => {
      const tokenUtils = require('../../utils/token')
      tokenUtils.getUserRoleFromToken.mockReturnValueOnce('admin')
      mockTokenManager.getAccessToken.mockResolvedValue('admin-token')

      const admin = await isAdmin()

      expect(admin).toBe(true)
    })

    it('returns false when user is not admin', async () => {
      const tokenUtils = require('../../utils/token')
      tokenUtils.getUserRoleFromToken.mockReturnValueOnce('user')
      mockTokenManager.getAccessToken.mockResolvedValue('user-token')

      const admin = await isAdmin()

      expect(admin).toBe(false)
    })
  })

  describe('setToken', () => {
    it('sets token in localStorage', () => {
      mockTokenManager.getCSRFToken.mockReturnValue('csrf-token')
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })

      setToken('test-token')

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', 'test-token')
    })
  })

  describe('removeToken', () => {
    it('removes token from localStorage', () => {
      mockTokenManager.getCSRFToken.mockReturnValue('csrf-token')
      mockTokenManager.clearTokens.mockImplementation(() => {})
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })

      removeToken()

      expect(mockTokenManager.clearTokens).toHaveBeenCalled()
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token')
    })
  })

  describe('setTokens', () => {
    it('sets tokens using tokenManager', async () => {
      mockAuthAPI.createSession.mockResolvedValue(undefined)
      mockTokenManager.setTokens.mockImplementation(() => {})

      await setTokens('access-token', 'refresh-token', 3600)

      expect(mockTokenManager.setTokens).toHaveBeenCalledWith('access-token', 'refresh-token', 3600)
    })
  })
})

