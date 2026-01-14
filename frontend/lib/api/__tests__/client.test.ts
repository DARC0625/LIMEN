/**
 * API 클라이언트 테스트
 * @jest-environment node
 */

import { apiRequest } from '../client'
import { tokenManager } from '../../tokenManager'
import { trackAPIError } from '../../errorTracking'
import { trackPerformanceMetric } from '../../analytics'

// 의존성 모킹
jest.mock('../../tokenManager')
jest.mock('../../errorTracking')
jest.mock('../../analytics')

const mockTokenManager = tokenManager as jest.Mocked<typeof tokenManager>
const mockTrackAPIError = trackAPIError as jest.MockedFunction<typeof trackAPIError>
const mockTrackPerformanceMetric = trackPerformanceMetric as jest.MockedFunction<typeof trackPerformanceMetric>

// fetch 모킹
global.fetch = jest.fn()

describe('apiRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTokenManager.getAccessToken = jest.fn().mockResolvedValue('test-access-token')
    mockTokenManager.getCSRFToken = jest.fn().mockReturnValue('test-csrf-token')
    
    // performance 모킹
    global.performance = {
      now: jest.fn().mockReturnValue(100),
    } as any
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should make GET request successfully', async () => {
    const mockData = { id: 1, name: 'Test' }
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockData),
      text: jest.fn().mockResolvedValue(JSON.stringify(mockData)),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const result = await apiRequest('/test')

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[0]).toContain('/test')
    expect(fetchCall[1].headers['Authorization']).toBe('Bearer test-access-token')
    expect(fetchCall[1].headers['Content-Type']).toBe('application/json')
    expect(fetchCall[1].credentials).toBe('include')
    // method는 fetchOptions에 없으면 기본값이 설정되지 않지만, GET 요청이므로 확인 불필요
    expect(result).toEqual(mockData)
  })

  it('should make POST request with body', async () => {
    const mockData = { id: 1 }
    const requestData = { name: 'Test' }
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockData),
      text: jest.fn().mockResolvedValue(JSON.stringify(mockData)),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const result = await apiRequest('/test', {
      method: 'POST',
      body: JSON.stringify(requestData),
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(requestData),
        headers: expect.objectContaining({
          'X-CSRF-Token': 'test-csrf-token',
        }),
      })
    )
    expect(result).toEqual(mockData)
  })

  it('should skip auth for public endpoints', async () => {
    const mockData = { public: true }
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockData),
      text: jest.fn().mockResolvedValue(JSON.stringify(mockData)),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    await apiRequest('/public', { skipAuth: true })

    expect(mockTokenManager.getAccessToken).not.toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.not.objectContaining({
          'Authorization': expect.any(String),
        }),
      })
    )
  })

  it('should handle 401 error and retry with new token', async () => {
    const mockData = { id: 1 }
    const mock401Response = {
      ok: false,
      status: 401,
      headers: new Headers(),
    }
    const mock200Response = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockData),
      text: jest.fn().mockResolvedValue(JSON.stringify(mockData)),
      headers: new Headers(),
    }

    // 첫 번째 요청은 401, 두 번째는 200
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(mock401Response)
      .mockResolvedValueOnce(mock200Response)

    mockTokenManager.getAccessToken
      .mockResolvedValueOnce('old-token')
      .mockResolvedValueOnce('new-token')

    const result = await apiRequest('/test')

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(result).toEqual(mockData)
  })

  it('should handle 403 error', async () => {
    const mock403Response = {
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue({ message: 'Forbidden' }),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mock403Response)

    await expect(apiRequest('/test')).rejects.toThrow('Forbidden')
    expect(mockTrackAPIError).toHaveBeenCalled()
  })

  it('should handle 404 error', async () => {
    const mock404Response = {
      ok: false,
      status: 404,
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mock404Response)

    await expect(apiRequest('/test')).rejects.toThrow('Not Found')
  })

  it('should handle network errors', async () => {
    const networkError = new Error('Network error')
    ;(global.fetch as jest.Mock).mockRejectedValue(networkError)

    await expect(apiRequest('/test')).rejects.toThrow('Network error')
    expect(mockTrackAPIError).toHaveBeenCalled()
  })

  it('should handle timeout', async () => {
    const controller = new AbortController()
    const timeoutError = new Error('AbortError')
    timeoutError.name = 'AbortError'

    ;(global.fetch as jest.Mock).mockRejectedValue(timeoutError)

    await expect(apiRequest('/test', { timeout: 1000 })).rejects.toThrow('Request timeout')
  })

  it('should handle empty response (204)', async () => {
    const mock204Response = {
      ok: true,
      status: 204,
      headers: new Headers([['content-length', '0']]),
      text: jest.fn().mockResolvedValue(''),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mock204Response)

    const result = await apiRequest('/test')

    expect(result).toEqual({})
  })

  it('should include CSRF token for POST requests', async () => {
    const mockData = { id: 1 }
    const requestData = { name: 'Test' }
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockData),
      text: jest.fn().mockResolvedValue(JSON.stringify(mockData)),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    await apiRequest('/test', {
      method: 'POST',
      body: JSON.stringify(requestData),
    })

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[1].headers['X-CSRF-Token']).toBe('test-csrf-token')
  })

  it('should handle 401 error when token refresh fails', async () => {
    const mock401Response = {
      ok: false,
      status: 401,
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mock401Response)
    mockTokenManager.getAccessToken.mockResolvedValue(null) // 토큰 갱신 실패

    await expect(apiRequest('/test')).rejects.toThrow('Authentication required')
    expect(mockTrackAPIError).toHaveBeenCalled()
  })

  it('should handle 401 error when retry also fails', async () => {
    const mock401Response = {
      ok: false,
      status: 401,
      headers: new Headers(),
    }
    const mock401RetryResponse = {
      ok: false,
      status: 401,
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(mock401Response)
      .mockResolvedValueOnce(mock401RetryResponse)

    mockTokenManager.getAccessToken
      .mockResolvedValueOnce('old-token')
      .mockResolvedValueOnce('new-token')

    await expect(apiRequest('/test')).rejects.toThrow('Authentication required')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('should handle retry logic when retry option is true', async () => {
    const networkError = new Error('Network error')
    const mockData = { id: 1 }
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockData),
      text: jest.fn().mockResolvedValue(JSON.stringify(mockData)),
      headers: new Headers(),
    }

    // 첫 번째 시도는 실패, 두 번째는 성공
    ;(global.fetch as jest.Mock)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(mockResponse)

    const result = await apiRequest('/test', { retry: true })

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(result).toEqual(mockData)
  })

  it('should handle body as object (auto JSON.stringify)', async () => {
    const mockData = { id: 1 }
    const requestData = { name: 'Test' }
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockData),
      text: jest.fn().mockResolvedValue(JSON.stringify(mockData)),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    await apiRequest('/test', {
      method: 'POST',
      body: requestData as any, // 객체로 전달
    })

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[1].body).toBe(JSON.stringify(requestData))
  })

  it('should handle PUT request', async () => {
    const mockData = { id: 1, updated: true }
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockData),
      text: jest.fn().mockResolvedValue(JSON.stringify(mockData)),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const result = await apiRequest('/test/1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
    })

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[1].method).toBe('PUT')
    expect(fetchCall[1].headers['X-CSRF-Token']).toBe('test-csrf-token')
    expect(result).toEqual(mockData)
  })

  it('should handle DELETE request', async () => {
    const mockResponse = {
      ok: true,
      status: 204,
      headers: new Headers([['content-length', '0']]),
      text: jest.fn().mockResolvedValue(''),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const result = await apiRequest('/test/1', {
      method: 'DELETE',
    })

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[1].method).toBe('DELETE')
    expect(fetchCall[1].headers['X-CSRF-Token']).toBe('test-csrf-token')
    expect(result).toEqual({})
  })

  it('should handle PATCH request', async () => {
    const mockData = { id: 1, patched: true }
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockData),
      text: jest.fn().mockResolvedValue(JSON.stringify(mockData)),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const result = await apiRequest('/test/1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Patched' }),
    })

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[1].method).toBe('PATCH')
    expect(fetchCall[1].headers['X-CSRF-Token']).toBe('test-csrf-token')
    expect(result).toEqual(mockData)
  })

  it('should handle GET request without CSRF token', async () => {
    const mockData = { id: 1 }
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockData),
      text: jest.fn().mockResolvedValue(JSON.stringify(mockData)),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    await apiRequest('/test', {
      method: 'GET',
    })

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[1].headers['X-CSRF-Token']).toBeUndefined()
  })

  it('should handle request without CSRF token when skipAuth is true', async () => {
    mockTokenManager.getCSRFToken.mockReturnValue(null)
    const mockData = { public: true }
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockData),
      text: jest.fn().mockResolvedValue(JSON.stringify(mockData)),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    await apiRequest('/public', {
      method: 'POST',
      skipAuth: true,
    })

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[1].headers['X-CSRF-Token']).toBeUndefined()
  })

  it('should handle JSON parse error in response', async () => {
    const invalidJsonResponse = {
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('invalid json {'),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(invalidJsonResponse)

    await expect(apiRequest('/test')).rejects.toThrow('Failed to parse server response')
    expect(mockTrackAPIError).toHaveBeenCalled()
  })

  it('should handle empty text response', async () => {
    const emptyResponse = {
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(''),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(emptyResponse)

    const result = await apiRequest('/test')

    expect(result).toEqual({})
  })

  it('should handle error response with text instead of JSON', async () => {
    const errorTextResponse = {
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('Internal Server Error'),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(errorTextResponse)

    await expect(apiRequest('/test')).rejects.toThrow('Internal Server Error')
    expect(mockTrackAPIError).toHaveBeenCalled()
  })

  it('should handle error response with JSON error data', async () => {
    const errorJsonResponse = {
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue(JSON.stringify({ message: 'Custom error', code: 'ERR_500' })),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(errorJsonResponse)

    await expect(apiRequest('/test')).rejects.toThrow('Custom error')
    expect(mockTrackAPIError).toHaveBeenCalled()
  })

  it('should track performance metrics', async () => {
    const mockData = { id: 1 }
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockData),
      text: jest.fn().mockResolvedValue(JSON.stringify(mockData)),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)
    
    // performance.now를 jest.fn()으로 재모킹
    const mockPerformanceNow = jest.fn()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(250)
    global.performance = {
      now: mockPerformanceNow,
    } as any

    await apiRequest('/test')

    expect(mockTrackPerformanceMetric).toHaveBeenCalledWith(
      expect.stringContaining('api_get'),
      expect.any(Number)
    )
  })

  it('should handle token refresh failure gracefully', async () => {
    // 토큰 갱신 실패 시 로그만 출력하고 계속 진행
    mockTokenManager.getAccessToken.mockRejectedValueOnce(new Error('Token refresh failed'))
    
    const mockData = { id: 1 }
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockData),
      text: jest.fn().mockResolvedValue(JSON.stringify(mockData)),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const result = await apiRequest('/test')

    // 토큰 갱신 실패해도 요청은 계속 진행되어야 함
    expect(result).toEqual(mockData)
  })

  it('should handle AbortController not available', async () => {
    // AbortController가 없는 환경 시뮬레이션
    const originalAbortController = global.AbortController
    // @ts-expect-error - intentional deletion of global.AbortController for test
    delete global.AbortController

    const mockData = { id: 1 }
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockData),
      text: jest.fn().mockResolvedValue(JSON.stringify(mockData)),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const result = await apiRequest('/test')

    expect(result).toEqual(mockData)

    global.AbortController = originalAbortController
  })

  it('should handle no response received after retries', async () => {
    // 모든 재시도가 실패하고 response가 없는 경우
    const networkError = new Error('Network error')
    
    ;(global.fetch as jest.Mock).mockRejectedValue(networkError)

    await expect(apiRequest('/test', { retry: true })).rejects.toThrow()
    
    // 마지막 에러가 발생해야 함
    expect(mockTrackAPIError).toHaveBeenCalled()
  })

  it('should handle response being undefined after loop', async () => {
    // response가 undefined인 경우를 시뮬레이션
    // (이론적으로는 발생하지 않지만, 방어적 프로그래밍을 위한 브랜치)
    const networkError = new Error('Network error')
    
    // retry가 false이고 fetch가 실패하는 경우
    ;(global.fetch as jest.Mock).mockRejectedValue(networkError)

    // retry가 false이므로 한 번만 시도하고 실패
    await expect(apiRequest('/test', { retry: false })).rejects.toThrow()
    
    // 에러가 추적되어야 함
    expect(mockTrackAPIError).toHaveBeenCalled()
  })

  it('should include CSRF token in retry headers for POST requests', async () => {
    const mock401Response = {
      ok: false,
      status: 401,
      headers: new Headers(),
    }
    const mockData = { id: 1 }
    const mockRetryResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockData),
      text: jest.fn().mockResolvedValue(JSON.stringify(mockData)),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(mock401Response)
      .mockResolvedValueOnce(mockRetryResponse)

    mockTokenManager.getAccessToken
      .mockResolvedValueOnce('old-token')
      .mockResolvedValueOnce('new-token')
    mockTokenManager.getCSRFToken.mockReturnValue('csrf-token')

    const result = await apiRequest('/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    })

    // 재시도 시 CSRF 토큰이 포함되어야 함
    const retryCall = (global.fetch as jest.Mock).mock.calls[1]
    expect(retryCall[1].headers['X-CSRF-Token']).toBe('csrf-token')
    expect(result).toEqual(mockData)
  })

  it('should handle token refresh error in 401 retry', async () => {
    const mock401Response = {
      ok: false,
      status: 401,
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mock401Response)
    // 토큰 갱신 시도 중 에러 발생
    mockTokenManager.getAccessToken.mockRejectedValue(new Error('Token refresh failed'))

    await expect(apiRequest('/test')).rejects.toThrow('Authentication required')
    expect(mockTrackAPIError).toHaveBeenCalled()
  })

  it('should handle parseErrorResponse with no text and no statusText', async () => {
    const mockErrorResponse = {
      ok: false,
      status: 500,
      statusText: '',
      text: jest.fn().mockResolvedValue(''),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockErrorResponse)

    await expect(apiRequest('/test')).rejects.toThrow()
    expect(mockTrackAPIError).toHaveBeenCalled()
  })

  it('should handle parseErrorResponse with text parsing failure', async () => {
    const mockErrorResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: jest.fn().mockRejectedValue(new Error('Text parsing failed')),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockErrorResponse)

    await expect(apiRequest('/test')).rejects.toThrow()
    expect(mockTrackAPIError).toHaveBeenCalled()
  })

  it('should handle parseErrorResponse with invalid JSON text', async () => {
    const mockErrorResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: jest.fn().mockResolvedValue('invalid json'),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockErrorResponse)

    await expect(apiRequest('/test')).rejects.toThrow()
    expect(mockTrackAPIError).toHaveBeenCalled()
  })

  it('should use custom API URL from environment', async () => {
    const originalEnv = process.env.NEXT_PUBLIC_API_URL
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com'

    const mockData = { id: 1 }
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockData),
      text: jest.fn().mockResolvedValue(JSON.stringify(mockData)),
      headers: new Headers(),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    await apiRequest('/test')

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[0]).toBe('https://api.example.com/test')

    process.env.NEXT_PUBLIC_API_URL = originalEnv
  })
})

