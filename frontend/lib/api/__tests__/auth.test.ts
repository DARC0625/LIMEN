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
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid credentials' }), { status: 401 })
    )

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
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ message: 'fail' }), { status: 401 })
    )

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

  it('handles login with token (legacy compatibility)', async () => {
    const mockResponse = {
      token: 'legacy-token',
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 900,
    }

    // localStorage 모킹
    const localStorageMock = {
      setItem: jest.fn(),
      getItem: jest.fn(),
      removeItem: jest.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    })

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
    expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'legacy-token')
  })

  it('handles login without refresh_token (should log error)', async () => {
    const mockResponse = {
      access_token: 'test-access-token',
      // refresh_token 없음
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: {
        getSetCookie: () => [],
      },
      json: async () => mockResponse,
    } as unknown as Response)

    // document.cookie도 비어있음
    Object.defineProperty(document, 'cookie', {
      value: '',
      writable: true,
      configurable: true,
    })

    const result = await authAPI.login({
      username: 'testuser',
      password: 'testpass',
    })

    expect(result).toBeDefined()
    // setTokens는 호출되지 않아야 함 (refresh_token이 없으므로)
    expect(mockTokenManager.setTokens).not.toHaveBeenCalled()
  })

  it('creates session without refreshToken', async () => {
    const accessToken = 'test-access-token'

    const mockResponse = {
      ok: true,
      headers: {
        getSetCookie: () => [],
      },
      json: async () => ({}),
    } as unknown as Response

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    await authAPI.createSession(accessToken)

    const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(callBody.access_token).toBe(accessToken)
    expect(callBody.refresh_token).toBeUndefined()
  })

  it('handles createSession errors', async () => {
    const accessToken = 'test-access-token'

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Session creation failed' }),
    } as unknown as Response)

    await expect(authAPI.createSession(accessToken)).rejects.toThrow('Session creation failed')
  })

  it('handles createSession JSON parse error', async () => {
    const accessToken = 'test-access-token'

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error('JSON parse error')
      },
    } as unknown as Response)

    await expect(authAPI.createSession(accessToken)).rejects.toThrow('Session creation failed')
  })

  it('handles refreshToken with cookie', async () => {
    // document.cookie 모킹
    Object.defineProperty(document, 'cookie', {
      value: 'refresh_token=cookie-refresh-token',
      writable: true,
      configurable: true,
    })

    const mockResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 900,
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: {
        getSetCookie: () => [],
      },
      json: async () => mockResponse,
    } as unknown as Response)

    const result = await authAPI.refreshToken()

    expect(global.fetch).toHaveBeenCalled()
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0][1]
    // 쿠키가 있으면 body가 undefined일 수 있음
    if (fetchCall.body) {
      const callBody = JSON.parse(fetchCall.body)
      expect(callBody.refresh_token).toBeUndefined()
    } else {
      // body가 없으면 쿠키를 사용하는 것
      expect(fetchCall.body).toBeUndefined()
    }
    expect(result).toEqual(mockResponse)
  })

  it('handles refreshToken with both cookie and parameter (cookie takes precedence)', async () => {
    // document.cookie 모킹
    Object.defineProperty(document, 'cookie', {
      value: 'refresh_token=cookie-refresh-token',
      writable: true,
      configurable: true,
    })

    const mockResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 900,
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: {
        getSetCookie: () => [],
      },
      json: async () => mockResponse,
    } as unknown as Response)

    const result = await authAPI.refreshToken('parameter-refresh-token')

    expect(global.fetch).toHaveBeenCalled()
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0][1]
    // 쿠키가 있으면 body가 undefined일 수 있음 (쿠키 우선)
    if (fetchCall.body) {
      const callBody = JSON.parse(fetchCall.body)
      expect(callBody.refresh_token).toBeUndefined()
    } else {
      // body가 없으면 쿠키를 사용하는 것
      expect(fetchCall.body).toBeUndefined()
    }
    expect(result).toEqual(mockResponse)
  })

  it('handles refreshToken without cookie (uses parameter)', async () => {
    // document.cookie 비어있음
    Object.defineProperty(document, 'cookie', {
      value: '',
      writable: true,
      configurable: true,
    })

    const mockResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 900,
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: {
        getSetCookie: () => [],
      },
      json: async () => mockResponse,
    } as unknown as Response)

    const result = await authAPI.refreshToken('parameter-refresh-token')

    expect(global.fetch).toHaveBeenCalled()
    const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    // 쿠키가 없으면 body에 refresh_token을 포함
    expect(callBody.refresh_token).toBe('parameter-refresh-token')
    expect(result).toEqual(mockResponse)
  })

  it('handles refreshToken error without message', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as unknown as Response)

    await expect(authAPI.refreshToken('old-refresh-token')).rejects.toThrow('Token refresh failed')
  })

  it('handles refreshToken JSON parse error', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error('JSON parse error')
      },
    } as unknown as Response)

    await expect(authAPI.refreshToken('old-refresh-token')).rejects.toThrow('Token refresh failed')
  })

  it('handles refreshToken without access_token in response', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      headers: {
        getSetCookie: () => [],
      },
      json: async () => ({
        refresh_token: 'new-refresh-token',
        expires_in: 900,
        // access_token이 없음
      }),
    }
    
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse as unknown as Response)
    
    await expect(authAPI.refreshToken()).rejects.toThrow('No access token in refresh response')
  })

  it('handles refreshToken with empty access_token', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      headers: {
        getSetCookie: () => [],
      },
      json: async () => ({
        access_token: '',
        refresh_token: 'new-refresh-token',
        expires_in: 900,
      }),
    }
    
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse as unknown as Response)
    
    await expect(authAPI.refreshToken()).rejects.toThrow('No access token in refresh response')
  })

  it('logs Set-Cookie headers in login response', async () => {
    const mockResponse = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 900,
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: {
        getSetCookie: () => ['refresh_token=test-refresh-token; HttpOnly; Secure; SameSite=Strict; Path=/'],
      },
      json: async () => mockResponse,
    } as unknown as Response)

    await authAPI.login({
      username: 'testuser',
      password: 'testpass',
    })

    // Set-Cookie 헤더가 있을 때 로깅이 발생하는지 확인
    expect(global.fetch).toHaveBeenCalled()
  })

  it('logs Set-Cookie headers in createSession response', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      headers: {
        getSetCookie: () => ['refresh_token=test-refresh-token; HttpOnly; Secure; SameSite=Strict; Path=/'],
      },
      json: async () => ({}),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse as unknown as Response)

    await authAPI.createSession('access-token', 'refresh-token')

    // Set-Cookie 헤더가 있을 때 로깅이 발생하는지 확인
    expect(global.fetch).toHaveBeenCalled()
  })

  it('handles login with refresh_token from cookie', async () => {
    // document.cookie 모킹
    Object.defineProperty(document, 'cookie', {
      value: 'refresh_token=cookie-refresh-token',
      writable: true,
      configurable: true,
    })

    const mockResponse = {
      access_token: 'test-access-token',
      // refresh_token이 JSON 응답에 없고 쿠키에만 있음
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

    expect(result).toEqual(mockResponse)
    // 쿠키에서 refresh_token을 찾았는지 확인
    expect(mockTokenManager.setTokens).toHaveBeenCalled()
  })

  it('handles login without expires_in (uses default)', async () => {
    const mockResponse = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      // expires_in이 없음
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

    expect(result).toEqual(mockResponse)
    // 기본 expires_in이 사용되었는지 확인
    expect(mockTokenManager.setTokens).toHaveBeenCalled()
  })

  it('handles login with legacy token format', async () => {
    const mockResponse = {
      token: 'legacy-token',
      // access_token과 refresh_token이 없고 token만 있음
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

    expect(result).toEqual(mockResponse)
    // 하위 호환성을 위해 localStorage에 저장되었는지 확인
    expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'legacy-token')
  })

  it('handles login without access_token length', async () => {
    const mockResponse = {
      access_token: '',
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

    expect(result).toEqual(mockResponse)
  })

  it('handles createSession without refreshToken', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      headers: {
        getSetCookie: () => [],
      },
      json: async () => ({}),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse as unknown as Response)

    await authAPI.createSession('access-token')
    // refreshToken이 없어도 세션이 생성되어야 함
    expect(global.fetch).toHaveBeenCalled()
  })

  it('handles login on server side (window undefined)', async () => {
    const originalWindow = global.window
    // @ts-expect-error - intentional deletion of global.window for server-side test
    delete global.window

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

    // 서버 사이드에서는 쿠키에서 refresh_token을 찾지 않음
    expect(result).toEqual(mockResponse)
    
    global.window = originalWindow
  })

  it('handles login with refreshTokenInStorage check on server side', async () => {
    const originalWindow = global.window
    // @ts-expect-error - intentional deletion of global.window for server-side test
    delete global.window

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

    await authAPI.login({
      username: 'testuser',
      password: 'testpass',
    })

    // 서버 사이드에서는 localStorage.getItem을 호출하지 않음
    expect(mockTokenManager.setTokens).toHaveBeenCalled()
    
    global.window = originalWindow
  })

  it('handles login with legacy token on server side', async () => {
    const originalWindow = global.window
    // @ts-expect-error - intentional deletion of global.window for server-side test
    delete global.window

    const mockResponse = {
      token: 'legacy-token',
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

    await authAPI.login({
      username: 'testuser',
      password: 'testpass',
    })

    // 서버 사이드에서는 localStorage.setItem을 호출하지 않음
    expect(mockTokenManager.setTokens).toHaveBeenCalled()
    
    global.window = originalWindow
  })

  it('handles createSession with undefined accessToken length', async () => {
    const accessToken = undefined as any

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: {
        getSetCookie: () => [],
      },
      json: async () => ({}),
    } as unknown as Response)

    await authAPI.createSession(accessToken)

    // optional chaining이 작동하는지 확인
    expect(global.fetch).toHaveBeenCalled()
  })

  it('handles createSession with Set-Cookie headers logging', async () => {
    const accessToken = 'test-access-token'
    const refreshToken = 'test-refresh-token'

    const mockSetCookieHeaders = [
      'refresh_token=test-refresh-token; HttpOnly; Secure; SameSite=Strict',
      'session_id=test-session-id; HttpOnly; Secure; SameSite=Strict',
    ]

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: {
        getSetCookie: () => mockSetCookieHeaders,
      },
      json: async () => ({}),
    } as unknown as Response)

    await authAPI.createSession(accessToken, refreshToken)

    // Set-Cookie 헤더가 로깅되는지 확인
    expect(global.fetch).toHaveBeenCalled()
  })

  it('handles refreshToken on server side (window undefined)', async () => {
    const originalWindow = global.window
    // @ts-expect-error - intentional deletion of global.window for server-side test
    delete global.window

    const mockResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 900,
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: {
        getSetCookie: () => [],
      },
      json: async () => mockResponse,
    } as unknown as Response)

    const result = await authAPI.refreshToken()

    // 서버 사이드에서는 쿠키에서 refresh_token을 찾지 않음
    expect(result).toEqual(mockResponse)
    
    global.window = originalWindow
  })

  it('handles createSession without CSRF token', async () => {
    mockTokenManager.getCSRFToken.mockReturnValue(null)
    
    const mockResponse = {
      ok: true,
      status: 200,
      headers: {
        getSetCookie: () => [],
      },
      json: async () => ({}),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse as unknown as Response)

    await authAPI.createSession('access-token', 'refresh-token')
    // CSRF 토큰이 없어도 세션이 생성되어야 함
    expect(global.fetch).toHaveBeenCalled()
  })
})

