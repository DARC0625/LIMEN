/**
 * 에러 처리 헬퍼 함수
 * 401/403 에러 처리를 표준화
 */

import type { APIError } from '../types';
import { removeToken } from '../api/index';

/**
 * 401/403 인증 에러인지 확인
 */
export function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  const apiError = error as APIError;
  return (
    apiError.status === 401 ||
    apiError.status === 403 ||
    apiError.message?.includes('401') ||
    apiError.message?.includes('403') ||
    apiError.message?.includes('Unauthorized') ||
    apiError.message?.includes('Forbidden') ||
    apiError.message?.includes('Authentication required')
  );
}

/**
 * 인증 에러 처리 (토큰 제거 및 리다이렉트)
 */
export function handleAuthError(error: unknown): void {
  if (isAuthError(error)) {
    removeToken();
    // AuthGuard가 자동으로 로그인 페이지로 리다이렉트
  }
}

