/**
 * 인증 관련 로직 통합
 * TokenManager, Security, AuthGuard의 인증 로직을 통합 관리
 */

import { tokenManager, type TokenManagerPort } from '../tokenManager';
import { authAPI } from '../api/auth';
import { getUserRoleFromToken, isUserApprovedFromToken, isTokenValid } from '../utils/token';
import type { SessionResponse } from '../types';
import { logger } from '../utils/logger';

// ✅ Command Jest-2: auth는 TokenManagerPort 인터페이스만 의존
// 구체 클래스에 의존하지 말고 인터페이스만 보게 만듦
// ✅ Command Jest-1: auth에서 브라우저 글로벌 직접 접근 완전 제거
// document.cookie는 checkBackendSession에서만 사용 (로그용)
// 실제 로직은 tokenManager(StoragePort)를 통해서만 접근

/**
 * 인증 확인 결과
 */
export interface AuthCheckResult {
  valid: boolean;
  reason?: string;
  // ✅ Command 1: debug payload (테스트에서만 활성화)
  debug?: {
    checkLocalStorageTokenCalled: boolean;
    checkBackendSessionCalled: boolean;
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    expiresAt: number | null;
    usedCache: boolean;
    backendStatus?: number;
    backendOk?: boolean;
    reasonPath: 'local' | 'backend' | 'cache' | 'none';
  };
}

/**
 * checkAuth 옵션
 */
export interface CheckAuthOptions {
  debug?: boolean; // ✅ Command 1: debug 활성화 옵션
}

/**
 * 인증 확인 (최신 방식: Refresh Token 패턴)
 * 
 * ✅ Command 1: debug 옵션 추가 (테스트에서만 활성화)
 */
export async function checkAuth(options?: CheckAuthOptions): Promise<AuthCheckResult> {
  const enableDebug = options?.debug === true;
  
  // ✅ Jest: 브라우저 경로가 막히지 않도록 수정
  // typeof window === 'undefined' 체크는 유지하되,
  // 테스트에서는 window를 mock하거나 Port를 주입하여 브라우저 기능을 흉내냄
  // 하지만 checkAuth는 tokenManager를 직접 사용하므로, tokenManager가 Port를 사용하면
  // window 체크는 "브라우저 전역 API 접근"을 막는 용도로만 사용
  // 실제 로직은 Port를 통해 동작하므로 Node 환경에서도 테스트 가능
  if (typeof window === 'undefined') {
    // ✅ P0-2: result.valid === false면 reason은 무조건 string이 되도록 보장
    return { 
      valid: false, 
      reason: '서버 환경에서는 인증을 확인할 수 없습니다.',
      ...(enableDebug ? { debug: { checkLocalStorageTokenCalled: false, checkBackendSessionCalled: false, hasAccessToken: false, hasRefreshToken: false, expiresAt: null, usedCache: false, reasonPath: 'none' } } : {}),
    };
  }
  
  // ✅ Jest: checkBackendSession에서 document.cookie를 사용하므로
  // 테스트 환경에서는 document를 mock해야 함
  // 또는 checkBackendSession이 Port를 사용하도록 리팩터링 필요
  // 지금은 document가 없으면 checkBackendSession을 건너뛰고 checkLocalStorageToken으로 폴백

  // ✅ Command 1: debug payload 수집 시작 (옵션이 활성화된 경우만)
  const debug: AuthCheckResult['debug'] | undefined = enableDebug ? {
    checkLocalStorageTokenCalled: false,
    checkBackendSessionCalled: false,
    hasAccessToken: false,
    hasRefreshToken: tokenManager.hasValidToken(),
    expiresAt: tokenManager.getExpiresAt(),
    usedCache: false,
    reasonPath: 'none',
  } : undefined;

  // 중요: 로그인 페이지에서는 세션 확인 요청을 보내지 않음
  // 이제 AuthGuard는 보호된 경로에서만 사용되므로 로그인 페이지 체크 불필요
  // 보호된 경로에 접근하려면 반드시 토큰이 있어야 함

  // 1. TokenManager에서 토큰 확인
  if (tokenManager.hasValidToken()) {
    try {
      // Access Token 가져오기 (자동 갱신)
      const accessToken = await tokenManager.getAccessToken();
      if (debug) {
        debug.hasAccessToken = !!accessToken;
      }
      if (accessToken) {
        // 백엔드 세션 확인
        if (debug) {
          debug.checkBackendSessionCalled = true;
          debug.reasonPath = 'backend';
        }
        const sessionResult = await checkBackendSession(enableDebug);
        if (debug && sessionResult.debug) {
          debug.backendStatus = sessionResult.debug.backendStatus;
          debug.backendOk = sessionResult.debug.backendOk;
          debug.usedCache = sessionResult.debug.usedCache || false;
        }
        if (sessionResult.valid) {
          return { valid: true, ...(debug ? { debug } : {}) };
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
    if (debug) {
      debug.checkBackendSessionCalled = true;
      debug.reasonPath = 'backend';
    }
    const sessionResult = await checkBackendSession(enableDebug);
    if (debug && sessionResult.debug) {
      debug.backendStatus = sessionResult.debug.backendStatus;
      debug.backendOk = sessionResult.debug.backendOk;
      debug.usedCache = sessionResult.debug.usedCache || false;
    }
    if (sessionResult.valid) {
      return { valid: true, ...(debug ? { debug } : {}) };
    }
    
    // 세션이 유효하지 않으면 토큰 정리
    // 단, 네트워크 오류가 아닌 경우에만 정리
    if (sessionResult.reason && !sessionResult.reason.includes('네트워크')) {
      tokenManager.clearTokens();
    }
    // ✅ P0-2: result.valid === false면 reason은 무조건 string이 되도록 보장
    return { valid: false, reason: sessionResult.reason || '세션이 유효하지 않습니다.', ...(debug ? { debug } : {}) };
  } catch (error) {
    // 네트워크 오류 - localStorage 토큰으로 폴백
    logger.warn('[checkAuth] Backend session check failed, falling back to localStorage:', error);
    if (debug) {
      debug.checkLocalStorageTokenCalled = true;
      debug.reasonPath = 'local';
    }
    const localStorageResult = await checkLocalStorageToken(enableDebug);
    return { ...localStorageResult, ...(debug ? { debug } : {}) };
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

async function checkBackendSession(enableDebug?: boolean): Promise<AuthCheckResult> {
  // 중요: 로그인 페이지에서는 세션 확인 요청을 보내지 않음
  // 루트 경로(/)는 로그인으로 리다이렉트되므로 제외
  // 이제 AuthGuard는 보호된 경로에서만 사용되므로 로그인 페이지 체크 불필요
  // 보호된 경로에 접근하려면 반드시 토큰이 있어야 함
  
  // ✅ Command 1: debug payload 수집 (옵션이 활성화된 경우만)
  const debug: AuthCheckResult['debug'] | undefined = enableDebug ? {
    checkLocalStorageTokenCalled: false,
    checkBackendSessionCalled: true,
    hasAccessToken: false,
    hasRefreshToken: tokenManager.hasValidToken(),
    expiresAt: tokenManager.getExpiresAt(),
    usedCache: false,
    reasonPath: 'backend',
  } : undefined;
  
  // React Error #321 해결: debounce 적용 - 너무 자주 호출되는 것 방지
  const now = Date.now();
  
  // 최근에 성공한 세션 확인 결과가 있으면 캐시된 결과 반환 (페이지 이동 시 세션 유지)
  if (lastSessionCheckResult?.valid && (now - lastSessionCheckTime < SESSION_CHECK_CACHE_MS)) {
    logger.log('[checkBackendSession] Using cached session check result');
    if (debug) {
      debug.usedCache = true;
      debug.reasonPath = 'cache';
    }
    return { ...lastSessionCheckResult, ...(debug ? { debug } : {}) };
  }
  
  if (sessionCheckInProgress || (now - lastSessionCheckTime < SESSION_CHECK_DEBOUNCE_MS)) {
    // 이미 체크 중이거나 최근에 체크했으면 캐시된 결과 또는 대기 중 반환
    if (lastSessionCheckResult) {
      if (debug) {
        debug.usedCache = true;
        debug.reasonPath = 'cache';
      }
      return { ...lastSessionCheckResult, ...(debug ? { debug } : {}) };
    }
    return { valid: false, reason: '세션 확인 중입니다.', ...(debug ? { debug } : {}) };
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

    // ✅ Command 1: debug에 backendStatus, backendOk 추가
    if (debug) {
      debug.backendStatus = response.status;
      debug.backendOk = response.ok;
    }
    
    if (response.ok) {
      const data: SessionResponse = await response.json();
      
      logger.log('[checkBackendSession] Session data:', {
        valid: data.valid,
        reason: data.reason,
      });
      
      if (data.valid === true) {
        logger.log('[checkBackendSession] Session is valid');
        const result = { valid: true, ...(debug ? { debug } : {}) };
        lastSessionCheckResult = { valid: true }; // 캐시는 debug 없이
        return result;
      } else {
        logger.log('[checkBackendSession] Session is invalid:', data.reason);
        const result = { valid: false, reason: data.reason || '세션이 유효하지 않습니다.', ...(debug ? { debug } : {}) };
        lastSessionCheckResult = { valid: false, reason: data.reason || '세션이 유효하지 않습니다.' }; // 캐시는 debug 없이
        return result;
      }
    } else if (response.status === 401) {
      // 401은 세션이 없거나 만료됨
      logger.log('[checkBackendSession] Session expired or not found (401)');
      const result = { valid: false, reason: '인증이 필요합니다.', ...(debug ? { debug } : {}) };
      lastSessionCheckResult = { valid: false, reason: '인증이 필요합니다.' }; // 캐시는 debug 없이
      return result;
    } else if (response.status === 403) {
      // 403은 권한 문제 (백엔드 변경으로 GET 요청에서는 이제 발생하지 않아야 함)
      // 하지만 혹시 모를 경우를 대비해 처리
      logger.warn('[checkBackendSession] Forbidden (403) - unexpected for GET request');
      const result = { valid: false, reason: '권한이 없습니다.', ...(debug ? { debug } : {}) };
      lastSessionCheckResult = { valid: false, reason: '권한이 없습니다.' }; // 캐시는 debug 없이
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
async function checkLocalStorageToken(enableDebug?: boolean): Promise<AuthCheckResult> {
  if (typeof window === 'undefined') {
    // ✅ P0-2: result.valid === false면 reason은 무조건 string이 되도록 보장
    return { 
      valid: false, 
      reason: '서버 환경에서는 인증을 확인할 수 없습니다.',
      ...(enableDebug ? { debug: { checkLocalStorageTokenCalled: true, checkBackendSessionCalled: false, hasAccessToken: false, hasRefreshToken: false, expiresAt: null, usedCache: false, reasonPath: 'none' } } : {}),
    };
  }

  // ✅ Command 1: debug payload 수집 (옵션이 활성화된 경우만)
  const debug: AuthCheckResult['debug'] | undefined = enableDebug ? {
    checkLocalStorageTokenCalled: true,
    checkBackendSessionCalled: false,
    hasAccessToken: false,
    hasRefreshToken: tokenManager.hasValidToken(),
    expiresAt: tokenManager.getExpiresAt(),
    usedCache: false,
    reasonPath: 'local',
  } : undefined;

  try {
    const accessToken = await tokenManager.getAccessToken();
    if (debug) {
      debug.hasAccessToken = !!accessToken;
    }
    if (!accessToken?.trim()) {
      // ✅ P0-2: result.valid === false면 reason은 무조건 string이 되도록 보장
      return { valid: false, reason: '토큰이 없습니다.', ...(debug ? { debug } : {}) };
    }

    // 토큰 유효성 확인
    if (!isTokenValid(accessToken)) {
      tokenManager.clearTokens();
      return { valid: false, reason: '토큰이 유효하지 않습니다.', ...(debug ? { debug } : {}) };
    }

    // 백엔드 연결 실패 시 임시로 토큰 기반 인증 허용
    return { valid: true, ...(debug ? { debug } : {}) };
  } catch {
    // ✅ P0-2: result.valid === false면 reason은 무조건 string이 되도록 보장
    return { valid: false, reason: '토큰 확인 중 오류가 발생했습니다.', ...(debug ? { debug } : {}) };
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
 * 
 * ✅ Command B: 브라우저 글로벌 직접 접근 제거
 * localStorage 직접 호출 제거, tokenManager를 통해서만 정리
 * tokenManager.clearTokens()가 이미 StoragePort를 통해 정리하므로
 * 추가 localStorage 접근 불필요
 */
export function logout(): void {
  if (typeof window === 'undefined') return;
  
  // ✅ Command B: TokenManager 정리 (StoragePort를 통해 정리됨)
  tokenManager.clearTokens();
  
  // 백엔드 세션 삭제
  authAPI.deleteSession().catch(() => {
    // 세션 삭제 실패는 무시
  });
  
  // ✅ Command B: localStorage 직접 접근 제거
  // tokenManager.clearTokens()가 이미 StoragePort를 통해 refresh_token, token_expires_at, csrf_token을 정리함
  // 하위 호환성을 위한 추가 localStorage 접근은 불필요
}

