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
    } as unknown as Response)

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
    } as unknown as Response

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

  it('handles login with refresh token from cookie', async () => {
    // document.cookie 모킹
    Object.defineProperty(document, 'cookie', {
      value: 'refresh_token=cookie-refresh-token',
      writable: true,
      configurable: true,
    })

    const mockResponse = {
      access_token: 'test-access-token',
      expires_in: 900,
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: {
        getSetCookie: () => [],
      },
      json: async () => mockResponse,
    } as unknown as Response)

    const result = await authAPI.login({
      username: 'testuser',
      password: 'testpass',
    })

    expect(result).toBeDefined()
    expect(mockTokenManager.setTokens).toHaveBeenCalled()
  })

  it('handles login error without message', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response)

    await expect(
      authAPI.login({
        username: 'testuser',
        password: 'wrongpass',
      })
    ).rejects.toThrow('Login failed')
  })

  it('handles login JSON parse error', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error('JSON parse error')
      },
    } as Response)

    await expect(
      authAPI.login({
        username: 'testuser',
        password: 'wrongpass',
      })
    ).rejects.toThrow('Login failed')
  })

  it('handles register errors', async () => {
    mockApiRequest.mockRejectedValue(new Error('Registration failed'))

    await expect(
      authAPI.register({
        username: 'newuser',
        password: 'password123',
      })
    ).rejects.toThrow('Registration failed')
  })

  it('handles session check errors', async () => {
    mockApiRequest.mockRejectedValue(new Error('Session check failed'))

    await expect(authAPI.checkSession()).rejects.toThrow('Session check failed')
  })

  it('handles refresh token', async () => {
    const mockResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 900,
    }

    // authAPI.refreshToken은 직접 fetch를 사용하므로 fetch를 모킹해야 함
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: {
        getSetCookie: () => [],
      },
      json: async () => mockResponse,
    } as unknown as Response)

    const result = await authAPI.refreshToken('old-refresh-token')

    expect(global.fetch).toHaveBeenCalled()
    expect(result).toEqual(mockResponse)
  })

  it('handles refresh token errors', async () => {
    // authAPI.refreshToken은 직접 fetch를 사용하므로 fetch를 모킹해야 함
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Refresh failed' }),
    } as unknown as Response)

    // authAPI.refreshToken은 에러를 "Token refresh failed"로 래핑할 수 있음
    await expect(authAPI.refreshToken('old-refresh-token')).rejects.toThrow()
  })

  it('deletes session', async () => {
    mockApiRequest.mockResolvedValue({})

    await authAPI.deleteSession()

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/auth/session',
      expect.objectContaining({
        method: 'DELETE',
      })
    )
  })

  it('handles delete session errors', async () => {
    mockApiRequest.mockRejectedValue(new Error('Delete failed'))

    await expect(authAPI.deleteSession()).rejects.toThrow('Delete failed')
  })

  it('handles login without CSRF token', async () => {
    mockTokenManager.getCSRFToken.mockReturnValue(null)

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
    } as unknown as Response)

    const result = await authAPI.login({
      username: 'testuser',
      password: 'testpass',
    })

    expect(result).toBeDefined()
    // CSRF 토큰이 없어도 로그인은 성공할 수 있음
    expect(global.fetch).toHaveBeenCalled()
  })
})

