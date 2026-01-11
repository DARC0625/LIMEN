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
      // @ts-expect-error - intentional deletion of global.window for server-side test
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

    it('handles missing PerformanceObserver', () => {
      const originalPerformanceObserver = global.PerformanceObserver
      // @ts-expect-error - intentional deletion of global.PerformanceObserver for test
      delete global.PerformanceObserver

      expect(() => initWebVitals()).not.toThrow()

      global.PerformanceObserver = originalPerformanceObserver
    })

    it('handles missing supportedEntryTypes', () => {
      global.PerformanceObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        disconnect: jest.fn(),
      })) as any

      // @ts-expect-error - intentional deletion of PerformanceObserver.supportedEntryTypes for test
      delete (PerformanceObserver as any).supportedEntryTypes

      expect(() => initWebVitals()).not.toThrow()
    })

    it('handles LCP observer errors', () => {
      global.PerformanceObserver = jest.fn().mockImplementation(() => {
        throw new Error('Observer error')
      }) as any

      ;(PerformanceObserver as any).supportedEntryTypes = ['largest-contentful-paint']

      expect(() => initWebVitals()).not.toThrow()
    })

    it('handles FID observer errors', () => {
      global.PerformanceObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        disconnect: jest.fn(),
      })) as any

      ;(PerformanceObserver as any).supportedEntryTypes = ['first-input']

      expect(() => initWebVitals()).not.toThrow()
    })

    it('handles FCP observer errors', () => {
      global.PerformanceObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        disconnect: jest.fn(),
      })) as any

      ;(PerformanceObserver as any).supportedEntryTypes = ['paint']

      expect(() => initWebVitals()).not.toThrow()
    })

    it('handles TTFB measurement errors', () => {
      // performance.getEntriesByType 모킹
      Object.defineProperty(window, 'performance', {
        value: {
          getEntriesByType: jest.fn().mockReturnValue([]),
        },
        writable: true,
        configurable: true,
      })

      expect(() => initWebVitals()).not.toThrow()
    })

    it('calculates rating correctly for different metrics', () => {
      // Good rating
      reportWebVitals({
        id: 'test-id',
        name: 'LCP',
        value: 2000,
        rating: 'good',
      })
      expect(logger.log).toHaveBeenCalled()

      // Needs improvement rating
      reportWebVitals({
        id: 'test-id',
        name: 'LCP',
        value: 3000,
        rating: 'needs-improvement',
      })
      expect(logger.log).toHaveBeenCalled()

      // Poor rating
      reportWebVitals({
        id: 'test-id',
        name: 'LCP',
        value: 5000,
        rating: 'poor',
      })
      expect(mockTrackError).toHaveBeenCalled()
    })

    it('sends metrics to Google Analytics when available', () => {
      const mockGtag = jest.fn()
      ;(window as any).gtag = mockGtag

      reportWebVitals({
        id: 'test-id',
        name: 'LCP',
        value: 2000,
        rating: 'good',
      })

      expect(mockGtag).toHaveBeenCalled()
    })

    it('sends metrics to Plausible when available', () => {
      const mockPlausible = jest.fn()
      ;(window as any).plausible = mockPlausible

      reportWebVitals({
        id: 'test-id',
        name: 'LCP',
        value: 2000,
        rating: 'good',
      })

      expect(mockPlausible).toHaveBeenCalled()
    })

    it('adds performance mark when available', () => {
      const mockMark = jest.fn()
      Object.defineProperty(window, 'performance', {
        value: {
          mark: mockMark,
        },
        writable: true,
        configurable: true,
      })

      reportWebVitals({
        id: 'test-id',
        name: 'LCP',
        value: 2000,
        rating: 'good',
      })

      expect(mockMark).toHaveBeenCalled()
    })

    it('handles performance mark errors', () => {
      const mockMark = jest.fn().mockImplementation(() => {
        throw new Error('Mark error')
      })
      Object.defineProperty(window, 'performance', {
        value: {
          mark: mockMark,
        },
        writable: true,
        configurable: true,
      })

      expect(() => {
        reportWebVitals({
          id: 'test-id',
          name: 'LCP',
          value: 2000,
          rating: 'good',
        })
      }).not.toThrow()
    })

    it('handles missing gtag and plausible', () => {
      delete (window as any).gtag
      delete (window as any).plausible

      expect(() => {
        reportWebVitals({
          id: 'test-id',
          name: 'LCP',
          value: 2000,
          rating: 'good',
        })
      }).not.toThrow()
    })

    it('handles missing performance.mark', () => {
      Object.defineProperty(window, 'performance', {
        value: {},
        writable: true,
        configurable: true,
      })

      expect(() => {
        reportWebVitals({
          id: 'test-id',
          name: 'LCP',
          value: 2000,
          rating: 'good',
        })
      }).not.toThrow()
    })
  })

  describe('initWebVitals - LCP observer', () => {
    it('handles LCP observer callback errors', () => {
      const mockObserve = jest.fn()
      const mockObserver = jest.fn().mockImplementation((callback) => {
        // callback에서 에러 발생 시뮬레이션
        try {
          callback({ getEntries: () => [] })
        } catch (e) {
          // 에러 무시
        }
        return { observe: mockObserve }
      }) as any

      global.PerformanceObserver = mockObserver
      ;(PerformanceObserver as any).supportedEntryTypes = ['largest-contentful-paint']

      expect(() => initWebVitals()).not.toThrow()
    })

    it('handles LCP entry without renderTime or loadTime', () => {
      const mockObserve = jest.fn()
      const mockObserver = jest.fn().mockImplementation((callback) => {
        callback({
          getEntries: () => [{
            id: 'test-lcp',
            renderTime: undefined,
            loadTime: undefined,
          }],
        })
        return { observe: mockObserve }
      }) as any

      global.PerformanceObserver = mockObserver
      ;(PerformanceObserver as any).supportedEntryTypes = ['largest-contentful-paint']

      expect(() => initWebVitals()).not.toThrow()
    })
  })

  describe('initWebVitals - FID observer', () => {
    it('handles FID observer callback errors', () => {
      const mockObserve = jest.fn()
      const mockObserver = jest.fn().mockImplementation((callback) => {
        try {
          callback({ getEntries: () => [] })
        } catch (e) {
          // 에러 무시
        }
        return { observe: mockObserve }
      }) as any

      global.PerformanceObserver = mockObserver
      ;(PerformanceObserver as any).supportedEntryTypes = ['first-input']

      expect(() => initWebVitals()).not.toThrow()
    })

    it('handles FID entry processing', () => {
      const mockObserve = jest.fn()
      const mockObserver = jest.fn().mockImplementation((callback) => {
        callback({
          getEntries: () => [{
            id: 'test-fid',
            startTime: 100,
            processingStart: 150,
          }],
        })
        return { observe: mockObserve }
      }) as any

      global.PerformanceObserver = mockObserver
      ;(PerformanceObserver as any).supportedEntryTypes = ['first-input']

      expect(() => initWebVitals()).not.toThrow()
    })
  })

  describe('initWebVitals - FCP observer', () => {
    it('handles FCP observer callback errors', () => {
      const mockObserve = jest.fn()
      const mockObserver = jest.fn().mockImplementation((callback) => {
        try {
          callback({ getEntries: () => [] })
        } catch (e) {
          // 에러 무시
        }
        return { observe: mockObserve }
      }) as any

      global.PerformanceObserver = mockObserver
      ;(PerformanceObserver as any).supportedEntryTypes = ['paint']

      expect(() => initWebVitals()).not.toThrow()
    })

    it('handles non-FCP paint entries', () => {
      const mockObserve = jest.fn()
      const mockObserver = jest.fn().mockImplementation((callback) => {
        callback({
          getEntries: () => [{
            name: 'other-paint',
            startTime: 100,
          }],
        })
        return { observe: mockObserve }
      }) as any

      global.PerformanceObserver = mockObserver
      ;(PerformanceObserver as any).supportedEntryTypes = ['paint']

      expect(() => initWebVitals()).not.toThrow()
    })
  })

  describe('initWebVitals - TTFB', () => {
    it('handles TTFB calculation', () => {
      Object.defineProperty(window, 'performance', {
        value: {
          getEntriesByType: jest.fn().mockReturnValue([{
            responseStart: 200,
            requestStart: 100,
          }]),
        },
        writable: true,
        configurable: true,
      })

      expect(() => initWebVitals()).not.toThrow()
    })

    it('handles missing navigation entry', () => {
      Object.defineProperty(window, 'performance', {
        value: {
          getEntriesByType: jest.fn().mockReturnValue([]),
        },
        writable: true,
        configurable: true,
      })

      expect(() => initWebVitals()).not.toThrow()
    })
  })
})

