/**
 * ✅ E2E 테스트 전용 tokenManager 엔트리
 * 
 * ✅ P1-Next-Fix-Module-4: client tokenManager 싱글톤을 사용하여 E2E와 앱이 같은 인스턴스를 공유
 * - 제품 코드(tokenManager.ts)는 순수하게 유지
 * - 테스트 훅(__test)은 이 엔트리에서 top-level로 강제 부착
 * - client tokenManager를 사용하여 E2E와 앱이 같은 인스턴스를 공유하도록 보장
 * 
 * ✅ Command E2E-2: E2E에서 TokenManager가 BrowserStoragePort를 사용하도록 고정
 * - snapshot === localStorage 상태가 일치
 * - "세션 정리"를 진짜 브라우저 저장소 기준으로 검증 가능
 * - CI hermetic 유지 가능 (네트워크는 route로 막고, 저장소는 브라우저 내부)
 */
// ✅ P1-Next-Fix-Module-4: client tokenManager 싱글톤 사용
import { tokenManager as clientTokenManager } from '../lib/tokenManager.client';
// ✅ P1-Next-Fix-Module-4E: authAPI를 생성하여 tokenManager에 주입
import { createAuthAPI } from '../lib/api/auth';
import { createApiClient } from '../lib/api/apiClient';

// ✅ P1-Next-Fix-Module-4: client tokenManager를 그대로 사용 (E2E와 앱이 같은 인스턴스)
export const tokenManager = clientTokenManager;

// ✅ P1-Next-Fix-Module-4E: E2E harness에서 authAPI를 주입하여 refresh가 동작하도록 보장
// client.ts와 동일한 방식으로 wiring
const api = createApiClient({
  tokenManager,
});

// fetch를 lazy proxy로 처리 (import-time throw 제거)
function getFetch(): typeof fetch {
  const f =
    (typeof globalThis !== 'undefined' && (globalThis as { fetch?: typeof fetch }).fetch) ||
    (typeof window !== 'undefined' && (window as { fetch?: typeof fetch }).fetch) ||
    undefined;

  if (!f) {
    throw new Error('fetch is required but not available');
  }
  return f.bind(globalThis || window);
}

const fetchProxy: typeof fetch = ((input: unknown, init?: unknown) => {
  return getFetch()(input as RequestInfo | URL, init as RequestInit | undefined);
}) as typeof fetch;

// authAPI 생성 및 주입
const authAPI = createAuthAPI({
  tokenManager,
  apiRequest: api.apiRequest,
  fetch: fetchProxy,
});

// ✅ P1-Next-Fix-Module-4E: tokenManager에 authAPI 주입 (E2E에서 refresh가 동작하도록)
tokenManager.setAuthAPI(authAPI);

// ✅ clearSession 호출 계측 (테스트용)
let clearSessionCalledCount = 0;

// clearTokens() 호출을 감지하기 위해 원본 함수를 래핑
const originalClearTokens = tokenManager.clearTokens.bind(tokenManager);
tokenManager.clearTokens = function() {
  clearSessionCalledCount++;
  console.log('[TEST] clearTokens called, count:', clearSessionCalledCount);
  return originalClearTokens();
};

// ✅ 테스트 전용 훅을 top-level에서 강제 할당
// 번들러가 tree-shake로 제거하지 않도록 side-effect로 명시
(tokenManager as Record<string, unknown>).__test = {
  /**
   * ✅ P1-Next-Fix-Module-4C: 강제 refresh 호출 (정책 변화에 흔들리지 않는 계약)
   * refreshAccessToken을 직접 호출하여 refresh를 확실히 트리거
   * @param options.respond - 응답 상태 코드 (401: 실패, 200: 성공)
   */
  forceRefresh: async (options?: { respond?: number }): Promise<void> => {
    // refreshToken이 없으면 에러 발생 (제품 코드와 동일한 검증)
    if (!tokenManager.getRefreshToken()) {
      throw new Error('No refresh token available');
    }
    
    // ✅ P1-Next-Fix-Module-4C: refreshAccessToken을 직접 호출하여 refresh를 확실히 트리거
    // TypeScript의 private는 컴파일 타임 체크일 뿐, 런타임에서는 접근 가능
    const tokenManagerAny = tokenManager as unknown as {
      refreshAccessToken?: () => Promise<string>;
    };
    
    if (!tokenManagerAny.refreshAccessToken) {
      throw new Error('refreshAccessToken method not found');
    }
    
    try {
      // refreshAccessToken() 직접 호출 (에러는 그대로 throw)
      await tokenManagerAny.refreshAccessToken();
    } catch (error) {
      // 401 응답 시 에러는 예상된 동작
      if (options?.respond === 401) {
        // 에러는 무시 (세션 정리 확인용)
      } else {
        throw error;
      }
    }
  },
  
  /**
   * refresh를 직접 호출 (테스트용) - 만료 판단 로직에 의존하지 않음
   * ✅ S4 테스트에서 refresh를 확실히 발생시키기 위한 훅
   * ✅ P1-Next-Fix-Module-3B: refreshAccessToken을 직접 호출하여 refresh를 확실히 트리거
   */
  refreshOnce: async (): Promise<void> => {
    // refreshToken이 없으면 에러 발생 (제품 코드와 동일한 검증)
    if (!tokenManager.getRefreshToken()) {
      throw new Error('No refresh token available');
    }
    
    // ✅ P1-Next-Fix-Module-3B: refreshAccessToken을 직접 호출하여 refresh를 확실히 트리거
    // TypeScript의 private는 컴파일 타임 체크일 뿐, 런타임에서는 접근 가능
    const tokenManagerAny = tokenManager as unknown as {
      refreshAccessToken?: () => Promise<string>;
    };
    
    if (!tokenManagerAny.refreshAccessToken) {
      throw new Error('refreshAccessToken method not found');
    }
    
    // refreshAccessToken() 직접 호출 (에러는 그대로 throw)
    await tokenManagerAny.refreshAccessToken();
  },
  
  /**
   * 현재 시간 설정 (테스트용)
   * ✅ P1-Next-Fix-Module-4: tokenManager 인스턴스 내부 clock 사용
   * @param now - 설정할 시간 (밀리초)
   */
  setNow: (now: number): void => {
    // ✅ P1-Next-Fix-Module-4: tokenManager 인스턴스 내부 clock 접근
    const tm = tokenManager as unknown as {
      clock?: { setNow?: (timestamp: number) => void };
    };
    tm.clock?.setNow?.(now);
  },
  
  /**
   * 토큰 설정 (테스트용)
   * @param accessToken - Access Token
   * @param refreshToken - Refresh Token
   * @param expiresIn - 만료 시간 (초)
   */
  setTokens: (accessToken: string, refreshToken: string, expiresIn: number): void => {
    tokenManager.setTokens(accessToken, refreshToken, expiresIn);
  },
  
  /**
   * ✅ P1-Next-Fix-Module-4E: 표준 토큰 시드 함수 (E2E 표준 계약)
   * TokenManager의 공식 저장 경로를 사용하여 refreshToken을 확실히 저장
   * 만료된 상태로 설정하여 refresh를 트리거
   * @param options - 토큰 시드 옵션
   */
  seedTokens: (options?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number; // 밀리초 epoch (만료된 상태로 설정하면 refresh 트리거)
    csrfToken?: string;
  }): void => {
    const tm = tokenManager as unknown as {
      clock?: { now: () => number };
      sessionStorage?: { set: (key: string, value: string) => void };
      storage?: { set: (key: string, value: string) => void };
      expiresAt?: number;
    };
    
    const now = tm.clock?.now() || Date.now();
    
    // ✅ P1-Next-Fix-Module-4E: TokenManager의 공식 setTokens 메서드 사용
    // refreshToken 설정 (기본값: test-refresh-token)
    const refreshToken = options?.refreshToken || 'test-refresh-token';
    
    // ✅ P1-Next-Fix-Module-4E: setTokens로 기본 저장 후, expiresAt을 만료된 상태로 직접 설정
    // setTokens는 expiresIn(초)을 받아 미래 시간을 계산하므로, 만료 상태를 만들려면 expiresAt을 직접 수정해야 함
    tokenManager.setTokens(
      options?.accessToken || 'expired-token',
      refreshToken,
      900 // 기본 15분 (일단 정상 값으로 저장)
    );
    
    // ✅ P1-Next-Fix-Module-4E: expiresAt을 만료된 상태로 직접 설정
    // S4는 refresh 실패/로그아웃을 검증하는 시나리오이므로, 무조건 만료된 상태로 고정
    // 충분히 과거로 설정하여 만료가 확실히 인식되도록 함
    const expiresAt = options?.expiresAt !== undefined 
      ? options.expiresAt 
      : now - 60_000; // 충분히 과거로 만료 (refresh 트리거 보장)
    
    // storage에 expiresAt 저장 (TokenManager가 읽는 키)
    if (tm.storage) {
      tm.storage.set('token_expires_at', expiresAt.toString());
    }
    // TokenManager 내부 필드도 동기화
    tm.expiresAt = expiresAt;
    
    // csrfToken 설정 (sessionStorage 직접 접근은 허용 - CSRF는 별도 경로)
    if (options?.csrfToken && tm.sessionStorage) {
      tm.sessionStorage.set('csrf_token', options.csrfToken);
      (tokenManager as { csrfToken?: string }).csrfToken = options.csrfToken;
    }
  },
  
  /**
   * 상태 확인 (테스트용)
   */
  getState: (): {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    expiresAt: number;
    timeUntilExpiry: number;
  } => {
    return {
      hasAccessToken: !!(tokenManager as { accessToken?: string | null }).accessToken,
      hasRefreshToken: !!tokenManager.getRefreshToken(),
      expiresAt: (tokenManager as { expiresAt?: number }).expiresAt || 0,
      timeUntilExpiry: tokenManager.getTimeUntilExpiry(),
    };
  },
  
  /**
   * 상태 초기화 (테스트용)
   */
  clearState: (): void => {
    tokenManager.clearTokens();
  },
  
  /**
   * 세션 정리 함수 (테스트용)
   * localStorage/cookie(가능하면)/memory 상태를 즉시 초기화
   */
  clearSession: (): void => {
    tokenManager.clearTokens();
  },
  
  /**
   * Refresh Token 설정 (테스트용)
   * ✅ P1-Next-Fix-Module-4: tokenManager 인스턴스 내부 storage 사용
   * @param value - Refresh Token 값 또는 null
   */
  setRefreshToken: (value: string | null): void => {
    // ✅ P1-Next-Fix-Module-4: tokenManager 인스턴스 내부 storage 접근
    const tm = tokenManager as unknown as {
      storage?: { get: (key: string) => string | null; set: (key: string, value: string) => void; remove: (key: string) => void };
      refreshToken?: string | null;
    };
    
    if (!tm.storage) {
      throw new Error('tokenManager.storage is not available');
    }
    
    if (value === null) {
      tm.storage.remove('refresh_token');
      tm.refreshToken = null;
    } else {
      tm.storage.set('refresh_token', value);
      tm.refreshToken = value;
    }
  },
  
  /**
   * 만료 시간 설정 (테스트용)
   * ✅ P1-Next-Fix-Module-4: tokenManager 인스턴스 내부 storage 사용
   * @param msEpoch - 만료 시간 (밀리초 epoch) 또는 null
   */
  setExpiresAt: (msEpoch: number | null): void => {
    // ✅ P1-Next-Fix-Module-4: tokenManager 인스턴스 내부 storage/clock 접근
    const tm = tokenManager as unknown as {
      storage?: { get: (key: string) => string | null; set: (key: string, value: string) => void; remove: (key: string) => void };
      clock?: { now: () => number; setNow?: (timestamp: number) => void };
      expiresAt?: number;
    };
    
    if (!tm.storage) {
      throw new Error('tokenManager.storage is not available');
    }
    
    if (msEpoch === null) {
      tm.storage.remove('token_expires_at');
      tm.expiresAt = 0;
    } else {
      tm.storage.set('token_expires_at', msEpoch.toString());
      tm.expiresAt = msEpoch;
      // ✅ clockPort도 함께 설정하여 만료 상태를 결정적으로 만들기
      // expiresAt이 clock.now()보다 작으면 만료된 상태
      if (tm.clock && msEpoch < tm.clock.now()) {
        // 이미 만료된 상태
      }
    }
  },
  
  /**
   * 스토리지 스냅샷 (테스트용)
   * ✅ P1-Next-Fix-Module-4: tokenManager 인스턴스 내부 storage 사용 (전역 변수 제거)
   */
  getStorageSnapshot: (): {
    refreshToken: string | null;
    expiresAt: string | null;
    csrfToken: string | null;
  } => {
    // ✅ P1-Next-Fix-Module-4: tokenManager 인스턴스 내부 storage 접근
    const tm = tokenManager as unknown as {
      storage?: { get: (key: string) => string | null };
      sessionStorage?: { get: (key: string) => string | null };
    };
    
    if (!tm.storage || !tm.sessionStorage) {
      throw new Error('tokenManager.storage or sessionStorage is not available');
    }
    
    return {
      refreshToken: tm.storage.get('refresh_token'),
      expiresAt: tm.storage.get('token_expires_at'),
      csrfToken: tm.sessionStorage.get('csrf_token'),
    };
  },
  
  /**
   * clearSession 호출 횟수 (테스트용)
   * S4에서 '정리 함수가 호출됐는지'를 직접 계측
   */
  getClearSessionCalledCount: (): number => {
    return clearSessionCalledCount;
  },
  
  /**
   * clearSession 호출 횟수 리셋 (테스트용)
   */
  resetClearSessionCalledCount: (): void => {
    clearSessionCalledCount = 0;
  },
};
