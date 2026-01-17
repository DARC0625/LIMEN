// 보안 관련 유틸리티 함수들
// 비정상 접근 감지 및 자동 로그아웃 기능

import { logger } from './utils/logger';
import { StoragePort, SessionStoragePort } from './ports/storagePort';
import { LocationPort } from './ports/locationPort';
import { BroadcastPort } from './ports/broadcastPort';
import { browserLocalStoragePort, browserSessionStoragePort } from './adapters/browserStoragePort';
import { createBrowserLocationPort } from './adapters/browserLocationPort';
import { createBrowserBroadcastPort } from './adapters/browserBroadcastPort';
import { createMemoryStoragePort, createMemorySessionStoragePort } from './adapters/memoryStoragePort';
import { createNoopBroadcastPort } from './adapters/noopBroadcastPort';

// 세션 하이재킹 방지를 위한 브라우저 핑거프린트
export function getBrowserFingerprint(): string {
  if (typeof window === 'undefined') return '';
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
  ].join('|');
  
  // 간단한 해시 생성
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit 정수로 변환
  }
  return Math.abs(hash).toString(36);
}

// 토큰 무결성 검증 (더 관대하게)
export function validateTokenIntegrity(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      logger.warn('[Token Validation] Invalid JWT format: not 3 parts');
      return false;
    }
    
    // JWT 형식 검증
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // 기본 JWT 구조만 확인 (exp는 선택적, id도 선택적)
    if (!header || typeof header !== 'object') {
      logger.warn('[Token Validation] Invalid header');
      return false;
    }
    
    if (!payload || typeof payload !== 'object') {
      logger.warn('[Token Validation] Invalid payload');
      return false;
    }
    
    // exp가 있으면 숫자여야 함
    if (payload.exp && typeof payload.exp !== 'number') {
      logger.warn('[Token Validation] Invalid exp type');
      return false;
    }
    
    return true;
  } catch (e) {
    logger.warn('[Token Validation] Parse error:', e);
    return false;
  }
}

// 다른 탭에 인증 이벤트 알림 전송 (Edge-safe 버전)
// 실제 구현은 security.browser.ts에 있으며, 동적 import로 로드됨
export function notifyAuthEvent(_reason?: string): void {
  // Edge / SSR / Node에서는 아무 것도 안 함
  // 브라우저에서는 동적 import로 security.browser.ts를 로드
  if (typeof window !== 'undefined') {
    import('./security.browser').then((m) => {
      m.notifyAuthEvent(_reason);
    }).catch(() => {
      // 동적 import 실패 시 무시
    });
  }
}

/**
 * forceLogout - Port 주입 방식 (정석)
 * 
 * 정석 원칙: core 함수는 "리다이렉트 실행" 대신
 * 결과 객체를 반환하고, 실제 redirect/broadcast는 브라우저 레이어에서 수행
 * 
 * @param reason - 로그아웃 이유
 * @param options - Port 주입 옵션
 * @returns 로그아웃 결과 객체 (redirect는 실행하지 않음)
 */
export function forceLogout(
  reason: string = '보안상의 이유로 로그아웃되었습니다.',
  options?: {
    storage?: StoragePort;
    location?: LocationPort | null;
    broadcast?: BroadcastPort | null;
  }
): { action: 'LOGOUT'; reason: string; pathname?: string; shouldRedirect?: boolean } {
  const storage = options?.storage ?? (typeof window !== 'undefined' && browserLocalStoragePort
    ? browserLocalStoragePort
    : createMemoryStoragePort());
  
  const location = options?.location ?? (typeof window !== 'undefined'
    ? createBrowserLocationPort()
    : null);
  
  const broadcast = options?.broadcast ?? (typeof window !== 'undefined'
    ? createBrowserBroadcastPort()
    : createNoopBroadcastPort());
  
  const pathname = location?.getPathname() ?? '/';
  const hasToken = !!storage.get('auth_token');
  
  // 차단하지 않고 로깅만 수행
  logger.warn('[Security Log] Logout event detected:', {
    reason,
    pathname,
    timestamp: new Date().toISOString(),
    hasToken,
  });
  
  // 토큰이 만료되었거나 유효하지 않은 경우에만 토큰 제거 (정상적인 로그아웃)
  // 강제 리다이렉트는 하지 않음 - 사용자가 정상적으로 로그인 페이지로 이동할 수 있도록 함
  if (reason.includes('만료') || reason.includes('expired') || reason.includes('invalid')) {
    storage.remove('auth_token');
    storage.remove('auth_token_timestamp');
  }
  
  // Broadcast는 실행하지 않고, 결과에 포함
  if (broadcast) {
    broadcast.postAuthEvent({
      type: 'AUTH_EVENT',
      reason,
      action: 'log',
    });
    broadcast.close();
  }
  
  // Redirect는 실행하지 않고, 결과에 포함
  // 실제 redirect는 브라우저 레이어에서 수행
  return {
    action: 'LOGOUT',
    reason,
    pathname,
    shouldRedirect: reason.includes('만료') || reason.includes('expired') || reason.includes('invalid'),
  };
}

/**
 * forceLogoutBrowser - 브라우저용 래퍼 (기존 호환성 유지)
 * 
 * Port를 자동으로 주입하고, redirect도 실행
 */
export function forceLogoutBrowser(reason?: string): void {
  const result = forceLogout(reason ?? '보안상의 이유로 로그아웃되었습니다.', {
    storage: typeof window !== 'undefined' && browserLocalStoragePort ? browserLocalStoragePort : null,
    location: typeof window !== 'undefined' ? createBrowserLocationPort() : null,
    broadcast: typeof window !== 'undefined' ? createBrowserBroadcastPort() : null,
  });
  
  // 브라우저 레이어에서 redirect 수행
  if (result.shouldRedirect && typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

/**
 * 세션 ID 생성 (탭별 고유 ID)
 * Port 주입 방식으로 변경 (정석)
 */
export function getSessionId(sessionStorage?: SessionStoragePort): string {
  const storage = sessionStorage ?? (typeof window !== 'undefined' && browserSessionStoragePort
    ? browserSessionStoragePort
    : createMemorySessionStoragePort());
  
  let sessionId = storage.get('session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    storage.set('session_id', sessionId);
  }
  return sessionId;
}

// 요청 빈도 제한 체크: 비활성화 (기본 보안만 유지)
const requestTimestamps: number[] = [];
// const MAX_REQUESTS_PER_MINUTE = 60; // 비활성화

export function checkRequestRateLimit(): boolean {
  // 요청 빈도 제한 비활성화 - 항상 허용
  return true;
  
  // 기존 코드 (비활성화)
  // const now = Date.now();
  // const oneMinuteAgo = now - 60000;
  // while (requestTimestamps.length > 0 && requestTimestamps[0] < oneMinuteAgo) {
  //   requestTimestamps.shift();
  // }
  // if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
  //   return false;
  // }
  // requestTimestamps.push(now);
  // return true;
}

/**
 * 비정상 활동 감지 - 패시브 모니터링만 (차단 없음)
 * Port 주입 방식으로 변경 (정석)
 */
export function detectAbnormalActivity(
  storage?: StoragePort,
  location?: LocationPort | null
): {
  isAbnormal: boolean;
  reason?: string;
} {
  const defaultStorage = storage ?? (typeof window !== 'undefined' && browserLocalStoragePort
    ? browserLocalStoragePort
    : createMemoryStoragePort());
  
  const defaultLocation = location ?? (typeof window !== 'undefined'
    ? createBrowserLocationPort()
    : null);
  
  // 패시브 모니터링: 로깅만 수행, 차단하지 않음
  const token = defaultStorage.get('auth_token');
  if (token && !validateTokenIntegrity(token)) {
    // 차단하지 않고 로깅만
    logger.warn('[Security Log] Token integrity check failed (passive monitoring):', {
      timestamp: new Date().toISOString(),
      pathname: defaultLocation?.getPathname() ?? '/',
    });
    // 차단하지 않음 - 항상 false 반환
    return { isAbnormal: false };
  }
  
  // 모든 검증 비활성화 - 차단 없음
  // - 브라우저 핑거프린트 검증: 비활성화 (다중 기기 접근 허용)
  // - 요청 빈도 제한: 비활성화 (정상 사용 허용)
  
  return { isAbnormal: false };
}

/**
 * 차단된 계정 확인 및 해제 (패시브 모니터링)
 * Port 주입 방식으로 변경 (정석)
 */
export function checkAndUnblockAccount(
  storage?: StoragePort,
  sessionStorage?: SessionStoragePort
): void {
  const defaultStorage = storage ?? (typeof window !== 'undefined' && browserLocalStoragePort
    ? browserLocalStoragePort
    : createMemoryStoragePort());
  
  const defaultSessionStorage = sessionStorage ?? (typeof window !== 'undefined' && browserSessionStoragePort
    ? browserSessionStoragePort
    : createMemorySessionStoragePort());
  
  // 차단 관련 플래그 확인 및 제거
  const blockedFlags = [
    'account_blocked',
    'user_blocked',
    'admin_blocked',
    'security_block',
    'rate_limit_blocked',
    'fingerprint_blocked',
  ];
  
  let hasBlockedFlag = false;
  blockedFlags.forEach(flag => {
    if (defaultStorage.get(flag)) {
      logger.warn('[Security Log] Removing block flag (passive monitoring):', flag);
      defaultStorage.remove(flag);
      hasBlockedFlag = true;
    }
  });
  
  // 세션 스토리지의 차단 플래그도 제거
  if (defaultSessionStorage.get('logout_redirect')) {
    logger.warn('[Security Log] Removing logout redirect flag (passive monitoring)');
    defaultSessionStorage.remove('logout_redirect');
    hasBlockedFlag = true;
  }
  
  if (hasBlockedFlag) {
    logger.warn('[Security Log] Account unblocked (passive monitoring):', {
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * 세션 초기화 (로그인 시 호출)
 * Port 주입 방식으로 변경 (정석)
 */
export function initializeSession(
  storage?: StoragePort,
  sessionStorage?: SessionStoragePort
): void {
  const defaultStorage = storage ?? (typeof window !== 'undefined' && browserLocalStoragePort
    ? browserLocalStoragePort
    : createMemoryStoragePort());
  
  const defaultSessionStorage = sessionStorage ?? (typeof window !== 'undefined' && browserSessionStoragePort
    ? browserSessionStoragePort
    : createMemorySessionStoragePort());
  
  // 차단 플래그 제거 (로그인 시 자동 해제)
  checkAndUnblockAccount(defaultStorage, defaultSessionStorage);
  
  // 브라우저 핑거프린트 저장 (다중 기기 접근 허용)
  // 각 기기마다 고유한 핑거프린트를 저장하되, 다른 기기 접근을 차단하지 않음
  const currentFingerprint = getBrowserFingerprint();
  defaultStorage.set('browser_fingerprint', currentFingerprint);
  
  // 세션 ID 생성 및 저장 (다중 기기 접근 추적용)
  const sessionId = getSessionId(defaultSessionStorage);
  defaultStorage.set('last_session_id', sessionId);
  
  // 요청 타임스탬프 초기화
  requestTimestamps.length = 0;
}
