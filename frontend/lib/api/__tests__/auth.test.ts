/**
 * authAPI 테스트
 */

import { authAPI } from '../auth'
import { tokenManager } from '../../tokenManager'
import { apiRequest } from '../client'

// tokenManager 모킹
jest.mock('../../tokenManager', () => ({
  tokenManager: {
    getCSRFToken: jest.fn(),
    setTokens: jest.fn(),
    hasValidToken: jest.fn(),
    getAccessToken: jest.fn(),
  },
}))

// apiRequest 모킹
jest.mock('../client', () => ({
  apiRequest: jest.fn(),
}))

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>

// logger 모킹
jest.mock('../../utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

// fetch 모킹
global.fetch = jest.fn()

const mockTokenManager = tokenManager as jest.Mocked<typeof tokenManager>

describe('authAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTokenManager.getCSRFToken.mockReturnValue('test-csrf-token')
  })

  it('logs in successfully', async () => {
    const mockResponse = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 900,
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: {
        getSetCookie: () => [],
      },
      json: async () => mockResponse,
    } as Response)

    const result = await authAPI.login({
      username: 'testuser',
      password: 'testpass',
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-CSRF-Token': 'test-csrf-token',
        }),
      })
    )
    expect(result).toEqual(mockResponse)
    expect(mockTokenManager.setTokens).toHaveBeenCalled()
  })

  it('handles login errors', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Invalid credentials' }),
    } as Response)

    await expect(
      authAPI.login({
        username: 'testuser',
        password: 'wrongpass',
      })
    ).rejects.toThrow('Invalid credentials')
  })

  it('registers user', async () => {
    const mockResponse = {
      id: 1,
      username: 'newuser',
      role: 'user',
    }

    mockApiRequest.mockResolvedValue(mockResponse)

    const result = await authAPI.register({
      username: 'newuser',
      password: 'password123',
    })

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/auth/register',
      expect.objectContaining({
        method: 'POST',
        skipAuth: true,
      })
    )
    expect(result).toEqual(mockResponse)
  })

  it('checks session', async () => {
    const mockResponse = {
      valid: true,
      user: { id: 1, username: 'testuser' },
    }

    mockApiRequest.mockResolvedValue(mockResponse)

    const result = await authAPI.checkSession()

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/auth/session',
      expect.objectContaining({
        method: 'GET',
      })
    )
    expect(result).toEqual(mockResponse)
  })

  it('creates session', async () => {
    const accessToken = 'test-access-token'
    const refreshToken = 'test-refresh-token'

    const mockResponse = {
      ok: true,
      headers: {
        getSetCookie: () => [],
      },
      json: async () => ({}),
    } as Response

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    await authAPI.createSession(accessToken, refreshToken)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/session'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${accessToken}`,
        }),
        body: expect.stringContaining(accessToken),
      })
    )
  })
})

