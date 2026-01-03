/**
 * 에러 처리 유틸리티
 * 통합된 에러 처리 및 사용자 친화적 메시지 변환
 */

import type { APIError, ErrorContext } from '../types';
import { trackError, trackAPIError } from '../errorTracking';

/**
 * 에러 타입
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  VALIDATION = 'VALIDATION',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN',
}

/**
 * 에러 분류
 */
export function classifyError(error: unknown): {
  type: ErrorType;
  message: string;
  status?: number;
} {
  if (error instanceof Error) {
    // API 에러
    const apiError = error as APIError;
    if (apiError.status) {
      if (apiError.status === 401 || apiError.status === 403) {
        return {
          type: ErrorType.AUTH,
          message: '인증이 필요합니다. 다시 로그인해주세요.',
          status: apiError.status,
        };
      }
      
      if (apiError.status >= 500) {
        return {
          type: ErrorType.SERVER,
          message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
          status: apiError.status,
        };
      }
      
      if (apiError.status === 404) {
        return {
          type: ErrorType.VALIDATION,
          message: '요청한 리소스를 찾을 수 없습니다.',
          status: apiError.status,
        };
      }
      
      if (apiError.status >= 400) {
        return {
          type: ErrorType.VALIDATION,
          message: apiError.message || '잘못된 요청입니다.',
          status: apiError.status,
        };
      }
    }
    
    // 네트워크 에러
    if (
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('network') ||
      error.message.includes('timeout') ||
      error.message.includes('Request timeout')
    ) {
      return {
        type: ErrorType.NETWORK,
        message: '네트워크 연결 오류가 발생했습니다. 인터넷 연결을 확인해주세요.',
      };
    }
    
    return {
      type: ErrorType.UNKNOWN,
      message: error.message || '알 수 없는 오류가 발생했습니다.',
    };
  }
  
  return {
    type: ErrorType.UNKNOWN,
    message: '알 수 없는 오류가 발생했습니다.',
  };
}

/**
 * 사용자 친화적 에러 메시지 생성
 */
export function getUserFriendlyMessage(error: unknown): string {
  const classified = classifyError(error);
  return classified.message;
}

/**
 * 에러 처리 및 추적
 */
export function handleError(
  error: unknown,
  context?: ErrorContext
): {
  type: ErrorType;
  message: string;
  status?: number;
} {
  const classified = classifyError(error);
  
  // 에러 추적
  if (error instanceof Error) {
    if (classified.type === ErrorType.NETWORK) {
      trackError(error, {
        ...context,
        type: 'NETWORK_ERROR',
      });
    } else if (classified.type === ErrorType.AUTH) {
      trackError(error, {
        ...context,
        type: 'AUTH_ERROR',
      });
    } else {
      trackError(error, context);
    }
  }
  
  return classified;
}

/**
 * API 에러 처리 및 추적
 */
export function handleAPIError(
  endpoint: string,
  error: unknown,
  context?: ErrorContext
): {
  type: ErrorType;
  message: string;
  status?: number;
} {
  const classified = classifyError(error);
  
  if (error instanceof Error) {
    const apiError = error as APIError;
    trackAPIError(
      endpoint,
      apiError.status || 0,
      error,
      {
        ...context,
        errorType: classified.type,
      }
    );
  }
  
  return classified;
}




