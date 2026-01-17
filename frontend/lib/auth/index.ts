/**
 * 인증 관련 로직 통합
 * TokenManager, Security, AuthGuard의 인증 로직을 통합 관리
 */

import { tokenManager } from '../tokenManager';
import { authAPI } from '../api/auth';
import { getUserRoleFromToken, isUserApprovedFromToken, isTokenValid } from '../utils/token';
import type { SessionResponse } from '../types';
import { logger } from '../utils/logger';

/**
 * 인증 확인 결과
 */
export interface AuthCheckResult {
  valid: boolean;
  reason?: string;
}

/**
 * 인증 확인 (최신 방식: Refresh Token 패턴)
 */
export async function checkAuth(): Promise<AuthCheckResult> {
  if (typeof window === 'undefined') {
    // ✅ P0-2: result.valid === false면 reason은 무조건 string이 되도록 보장
    return { valid: false, reason: '서버 환경에서는 인증을 확인할 수 없습니다.' };
  }

  // 중요: 로그인 페이지에서는 세션 확인 요청을 보내지 않음
  // 이제 AuthGuard는 보호된 경로에서만 사용되므로 로그인 페이지 체크 불필요
  // 보호된 경로에 접근하려면 반드시 토큰이 있어야 함

  // 1. TokenManager에서 토큰 확인
  if (tokenManager.hasValidToken()) {
    try {
      // Access Token 가져오기 (자동 갱신)
      const accessToken = await tokenManager.getAccessToken();
      if (accessToken) {
        // 백엔드 세션 확인
        const sessionResult = await checkBackendSession();
        if (sessionResult.valid) {
          return { valid: true };
        }
        // 세션이 유효하지 않으면 토큰 정리하지 않음 (재시도 가능)
      }
    } catch (error) {
      // 토큰 갱신 실패는 무시하고 백엔드 세션 확인으로 진행
      logger.warn('[checkAuth] Token refresh failed, checking backend session:', error);
    }
  }

  // 2. 백엔드 세션 확인 (폴백)
  // 이제 AuthGuard는 보호된 경로에서만 사용되므로 로그인 페이지 체크 불필요

  try {
    const sessionResult = await checkBackendSession();
    if (sessionResult.valid) {
      return { valid: true };
    }
    
    // 세션이 유효하지 않으면 토큰 정리
    // 단, 네트워크 오류가 아닌 경우에만 정리
    if (sessionResult.reason && !sessionResult.reason.includes('네트워크')) {
      tokenManager.clearTokens();
    }
    // ✅ P0-2: result.valid === false면 reason은 무조건 string이 되도록 보장
    return { valid: false, reason: sessionResult.reason || '세션이 유효하지 않습니다.' };
  } catch (error) {
    // 네트워크 오류 - localStorage 토큰으로 폴백
    logger.warn('[checkAuth] Backend session check failed, falling back to localStorage:', error);
    return checkLocalStorageToken();
  }
}

/**
 * 백엔드 세션 확인
 */
// React Error #321 해결: checkBackendSession 호출을 debounce하기 위한 플래그
let sessionCheckInProgress = false;
let lastSessionCheckTime = 0;
let lastSessionCheckResult: AuthCheckResult | null = null;
const SESSION_CHECK_DEBOUNCE_MS = 1000; // 1초 debounce
const SESSION_CHECK_CACHE_MS = 30000; // 30초간 결과 캐시 (페이지 이동 시 세션 유지)

async function checkBackendSession(): Promise<AuthCheckResult> {
  // 중요: 로그인 페이지에서는 세션 확인 요청을 보내지 않음
  // 루트 경로(/)는 로그인으로 리다이렉트되므로 제외
  // 이제 AuthGuard는 보호된 경로에서만 사용되므로 로그인 페이지 체크 불필요
  // 보호된 경로에 접근하려면 반드시 토큰이 있어야 함
  
  // React Error #321 해결: debounce 적용 - 너무 자주 호출되는 것 방지
  const now = Date.now();
  
  // 최근에 성공한 세션 확인 결과가 있으면 캐시된 결과 반환 (페이지 이동 시 세션 유지)
  if (lastSessionCheckResult?.valid && (now - lastSessionCheckTime < SESSION_CHECK_CACHE_MS)) {
    logger.log('[checkBackendSession] Using cached session check result');
    return lastSessionCheckResult;
  }
  
  if (sessionCheckInProgress || (now - lastSessionCheckTime < SESSION_CHECK_DEBOUNCE_MS)) {
    // 이미 체크 중이거나 최근에 체크했으면 캐시된 결과 또는 대기 중 반환
    if (lastSessionCheckResult) {
      return lastSessionCheckResult;
    }
    return { valid: false, reason: '세션 확인 중입니다.' };
  }
  
  sessionCheckInProgress = true;
  lastSessionCheckTime = now;
  
  try {
    const csrfToken = tokenManager.getCSRFToken();
    
    // 상세 로깅 (개발 환경에서만)
    logger.log('[checkBackendSession] Checking session', {
      hasCSRFToken: !!csrfToken,
    });
    
    // 요청 전 쿠키 확인
    // Phase 4: 보안 강화 - localStorage 직접 사용 제거, tokenManager 사용
    const cookiesBeforeRequest = document.cookie;
    const hasRefreshToken = tokenManager.hasValidToken();
    logger.log('[checkBackendSession] Cookies before request:', {
      hasCookies: !!cookiesBeforeRequest,
      cookieCount: cookiesBeforeRequest ? cookiesBeforeRequest.split(';').length : 0,
      cookies: cookiesBeforeRequest ? cookiesBeforeRequest.substring(0, 300) : 'none',
      hasRefreshTokenInStorage: hasRefreshToken,
    });
    
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include', // 쿠키 포함 필수
      headers: {
        'Content-Type': 'application/json',
        // GET 요청은 읽기 전용이므로 CSRF 토큰이 없어도 백엔드에서 처리함
        // 백엔드: GET 요청에서 CSRF 토큰 검증 실패 시에도 세션 정보 반환
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
    });

    // 상세 로깅 (개발 환경에서만)
    const setCookieHeaders = response.headers.getSetCookie();
    logger.log('[checkBackendSession] Session check response:', {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
      setCookieCount: setCookieHeaders.length,
      setCookies: setCookieHeaders.map(h => h.substring(0, 150)),
    });

    if (response.ok) {
      const data: SessionResponse = await response.json();
      
      logger.log('[checkBackendSession] Session data:', {
        valid: data.valid,
        reason: data.reason,
      });
      
      if (data.valid === true) {
        logger.log('[checkBackendSession] Session is valid');
        const result = { valid: true };
        lastSessionCheckResult = result; // 성공한 결과 캐시
        return result;
      } else {
        logger.log('[checkBackendSession] Session is invalid:', data.reason);
        const result = { valid: false, reason: data.reason || '세션이 유효하지 않습니다.' };
        lastSessionCheckResult = result; // 실패한 결과도 캐시 (빠른 실패)
        return result;
      }
    } else if (response.status === 401) {
      // 401은 세션이 없거나 만료됨
      logger.log('[checkBackendSession] Session expired or not found (401)');
      const result = { valid: false, reason: '인증이 필요합니다.' };
      lastSessionCheckResult = result; // 실패 결과 캐시
      return result;
    } else if (response.status === 403) {
      // 403은 권한 문제 (백엔드 변경으로 GET 요청에서는 이제 발생하지 않아야 함)
      // 하지만 혹시 모를 경우를 대비해 처리
      logger.warn('[checkBackendSession] Forbidden (403) - unexpected for GET request');
      const result = { valid: false, reason: '권한이 없습니다.' };
      lastSessionCheckResult = result; // 실패 결과 캐시
      return result;
    } else {
      // 기타 오류는 네트워크 문제로 간주하고 예외 발생
      logger.error(new Error(`[checkBackendSession] Unexpected status: ${response.status}`), {
        status: response.status,
        component: 'auth',
        action: 'checkBackendSession',
      });
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    // 네트워크 오류 또는 기타 예외
    logger.error(error instanceof Error ? error : new Error(String(error)), {
      component: 'auth',
      action: 'checkBackendSession',
    });
    throw error;
  } finally {
    sessionCheckInProgress = false;
  }
}

/**
 * localStorage 토큰 확인 (폴백)
 * Phase 4: 보안 강화 - localStorage 직접 사용 제거, tokenManager 사용
 */
async function checkLocalStorageToken(): Promise<AuthCheckResult> {
  if (typeof window === 'undefined') {
    // ✅ P0-2: result.valid === false면 reason은 무조건 string이 되도록 보장
    return { valid: false, reason: '서버 환경에서는 인증을 확인할 수 없습니다.' };
  }

  try {
    const accessToken = await tokenManager.getAccessToken();
    if (!accessToken?.trim()) {
      // ✅ P0-2: result.valid === false면 reason은 무조건 string이 되도록 보장
      return { valid: false, reason: '토큰이 없습니다.' };
    }

    // 토큰 유효성 확인
    if (!isTokenValid(accessToken)) {
      tokenManager.clearTokens();
      return { valid: false, reason: '토큰이 유효하지 않습니다.' };
    }

    // 백엔드 연결 실패 시 임시로 토큰 기반 인증 허용
    return { valid: true };
  } catch {
    // ✅ P0-2: result.valid === false면 reason은 무조건 string이 되도록 보장
    return { valid: false, reason: '토큰 확인 중 오류가 발생했습니다.' };
  }
}

/**
 * 사용자 역할 가져오기
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
 * 사용자 승인 상태 확인
 * Phase 4: 보안 강화 - localStorage 직접 사용 제거, tokenManager 사용
 */
export async function isUserApproved(): Promise<boolean> {
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
 * 로그아웃
 */
export function logout(): void {
  if (typeof window === 'undefined') return;
  
  // TokenManager 정리
  tokenManager.clearTokens();
  
  // 백엔드 세션 삭제
  authAPI.deleteSession().catch(() => {
    // 세션 삭제 실패는 무시
  });
  
  // localStorage 정리 (하위 호환성)
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_token_timestamp');
}

