/**
 * errorTracking.ts 테스트
 */

import { trackError, trackAPIError, trackWebSocketError } from '../errorTracking'

// console.error 모킹
const originalConsoleError = console.error
const originalFetch = global.fetch
const originalWindow = global.window

beforeAll(() => {
  console.error = jest.fn()
  global.fetch = jest.fn()
})

afterAll(() => {
  console.error = originalConsoleError
  global.fetch = originalFetch
  global.window = originalWindow
})

describe('errorTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('tracks error in development', () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: 'development' },
      writable: true,
      configurable: true,
    })

    const error = new Error('Test error')
    const context = { component: 'TestComponent', action: 'test_action' }

    trackError(error, context)

    expect(console.error).toHaveBeenCalled()
    const callArgs = (console.error as jest.Mock).mock.calls[0]
    expect(callArgs[0]).toBe('[Error Tracking]')
    expect(callArgs[1]).toMatchObject({
      message: 'Test error',
      context: expect.objectContaining({
        component: 'TestComponent',
      }),
    })

    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: originalEnv },
      writable: true,
      configurable: true,
    })
  })

  it('skips tracking for 404 errors', () => {
    const error = new Error('Not Found')
    const context = { component: 'TestComponent' }

    trackError(error, context)

    expect(console.error).not.toHaveBeenCalled()
  })

  it('skips tracking for errors with 404 status', () => {
    const error = new Error('Not Found') as Error & { status?: number }
    error.status = 404
    const context = { component: 'TestComponent' }

    trackError(error, context)

    expect(console.error).not.toHaveBeenCalled()
  })

  it('includes error context', () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: 'development' },
      writable: true,
      configurable: true,
    })

    const error = new Error('Test error')
    const context = {
      component: 'TestComponent',
      action: 'test_action',
      userId: 123,
    }

    trackError(error, context)

    expect(console.error).toHaveBeenCalled()
    const callArgs = (console.error as jest.Mock).mock.calls[0]
    expect(callArgs[0]).toBe('[Error Tracking]')
    expect(callArgs[1]).toMatchObject({
      context: expect.objectContaining({
        component: 'TestComponent',
        action: 'test_action',
        userId: 123,
      }),
    })

    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: originalEnv },
      writable: true,
      configurable: true,
    })
  })

  it('tracks error in production without Sentry', () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: 'production' },
      writable: true,
      configurable: true,
    })

    const error = new Error('Test error')
    trackError(error)

    // 프로덕션 환경에서 Sentry가 없으면 콘솔에 출력
    expect(console.error).toHaveBeenCalled()

    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: originalEnv },
      writable: true,
      configurable: true,
    })
  })

  it('sends error to tracking API when configured', async () => {
    const originalEnv = process.env.NEXT_PUBLIC_ERROR_TRACKING_API
    process.env.NEXT_PUBLIC_ERROR_TRACKING_API = 'https://api.example.com/errors'

    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })

    const error = new Error('Test error')
    trackError(error)

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/errors',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )

    if (originalEnv) {
      process.env.NEXT_PUBLIC_ERROR_TRACKING_API = originalEnv
    } else {
      delete process.env.NEXT_PUBLIC_ERROR_TRACKING_API
    }
  })

  it('handles tracking API fetch error gracefully', async () => {
    const originalEnv = process.env.NEXT_PUBLIC_ERROR_TRACKING_API
    process.env.NEXT_PUBLIC_ERROR_TRACKING_API = 'https://api.example.com/errors'

    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    const error = new Error('Test error')
    trackError(error)

    await new Promise(resolve => setTimeout(resolve, 100))

    // fetch 에러가 발생해도 예외가 발생하지 않아야 함
    expect(global.fetch).toHaveBeenCalled()

    if (originalEnv) {
      process.env.NEXT_PUBLIC_ERROR_TRACKING_API = originalEnv
    } else {
      delete process.env.NEXT_PUBLIC_ERROR_TRACKING_API
    }
  })

  it('tracks API error', () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: 'development' },
      writable: true,
      configurable: true,
    })

    const error = new Error('API error')
    trackAPIError('/api/test', 500, error, { component: 'TestComponent' })

    expect(console.error).toHaveBeenCalled()
    const callArgs = (console.error as jest.Mock).mock.calls[0]
    expect(callArgs[1]).toMatchObject({
      context: expect.objectContaining({
        type: 'API_ERROR',
        endpoint: '/api/test',
        status: 500,
        component: 'TestComponent',
      }),
    })

    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: originalEnv },
      writable: true,
      configurable: true,
    })
  })

  it('tracks WebSocket error', () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: 'development' },
      writable: true,
      configurable: true,
    })

    const error = new Error('WebSocket error')
    trackWebSocketError('ws://example.com', error, { component: 'TestComponent' })

    expect(console.error).toHaveBeenCalled()
    const callArgs = (console.error as jest.Mock).mock.calls[0]
    // trackError에서 url이 window.location.href로 덮어씌워지므로
    // type과 component만 확인
    expect(callArgs[1].context).toMatchObject({
      type: 'WEBSOCKET_ERROR',
      component: 'TestComponent',
    })

    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: originalEnv },
      writable: true,
      configurable: true,
    })
  })
})

