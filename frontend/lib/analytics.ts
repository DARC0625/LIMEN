// 성능 모니터링 및 분석 유틸리티
// FRONTEND_DEPLOYMENT_STRATEGY.md 가이드 준수

// Window 타입 확장 (Google Analytics, Plausible)
interface WindowWithAnalytics extends Window {
  gtag?: (...args: unknown[]) => void;
  plausible?: (event: string, options?: { props?: Record<string, unknown> }) => void;
}

// Google Analytics 연동 헬퍼
function getGtag(): ((...args: unknown[]) => void) | null {
  if (typeof window === 'undefined') return null;
  const win = window as WindowWithAnalytics;
  return win.gtag || null;
}

// Plausible 연동 헬퍼
function trackPlausible(event: string, props?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const win = window as WindowWithAnalytics;
  const plausible = win.plausible;
  if (plausible) {
    plausible(event, { props });
  }
}

/**
 * 페이지 뷰 추적
 * Google Analytics, Plausible 등 분석 서비스 자동 연동
 */
export function trackPageView(path: string): void {
  if (typeof window === 'undefined') return;

  // 개발 환경에서는 콘솔에 출력
  if (process.env.NODE_ENV === 'development') {
    console.log('[Page View]', path);
  }

  // Google Analytics 연동
  const gtag = getGtag();
  if (gtag && process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
    gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
      page_path: path,
    });
  }

  // Plausible 연동
  if (process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) {
    trackPlausible('pageview', { path });
  }

  // 프로덕션 환경에서도 콘솔에 출력 (디버깅용)
  if (process.env.NODE_ENV === 'production' && !gtag && !process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) {
    console.log('[Page View]', path);
  }
}

/**
 * 이벤트 추적
 * Google Analytics, Plausible 등 분석 서비스 자동 연동
 */
export function trackEvent(
  name: string,
  properties?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;

  const eventData = {
    name,
    properties: {
      ...properties,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    },
  };

  // 개발 환경에서는 콘솔에 출력
  if (process.env.NODE_ENV === 'development') {
    console.log('[Event Tracking]', eventData);
  }

  // Google Analytics 연동
  const gtag = getGtag();
  if (gtag) {
    gtag('event', name, properties || {});
  }

  // Plausible 연동
  if (process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) {
    trackPlausible(name, properties);
  }

  // 프로덕션 환경에서도 콘솔에 출력 (디버깅용)
  if (process.env.NODE_ENV === 'production' && !gtag && !process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) {
    console.log('[Event Tracking]', eventData);
  }
}

/**
 * 성능 메트릭 수집
 * Google Analytics, Performance API 등으로 전송
 */
export function trackPerformanceMetric(
  name: string,
  value: number,
  unit: string = 'ms'
): void {
  if (typeof window === 'undefined') return;

  const metric = {
    name,
    value,
    unit,
    timestamp: new Date().toISOString(),
  };

  // 개발 환경에서는 콘솔에 출력
  if (process.env.NODE_ENV === 'development') {
    console.log('[Performance Metric]', metric);
  }

  // Google Analytics로 전송
  const gtag = getGtag();
  if (gtag) {
    gtag('event', 'timing_complete', {
      name: metric.name,
      value: Math.round(metric.value),
      event_category: 'Performance',
    });
  }

  // Performance API 사용 (브라우저 네이티브)
  if (typeof window !== 'undefined' && 'performance' in window && 'mark' in window.performance) {
    try {
      window.performance.mark(`${name}-${Date.now()}`);
    } catch {
      // Performance API 에러는 무시
    }
  }

  // 프로덕션 환경에서도 콘솔에 출력 (디버깅용)
  if (process.env.NODE_ENV === 'production' && !gtag) {
    console.log('[Performance Metric]', metric);
  }
}

/**
 * Web Vitals 메트릭 수집
 */
export function trackWebVitals(metric: {
  id: string;
  name: string;
  value: number;
  label: string;
}): void {
  trackPerformanceMetric(metric.name, metric.value);
  
  // Google Analytics 등으로 전송
  const gtag = getGtag();
  if (gtag) {
    gtag('event', metric.name, {
      event_category: 'Web Vitals',
      value: Math.round(metric.value),
      event_label: metric.id,
      non_interaction: true,
    });
  }
}



