/**
 * 로깅 유틸리티
 * 프로덕션 환경에서는 에러 추적 시스템으로, 개발 환경에서는 console로 로깅
 */

import { trackError } from '../errorTracking';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * 개발 환경에서만 console.log 출력
 */
export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(...args);
    } else {
      // 프로덕션에서는 경고도 에러 추적 시스템으로 전송
      const message = args.map(arg => 
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ');
      trackError(new Error(`Warning: ${message}`), {
        type: 'WARNING',
        source: 'logger',
      });
    }
  },

  error: (error: Error | unknown, context?: Record<string, unknown>) => {
    if (isDevelopment) {
      console.error(error, context);
    }
    // 프로덕션에서는 항상 에러 추적 시스템으로 전송
    if (error instanceof Error) {
      trackError(error, context);
    } else {
      trackError(new Error(String(error)), context);
    }
  },

  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
};

