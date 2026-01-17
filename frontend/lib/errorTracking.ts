// 에러 추적 및 로깅 유틸리티
// OPERATIONS_GUIDE.md 및 FRONTEND_DEPLOYMENT_STRATEGY.md 가이드 준수

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: number;
  timestamp?: string;
  [key: string]: unknown;
}

// Sentry 타입 정의
interface SentryInstance {
  captureException: (error: Error, options?: {
    contexts?: { custom?: ErrorContext };
    tags?: Record<string, string>;
  }) => void;
}

// Sentry 연동 (환경 변수로 활성화)
// ✅ 브라우저에서 기본 OFF: hermetic 환경에서는 외부 side effect 금지
const Sentry: SentryInstance | null = null;
if (typeof window !== 'undefined' && typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    // 동적 import로 Sentry 로드 (필요시 설치: npm install @sentry/nextjs)
    // Sentry = require('@sentry/nextjs');
  } catch {
    // Sentry가 설치되지 않은 경우 무시
  }
}

/**
 * 에러 추적 함수
 * Sentry, LogRocket 등 에러 추적 서비스 연동 지원
 */
export function trackError(error: Error, context?: ErrorContext): void {
  // Skip tracking for 404 errors (expected when APIs don't exist)
  interface ErrorWithStatus extends Error {
    status?: number;
  }
  const errorWithStatus = error as ErrorWithStatus;
  if (error.message === 'Not Found' || errorWithStatus.status === 404) {
    return;
  }
  
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    context: {
      ...context,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    },
  };

  // 개발 환경에서는 콘솔에 출력
  // ✅ 브라우저에서 기본 OFF: process가 없으면 스킵
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    console.error('[Error Tracking]', errorInfo);
  }

  // Sentry 연동 (활성화된 경우)
  if (Sentry && typeof window !== 'undefined') {
    try {
      Sentry.captureException(error, {
        contexts: {
          custom: context || {},
        },
        tags: {
          component: context?.component || 'unknown',
          action: context?.action || 'unknown',
        },
      });
    } catch {
      // Sentry 에러는 무시하고 계속 진행
    }
  }

  // 백엔드 API로 에러 전송 (선택적)
  // ✅ 브라우저에서 기본 OFF: hermetic 환경에서는 외부 전송 금지
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ERROR_TRACKING_API && typeof window !== 'undefined') {
    fetch(process.env.NEXT_PUBLIC_ERROR_TRACKING_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorInfo),
    }).catch(() => {
      // 네트워크 에러는 무시
    });
  }

  // 프로덕션 환경에서도 콘솔에 출력 (디버깅용)
  // ✅ 브라우저에서 기본 OFF: process가 없으면 스킵
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production' && !Sentry) {
    console.error('[Error Tracking]', errorInfo);
  }
}

/**
 * API 에러 추적
 */
export function trackAPIError(
  endpoint: string,
  status: number,
  error: Error,
  context?: ErrorContext
): void {
  trackError(error, {
    ...context,
    type: 'API_ERROR',
    endpoint,
    status,
  });
}

/**
 * WebSocket 에러 추적
 */
export function trackWebSocketError(
  url: string,
  error: Error,
  context?: ErrorContext
): void {
  trackError(error, {
    ...context,
    type: 'WEBSOCKET_ERROR',
    url,
  });
}





