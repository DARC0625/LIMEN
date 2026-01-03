/**
 * lib/analytics.ts 테스트
 */

import { trackEvent, trackPageView, trackPerformanceMetric, trackWebVitals } from '../analytics'

describe('analytics', () => {
  const originalLocation = window.location

  beforeEach(() => {
    jest.clearAllMocks()
    // window 객체 초기화
    delete (window as any).gtag
    delete (window as any).plausible
    delete (process.env as any).NEXT_PUBLIC_GA_MEASUREMENT_ID
    delete (process.env as any).NEXT_PUBLIC_PLAUSIBLE_DOMAIN
    // window.location.href 모킹 (delete 후 재할당)
    try {
      delete (window as any).location
    } catch (e) {
      // location을 삭제할 수 없는 경우 무시
    }
    ;(window as any).location = {
      href: 'http://localhost:3000/test',
    }
  })

  afterEach(() => {
    try {
      window.location = originalLocation
    } catch (e) {
      // location을 복원할 수 없는 경우 무시
    }
  })

  describe('trackPageView', () => {
    it('tracks page view in development', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      process.env.NODE_ENV = 'development'

      trackPageView('/test-page')

      expect(consoleSpy).toHaveBeenCalledWith('[Page View]', '/test-page')
      consoleSpy.mockRestore()
    })

    it('tracks page view with Google Analytics', () => {
      const mockGtag = jest.fn()
      ;(window as any).gtag = mockGtag
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'GA-123'

      trackPageView('/test-page')

      expect(mockGtag).toHaveBeenCalledWith('config', 'GA-123', {
        page_path: '/test-page',
      })
    })

  it('tracks page view with Plausible', () => {
    const mockPlausible = jest.fn()
    ;(window as any).plausible = mockPlausible
    process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = 'example.com'

    trackPageView('/test-page')

    // Plausible은 { props: { path } } 형식으로 호출됨
    expect(mockPlausible).toHaveBeenCalled()
  })

    it('tracks page view in production without analytics', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      process.env.NODE_ENV = 'production'
      delete (window as any).gtag
      delete (process.env as any).NEXT_PUBLIC_PLAUSIBLE_DOMAIN

      trackPageView('/test-page')

      expect(consoleSpy).toHaveBeenCalledWith('[Page View]', '/test-page')
      consoleSpy.mockRestore()
    })

    it('does not track when window is undefined', () => {
      const originalWindow = global.window
      // @ts-ignore
      delete global.window

      expect(() => trackPageView('/test-page')).not.toThrow()

      global.window = originalWindow
    })
  })

  describe('trackEvent', () => {
    it('tracks event in development', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      process.env.NODE_ENV = 'development'

      trackEvent('button_click', { button: 'submit' })

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('tracks event with Google Analytics', () => {
      const mockGtag = jest.fn()
      ;(window as any).gtag = mockGtag

      trackEvent('button_click', { button: 'submit' })

      expect(mockGtag).toHaveBeenCalledWith('event', 'button_click', { button: 'submit' })
    })

  it('tracks event with Plausible', () => {
    const mockPlausible = jest.fn()
    ;(window as any).plausible = mockPlausible
    process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = 'example.com'

    trackEvent('button_click', { button: 'submit' })

    // Plausible은 { props } 형식으로 호출됨
    expect(mockPlausible).toHaveBeenCalled()
  })

    it('tracks event without properties', () => {
      const mockGtag = jest.fn()
      ;(window as any).gtag = mockGtag

      trackEvent('button_click')

      expect(mockGtag).toHaveBeenCalledWith('event', 'button_click', {})
    })

    it('tracks event in production without analytics', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      process.env.NODE_ENV = 'production'
      delete (window as any).gtag
      delete (process.env as any).NEXT_PUBLIC_PLAUSIBLE_DOMAIN

      trackEvent('button_click', { button: 'submit' })

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('includes timestamp and URL in event data', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      process.env.NODE_ENV = 'development'

      trackEvent('button_click', { button: 'submit' })

      const callArgs = consoleSpy.mock.calls[0]
      expect(callArgs[1]).toHaveProperty('properties')
      expect(callArgs[1].properties).toHaveProperty('timestamp')
      expect(callArgs[1].properties).toHaveProperty('url')
      consoleSpy.mockRestore()
    })
  })

  describe('trackPerformanceMetric', () => {
    it('tracks performance metric in development', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      process.env.NODE_ENV = 'development'

      trackPerformanceMetric('page_load', 1000)

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('tracks performance metric with Google Analytics', () => {
      const mockGtag = jest.fn()
      ;(window as any).gtag = mockGtag

      trackPerformanceMetric('page_load', 1000)

      expect(mockGtag).toHaveBeenCalledWith('event', 'timing_complete', {
        name: 'page_load',
        value: 1000,
        event_category: 'Performance',
      })
    })

    it('tracks performance metric with custom unit', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      process.env.NODE_ENV = 'development'

      trackPerformanceMetric('memory_usage', 512, 'MB')

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

  it('uses Performance API when available', () => {
    const mockMark = jest.fn()
    Object.defineProperty(window, 'performance', {
      value: { mark: mockMark },
      writable: true,
      configurable: true,
    })

    trackPerformanceMetric('page_load', 1000)

    expect(mockMark).toHaveBeenCalled()
  })

    it('handles Performance API errors gracefully', () => {
      const mockMark = jest.fn().mockImplementation(() => {
        throw new Error('Performance API error')
      })
      ;(window.performance as any) = { mark: mockMark }

      expect(() => trackPerformanceMetric('page_load', 1000)).not.toThrow()
    })

    it('tracks performance metric in production without analytics', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      process.env.NODE_ENV = 'production'
      delete (window as any).gtag

      trackPerformanceMetric('page_load', 1000)

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('trackWebVitals', () => {
    it('tracks web vitals', () => {
      const mockGtag = jest.fn()
      ;(window as any).gtag = mockGtag

      trackWebVitals({
        id: 'test-id',
        name: 'CLS',
        value: 0.1,
        label: 'good',
      })

      expect(mockGtag).toHaveBeenCalledWith('event', 'CLS', {
        event_category: 'Web Vitals',
        value: 0,
        event_label: 'test-id',
        non_interaction: true,
      })
    })

    it('tracks web vitals without gtag', () => {
      delete (window as any).gtag

      expect(() => {
        trackWebVitals({
          id: 'test-id',
          name: 'CLS',
          value: 0.1,
          label: 'good',
        })
      }).not.toThrow()
    })

    it('calls trackPerformanceMetric', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      process.env.NODE_ENV = 'development'

      trackWebVitals({
        id: 'test-id',
        name: 'CLS',
        value: 0.1,
        label: 'good',
      })

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})
