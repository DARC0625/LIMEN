/**
 * ✅ P1-Next-Fix-Module-2C: 인증 API 클라이언트 (Factory 패턴)
 * 로그인, 회원가입, 세션 관리
 * 
 * 이 모듈은 순수 함수만 제공하며, 싱글톤 의존성을 제거했습니다.
 * 브라우저 전용 인스턴스는 clientApi.ts에서 생성됩니다.
 */

import type { TokenManagerPort } from '../tokenManager';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  SessionResponse,
  TokenRefreshResponse,
} from '../types';
import { AUTH_CONSTANTS } from '../constants';
import { logger } from '../utils/logger';

/**
 * ✅ P1-Next-Fix-Module-2C: AuthAPI 의존성
 */
export interface AuthAPIDeps {
  tokenManager: TokenManagerPort;
  apiRequest: <T>(endpoint: string, options?: RequestInit & { skipAuth?: boolean; retry?: boolean; timeout?: number }) => Promise<T>;
  fetch: typeof fetch;
}

/**
 * ✅ P1-Next-Fix-Module-2C: AuthAPI Factory
 */
export function createAuthAPI(deps: AuthAPIDeps) {
  const { tokenManager, apiRequest, fetch } = deps;

  return {
    /**
     * 로그인
     */
    login: async (credentials: LoginRequest): Promise<LoginResponse> => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const url = `${apiUrl}/auth/login`;
      
      // CSRF 토큰 포함
      const csrfToken = tokenManager.getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include', // 중요: 쿠키 인증이면 필수
        body: JSON.stringify(credentials),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(errorData.message || 'Login failed');
      }
      
      // 로그인 응답의 Set-Cookie 헤더 확인 (쿠키 설정 확인)
      const setCookieHeaders = response.headers.getSetCookie();
      logger.log('[authAPI.login] Login response Set-Cookie headers:', {
        count: setCookieHeaders.length,
        headers: setCookieHeaders.map(h => h.substring(0, 200)), // 처음 200자
      });
      
      // JSON이 없을 수도 있으니 안전 파싱
      const data = await response.json().catch(() => ({}));
      
      // 기존 토큰 바디 기반 (하위 호환성)
      const accessToken = data?.token ?? data?.access_token ?? data?.accessToken ?? null;
      const refreshToken = data?.refresh_token ?? data?.refreshToken ?? null;
      
      // 토큰이 JSON 응답에 있으면 기존 로직대로 저장
      if (accessToken && refreshToken) {
        const expiresIn = data.expires_in || AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY;
        logger.log('[authAPI.login] Tokens found in JSON response, saving to tokenManager', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          expiresIn,
        });
        tokenManager.setTokens(accessToken, refreshToken, expiresIn);
        
        return {
          success: true,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: expiresIn,
          ...data,
        } as LoginResponse;
      }
      
      // ✅ cookie-only 모드: 토큰이 JSON에 없으면 /session으로 로그인 성공 확인
      logger.log('[authAPI.login] No tokens in JSON response, checking session (cookie-based auth)', {
        status: response.status,
        hasSetCookie: setCookieHeaders.length > 0,
        responseKeys: Object.keys(data),
      });
      
      // 세션 확인으로 로그인 성공 여부 검증
      try {
        const sessionCheck = await fetch(`${apiUrl}/auth/session`, {
          method: 'GET',
          credentials: 'include', // 쿠키 포함 필수
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (sessionCheck.ok) {
          const sessionData = await sessionCheck.json();
          if (sessionData.valid === true) {
            logger.log('[authAPI.login] Session verified successfully (cookie-based auth)');
            return {
              success: true,
              ...data, // 기타 응답 데이터는 그대로 전달 (메시지 등)
            } as LoginResponse;
          }
        }
        
        // 세션 확인 실패는 로그인 실패로 간주하지 않음 (쿠키가 설정되었을 수 있음)
        logger.warn('[authAPI.login] Session check failed, but login response was 200 (cookie may be set)');
      } catch (sessionError) {
        // 세션 확인 실패는 무시 (쿠키가 설정되었을 수 있음)
        logger.warn('[authAPI.login] Session check error (ignored):', sessionError);
      }
      
      // 응답이 200이면 성공으로 간주 (쿠키 기반 인증)
      return {
        success: true,
        ...data, // 기타 응답 데이터는 그대로 전달 (메시지 등)
      } as LoginResponse;
    },

    /**
     * 회원가입
     */
    register: async (data: RegisterRequest): Promise<RegisterResponse> => {
      return apiRequest<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
        skipAuth: true, // 회원가입은 인증 불필요
      });
    },

    /**
     * 세션 확인
     */
    checkSession: async (): Promise<SessionResponse> => {
      // GET 요청이므로 CSRF 토큰 불필요
      return apiRequest<SessionResponse>('/auth/session', {
        method: 'GET',
      });
    },

    /**
     * 세션 생성
     */
    createSession: async (
      accessToken: string,
      refreshToken?: string
    ): Promise<void> => {
      const csrfToken = tokenManager.getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      };

      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      // 상세 로깅 (개발 환경만)
      logger.log('[authAPI.createSession] Creating session:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        hasCSRF: !!csrfToken,
        accessTokenLength: accessToken?.length || 0,
      });

      try {
        // apiRequest 대신 직접 fetch를 사용하여 Set-Cookie 헤더 확인
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
        const url = `${apiUrl}/auth/session`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers,
          credentials: 'include', // 쿠키 포함 필수
          body: JSON.stringify({
            access_token: accessToken,
            ...(refreshToken ? { refresh_token: refreshToken } : {}),
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Session creation failed' }));
          throw new Error(errorData.message || 'Session creation failed');
        }
        
        // Set-Cookie 헤더 확인
        const setCookieHeaders = response.headers.getSetCookie();
        logger.log('[authAPI.createSession] Session creation response Set-Cookie headers:', {
          status: response.status,
          count: setCookieHeaders.length,
          headers: setCookieHeaders.map(h => h.substring(0, 150)), // 처음 150자만
        });
        
        const result = await response.json();
        
        logger.log('[authAPI.createSession] Session created successfully:', result);
      } catch (error) {
        logger.error(error instanceof Error ? error : new Error(String(error)), {
          component: 'authAPI',
          action: 'createSession',
        });
        throw error;
      }
    },

    /**
     * 세션 삭제
     */
    deleteSession: async (): Promise<void> => {
      const csrfToken = tokenManager.getCSRFToken();
      const headers: Record<string, string> = {};

      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      await apiRequest('/auth/session', {
        method: 'DELETE',
        headers,
      });
    },

    /**
     * 토큰 갱신
     * 백엔드는 쿠키 우선, 없으면 body에서 refresh_token을 읽음
     * 쿠키가 있으면 body에 포함하지 않음 (쿠키 우선 정책)
     */
    refreshToken: async (refreshToken?: string): Promise<TokenRefreshResponse> => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const url = `${apiUrl}/auth/refresh`;
      
      // 쿠키에서 refresh_token 확인
      let hasRefreshTokenCookie = false;
      if (typeof window !== 'undefined') {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name] = cookie.trim().split('=');
          if (name === 'refresh_token') {
            hasRefreshTokenCookie = true;
            break;
          }
        }
      }
      
      interface RefreshTokenBody {
        refresh_token?: string;
      }
      
      const body: RefreshTokenBody = {};
      
      // 쿠키에 refresh_token이 없을 때만 body에 포함 (쿠키 우선 정책)
      if (!hasRefreshTokenCookie && refreshToken) {
        body.refresh_token = refreshToken;
        logger.log('[authAPI.refreshToken] No refresh_token cookie found, using body');
      } else if (hasRefreshTokenCookie) {
        logger.log('[authAPI.refreshToken] Using refresh_token from cookie');
      }

      logger.log('[authAPI.refreshToken] Requesting token refresh...', {
        hasRefreshTokenCookie,
        hasRefreshTokenInBody: !!body.refresh_token,
        refreshTokenLength: refreshToken?.length || 0,
        url,
      });

      // apiRequest 대신 직접 fetch 사용 (쿠키 전송 보장)
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 쿠키 전송 필수 (refresh_token 쿠키)
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        console.log('[authAPI.refreshToken] Response NOT OK - status:', response.status, 'statusText:', response.statusText);
        const errorData = await response.json().catch(() => ({ message: 'Token refresh failed' }));
        console.log('[authAPI.refreshToken] Error data:', errorData);
        logger.error(new Error(errorData.message || 'Token refresh failed'), {
          component: 'authAPI',
          action: 'refreshToken',
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        const error = new Error(errorData.message || 'Token refresh failed');
        console.log('[authAPI.refreshToken] Throwing error:', error.message);
        throw error;
      }
      
      console.log('[authAPI.refreshToken] Response OK - status:', response.status);

      const data = await response.json() as TokenRefreshResponse;
      
      logger.log('[authAPI.refreshToken] Refresh response:', {
        hasAccessToken: !!data.access_token,
        accessTokenLength: data.access_token?.length || 0,
        hasRefreshToken: !!data.refresh_token,
        expiresIn: data.expires_in,
      });
      
      if (!data.access_token) {
        logger.error(new Error('No access token in refresh response'), {
          component: 'authAPI',
          action: 'refreshToken',
          data: data,
        });
        throw new Error('No access token in refresh response');
      }
      
      return data;
    },
  };
}

