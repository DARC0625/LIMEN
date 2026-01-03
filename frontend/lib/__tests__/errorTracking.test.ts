/**
 * errorTracking.ts 테스트
 */

import { trackError } from '../errorTracking'

// console.error 모킹
const originalConsoleError = console.error
beforeAll(() => {
  console.error = jest.fn()
})

afterAll(() => {
  console.error = originalConsoleError
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
})

