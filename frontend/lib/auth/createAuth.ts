/**
 * ✅ P1-1: Auth Factory (DI 패턴)
 * 
 * 브라우저 전역 객체에 직접 의존하지 않고, Port/Adapter를 주입받아 동작
 */

import { getUserRoleFromToken, isUserApprovedFromToken, isTokenValid } from '../utils/token';
import type { SessionResponse } from '../types';
import { logger } from '../utils/logger';

/**
 * 인증 확인 결과
 */
export interface AuthCheckResult {
  valid: boolean;
  reason?: string;
  // ✅ P1-5: debug payload (테스트에서만 활성화)
  debug?: {
    checkLocalStorageTokenCalled: boolean;
    checkBackendSessionCalled: boolean;
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    expiresAt: number | null;
    usedCache: boolean;
    backendStatus?: number;
    backendOk?: boolean;
    reasonPath: 'local' | 'backend' | 'cache' | 'refresh' | 'none';
  };
}

/**
 * checkAuth 옵션
 */
export interface CheckAuthOptions {
  debug?: boolean; // ✅ P1-5: debug 활성화 옵션
}

/**
 * ✅ P1-1: Auth 의존성 인터페이스 (Port 기반)
 */
export interface AuthDeps {
  tokenManager: {
    hasValidToken(): boolean;
    getAccessToken(): Promise<string | null>;
    getRefreshToken(): string | null;
    getExpiresAt(): number | null;
    getCSRFToken(): string | null;
    clearTokens(): void;
  };
  authAPI: {
    checkSession?(): Promise<{ ok: boolean; status?: number; data?: SessionResponse }>;
    deleteSession(): Promise<void>;
    refreshToken?(refreshToken: string): Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
  };
  clock: {
    now(): number;
  };
  fetch?: typeof fetch; // ✅ P1-7: fetch도 주입 가능하게 (테스트용)
}

/**
 * ✅ P1-1: Auth 서비스 생성 (Factory 패턴)
 */
export function createAuth(deps: AuthDeps) {
  // ✅ P1-6: 캐시 상태는 auth 인스턴스별로 관리
  let sessionCheckInProgress = false;
  let lastSessionCheckTime = 0;
  let lastSessionCheckResult: AuthCheckResult | null = null;
  const SESSION_CHECK_DEBOUNCE_MS = 1000; // 1초 debounce
  const SESSION_CHECK_CACHE_MS = 30000; // 30초간 결과 캐시

  /**
   * 인증 확인 (최신 방식: Refresh Token 패턴)
   */
  async function checkAuth(options?: CheckAuthOptions): Promise<AuthCheckResult> {
    const enableDebug = options?.debug === true;
    
    // ✅ P1-5: debug payload 수집 시작 (옵션이 활성화된 경우만)
    const debug: AuthCheckResult['debug'] | undefined = enableDebug ? {
      checkLocalStorageTokenCalled: false,
      checkBackendSessionCalled: false,
      hasAccessToken: false,
      hasRefreshToken: deps.tokenManager.hasValidToken(),
      expiresAt: deps.tokenManager.getExpiresAt(),
      usedCache: false,
      reasonPath: 'none',
    } : undefined;

    // 1. TokenManager에서 토큰 확인
    if (deps.tokenManager.hasValidToken()) {
      try {
        // Access Token 가져오기 (자동 갱신)
        const accessToken = await deps.tokenManager.getAccessToken();
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
        deps.tokenManager.clearTokens();
      }
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
  async function checkBackendSession(enableDebug?: boolean): Promise<AuthCheckResult> {
    // ✅ P1-5: debug payload 수집 (옵션이 활성화된 경우만)
    const debug: AuthCheckResult['debug'] | undefined = enableDebug ? {
      checkLocalStorageTokenCalled: false,
      checkBackendSessionCalled: true,
      hasAccessToken: false,
      hasRefreshToken: deps.tokenManager.hasValidToken(),
      expiresAt: deps.tokenManager.getExpiresAt(),
      usedCache: false,
      reasonPath: 'backend',
    } : undefined;
    
    // ✅ P1-6: clock을 사용하여 시간 판단
    const now = deps.clock.now();
    
    // 최근에 성공한 세션 확인 결과가 있으면 캐시된 결과 반환
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
      const csrfToken = deps.tokenManager.getCSRFToken();
      
      // ✅ P1-7: authAPI.checkSession이 있으면 사용, 없으면 fetch 직접 사용
      if (deps.authAPI.checkSession) {
        const sessionResult = await deps.authAPI.checkSession();
        if (debug) {
          debug.backendStatus = sessionResult.status;
          debug.backendOk = sessionResult.ok;
        }
        
        if (sessionResult.ok && sessionResult.data?.valid === true) {
          const result = { valid: true, ...(debug ? { debug } : {}) };
          lastSessionCheckResult = { valid: true };
          return result;
        } else {
          const result = { valid: false, reason: sessionResult.data?.reason || '세션이 유효하지 않습니다.', ...(debug ? { debug } : {}) };
          lastSessionCheckResult = { valid: false, reason: sessionResult.data?.reason || '세션이 유효하지 않습니다.' };
          return result;
        }
      }
      
      // ✅ P1-7: fetch는 deps에서 주입받거나 전역 fetch 사용
      const fetchFn = deps.fetch || (typeof fetch !== 'undefined' ? fetch : null);
      if (!fetchFn) {
        throw new Error('fetch is not available');
      }
      
      const response = await fetchFn('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
      });

      // ✅ P1-5: debug에 backendStatus, backendOk 추가
      if (debug) {
        debug.backendStatus = response.status;
        debug.backendOk = response.ok;
      }
      
      if (response.ok) {
        const data: SessionResponse = await response.json();
        
        if (data.valid === true) {
          const result = { valid: true, ...(debug ? { debug } : {}) };
          lastSessionCheckResult = { valid: true };
          return result;
        } else {
          const result = { valid: false, reason: data.reason || '세션이 유효하지 않습니다.', ...(debug ? { debug } : {}) };
          lastSessionCheckResult = { valid: false, reason: data.reason || '세션이 유효하지 않습니다.' };
          return result;
        }
      } else if (response.status === 401) {
        const result = { valid: false, reason: '인증이 필요합니다.', ...(debug ? { debug } : {}) };
        lastSessionCheckResult = { valid: false, reason: '인증이 필요합니다.' };
        return result;
      } else if (response.status === 403) {
        const result = { valid: false, reason: '권한이 없습니다.', ...(debug ? { debug } : {}) };
        lastSessionCheckResult = { valid: false, reason: '권한이 없습니다.' };
        return result;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
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
   */
  async function checkLocalStorageToken(enableDebug?: boolean): Promise<AuthCheckResult> {
    // ✅ P1-5: debug payload 수집 (옵션이 활성화된 경우만)
    const debug: AuthCheckResult['debug'] | undefined = enableDebug ? {
      checkLocalStorageTokenCalled: true,
      checkBackendSessionCalled: false,
      hasAccessToken: false,
      hasRefreshToken: deps.tokenManager.hasValidToken(),
      expiresAt: deps.tokenManager.getExpiresAt(),
      usedCache: false,
      reasonPath: 'local',
    } : undefined;

    try {
      const accessToken = await deps.tokenManager.getAccessToken();
      if (debug) {
        debug.hasAccessToken = !!accessToken;
      }
      if (!accessToken?.trim()) {
        return { valid: false, reason: '토큰이 없습니다.', ...(debug ? { debug } : {}) };
      }

      // 토큰 유효성 확인
      if (!isTokenValid(accessToken)) {
        deps.tokenManager.clearTokens();
        return { valid: false, reason: '토큰이 유효하지 않습니다.', ...(debug ? { debug } : {}) };
      }

      return { valid: true, ...(debug ? { debug } : {}) };
    } catch {
      return { valid: false, reason: '토큰 확인 중 오류가 발생했습니다.', ...(debug ? { debug } : {}) };
    }
  }

  /**
   * 사용자 역할 가져오기
   */
  async function getUserRole(): Promise<string | null> {
    try {
      const accessToken = await deps.tokenManager.getAccessToken();
      return getUserRoleFromToken(accessToken);
    } catch {
      return null;
    }
  }

  /**
   * 사용자 승인 상태 확인
   */
  async function isUserApproved(): Promise<boolean> {
    try {
      const accessToken = await deps.tokenManager.getAccessToken();
      return isUserApprovedFromToken(accessToken);
    } catch {
      return false;
    }
  }

  /**
   * Admin 여부 확인
   */
  async function isAdmin(): Promise<boolean> {
    const role = await getUserRole();
    return role === 'admin';
  }

  /**
   * 로그아웃
   */
  function logout(): void {
    deps.tokenManager.clearTokens();
    deps.authAPI.deleteSession().catch(() => {
      // 세션 삭제 실패는 무시
    });
  }

  return {
    checkAuth,
    getUserRole,
    isUserApproved,
    isAdmin,
    logout,
  };
}
