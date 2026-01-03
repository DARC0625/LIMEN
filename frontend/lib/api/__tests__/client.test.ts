/**
 * API 클라이언트 테스트
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
})

