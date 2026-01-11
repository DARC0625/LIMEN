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
    
    logger.log('[tokenManager] setTokens called', {
      accessTokenLength: accessToken?.length || 0,
      refreshTokenLength: refreshToken?.length || 0,
      expiresIn,
    });
    
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresAt = Date.now() + (expiresIn * 1000);
    
    // localStorage에 Refresh Token만 저장 (Access Token은 메모리에만)
    try {
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('token_expires_at', this.expiresAt.toString());
      logger.log('[tokenManager] Tokens saved to localStorage', {
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
  async getAccessToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    
    // Access Token이 유효하면 반환
    if (this.accessToken && this.expiresAt > Date.now() + 60000) { // 1분 여유
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
    } finally {
      this.refreshPromise = null;
    }
  }

  // Access Token 갱신
  private async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    try {
      // authAPI 사용 (순환 참조 방지를 위해 동적 import)
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
      
      return data.access_token;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), { component: 'tokenManager', action: 'refresh_token' });
      
      // Refresh token이 만료되었거나 유효하지 않은 경우
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Invalid or expired refresh token') || 
          errorMessage.includes('expired') ||
          errorMessage.includes('invalid')) {
        logger.warn('[tokenManager] Refresh token expired or invalid, clearing tokens and redirecting to login');
        this.clearTokens();
        
        // 로그인 페이지로 리다이렉트 (클라이언트 사이드에서만)
        if (typeof window !== 'undefined') {
          // AuthGuard가 자동으로 처리하도록 하기 위해 약간의 지연을 두고 리다이렉트
          setTimeout(() => {
            window.location.href = '/login';
          }, 100);
        }
      } else {
        // 기타 에러는 토큰만 클리어
        this.clearTokens();
      }
      
      throw error;
    }
  }

  // Refresh Token 가져오기
  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  // 토큰 삭제
  clearTokens(): void {
    if (typeof window === 'undefined') return;
    
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
    
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token_expires_at');
    sessionStorage.removeItem('csrf_token');
    
    this.csrfToken = null;
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

