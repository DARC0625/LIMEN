/**
 * ✅ P1-Next-Fix-Module-2A: 브라우저 전용 헬퍼 함수들
 * 
 * 하위 호환성을 위한 유틸리티 함수들
 * 이 파일은 'use client'로 마크되어 브라우저에서만 실행됩니다.
 */

'use client';

import { getUserRoleFromToken, isUserApprovedFromToken } from '../utils/token';
import { tokenManager } from './clientApi';
import { logger } from '../utils/logger';

/**
 * 사용자 역할 가져오기 (동기 버전 - 하위 호환성)
 * Phase 4: 보안 강화 - localStorage 직접 사용 제거, tokenManager 사용
 */
export async function getUserRole(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const accessToken = await tokenManager.getAccessToken();
    return getUserRoleFromToken(accessToken);
  } catch {
    return null;
  }
}

/**
 * 사용자 승인 상태 확인 (동기 버전 - 하위 호환성)
 * Phase 4: 보안 강화 - localStorage 직접 사용 제거, tokenManager 사용
 */
export async function isApproved(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const accessToken = await tokenManager.getAccessToken();
    return isUserApprovedFromToken(accessToken);
  } catch {
    return false;
  }
}

/**
 * Admin 여부 확인
 * Phase 4: 보안 강화 - 비동기 함수로 변경
 */
export async function isAdmin(): Promise<boolean> {
  const role = await getUserRole();
  return role === 'admin';
}

/**
 * 토큰 설정 (하위 호환성)
 */
export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  
  // 하위 호환성: localStorage에 저장
  localStorage.setItem('auth_token', token);
  localStorage.setItem('auth_token_timestamp', Date.now().toString());
  
  // 백엔드 세션 생성 요청
  const csrfToken = tokenManager.getCSRFToken();
  fetch('/api/auth/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ token }),
  }).catch(() => {
    // 세션 생성 실패는 무시
  });
}

/**
 * 토큰 삭제 (하위 호환성)
 */
export function removeToken(): void {
  if (typeof window === 'undefined') return;
  
  // TokenManager 정리
  tokenManager.clearTokens();
  
  // 백엔드 세션 삭제 요청
  const csrfToken = tokenManager.getCSRFToken();
  fetch('/api/auth/session', {
    method: 'DELETE',
    headers: {
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    credentials: 'include',
  }).catch(() => {
    // 세션 삭제 실패는 무시
  });
  
  // localStorage 정리 (하위 호환성)
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_token_timestamp');
}

/**
 * 토큰 설정 (최신 방식 - Access Token + Refresh Token)
 */
export async function setTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): Promise<void> {
  if (typeof window === 'undefined') return;
  
  // TokenManager에 토큰 저장
  tokenManager.setTokens(accessToken, refreshToken, expiresIn);
  
  // 백엔드 세션 생성 요청 (순환 참조 방지를 위해 직접 import)
  try {
    // ✅ P1-Next-Fix-Module-2C: authAPI는 clientApi에서 import
    const { authAPI } = await import('./clientApi');
    await authAPI.createSession(accessToken, refreshToken);
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error(String(error)), {
      component: 'api/clientHelpers',
      action: 'setTokens',
    });
  }
}
