// Web Vitals 모니터링
// Core Web Vitals (LCP, FID, CLS) 및 기타 성능 메트릭 수집

import { logger } from './utils/logger';
import { trackError } from './errorTracking';

interface Metric {
  id: string;
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  entries?: PerformanceEntry[];
}

// Web Vitals 임계값
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  FID: { good: 100, poor: 300 }, // First Input Delay
  CLS: { good: 0.1, poor: 0.25 }, // Cumulative Layout Shift
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  TTFB: { good: 800, poor: 1800 }, // Time to First Byte
  INP: { good: 200, poor: 500 }, // Interaction to Next Paint
};

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return 'good';
  
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

function sendToAnalytics(metric: Metric) {
  // 개발 환경에서는 로거를 통해 출력
  logger.log(`[Web Vital] ${metric.name}:`, {
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
  });

  // Poor rating인 경우 에러 추적 시스템에 보고
  if (metric.rating === 'poor') {
    trackError(new Error(`Poor Web Vital: ${metric.name} = ${metric.value}ms`), {
      component: 'WebVitals',
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
    });
  }

  // Google Analytics로 전송
  interface WindowWithGtag extends Window {
    gtag?: (command: string, eventName: string, params: Record<string, unknown>) => void;
  }
  const windowWithGtag = window as WindowWithGtag;
  if (typeof window !== 'undefined' && windowWithGtag.gtag) {
    windowWithGtag.gtag('event', metric.name, {
      event_category: 'Web Vitals',
      value: Math.round(metric.value),
      event_label: metric.id,
      non_interaction: true,
      custom_map: {
        metric_rating: metric.rating,
      },
    });
  }

  // Plausible로 전송
  interface WindowWithPlausible extends Window {
    plausible?: (eventName: string, options?: { props?: Record<string, unknown> }) => void;
  }
  const windowWithPlausible = window as WindowWithPlausible;
  if (typeof window !== 'undefined' && windowWithPlausible.plausible) {
    windowWithPlausible.plausible('Web Vital', {
      props: {
        name: metric.name,
        value: Math.round(metric.value),
        rating: metric.rating,
      },
    });
  }

  // Performance API에 마크 추가
  if (typeof window !== 'undefined' && 'performance' in window && 'mark' in window.performance) {
    try {
      window.performance.mark(`${metric.name}-${metric.id}`);
    } catch (e) {
      // Performance API 에러는 무시
    }
  }
}

// LCP (Largest Contentful Paint) 측정
export function reportWebVitals(metric: Metric) {
  const rating = getRating(metric.name, metric.value);
  sendToAnalytics({ ...metric, rating });
}

// Performance Observer를 사용한 자동 측정
export function initWebVitals() {
  if (typeof window === 'undefined') return;
  
  // PerformanceObserver 지원 여부 확인
  if (typeof PerformanceObserver === 'undefined') return;

  // LCP (Largest Contentful Paint)
  try {
    // supportedEntryTypes 확인
    if (!PerformanceObserver.supportedEntryTypes || !PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint')) {
      return;
    }
    
    const lcpObserver = new PerformanceObserver((list) => {
      try {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        
        reportWebVitals({
          id: lastEntry.id || 'lcp',
          name: 'LCP',
          value: lastEntry.renderTime || lastEntry.loadTime,
          rating: 'good',
          entries: entries as PerformanceEntry[],
        });
      } catch (e) {
        // 에러 무시
      }
    });
    
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
  } catch (e) {
    // Performance Observer를 지원하지 않는 브라우저 또는 에러
  }

  // FID (First Input Delay) - 이제 INP로 대체됨
  try {
    // supportedEntryTypes 확인
    if (PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.includes('first-input')) {
      const fidObserver = new PerformanceObserver((list) => {
        try {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            reportWebVitals({
              id: entry.id || 'fid',
              name: 'FID',
              value: entry.processingStart - entry.startTime,
              rating: 'good',
              entries: [entry],
            });
          });
        } catch (e) {
          // 에러 무시
        }
      });
      
      fidObserver.observe({ entryTypes: ['first-input'] });
    }
  } catch (e) {
    // Performance Observer를 지원하지 않는 브라우저 또는 에러
  }

  // CLS (Cumulative Layout Shift)
  // layout-shift는 일부 브라우저에서 지원하지 않으므로 완전히 비활성화하여 경고 제거
  // CLS 측정은 제거 (브라우저 호환성 문제로 인해)
  // 필요시 다른 방법으로 CLS 측정 가능

  // FCP (First Contentful Paint)
  try {
    // supportedEntryTypes 확인
    if (PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.includes('paint')) {
      const paintObserver = new PerformanceObserver((list) => {
        try {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (entry.name === 'first-contentful-paint') {
              reportWebVitals({
                id: 'fcp',
                name: 'FCP',
                value: entry.startTime,
                rating: 'good',
                entries: [entry],
              });
            }
          });
        } catch (e) {
          // 에러 무시
        }
      });
      
      paintObserver.observe({ entryTypes: ['paint'] });
    }
  } catch (e) {
    // Performance Observer를 지원하지 않는 브라우저 또는 에러
  }

  // TTFB (Time to First Byte)
  try {
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigationEntry) {
      const ttfb = navigationEntry.responseStart - navigationEntry.requestStart;
      reportWebVitals({
        id: 'ttfb',
        name: 'TTFB',
        value: ttfb,
        rating: 'good',
      });
    }
  } catch (e) {
    // Navigation Timing을 지원하지 않는 브라우저
  }
}

