/**
 * ✅ P1-3: Auth 테스트 전용 deps/fake 표준화
 * 
 * 테스트에서 사용하는 표준 팩토리 함수들
 * mock 지옥 탈출을 위한 표준화된 테스트 의존성 생성
 */

import type { AuthDeps } from '../createAuth';
// ✅ P1-Next-1B: createMemoryClockPort는 테스트에서 직접 사용하지 않음 (createTestClock 사용)
// import { createMemoryClockPort } from '../../adapters/memoryClockPort';
import type { SessionResponse } from '../../types';

/**
 * ✅ P1-6: 테스트용 Clock 생성 (시간 제어 가능)
 */
export function createTestClock(initialNow?: number) {
  let now = initialNow ?? (typeof Date !== 'undefined' ? Date.now() : 0);
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
    set: (newNow: number) => {
      now = newNow;
    },
  };
}

/**
 * ✅ P1-3: Fake TokenManager 생성
 */
export function createFakeTokenManager(options: {
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  csrfToken?: string | null;
  getAccessTokenImpl?: () => Promise<string | null>;
  clock?: { now(): number }; // ✅ P1-Next-1B: clock을 주입받아 expiresAt 검증
} = {}) {
  const {
    accessToken = null,
    refreshToken = null,
    expiresAt = null,
    csrfToken = null,
    getAccessTokenImpl,
  } = options;

  // ✅ P1-Next-1B: clock을 주입받아 expiresAt 검증
  const clock = options.clock || { now: () => (typeof Date !== 'undefined' ? Date.now() : 0) };
  return {
    hasValidToken: jest.fn(() => refreshToken !== null && expiresAt !== null && expiresAt > clock.now()),
    getAccessToken: jest.fn(getAccessTokenImpl || (async () => accessToken)),
    getRefreshToken: jest.fn(() => refreshToken),
    getExpiresAt: jest.fn(() => expiresAt),
    getCSRFToken: jest.fn((options?: { ensure?: boolean }) => {
      if (options?.ensure && !csrfToken) {
        // ensure가 true이고 csrfToken이 없으면 생성
        // 테스트에서는 간단히 랜덤 문자열 생성
        csrfToken = Math.random().toString(36).substring(2, 34) + Math.random().toString(36).substring(2, 34);
      }
      return csrfToken;
    }),
    ensureCSRFToken: jest.fn(() => {
      if (!csrfToken) {
        // 테스트에서는 간단히 랜덤 문자열 생성
        csrfToken = Math.random().toString(36).substring(2, 34) + Math.random().toString(36).substring(2, 34);
      }
      return csrfToken;
    }),
    clearTokens: jest.fn(),
  };
}

/**
 * ✅ P1-3: Fake AuthAPI 생성
 */
export function createFakeAuthAPI(options: {
  checkSessionResult?: { ok: boolean; status?: number; data?: SessionResponse };
  checkSessionImpl?: () => Promise<{ ok: boolean; status?: number; data?: SessionResponse }>;
  deleteSessionImpl?: () => Promise<void>;
  refreshTokenImpl?: (refreshToken: string) => Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
} = {}) {
  const {
    checkSessionResult,
    checkSessionImpl,
    deleteSessionImpl,
    refreshTokenImpl,
  } = options;

  return {
    // checkSession이 undefined이면 fetch를 사용하도록 함
    checkSession: checkSessionImpl ? jest.fn(checkSessionImpl) : (checkSessionResult !== undefined ? jest.fn(async () => checkSessionResult) : undefined),
    deleteSession: jest.fn(deleteSessionImpl || (async () => {})),
    refreshToken: refreshTokenImpl ? jest.fn(refreshTokenImpl) : undefined,
  };
}

/**
 * ✅ P1-3: Fake Fetch 생성 (네트워크 요청 모킹)
 */
export function createFakeFetch(options: {
  sessionResponse?: { status: number; ok: boolean; data?: SessionResponse };
  defaultResponse?: { status: number; ok: boolean; data?: unknown };
} = {}) {
  const { sessionResponse, defaultResponse } = options;

  return jest.fn(async (url: string | Request, _init?: RequestInit) => {
    const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
    
    if (urlString.includes('/api/auth/session')) {
      const response = sessionResponse || { status: 200, ok: true, data: { valid: true } };
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.status === 200 ? 'OK' : 'Error',
        headers: {
          getSetCookie: () => [],
        },
        json: async () => response.data || { valid: false },
      } as Response;
    }

    // 기본 응답
    const response = defaultResponse || { status: 500, ok: false, data: { error: 'UNMOCKED_REQUEST', url: urlString } };
    return {
      ok: response.ok,
      status: response.status,
      statusText: 'Error',
      headers: {
        getSetCookie: () => [],
      },
      json: async () => response.data || {},
    } as Response;
  });
}

/**
 * ✅ P1-3: 표준 테스트 deps 생성
 */
export function createTestAuthDeps(options: {
  tokenManager?: ReturnType<typeof createFakeTokenManager>;
  authAPI?: ReturnType<typeof createFakeAuthAPI>;
  clock?: ReturnType<typeof createTestClock>;
  fetch?: ReturnType<typeof createFakeFetch>;
} = {}): AuthDeps {
  return {
    tokenManager: options.tokenManager || createFakeTokenManager(),
    authAPI: options.authAPI || createFakeAuthAPI(),
    clock: options.clock || createTestClock(),
    fetch: options.fetch || createFakeFetch(),
  };
}
