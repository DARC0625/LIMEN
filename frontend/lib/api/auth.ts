/**
 * 인증 API 클라이언트
 * 로그인, 회원가입, 세션 관리
 */

import { apiRequest } from './client';
import { tokenManager } from '../tokenManager';
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
 * 인증 API
 */
export const authAPI = {
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
      credentials: 'include',
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
    
    const data = await response.json();
    
    // 쿠키에서 refresh_token 추출 시도 (HttpOnly가 아니면 가능)
    // 백엔드가 refresh_token을 쿠키로만 전송하는 경우를 대비
    let refreshTokenFromCookie: string | null = null;
    if (typeof window !== 'undefined') {
      // document.cookie에서 refresh_token 찾기
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'refresh_token' && value) {
          refreshTokenFromCookie = value;
          logger.log('[authAPI.login] Found refresh_token in cookie');
          break;
        }
      }
    }
    
    // 응답 데이터 상세 로깅
    logger.log('[authAPI.login] Response data:', {
      hasAccessToken: !!data.access_token,
      hasRefreshToken: !!data.refresh_token,
      hasRefreshTokenFromCookie: !!refreshTokenFromCookie,
      accessTokenLength: data.access_token?.length || 0,
      refreshTokenLength: data.refresh_token?.length || 0,
      refreshTokenFromCookieLength: refreshTokenFromCookie?.length || 0,
      expiresIn: data.expires_in,
      allKeys: Object.keys(data),
      dataPreview: JSON.stringify(data).substring(0, 200),
    });
    
    // refresh_token 소스 결정: JSON 응답 > 쿠키
    const refreshToken = data.refresh_token || refreshTokenFromCookie;
    
    // 최신 방식: Access Token + Refresh Token 분리
    if (data.access_token && refreshToken) {
      const expiresIn = data.expires_in || AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY;
      logger.log('[authAPI.login] Saving tokens to tokenManager', {
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!refreshToken,
        refreshTokenSource: data.refresh_token ? 'JSON' : 'Cookie',
        expiresIn,
      });
      tokenManager.setTokens(data.access_token, refreshToken, expiresIn);
      logger.log('[authAPI.login] Tokens saved, verifying...', {
        hasValidToken: tokenManager.hasValidToken(),
        refreshTokenInStorage: typeof window !== 'undefined' ? !!localStorage.getItem('refresh_token') : false,
      });
    } else {
      // refresh_token이 없는 경우 에러 로깅
      logger.error(new Error('[authAPI.login] Missing tokens in response!'), {
        hasAccessToken: !!data.access_token,
        hasRefreshTokenInJSON: !!data.refresh_token,
        hasRefreshTokenInCookie: !!refreshTokenFromCookie,
        dataKeys: Object.keys(data),
        data: data,
      });
    }
    
    if (data.token) {
      // 하위 호환성: 단일 토큰
      // localStorage에 저장 (하위 호환성)
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', data.token);
      }
    }
    
    return data;
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
      const errorData = await response.json().catch(() => ({ message: 'Token refresh failed' }));
      logger.error(new Error(errorData.message || 'Token refresh failed'), {
        component: 'authAPI',
        action: 'refreshToken',
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      throw new Error(errorData.message || 'Token refresh failed');
    }

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

