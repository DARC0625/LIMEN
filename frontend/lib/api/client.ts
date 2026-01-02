/**
 * API 클라이언트 핵심 로직
 * 에러 처리, 재시도, 토큰 관리 통합
 */

import { trackAPIError } from '../errorTracking';
import { trackPerformanceMetric } from '../analytics';
import { tokenManager } from '../tokenManager';
import { API_CONSTANTS } from '../constants';
import type { APIError } from '../types';

/**
 * API URL 가져오기
 */
const getAPIUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return '/api';
};

/**
 * API 요청 옵션
 */
interface APIRequestOptions extends RequestInit {
  skipAuth?: boolean; // 인증 스킵 (public endpoints)
  retry?: boolean; // 재시도 여부
  timeout?: number; // 타임아웃 (밀리초)
}

/**
 * API 요청 핵심 함수
 * - 자동 토큰 갱신
 * - 에러 처리 통합
 * - 재시도 로직
 * - 성능 측정
 */
export async function apiRequest<T>(
  endpoint: string,
  options: APIRequestOptions = {}
): Promise<T> {
  const apiUrl = getAPIUrl();
  const {
    skipAuth = false,
    retry = false,
    timeout = API_CONSTANTS.DEFAULT_TIMEOUT,
    ...fetchOptions
  } = options;

  // Access Token 가져오기 (자동 갱신)
  let accessToken: string | null = null;
  if (!skipAuth) {
    try {
      accessToken = await tokenManager.getAccessToken();
      console.log('[apiRequest] Access token check:', {
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken?.length || 0,
        endpoint,
      });
    } catch (error) {
      // 토큰 갱신 실패는 무시 (401 에러로 처리됨)
      console.warn('[apiRequest] Token refresh failed:', error);
    }
  }

  // 헤더 구성
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  const url = `${apiUrl}${endpoint}`;
  const method = fetchOptions.method || 'GET';

  // 인증 헤더 추가
  if (accessToken && !skipAuth) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // CSRF 토큰 추가 (POST, PUT, DELETE 요청에만 필요)
  const csrfToken = tokenManager.getCSRFToken();
  const needsCSRF = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
  if (csrfToken && !skipAuth && needsCSRF) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  // 성능 측정 시작
  const startTime = typeof window !== 'undefined' && typeof performance !== 'undefined'
    ? performance.now()
    : 0;

  // 디버그 로그 (개발 환경만)
  if (process.env.NODE_ENV === 'development') {
    console.log('[API Request]', {
      url,
      method,
      endpoint,
      hasAuth: !!accessToken,
      hasCSRF: !!csrfToken,
    });
  }

  // 요청 실행 (재시도 포함)
  const executeRequest = async (attempt: number = 1): Promise<Response> => {
    // 타임아웃 처리
    const controller = typeof AbortController !== 'undefined'
      ? new AbortController()
      : null;
    
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), timeout)
      : null;

    try {
      // body 처리: 객체면 JSON.stringify, 문자열이면 그대로 사용
      let requestBody: string | undefined = undefined;
      if (fetchOptions.body) {
        if (typeof fetchOptions.body === 'string') {
          requestBody = fetchOptions.body;
        } else {
          requestBody = JSON.stringify(fetchOptions.body);
        }
      }
      
      console.log('[executeRequest] Request details:', {
        url,
        method,
        hasBody: !!requestBody,
        bodyLength: requestBody?.length || 0,
        bodyPreview: requestBody ? requestBody.substring(0, 200) : 'none',
        hasAuth: !!accessToken,
        hasCSRF: !!csrfToken,
        endpoint,
      });
      
      const response = await fetch(url, {
        ...fetchOptions,
        body: requestBody,
        headers,
        credentials: 'include', // 쿠키 포함 (Refresh Token)
        signal: controller?.signal,
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      return response;
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // 타임아웃 또는 네트워크 에러
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      throw error;
    }
  };

  try {
    let response: Response;
    let lastError: Error | null = null;

    // 재시도 로직
    for (let attempt = 1; attempt <= (retry ? API_CONSTANTS.MAX_RETRIES : 1); attempt++) {
      try {
        response = await executeRequest(attempt);
        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // 마지막 시도가 아니면 재시도
        if (attempt < (retry ? API_CONSTANTS.MAX_RETRIES : 1)) {
          await new Promise(resolve => 
            setTimeout(resolve, API_CONSTANTS.RETRY_DELAY * attempt)
          );
          continue;
        }
        
        throw lastError;
      }
    }

    if (!response!) {
      throw lastError || new Error('No response received');
    }

    // 성능 측정 종료
    let duration = 0;
    if (startTime > 0 && typeof window !== 'undefined' && typeof performance !== 'undefined') {
      duration = performance.now() - startTime;
      trackPerformanceMetric(
        `api_${method.toLowerCase()}_${endpoint.replace(/\//g, '_')}`,
        duration
      );
    }

    // 디버그 로그 (CORS 헤더 확인 포함)
    if (process.env.NODE_ENV === 'development') {
      const corsHeaders = {
        'access-control-allow-credentials': response.headers.get('access-control-allow-credentials'),
        'access-control-allow-headers': response.headers.get('access-control-allow-headers'),
        'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
        'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
      };
      console.log('[API Response]', {
        url,
        method,
        status: response.status,
        duration: duration > 0 ? `${duration.toFixed(2)}ms` : 'N/A',
        corsHeaders,
      });
    }

    // 응답 처리
    return await handleResponse<T>(response, endpoint, url, method);
  } catch (error) {
    // 네트워크 에러 처리
    const apiError: APIError = error instanceof Error
      ? error
      : new Error(String(error));

    trackAPIError(endpoint, 0, apiError, {
      action: 'network_error',
      component: 'api_client',
    });

    throw apiError;
  }
}

/**
 * 응답 처리
 */
async function handleResponse<T>(
  response: Response,
  endpoint: string,
  url: string,
  method: string
): Promise<T> {
  // 404 처리
  if (response.status === 404) {
    const error: APIError = new Error('Not Found');
    error.status = 404;
    throw error;
  }

  // 401 처리 - 토큰 갱신 시도
  if (response.status === 401) {
    // 토큰 갱신 시도
    try {
      const newAccessToken = await tokenManager.getAccessToken();
      
      if (newAccessToken) {
        // 새 토큰으로 재시도
        const retryHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newAccessToken}`,
        };

        // CSRF 토큰은 POST, PUT, DELETE에만 필요
        // method는 handleResponse 함수의 파라미터에서 가져옴
        const needsCSRF = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
        const csrfToken = tokenManager.getCSRFToken();
        if (csrfToken && needsCSRF) {
          retryHeaders['X-CSRF-Token'] = csrfToken;
        }

        const retryResponse = await fetch(url, {
          method,
          headers: retryHeaders,
          credentials: 'include',
        });

        if (retryResponse.ok) {
          return await parseResponse<T>(retryResponse, endpoint);
        }
      }
    } catch (refreshError) {
      // 토큰 갱신 실패
      console.warn('[apiRequest] Token refresh failed:', refreshError);
    }

    // 토큰 갱신 실패 또는 재시도 실패
    const error: APIError = new Error('Authentication required');
    error.status = 401;
    
    trackAPIError(endpoint, 401, error, {
      action: 'api_request',
      component: 'api_client',
    });

    throw error;
  }

  // 403 처리
  if (response.status === 403) {
    const errorData = await response.json().catch(() => ({ message: 'Forbidden' }));
    const error: APIError = new Error(errorData.message || 'Forbidden');
    error.status = 403;
    
    trackAPIError(endpoint, 403, error, {
      action: 'api_request',
      component: 'api_client',
    });

    throw error;
  }

  // 기타 에러 처리
  if (!response.ok) {
    const errorData = await parseErrorResponse(response);
    const error: APIError = new Error(
      errorData.message || errorData.error || `HTTP error! status: ${response.status}`
    );
    error.status = response.status;
    error.response = response;
    error.data = errorData;

    trackAPIError(endpoint, response.status, error, {
      action: 'api_request',
      component: 'api_client',
      errorMessage: errorData.message || errorData.error,
    });

    throw error;
  }

  // 성공 응답 처리
  return await parseResponse<T>(response, endpoint);
}

/**
 * 에러 응답 파싱
 */
async function parseErrorResponse(response: Response): Promise<any> {
  try {
    const text = await response.text();
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        return { message: text || response.statusText || 'Unknown error' };
      }
    }
  } catch {
    // 파싱 실패
  }
  
  return { message: response.statusText || 'Unknown error' };
}

/**
 * 성공 응답 파싱
 */
async function parseResponse<T>(response: Response, endpoint: string): Promise<T> {
  // 상세 로깅 (항상 출력)
  const contentLength = response.headers.get('content-length');
  console.log('[parseResponse] Response details:', {
    status: response.status,
    statusText: response.statusText,
    contentLength,
    contentType: response.headers.get('content-type'),
    endpoint,
  });
  
  // 204 No Content
  if (response.status === 204 || contentLength === '0') {
    console.log('[parseResponse] 204 No Content or content-length=0, returning empty object');
    return {} as T;
  }

  // JSON 파싱
  const text = await response.text();
  
  console.log('[parseResponse] Response text:', {
    hasText: !!text,
    textLength: text?.length || 0,
    textPreview: text ? text.substring(0, 300) : 'empty',
    endpoint,
  });
  
  if (!text || text.trim() === '') {
    console.warn('[parseResponse] Empty response body, returning empty object');
    return {} as T;
  }

  try {
    const parsed = JSON.parse(text) as T;
    console.log('[parseResponse] Parsed response:', {
      hasData: !!parsed,
      keys: parsed ? Object.keys(parsed) : [],
      dataPreview: parsed ? JSON.stringify(parsed).substring(0, 300) : 'empty',
      endpoint,
    });
    return parsed;
  } catch (err) {
    console.error('[parseResponse] JSON parse error:', err, {
      text: text.substring(0, 300),
      endpoint,
    });
    const parseError: APIError = new Error('Failed to parse server response');
    parseError.status = response.status;
    
    trackAPIError(endpoint, response.status, parseError, {
      action: 'parse_response',
      component: 'api_client',
      responseText: text.substring(0, 100),
    });

    throw parseError;
  }
}

