// 최신 세션 관리: Refresh Token 패턴
// Access Token (15분) + Refresh Token (7일) 분리
// 자동 토큰 갱신 및 CSRF 보호

import { logger } from './utils/logger';
import { StoragePort, SessionStoragePort } from './ports/storagePort';
import { LocationPort } from './ports/locationPort';
import { ClockPort } from './ports/clockPort';
import { browserLocalStoragePort, browserSessionStoragePort } from './adapters/browserStoragePort';
import { createBrowserLocationPort } from './adapters/browserLocationPort';
import { createBrowserClockPort } from './adapters/browserClockPort';
import { createMemoryStoragePort, createMemorySessionStoragePort } from './adapters/memoryStoragePort';
import { createMemoryLocationPort } from './adapters/memoryLocationPort';
import { createMemoryClockPort } from './adapters/memoryClockPort';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Access Token 만료 시간
};

export type TokenRefreshResponse = {
  access_token: string;
  refresh_token?: string; // 선택적 (Rotation)
  expires_in: number; // 초 단위
};

// Token Storage (메모리 + StoragePort 폴백)
class TokenManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number = 0;
  private csrfToken: string | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor(
    private storage: StoragePort,
    private sessionStorage: SessionStoragePort,
    private clock: ClockPort,
    private location?: LocationPort | null
  ) {
    logger.log('[tokenManager] Constructor called');
    // localStorage에서 토큰 복원 (페이지 새로고침 대비)
    this.loadTokens();
    // CSRF 토큰 생성/복원
    this.ensureCSRFToken();
    logger.log('[tokenManager] Constructor complete', {
      hasRefreshToken: !!this.refreshToken,
      refreshTokenInStorage: !!this.storage.get('refresh_token'),
      expiresAt: this.expiresAt,
    });
  }

  // CSRF 토큰 관리
  private ensureCSRFToken(): void {
    // 세션 스토리지에서 CSRF 토큰 확인
    let csrf = this.sessionStorage.get('csrf_token');
    
    if (!csrf) {
      // 새로운 CSRF 토큰 생성 (32바이트 랜덤)
      // crypto는 브라우저/Node 모두에서 사용 가능
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        csrf = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      } else {
        // Node 환경 fallback (테스트용)
        csrf = Math.random().toString(36).substring(2, 34) + Math.random().toString(36).substring(2, 34);
      }
      this.sessionStorage.set('csrf_token', csrf);
    }
    
    this.csrfToken = csrf;
  }

  getCSRFToken(): string | null {
    return this.csrfToken;
  }

  // 토큰 저장 (메모리 + StoragePort)
  setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    logger.log('[tokenManager] setTokens called', {
      accessTokenLength: accessToken?.length || 0,
      refreshTokenLength: refreshToken?.length || 0,
      expiresIn,
    });
    
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresAt = this.clock.now() + (expiresIn * 1000);
    
    // StoragePort에 Refresh Token만 저장 (Access Token은 메모리에만)
    try {
      this.storage.set('refresh_token', refreshToken);
      this.storage.set('token_expires_at', this.expiresAt.toString());
      logger.log('[tokenManager] Tokens saved to storage', {
        refreshTokenSaved: !!this.storage.get('refresh_token'),
        expiresAtSaved: !!this.storage.get('token_expires_at'),
        expiresAt: this.expiresAt,
      });
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), { component: 'tokenManager', action: 'save_tokens' });
      throw error;
    }
    
    // Access Token은 메모리에만 (보안 강화)
    // StoragePort에는 저장하지 않음
  }

  // 토큰 로드 (StoragePort에서)
  private loadTokens(): void {
    const refreshToken = this.storage.get('refresh_token');
    const expiresAtStr = this.storage.get('token_expires_at');
    
    if (refreshToken && expiresAtStr) {
      this.refreshToken = refreshToken;
      this.expiresAt = parseInt(expiresAtStr, 10);
      
      // Access Token은 서버에서 다시 받아야 함 (메모리에만 저장)
      // 페이지 새로고침 시 자동으로 갱신됨
    }
  }

  // Access Token 가져오기 (자동 갱신 포함)
  async getAccessToken(): Promise<string | null> {
    // Access Token이 유효하면 반환
    if (this.accessToken && this.expiresAt > this.clock.now() + 60000) { // 1분 여유
      return this.accessToken;
    }
    
    // Refresh Token이 없으면 null
    if (!this.refreshToken) {
      return null;
    }
    
    // 이미 갱신 중이면 대기
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    
    // 토큰 갱신
    this.refreshPromise = this.refreshAccessToken();
    
    try {
      const newAccessToken = await this.refreshPromise;
      return newAccessToken;
    } catch (error) {
      // ✅ 디버깅: getAccessToken에서 refreshAccessToken 에러를 catch
      // refreshAccessToken의 catch에서 이미 clearTokens()를 호출했지만,
      // 여기서도 로그를 남겨서 흐름을 추적
      logger.error(error instanceof Error ? error : new Error(String(error)), { 
        component: 'tokenManager', 
        action: 'getAccessToken',
        note: 'refreshAccessToken failed, error propagated'
      });
      // refreshAccessToken의 catch에서 이미 clearTokens()를 호출했으므로 여기서는 throw만
      throw error;
    } finally {
      this.refreshPromise = null;
    }
  }

  // Access Token 갱신
  private async refreshAccessToken(): Promise<string> {
    console.log('[tokenManager.refreshAccessToken] START - refreshToken exists:', !!this.refreshToken);
    
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    try {
      // authAPI 사용 (순환 참조 방지를 위해 동적 import)
      console.log('[tokenManager.refreshAccessToken] Calling authAPI.refreshToken...');
      const { authAPI } = await import('./api/auth');
      const data = await authAPI.refreshToken(this.refreshToken);
      
      logger.log('[tokenManager] Refresh token response:', {
        hasAccessToken: !!data.access_token,
        accessTokenLength: data.access_token?.length || 0,
        hasRefreshToken: !!data.refresh_token,
        expiresIn: data.expires_in,
      });
      
      if (!data.access_token) {
        throw new Error('No access token in refresh response');
      }
      
      // 새 토큰 저장
      const expiresIn = data.expires_in || 900; // 기본 15분
      this.setTokens(
        data.access_token,
        data.refresh_token || this.refreshToken, // Rotation 지원
        expiresIn
      );
      
      console.log('[tokenManager.refreshAccessToken] SUCCESS');
      return data.access_token;
    } catch (error) {
      console.log('[tokenManager.refreshAccessToken] ERROR caught:', error instanceof Error ? error.message : String(error));
      logger.error(error instanceof Error ? error : new Error(String(error)), { component: 'tokenManager', action: 'refresh_token' });
      
      // ✅ 해결책(제품 코드): refreshAccessToken에 "실패면 무조건 throw" 보장
      // catch에서 무조건 clearTokens():
      // 모든 에러에 대해 세션 정리 보장
      console.log('[tokenManager.refreshAccessToken] Calling clearTokens()...');
      this.clearTokens();
      console.log('[tokenManager.refreshAccessToken] clearTokens() called');
      
      // Refresh token이 만료되었거나 유효하지 않은 경우
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Invalid or expired refresh token') || 
          errorMessage.includes('expired') ||
          errorMessage.includes('invalid') ||
          errorMessage.includes('401') ||
          errorMessage.includes('refresh_failed')) {
        logger.warn('[tokenManager] Refresh token expired or invalid, clearing tokens and redirecting to login');
        
        // 로그인 페이지로 리다이렉트 (LocationPort가 있으면 사용)
        if (this.location) {
          // AuthGuard가 자동으로 처리하도록 하기 위해 약간의 지연을 두고 리다이렉트
          setTimeout(() => {
            this.location!.redirect('/login');
          }, 100);
        }
      }
      
      throw error;
    } finally {
      // ✅ finally에서 refreshPromise = null 보장
      console.log('[tokenManager.refreshAccessToken] FINALLY - setting refreshPromise = null');
      this.refreshPromise = null;
    }
  }

  // Refresh Token 가져오기
  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  // 토큰 삭제
  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
    
    this.storage.remove('refresh_token');
    this.storage.remove('token_expires_at');
    this.sessionStorage.remove('csrf_token');
    
    this.csrfToken = null;
  }

  // 토큰 유효성 확인
  hasValidToken(): boolean {
    // 메모리에 토큰이 있으면 true
    if (this.refreshToken !== null) {
      return true;
    }
    
    // 메모리에 없으면 StoragePort에서 확인 (페이지 리로드 후)
    const refreshToken = this.storage.get('refresh_token');
    if (refreshToken) {
      // StoragePort에 있으면 메모리에 로드
      this.refreshToken = refreshToken;
      const expiresAtStr = this.storage.get('token_expires_at');
      if (expiresAtStr) {
        this.expiresAt = parseInt(expiresAtStr, 10);
      }
      return true;
    }
    
    return false;
  }

  // Access Token 만료까지 남은 시간 (초)
  // ✅ Step 1: S3 에러 제거 - undefined 경로 방어 로직 추가
  // 없으면 throw가 아니라 폴백(0 또는 Infinity) 하도록 방어 로직 추가
  // 이건 제품 코드에도 유익(기관망/이상 상태에서 폭사 방지)
  getTimeUntilExpiry(): number {
    // expiresAt이 0이거나 유효하지 않으면 0 반환 (폴백)
    if (!this.expiresAt || this.expiresAt === 0) return 0;
    
    // clock.now()가 유효하지 않으면 Infinity 반환 (폴백)
    const now = this.clock.now();
    if (!isFinite(now)) return Infinity;
    
    // 계산 결과가 유효하지 않으면 0 반환 (폴백)
    const timeUntilExpiry = Math.floor((this.expiresAt - now) / 1000);
    if (!isFinite(timeUntilExpiry)) return 0;
    
    return Math.max(0, timeUntilExpiry);
  }

  // Phase 4: Access Token 만료 시간 반환
  getExpiresAt(): number | null {
    if (this.expiresAt === 0) return null;
    return this.expiresAt;
  }
}

/**
 * TokenManager 팩토리 함수
 * Port를 주입받아 TokenManager 인스턴스 생성
 * 
 * 정석 원칙: core 로직은 Port 인터페이스에만 의존하고,
 * 실제 구현(localStorage/memory)은 adapter에서 주입받음
 */
export function createTokenManager(
  storage?: StoragePort,
  sessionStorage?: SessionStoragePort,
  clock?: ClockPort,
  location?: LocationPort | null
): TokenManager {
  // 기본값: 브라우저 환경이면 browser adapter, 아니면 memory adapter
  const defaultStorage = storage ?? (typeof window !== 'undefined' && browserLocalStoragePort
    ? browserLocalStoragePort
    : createMemoryStoragePort());
  
  const defaultSessionStorage = sessionStorage ?? (typeof window !== 'undefined' && browserSessionStoragePort
    ? browserSessionStoragePort
    : createMemorySessionStoragePort());
  
  const defaultClock = clock ?? (typeof window !== 'undefined'
    ? createBrowserClockPort()
    : createMemoryClockPort());
  
  const defaultLocation = location ?? (typeof window !== 'undefined'
    ? createBrowserLocationPort()
    : null);
  
  return new TokenManager(defaultStorage, defaultSessionStorage, defaultClock, defaultLocation);
}

// 싱글톤 인스턴스 (기존 호환성 유지)
// 브라우저 환경에서만 사용 가능
export const tokenManager = typeof window !== 'undefined'
  ? createTokenManager()
  : createTokenManager(createMemoryStoragePort(), createMemorySessionStoragePort(), createMemoryClockPort(), null);

// ✅ 제품 코드는 순수하게 유지
// 테스트 훅(__test)은 frontend/e2e/tokenManager-test-entry.ts에서 부착
