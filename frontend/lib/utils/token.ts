/**
 * 토큰 관련 유틸리티 함수
 * JWT 토큰 파싱 및 검증
 */

import { validateTokenIntegrity } from '../security';
import { logger } from './logger';

/**
 * JWT 토큰 디코딩
 */
export interface DecodedToken {
  id?: number;
  username?: string;
  role?: string;
  approved?: boolean;
  exp?: number;
  user_id?: number;
  iat?: number;
  iss?: string;
  [key: string]: unknown;
}

export function decodeToken(token: string): DecodedToken | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) {
      return null;
    }

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    logger.warn('[decodeToken] Parse error:', e);
    return null;
  }
}

/**
 * 토큰 만료 확인
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return false; // exp가 없으면 만료되지 않은 것으로 간주
  }

  return decoded.exp * 1000 < Date.now();
}

/**
 * 토큰 유효성 확인 (무결성 + 만료)
 */
export function isTokenValid(token: string | null): boolean {
  if (!token) {
    return false;
  }

  // 무결성 검증
  if (!validateTokenIntegrity(token)) {
    return false;
  }

  // 만료 확인
  if (isTokenExpired(token)) {
    return false;
  }

  return true;
}

/**
 * 사용자 역할 가져오기
 */
export function getUserRoleFromToken(token: string | null): string | null {
  if (!token) {
    return null;
  }

  const decoded = decodeToken(token);
  return decoded?.role || null;
}

/**
 * 사용자 승인 상태 확인
 */
export function isUserApprovedFromToken(token: string | null): boolean {
  if (!token) {
    return false;
  }

  const decoded = decodeToken(token);
  if (!decoded) {
    return false;
  }

  // Admin은 항상 승인됨
  if (decoded.role === 'admin') {
    return true;
  }

  return decoded.approved === true;
}




