// 최신 세션 관리: Refresh Token 패턴
// Access Token (15분) + Refresh Token (7일) 분리
// 자동 토큰 갱신 및 CSRF 보호

import { logger } from './utils/logger';

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

// Token Storage (메모리 + localStorage 폴백)
class TokenManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number = 0;
  private csrfToken: string | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    logger.log('[tokenManager] Constructor called');
    if (typeof window !== 'undefined') {
      // localStorage에서 토큰 복원 (페이지 새로고침 대비)
      this.loadTokens();
      // CSRF 토큰 생성/복원
      this.ensureCSRFToken();
      logger.log('[tokenManager] Constructor complete', {
        hasRefreshToken: !!this.refreshToken,
        refreshTokenInStorage: !!localStorage.getItem('refresh_token'),
        expiresAt: this.expiresAt,
      });
    } else {
      logger.log('[tokenManager] Constructor: window is undefined (server side)');
    }
  }

  // CSRF 토큰 관리
  private ensureCSRFToken(): void {
    if (typeof window === 'undefined') return;
    
    // 세션 스토리지에서 CSRF 토큰 확인
    let csrf = sessionStorage.getItem('csrf_token');
    
    if (!csrf) {
      // 새로운 CSRF 토큰 생성 (32바이트 랜덤)
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      csrf = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      sessionStorage.setItem('csrf_token', csrf);
    }
    
    this.csrfToken = csrf;
  }

  getCSRFToken(): string | null {
    return this.csrfToken;
  }

  // 토큰 저장 (메모리 + localStorage)
  setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    if (typeof window === 'undefined') {
      logger.warn('[tokenManager] setTokens called on server side, ignoring');
      return;
    }
    
    // ✅ Auth 타임라인 로그: 토큰 저장 시작
    const expiresAt = Date.now() + (expiresIn * 1000);
    logger.log('[tokenManager] setTokens called', {
      timestamp: new Date().toISOString(),
      accessTokenLength: accessToken?.length || 0,
      refreshTokenLength: refreshToken?.length || 0,
      expiresIn,
      expiresAt,
      timeUntilExpiry: Math.floor(expiresIn),
    });
    
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresAt = expiresAt;
    
    // localStorage에 Refresh Token만 저장 (Access Token은 메모리에만)
    try {
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('token_expires_at', this.expiresAt.toString());
      
      // ✅ Auth 타임라인 로그: localStorage 저장 완료
      logger.log('[tokenManager] Tokens saved to localStorage', {
        timestamp: new Date().toISOString(),
        refreshTokenSaved: !!localStorage.getItem('refresh_token'),
        expiresAtSaved: !!localStorage.getItem('token_expires_at'),
        expiresAt: this.expiresAt,
      });
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), { component: 'tokenManager', action: 'save_tokens' });
      throw error;
    }
    
    // Access Token은 메모리에만 (보안 강화)
    // localStorage에는 저장하지 않음
  }

  // 토큰 로드 (localStorage에서)
  private loadTokens(): void {
    if (typeof window === 'undefined') return;
    
    const refreshToken = localStorage.getItem('refresh_token');
    const expiresAtStr = localStorage.getItem('token_expires_at');
    
    if (refreshToken && expiresAtStr) {
      this.refreshToken = refreshToken;
      this.expiresAt = parseInt(expiresAtStr, 10);
      
      // Access Token은 서버에서 다시 받아야 함 (메모리에만 저장)
      // 페이지 새로고침 시 자동으로 갱신됨
    }
  }

  // Access Token 가져오기 (자동 갱신 포함)
  // ✅ Single-flight: 동시 refresh 요청을 하나로 묶어 경합 방지
  async getAccessToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    
    // ✅ Auth 타임라인 로그: access token 요청
    const now = Date.now();
    const timeUntilExpiry = this.getTimeUntilExpiry();
    
    // Access Token이 유효하면 반환
    if (this.accessToken && this.expiresAt > now + 60000) { // 1분 여유
      // ✅ Auth 타임라인 로그: 유효한 토큰 반환
      logger.log('[tokenManager] Returning valid access token', {
        timestamp: new Date().toISOString(),
        expiresAt: this.expiresAt,
        timeUntilExpiry,
      });
      return this.accessToken;
    }
    
    // Refresh Token이 없으면 null
    if (!this.refreshToken) {
      // ✅ Auth 타임라인 로그: refresh token 없음
      logger.warn('[tokenManager] No refresh token available', {
        timestamp: new Date().toISOString(),
        hasAccessToken: !!this.accessToken,
        expiresAt: this.expiresAt,
        timeUntilExpiry,
      });
      return null;
    }
    
    // ✅ Single-flight: 이미 갱신 중이면 대기 (동시 refresh 경합 방지)
    if (this.refreshPromise) {
      // ✅ Auth 타임라인 로그: refresh 대기 중
      logger.log('[tokenManager] Refresh already in progress, waiting...', {
        timestamp: new Date().toISOString(),
      });
      return this.refreshPromise;
    }
    
    // ✅ 토큰 갱신 (single-flight 보장)
    this.refreshPromise = this.refreshAccessToken();
    
    try {
      const newAccessToken = await this.refreshPromise;
      return newAccessToken;
    } finally {
      // ✅ Single-flight: refresh 완료 후 promise 초기화
      this.refreshPromise = null;
    }
  }

  // Access Token 갱신
  // ✅ Single-flight: 동시 refresh 요청을 하나로 묶어 경합 방지
  private async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      // ✅ Auth 타임라인 로그: refresh 요청 시작 실패 (토큰 없음)
      logger.warn('[tokenManager] Refresh request failed: No refresh token available', {
        timestamp: new Date().toISOString(),
        hasAccessToken: !!this.accessToken,
        expiresAt: this.expiresAt,
        timeUntilExpiry: this.getTimeUntilExpiry(),
      });
      throw new Error('No refresh token available');
    }
    
    // ✅ Auth 타임라인 로그: refresh 요청 시작
    const refreshStartTime = Date.now();
    logger.log('[tokenManager] Refresh request started', {
      timestamp: new Date().toISOString(),
      hasAccessToken: !!this.accessToken,
      expiresAt: this.expiresAt,
      timeUntilExpiry: this.getTimeUntilExpiry(),
      refreshTokenExists: !!this.refreshToken,
    });
    
    try {
      // authAPI 사용 (순환 참조 방지를 위해 동적 import)
      const { authAPI } = await import('./api/auth');
      const data = await authAPI.refreshToken(this.refreshToken);
      
      // ✅ Auth 타임라인 로그: refresh 성공
      const refreshDuration = Date.now() - refreshStartTime;
      logger.log('[tokenManager] Refresh request succeeded', {
        timestamp: new Date().toISOString(),
        duration: `${refreshDuration}ms`,
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
      
      // ✅ Auth 타임라인 로그: 토큰 저장 완료
      logger.log('[tokenManager] Tokens updated after refresh', {
        timestamp: new Date().toISOString(),
        newExpiresAt: this.expiresAt,
        newTimeUntilExpiry: this.getTimeUntilExpiry(),
      });
      
      return data.access_token;
    } catch (error) {
      // ✅ Auth 타임라인 로그: refresh 실패
      const refreshDuration = Date.now() - refreshStartTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(error instanceof Error ? error : new Error(String(error)), {
        component: 'tokenManager',
        action: 'refresh_token',
        timestamp: new Date().toISOString(),
        duration: `${refreshDuration}ms`,
        errorMessage,
      });
      
      // ✅ Refresh 실패 시 전역 세션 정리 → 로그인으로 강제
      // "부분 복구" 금지: 모든 저장소 정리 + BroadcastChannel로 다른 탭에도 알림
      logger.warn('[tokenManager] Refresh failed, performing global session cleanup', {
        timestamp: new Date().toISOString(),
        errorMessage,
        willRedirect: typeof window !== 'undefined',
      });
      
      // 전역 세션 정리
      this.clearTokens();
      
      // ✅ BroadcastChannel을 통한 다른 탭에 세션 정리 알림
      if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
        try {
          const channel = new BroadcastChannel('auth_events');
          channel.postMessage({
            type: 'SESSION_EXPIRED',
            reason: 'refresh_failed',
            error: errorMessage,
            timestamp: new Date().toISOString(),
          });
          channel.close();
          logger.log('[tokenManager] Broadcasted session expired event to other tabs', {
            timestamp: new Date().toISOString(),
          });
        } catch (broadcastError) {
          logger.warn('[tokenManager] Failed to broadcast session expired event', {
            error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError),
          });
        }
      }
      
      // ✅ 로그인 페이지로 강제 리다이렉트
      if (typeof window !== 'undefined') {
        // ✅ Auth 타임라인 로그: 리다이렉트 트리거
        logger.log('[tokenManager] Redirecting to login due to refresh failure', {
          timestamp: new Date().toISOString(),
          reason: 'refresh_failed',
          errorMessage,
        });
        
        // 즉시 리다이렉트 (지연 없이)
        window.location.href = `/login?reason=${encodeURIComponent('세션이 만료되었습니다. 다시 로그인해주세요.')}`;
      }
      
      throw error;
    }
  }

  // Refresh Token 가져오기
  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  // 토큰 삭제
  // ✅ 전역 세션 정리: 모든 저장소 정리
  clearTokens(): void {
    if (typeof window === 'undefined') return;
    
    // ✅ Auth 타임라인 로그: 토큰 삭제 시작
    logger.log('[tokenManager] clearTokens called', {
      timestamp: new Date().toISOString(),
      hadAccessToken: !!this.accessToken,
      hadRefreshToken: !!this.refreshToken,
      expiresAt: this.expiresAt,
    });
    
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
    
    // ✅ 모든 저장소 정리 (localStorage, sessionStorage)
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token_expires_at');
    sessionStorage.removeItem('csrf_token');
    
    this.csrfToken = null;
    
    // ✅ Auth 타임라인 로그: 토큰 삭제 완료
    logger.log('[tokenManager] Tokens cleared', {
      timestamp: new Date().toISOString(),
    });
  }

  // 토큰 유효성 확인
  hasValidToken(): boolean {
    // 메모리에 토큰이 있으면 true
    if (this.refreshToken !== null) {
      return true;
    }
    
    // 메모리에 없으면 localStorage에서 확인 (페이지 리로드 후)
    if (typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        // localStorage에 있으면 메모리에 로드
        this.refreshToken = refreshToken;
        const expiresAtStr = localStorage.getItem('token_expires_at');
        if (expiresAtStr) {
          this.expiresAt = parseInt(expiresAtStr, 10);
        }
        return true;
      }
    }
    
    return false;
  }

  // Access Token 만료까지 남은 시간 (초)
  getTimeUntilExpiry(): number {
    if (this.expiresAt === 0) return 0;
    return Math.max(0, Math.floor((this.expiresAt - Date.now()) / 1000));
  }

  // Phase 4: Access Token 만료 시간 반환
  getExpiresAt(): number | null {
    if (this.expiresAt === 0) return null;
    return this.expiresAt;
  }
}

// 싱글톤 인스턴스
export const tokenManager = new TokenManager();

