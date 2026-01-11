/**
 * lib/analytics.ts 테스트
 */

import { trackPageView, trackEvent, trackPerformanceMetric, trackWebVitals } from '../analytics'
import { setEnv, getEnv } from '../test-utils/env'

describe('analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // gtag와 plausible을 완전히 삭제
    if ((window as any).gtag) {
      delete (window as any).gtag
    }
    if ((window as any).plausible) {
      delete (window as any).plausible
    }
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
  })

  describe('trackPageView', () => {
    it('logs page view in development', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      setEnv('NODE_ENV', 'development')

      trackPageView('/test')

      expect(consoleSpy).toHaveBeenCalledWith('[Page View]', '/test')
      consoleSpy.mockRestore()
    })

    it('sends page view to Google Analytics when available', () => {
      const mockGtag = jest.fn()
      ;(window as any).gtag = mockGtag
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'GA-123'

      trackPageView('/test')

      expect(mockGtag).toHaveBeenCalledWith('config', 'GA-123', {
        page_path: '/test',
      })
    })

    it('sends page view to Plausible when available', () => {
      const mockPlausible = jest.fn()
      ;(window as any).plausible = mockPlausible
      process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = 'example.com'

      trackPageView('/test')

      // trackPlausible은 props를 사용하므로 호출 방식이 다름
      expect(mockPlausible).toHaveBeenCalledWith('pageview', { props: { path: '/test' } })
    })

    it('does nothing on server side', () => {
      const originalWindow = global.window
      // @ts-expect-error - intentional deletion of global.window for server-side test
      delete global.window

      expect(() => trackPageView('/test')).not.toThrow()

      global.window = originalWindow
    })
  })

  describe('trackEvent', () => {
    it('logs event in development', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      setEnv('NODE_ENV', 'development')

      trackEvent('test-event', { key: 'value' })

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('sends event to Google Analytics when available', () => {
      const mockGtag = jest.fn()
      ;(window as any).gtag = mockGtag

      trackEvent('test-event', { key: 'value' })

      expect(mockGtag).toHaveBeenCalledWith('event', 'test-event', { key: 'value' })
    })

    it('sends event to Plausible when available', () => {
      const mockPlausible = jest.fn()
      ;(window as any).plausible = mockPlausible
      process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = 'example.com'

      trackEvent('test-event', { key: 'value' })

      // trackPlausible은 props를 사용하므로 호출 방식이 다름
      expect(mockPlausible).toHaveBeenCalledWith('test-event', { props: { key: 'value' } })
    })

    it('includes timestamp and url in event data', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      setEnv('NODE_ENV', 'development')

      trackEvent('test-event', { key: 'value' })

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Event Tracking]',
        expect.objectContaining({
          name: 'test-event',
          properties: expect.objectContaining({
            key: 'value',
            timestamp: expect.any(String),
            url: expect.any(String),
          }),
        })
      )
      consoleSpy.mockRestore()
    })
  })

  describe('trackPerformanceMetric', () => {
    it('logs metric in development', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      setEnv('NODE_ENV', 'development')

      trackPerformanceMetric('test-metric', 100, 'ms')

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('sends metric to Google Analytics when available', () => {
      const mockGtag = jest.fn()
      ;(window as any).gtag = mockGtag

      trackPerformanceMetric('test-metric', 100, 'ms')

      expect(mockGtag).toHaveBeenCalledWith('event', 'timing_complete', {
        name: 'test-metric',
        value: 100,
        event_category: 'Performance',
      })
    })

    it('uses default unit of ms', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      setEnv('NODE_ENV', 'development')

      trackPerformanceMetric('test-metric', 100)

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Performance Metric]',
        expect.objectContaining({
          unit: 'ms',
        })
      )
      consoleSpy.mockRestore()
    })

    it('creates performance mark when available', () => {
      const mockMark = jest.fn()
      Object.defineProperty(window, 'performance', {
        value: { mark: mockMark },
        writable: true,
        configurable: true,
      })

      trackPerformanceMetric('test-metric', 100)

      expect(mockMark).toHaveBeenCalled()
    })

    it('handles performance mark errors gracefully', () => {
      const mockMark = jest.fn().mockImplementation(() => {
        throw new Error('Mark error')
      })
      Object.defineProperty(window, 'performance', {
        value: { mark: mockMark },
        writable: true,
        configurable: true,
      })

      expect(() => trackPerformanceMetric('test-metric', 100)).not.toThrow()
    })
  })

  describe('trackWebVitals', () => {
    it('calls trackPerformanceMetric', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      setEnv('NODE_ENV', 'development')

      trackWebVitals({
        id: 'test-id',
        name: 'LCP',
        value: 2000,
        label: 'good',
      })

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('sends web vitals to Google Analytics when available', () => {
      const mockGtag = jest.fn()
      ;(window as any).gtag = mockGtag

      trackWebVitals({
        id: 'test-id',
        name: 'LCP',
        value: 2000,
        label: 'good',
      })

      expect(mockGtag).toHaveBeenCalledWith('event', 'LCP', {
        event_category: 'Web Vitals',
        value: 2000,
        event_label: 'test-id',
        non_interaction: true,
      })
    })
  })

  describe('trackPageView edge cases', () => {
    it('handles production environment without gtag and plausible', () => {
      const originalEnv = getEnv('NODE_ENV')
      setEnv('NODE_ENV', 'production')
      delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      trackPageView('/test')

      expect(consoleSpy).toHaveBeenCalledWith('[Page View]', '/test')

      consoleSpy.mockRestore()
      setEnv('NODE_ENV', originalEnv)
    })

    it('handles production environment with gtag', () => {
      const originalEnv = getEnv('NODE_ENV')
      setEnv('NODE_ENV', 'production')
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'GA-123'
      delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN

      const mockGtag = jest.fn()
      Object.defineProperty(window, 'gtag', {
        writable: true,
        configurable: true,
        value: mockGtag,
      })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      trackPageView('/test')

      expect(mockGtag).toHaveBeenCalled()
      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
      setEnv('NODE_ENV', originalEnv)
      delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    })
  })

  describe('trackEvent edge cases', () => {
    it('handles production environment without gtag and plausible', () => {
      const originalEnv = getEnv('NODE_ENV')
      setEnv('NODE_ENV', 'production')
      delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
      delete (window as any).gtag

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      trackEvent('test-event', { key: 'value' })

      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
      setEnv('NODE_ENV', originalEnv)
    })

    it('handles production environment with gtag', () => {
      const originalEnv = getEnv('NODE_ENV')
      setEnv('NODE_ENV', 'production')
      delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN

      const mockGtag = jest.fn()
      Object.defineProperty(window, 'gtag', {
        writable: true,
        value: mockGtag,
      })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      trackEvent('test-event', { key: 'value' })

      expect(mockGtag).toHaveBeenCalled()
      expect(consoleSpy).not.toHaveBeenCalled()

      setEnv('NODE_ENV', originalEnv)
    })

    it('handles trackEvent with no properties', () => {
      // 이전 테스트에서 gtag가 정의되었을 수 있으므로 삭제 후 재정의
      if ((window as any).gtag) {
        delete (window as any).gtag
      }
      const mockGtag = jest.fn()
      // Object.defineProperty 대신 직접 할당 사용
      ;(window as any).gtag = mockGtag

      trackEvent('test-event')

      expect(mockGtag).toHaveBeenCalledWith('event', 'test-event', {})
    })
  })

  describe('trackPerformanceMetric edge cases', () => {
    it('handles trackPerformanceMetric with no gtag', () => {
      Object.defineProperty(window, 'gtag', {
        writable: true,
        value: undefined,
      })

      trackPerformanceMetric('test-metric', 100)

      // gtag가 없어도 에러가 발생하지 않아야 함
      expect(true).toBe(true)
    })
  })
})
