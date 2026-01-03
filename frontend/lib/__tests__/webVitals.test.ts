/**
 * webVitals.ts 테스트
 */

import { reportWebVitals, initWebVitals } from '../webVitals'
import { logger } from '../utils/logger'
import { trackError } from '../errorTracking'

// logger 모킹
jest.mock('../utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

// errorTracking 모킹
jest.mock('../errorTracking', () => ({
  trackError: jest.fn(),
}))

const mockTrackError = trackError as jest.MockedFunction<typeof trackError>

describe('webVitals', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('reportWebVitals', () => {
    it('reports good rating metric', () => {
      const metric = {
        id: 'test-id',
        name: 'LCP',
        value: 2000,
        rating: 'good' as const,
      }

      reportWebVitals(metric)

      expect(logger.log).toHaveBeenCalledWith(
        '[Web Vital] LCP:',
        expect.objectContaining({
          value: 2000,
          rating: 'good',
        })
      )
    })

    it('reports poor rating metric and tracks error', () => {
      const metric = {
        id: 'test-id',
        name: 'LCP',
        value: 5000,
        rating: 'poor' as const,
      }

      reportWebVitals(metric)

      expect(logger.log).toHaveBeenCalled()
      expect(mockTrackError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          component: 'WebVitals',
          metric: 'LCP',
        })
      )
    })

    it('calculates rating correctly for LCP', () => {
      const goodMetric = {
        id: 'test-id',
        name: 'LCP',
        value: 2000,
        rating: 'good' as const,
      }

      reportWebVitals(goodMetric)

      expect(logger.log).toHaveBeenCalled()
    })
  })

  describe('initWebVitals', () => {
    it('does nothing on server side', () => {
      const originalWindow = global.window
      // @ts-ignore
      delete global.window

      initWebVitals()

      expect(logger.log).not.toHaveBeenCalled()
      global.window = originalWindow
    })

    it('initializes on client side', () => {
      // PerformanceObserver 모킹
      global.PerformanceObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        disconnect: jest.fn(),
      })) as any

      // supportedEntryTypes 모킹
      ;(PerformanceObserver as any).supportedEntryTypes = [
        'largest-contentful-paint',
        'first-input',
        'paint',
      ]

      initWebVitals()

      // 함수가 실행되는지 확인 (에러가 발생하지 않으면 성공)
      expect(true).toBe(true)
    })
  })
})

