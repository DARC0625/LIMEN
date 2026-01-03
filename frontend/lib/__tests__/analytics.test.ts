/**
 * lib/analytics.ts 테스트
 */

import { trackEvent, trackPageView } from '../analytics'

// window.gtag 모킹
const mockGtag = jest.fn()
Object.defineProperty(window, 'gtag', {
  value: mockGtag,
  writable: true,
})

describe('analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // window.gtag 재설정
    ;(window as any).gtag = mockGtag
  })

  it('tracks event when gtag is available', () => {
    trackEvent('test_event', { category: 'test', label: 'test_label' })

    expect(mockGtag).toHaveBeenCalledWith('event', 'test_event', {
      category: 'test',
      label: 'test_label',
    })
  })

  it('tracks page view when gtag is available', () => {
    // 환경 변수 설정
    const originalEnv = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'test-ga-id'
    
    trackPageView('/test-page')

    expect(mockGtag).toHaveBeenCalledWith('config', 'test-ga-id', {
      page_path: '/test-page',
    })

    // 환경 변수 복원
    if (originalEnv) {
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = originalEnv
    } else {
      delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    }
  })

  it('does not throw when gtag is not available', () => {
    delete (window as any).gtag

    expect(() => {
      trackEvent('test_event', {})
      trackPageView('/test-page')
    }).not.toThrow()
  })
})

