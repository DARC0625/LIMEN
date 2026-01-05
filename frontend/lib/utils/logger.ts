/**
 * 로깅 유틸리티
 * 프로덕션 환경에서는 에러 추적 시스템으로, 개발 환경에서는 console로 로깅
 * 
 * @module lib/utils/logger
 */

import { trackError } from '../errorTracking';

// 클라이언트 사이드에서 process.env 접근 시 안전하게 처리
// Next.js는 빌드 시점에 process.env.NODE_ENV를 치환하므로, 직접 값으로 설정
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * 로깅 유틸리티 객체
 * 
 * @example
 * ```ts
 * import { logger } from '../lib/utils/logger';
 * 
 * logger.log('Debug message');
 * logger.warn('Warning message');
 * logger.error(new Error('Error message'), { context: 'component' });
 * ```
 */
export const logger = {
  /**
   * 개발 환경에서만 console.log 출력
   * @param args - 로그할 인자들
   */
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * 경고 메시지 로깅
   * 개발 환경에서는 console.warn 출력, 프로덕션에서는 에러 추적 시스템으로 전송
   * @param args - 경고 메시지 인자들
   */
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

  /**
   * 에러 로깅
   * 개발 환경에서는 console.error 출력, 프로덕션에서는 항상 에러 추적 시스템으로 전송
   * @param error - 에러 객체 또는 에러 메시지
   * @param context - 추가 컨텍스트 정보 (컴포넌트, 액션 등)
   */
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

  /**
   * 디버그 메시지 로깅
   * 개발 환경에서만 console.debug 출력
   * @param args - 디버그 메시지 인자들
   */
  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
};

