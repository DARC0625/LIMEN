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
          message: 'Authentication required. Please log in again.',
          status: apiError.status,
        };
      }
      
      if (apiError.status >= 500) {
        return {
          type: ErrorType.SERVER,
          message: 'Server error occurred. Please try again later.',
          status: apiError.status,
        };
      }
      
      if (apiError.status >= 400) {
        return {
          type: ErrorType.VALIDATION,
          message: apiError.message || 'Invalid request.',
          status: apiError.status,
        };
      }
    }
    
    // 네트워크 에러
    if (
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('network') ||
      error.message.includes('timeout')
    ) {
      return {
        type: ErrorType.NETWORK,
        message: 'Network connection error. Please check your connection.',
      };
    }
    
    return {
      type: ErrorType.UNKNOWN,
      message: error.message || 'An unknown error occurred.',
    };
  }
  
  return {
    type: ErrorType.UNKNOWN,
    message: 'An unknown error occurred.',
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




