/**
 * ✅ E2E 테스트 전용 tokenManager 엔트리
 * 
 * 제품 코드(tokenManager.ts)는 순수하게 유지하고,
 * 테스트 훅(__test)은 이 엔트리에서 top-level로 강제 부착
 * 
 * 이렇게 하면 "제품 번들에 훅이 포함되냐" 싸움 자체가 사라진다.
 */

import { tokenManager } from '../lib/tokenManager';

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
   * 강제 refresh 호출 (테스트용)
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
   * 현재 시간 설정 (테스트용)
   * @param now - 설정할 시간 (밀리초)
   */
  setNow: (now: number): void => {
    // Date.now()를 오버라이드할 수 없으므로, expiresAt을 조정하여 시뮬레이션
    // 실제로는 setTokens로 expiresAt을 조정
    const currentExpiresAt = (tokenManager as { expiresAt?: number }).expiresAt || 0;
    if (currentExpiresAt > 0) {
      const diff = currentExpiresAt - Date.now();
      (tokenManager as { expiresAt?: number }).expiresAt = now + diff;
    }
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
   * @param value - Refresh Token 값 또는 null
   */
  setRefreshToken: (value: string | null): void => {
    if (value === null) {
      localStorage.removeItem('refresh_token');
      (tokenManager as { refreshToken?: string | null }).refreshToken = null;
    } else {
      localStorage.setItem('refresh_token', value);
      (tokenManager as { refreshToken?: string | null }).refreshToken = value;
    }
  },
  
  /**
   * 만료 시간 설정 (테스트용)
   * @param msEpoch - 만료 시간 (밀리초 epoch) 또는 null
   */
  setExpiresAt: (msEpoch: number | null): void => {
    if (msEpoch === null) {
      localStorage.removeItem('token_expires_at');
      (tokenManager as { expiresAt?: number }).expiresAt = 0;
    } else {
      localStorage.setItem('token_expires_at', msEpoch.toString());
      (tokenManager as { expiresAt?: number }).expiresAt = msEpoch;
    }
  },
  
  /**
   * 스토리지 스냅샷 (테스트용)
   */
  getStorageSnapshot: (): {
    refreshToken: string | null;
    expiresAt: string | null;
    csrfToken: string | null;
  } => {
    return {
      refreshToken: localStorage.getItem('refresh_token'),
      expiresAt: localStorage.getItem('token_expires_at'),
      csrfToken: sessionStorage.getItem('csrf_token'),
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

// ✅ E2E 전용 번들에서 export
export { tokenManager };
