// 최신 세션 관리: Refresh Token 패턴
// Access Token (15분) + Refresh Token (7일) 분리
// 자동 토큰 갱신 및 CSRF 보호

import { logger } from './utils/logger';
import { StoragePort, SessionStoragePort } from './ports/storagePort';
import { LocationPort } from './ports/locationPort';
import { ClockPort } from './ports/clockPort';
import { CryptoPort } from './ports/cryptoPort';
import { browserLocalStoragePort, browserSessionStoragePort } from './adapters/browserStoragePort';
import { createBrowserLocationPort } from './adapters/browserLocationPort';
import { createBrowserClockPort } from './adapters/browserClockPort';
import { createMemoryStoragePort, createMemorySessionStoragePort } from './adapters/memoryStoragePort';
import { createMemoryLocationPort } from './adapters/memoryLocationPort';
import { createMemoryClockPort } from './adapters/memoryClockPort';
import { createBrowserCryptoPort } from './adapters/browserCryptoPort';
import { createNodeCryptoPort } from './adapters/nodeCryptoPort';

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

/**
 * ✅ Command Jest-2: TokenManagerPort 공개 계약(Interface) 확정
 * 
 * 제품 코드(checkAuth 등)가 TokenManager에 기대하는 최소 계약
 * 테스트 더블은 이 계약을 100% 구현해야 함
 * 
 * 명명: TokenManagerInterface → TokenManagerPort (Port 패턴 일관성)
 */
export interface TokenManagerPort {
  hasValidToken(): boolean;
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): string | null;
  getExpiresAt(): number | null; // ✅ Command Jest-2: 추가된 계약
  getCSRFToken(options?: { ensure?: boolean }): string | null;
  ensureCSRFToken(): string; // ✅ P1-Next-Fix-Module-2D: CSRF 생성 계약 명확화
  clearTokens(): void;
}

/**
 * @deprecated TokenManagerInterface는 TokenManagerPort로 대체됨
 * 하위 호환성을 위해 유지
 */
export type TokenManagerInterface = TokenManagerPort;

// Token Storage (메모리 + StoragePort 폴백)
// ✅ Command Jest-2: TokenManager는 TokenManagerPort를 구현
class TokenManager implements TokenManagerPort {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number = 0;
  private csrfToken: string | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor(
    private storage: StoragePort,
    private sessionStorage: SessionStoragePort,
    private clock: ClockPort,
    private crypto: CryptoPort, // ✅ P1-Next-Fix-Module-2D: CryptoPort 주입
    private location?: LocationPort
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

  // ✅ P1-Next-Fix-Module-2D: CSRF 토큰 생성 계약 명확화
  ensureCSRFToken(): string {
    // 세션 스토리지에서 CSRF 토큰 확인
    let csrf = this.sessionStorage.get('csrf_token');
    
    if (!csrf) {
      // 새로운 CSRF 토큰 생성 (32바이트 랜덤)
      csrf = this.crypto.randomHex(32);
      this.sessionStorage.set('csrf_token', csrf);
    }
    
    this.csrfToken = csrf;
    return csrf;
  }

  getCSRFToken(options?: { ensure?: boolean }): string | null {
    if (options?.ensure) {
      return this.ensureCSRFToken();
    }
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
    
    // ✅ Command 3: 이미 갱신 중이면 대기 (하지만 무한 대기 방지)
    if (this.refreshPromise) {
      // refreshPromise가 이미 있으면 그것을 반환하되,
      // refreshAccessToken의 finally에서 정리되므로 무한 대기는 발생하지 않음
      return this.refreshPromise;
    }
    
    // ✅ Command 3: 토큰 갱신 (refreshPromise는 refreshAccessToken에서 finally로 정리됨)
    this.refreshPromise = this.refreshAccessToken();
    
    try {
      const newAccessToken = await this.refreshPromise;
      // ✅ Command 3: 정상 완료 시 refreshPromise는 refreshAccessToken의 finally에서 null로 설정됨
      return newAccessToken;
    } catch (error) {
      // ✅ Command 3: getAccessToken은 무한 대기 없이 종료 보장
      // refreshAccessToken의 catch에서 이미 clearTokens()를 호출했고,
      // finally에서 refreshPromise = null로 보장되므로 여기서는 throw만
      logger.error(error instanceof Error ? error : new Error(String(error)), { 
        component: 'tokenManager', 
        action: 'getAccessToken',
        note: 'refreshAccessToken failed, error propagated'
      });
      // ✅ Command 3: reason은 항상 string 보장
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      // ✅ Command 3: 이중 보장 (refreshAccessToken의 finally에서도 처리하지만, 여기서도 보장)
      // refreshAccessToken이 완료되면 refreshPromise는 null이 되어야 함
      // 하지만 refreshAccessToken 내부에서 에러가 발생하면 여기서도 정리
      // 이렇게 하면 getAccessToken은 "반드시" resolve/reject (영원히 pending 금지)
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
      
      // ✅ Command 3: refresh 실패(401) 경로에서 제품 코드 계약 보장
      // 1. clearTokens 실행 보장
      console.log('[tokenManager.refreshAccessToken] Calling clearTokens()...');
      this.clearTokens();
      console.log('[tokenManager.refreshAccessToken] clearTokens() called');
      
      // 2. pending promise 해제 보장 (finally에서 처리)
      
      // 3. getAccessToken은 무한 대기 없이 종료 보장 (refreshPromise = null로 보장)
      
      // 4. reason string 보장 (Error 객체의 message 사용)
      
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
      
      // ✅ Command 3: reason은 항상 string 보장
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      // ✅ Command 3: finally에서 refreshPromise = null 보장 (pending promise 해제)
      // 이렇게 하면 getAccessToken은 무한 대기 없이 종료 보장
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
  crypto?: CryptoPort, // ✅ P1-Next-Fix-Module-2D: CryptoPort 주입
  location?: LocationPort
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
  
  // ✅ P1-Next-Fix-Module-2D: CryptoPort 기본값 설정
  // 브라우저: browserCryptoPort, Node: nodeCryptoPort
  const defaultCrypto = crypto ?? (typeof window !== 'undefined'
    ? createBrowserCryptoPort()
    : createNodeCryptoPort());
  
  const defaultLocation = location ?? (typeof window !== 'undefined'
    ? (createBrowserLocationPort() ?? createMemoryLocationPort('/'))
    : createMemoryLocationPort('/'));
  
  return new TokenManager(defaultStorage, defaultSessionStorage, defaultClock, defaultCrypto, defaultLocation);
}

// ✅ P1-Next-Fix-Module: top-level 싱글톤 생성 제거
// 브라우저 전용 인스턴스는 'use client' 파일(lib/api/clientApi.ts)에서만 생성
// 
// 기존 코드에서 tokenManager를 import하는 경우:
// - 브라우저 코드: lib/api/clientApi.ts에서 import
// - 테스트: createTokenManager(deps)로 직접 생성

// ✅ 제품 코드는 순수하게 유지
// 테스트 훅(__test)은 frontend/e2e/tokenManager-test-entry.ts에서 부착
