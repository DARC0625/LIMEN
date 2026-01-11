/**
 * 상수 정의 통합 파일
 * 모든 상수를 여기에 정의하여 중앙 관리
 */

// ============================================================================
// 인증 관련 상수
// ============================================================================

export const AUTH_CONSTANTS = {
  // 토큰 만료 시간 (초)
  ACCESS_TOKEN_EXPIRY: 900, // 15분
  REFRESH_TOKEN_EXPIRY: 604800, // 7일
  
  // 세션 타임아웃 (밀리초)
  INACTIVE_TIMEOUT_MS: 10 * 60 * 1000, // 10분
  SESSION_CHECK_INTERVAL: 5 * 60 * 1000, // 5분
  
  // 토큰 갱신 여유 시간 (밀리초)
  TOKEN_REFRESH_BUFFER: 60000, // 1분
  
  // Storage 키
  STORAGE_KEYS: {
    REFRESH_TOKEN: 'refresh_token',
    TOKEN_EXPIRES_AT: 'token_expires_at',
    AUTH_TOKEN: 'auth_token', // 하위 호환성
    AUTH_TOKEN_TIMESTAMP: 'auth_token_timestamp', // 하위 호환성
    CSRF_TOKEN: 'csrf_token',
    SESSION_ID: 'session_id',
  },
} as const;

// ============================================================================
// API 관련 상수
// ============================================================================

export const API_CONSTANTS = {
  // 기본 타임아웃 (밀리초)
  DEFAULT_TIMEOUT: 30000, // 30초
  
  // 재시도 설정
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1초
  
  // Rate Limiting
  RATE_LIMIT: {
    LOGIN: 5, // 분당 5회
    REFRESH: 10, // 분당 10회
    API: 60, // 분당 60회
  },
} as const;

// ============================================================================
// React Query 관련 상수
// ============================================================================

export const QUERY_CONSTANTS = {
  // 캐시 시간
  STALE_TIME: 2000, // 2초
  GC_TIME: 10 * 60 * 1000, // 10분
  
  // 리페치 간격
  REFETCH_INTERVAL: 5000, // 5초
  
  // 재시도
  RETRY: false,
  RETRY_DELAY: 0,
} as const;

// ============================================================================
// 공개 경로
// ============================================================================

export const PUBLIC_PATHS = ['/login', '/register'] as const;

// ============================================================================
// 활동 감지 이벤트
// ============================================================================

export const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keypress',
  'scroll',
  'touchstart',
  'click',
] as const;




