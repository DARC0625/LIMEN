/**
 * ✅ E2E 테스트 전용 tokenManager 엔트리
 * 
 * 제품 코드(tokenManager.ts)는 순수하게 유지하고,
 * 테스트 훅(__test)은 이 엔트리에서 top-level로 강제 부착
 * 
 * ✅ Command E2E-2: E2E에서 TokenManager가 BrowserStoragePort를 사용하도록 고정
 * - snapshot === localStorage 상태가 일치
 * - "세션 정리"를 진짜 브라우저 저장소 기준으로 검증 가능
 * - CI hermetic 유지 가능 (네트워크는 route로 막고, 저장소는 브라우저 내부)
 */
import { createTokenManager } from '../lib/tokenManager';
import { createBrowserStoragePort } from '../lib/adapters/browserStoragePort';
import { createBrowserClockPort } from '../lib/adapters/browserClockPort';
import { createBrowserLocationPort } from '../lib/adapters/browserLocationPort';
import { createBrowserCryptoPort } from '../lib/adapters/browserCryptoPort';
import { createMemoryStoragePort, createMemorySessionStoragePort } from '../lib/adapters/memoryStoragePort';
import { createMemoryClockPort } from '../lib/adapters/memoryClockPort';
import { createMemoryLocationPort } from '../lib/adapters/memoryLocationPort';

// ✅ Command E2E-2: E2E에서만큼은 BrowserStoragePort 사용
// snapshot === localStorage 상태가 일치하도록
// 브라우저 환경에서만 실행되므로 window/localStorage는 항상 존재
const storagePort = typeof window !== 'undefined' && window.localStorage
  ? createBrowserStoragePort(window.localStorage)
  : createMemoryStoragePort();
const sessionStoragePort = typeof window !== 'undefined' && window.sessionStorage
  ? createBrowserStoragePort(window.sessionStorage)
  : createMemorySessionStoragePort();
const clockPort = typeof window !== 'undefined'
  ? createBrowserClockPort()
  : createMemoryClockPort(Date.now());
const locationPort = typeof window !== 'undefined'
  ? (createBrowserLocationPort() ?? createMemoryLocationPort('/'))
  : createMemoryLocationPort('/');
const cryptoPort = typeof window !== 'undefined'
  ? createBrowserCryptoPort()
  : createNodeCryptoPort();

// ✅ 테스트 전용 tokenManager 인스턴스 생성
export const tokenManager = createTokenManager(
  storagePort,
  sessionStoragePort,
  clockPort,
  cryptoPort,
  locationPort
);

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
   * 강제 refresh 호출 (테스트용) - getAccessToken()을 통한 간접 호출
   * @param options.respond - 응답 상태 코드 (401: 실패, 200: 성공)
   */
  forceRefresh: async (options?: { respond?: number }): Promise<void> => {
    // 만료된 토큰 상태로 설정 (refresh 트리거)
    tokenManager.setTokens('expired-token', 'test-refresh-token', -1);
    
    // getAccessToken 호출로 refresh 강제 트리거
    try {
      await tokenManager.getAccessToken();
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
   * ✅ Port 기반: clockPort.setNow() 사용
   * @param now - 설정할 시간 (밀리초)
   */
  setNow: (now: number): void => {
    (clockPort as { setNow?: (timestamp: number) => void }).setNow?.(now);
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
   * ✅ Command E2E-2: BrowserStoragePort 사용 (localStorage와 동일한 저장소)
   * @param value - Refresh Token 값 또는 null
   */
  setRefreshToken: (value: string | null): void => {
    if (value === null) {
      storagePort.remove('refresh_token');
      (tokenManager as { refreshToken?: string | null }).refreshToken = null;
    } else {
      storagePort.set('refresh_token', value);
      (tokenManager as { refreshToken?: string | null }).refreshToken = value;
    }
  },
  
  /**
   * 만료 시간 설정 (테스트용)
   * ✅ Command E2E-2: BrowserStoragePort 사용 (localStorage와 동일한 저장소)
   * @param msEpoch - 만료 시간 (밀리초 epoch) 또는 null
   */
  setExpiresAt: (msEpoch: number | null): void => {
    if (msEpoch === null) {
      storagePort.remove('token_expires_at');
      (tokenManager as { expiresAt?: number }).expiresAt = 0;
    } else {
      storagePort.set('token_expires_at', msEpoch.toString());
      (tokenManager as { expiresAt?: number }).expiresAt = msEpoch;
      // ✅ clockPort도 함께 설정하여 만료 상태를 결정적으로 만들기
      // expiresAt이 clock.now()보다 작으면 만료된 상태
      if (msEpoch < clockPort.now()) {
        // 이미 만료된 상태
      }
    }
  },
  
  /**
   * 스토리지 스냅샷 (테스트용)
   * ✅ Command E2E-2: BrowserStoragePort 사용 (localStorage와 동일한 저장소)
   * snapshot === localStorage 상태가 일치
   */
  getStorageSnapshot: (): {
    refreshToken: string | null;
    expiresAt: string | null;
    csrfToken: string | null;
  } => {
    return {
      refreshToken: storagePort.get('refresh_token'),
      expiresAt: storagePort.get('token_expires_at'),
      csrfToken: sessionStoragePort.get('csrf_token'),
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
