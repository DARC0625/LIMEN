// 보안 관련 유틸리티 함수들
// 비정상 접근 감지 및 자동 로그아웃 기능

// 세션 하이재킹 방지를 위한 브라우저 핑거프린트
export function getBrowserFingerprint(): string {
  if (typeof window === 'undefined') return '';
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
  ].join('|');
  
  // 간단한 해시 생성
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit 정수로 변환
  }
  return Math.abs(hash).toString(36);
}

// 토큰 무결성 검증 (더 관대하게)
export function validateTokenIntegrity(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Token Validation] Invalid JWT format: not 3 parts');
      }
      return false;
    }
    
    // JWT 형식 검증
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // 기본 JWT 구조만 확인 (exp는 선택적, id도 선택적)
    if (!header || typeof header !== 'object') {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Token Validation] Invalid header');
      }
      return false;
    }
    
    if (!payload || typeof payload !== 'object') {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Token Validation] Invalid payload');
      }
      return false;
    }
    
    // exp가 있으면 숫자여야 함
    if (payload.exp && typeof payload.exp !== 'number') {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Token Validation] Invalid exp type');
      }
      return false;
    }
    
    return true;
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Token Validation] Parse error:', e);
    }
    return false;
  }
}

// 비정상 활동 감지 및 로깅 (차단 없음, 패시브 모니터링만)
export function forceLogout(reason: string = '보안상의 이유로 로그아웃되었습니다.'): void {
  if (typeof window === 'undefined') return;
  
  // 차단하지 않고 로깅만 수행
  console.warn('[Security Log] Logout event detected:', {
    reason,
    pathname: window.location.pathname,
    timestamp: new Date().toISOString(),
    hasToken: !!localStorage.getItem('auth_token'),
  });
  
  // 토큰이 만료되었거나 유효하지 않은 경우에만 토큰 제거 (정상적인 로그아웃)
  // 강제 리다이렉트는 하지 않음 - 사용자가 정상적으로 로그인 페이지로 이동할 수 있도록 함
  if (reason.includes('만료') || reason.includes('expired') || reason.includes('invalid')) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_token_timestamp');
  }
  
  // 다른 탭에 알림만 전송 (차단하지 않음)
  try {
    const channel = new BroadcastChannel('auth_channel');
    channel.postMessage({ type: 'AUTH_EVENT', reason, action: 'log' });
    channel.close();
  } catch (e) {
    // BroadcastChannel을 지원하지 않는 경우 무시
  }
}

// 세션 ID 생성 (탭별 고유 ID)
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let sessionId = sessionStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('session_id', sessionId);
  }
  return sessionId;
}

// 요청 빈도 제한 체크: 비활성화 (기본 보안만 유지)
const requestTimestamps: number[] = [];
// const MAX_REQUESTS_PER_MINUTE = 60; // 비활성화

export function checkRequestRateLimit(): boolean {
  // 요청 빈도 제한 비활성화 - 항상 허용
  return true;
  
  // 기존 코드 (비활성화)
  // const now = Date.now();
  // const oneMinuteAgo = now - 60000;
  // while (requestTimestamps.length > 0 && requestTimestamps[0] < oneMinuteAgo) {
  //   requestTimestamps.shift();
  // }
  // if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
  //   return false;
  // }
  // requestTimestamps.push(now);
  // return true;
}

// 비정상 활동 감지 - 패시브 모니터링만 (차단 없음)
export function detectAbnormalActivity(): {
  isAbnormal: boolean;
  reason?: string;
} {
  if (typeof window === 'undefined') {
    return { isAbnormal: false };
  }
  
  // 패시브 모니터링: 로깅만 수행, 차단하지 않음
  const token = localStorage.getItem('auth_token');
  if (token && !validateTokenIntegrity(token)) {
    // 차단하지 않고 로깅만
    console.warn('[Security Log] Token integrity check failed (passive monitoring):', {
      timestamp: new Date().toISOString(),
      pathname: window.location.pathname,
    });
    // 차단하지 않음 - 항상 false 반환
    return { isAbnormal: false };
  }
  
  // 모든 검증 비활성화 - 차단 없음
  // - 브라우저 핑거프린트 검증: 비활성화 (다중 기기 접근 허용)
  // - 요청 빈도 제한: 비활성화 (정상 사용 허용)
  
  return { isAbnormal: false };
}

// 차단된 계정 확인 및 해제 (패시브 모니터링)
export function checkAndUnblockAccount(): void {
  if (typeof window === 'undefined') return;
  
  // 차단 관련 플래그 확인 및 제거
  const blockedFlags = [
    'account_blocked',
    'user_blocked',
    'admin_blocked',
    'security_block',
    'rate_limit_blocked',
    'fingerprint_blocked',
  ];
  
  let hasBlockedFlag = false;
  blockedFlags.forEach(flag => {
    if (localStorage.getItem(flag)) {
      console.warn('[Security Log] Removing block flag (passive monitoring):', flag);
      localStorage.removeItem(flag);
      hasBlockedFlag = true;
    }
  });
  
  // 세션 스토리지의 차단 플래그도 제거
  if (sessionStorage.getItem('logout_redirect')) {
    console.warn('[Security Log] Removing logout redirect flag (passive monitoring)');
    sessionStorage.removeItem('logout_redirect');
    hasBlockedFlag = true;
  }
  
  if (hasBlockedFlag) {
    console.warn('[Security Log] Account unblocked (passive monitoring):', {
      timestamp: new Date().toISOString(),
    });
  }
}

// 세션 초기화 (로그인 시 호출)
export function initializeSession(token: string): void {
  if (typeof window === 'undefined') return;
  
  // 차단 플래그 제거 (로그인 시 자동 해제)
  checkAndUnblockAccount();
  
  // 브라우저 핑거프린트 저장 (다중 기기 접근 허용)
  // 각 기기마다 고유한 핑거프린트를 저장하되, 다른 기기 접근을 차단하지 않음
  const currentFingerprint = getBrowserFingerprint();
  localStorage.setItem('browser_fingerprint', currentFingerprint);
  
  // 세션 ID 생성 및 저장 (다중 기기 접근 추적용)
  const sessionId = getSessionId();
  localStorage.setItem('last_session_id', sessionId);
  
  // 요청 타임스탬프 초기화
  requestTimestamps.length = 0;
}
