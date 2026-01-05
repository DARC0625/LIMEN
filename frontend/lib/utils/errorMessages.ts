/**
 * 사용자 친화적인 오류 메시지 표준화
 * 모든 주요 오류 케이스에 대한 안내 문구 제공
 */

export interface ErrorMessage {
  title: string;
  message: string;
  action?: string;
  actionUrl?: string;
}

/**
 * 오류 타입별 메시지 맵핑
 */
export const ERROR_MESSAGES: Record<string, ErrorMessage> = {
  // 초대 권한 없음
  'NOT_APPROVED': {
    title: '초대 대기 중',
    message: '현재 초대 대기 상태입니다. 관리자 검토 후 초대 안내를 이메일로 보내드리겠습니다.',
    action: '대기 상태 확인',
    actionUrl: '/waiting',
  },
  'NOT_INVITED': {
    title: '초대 권한 없음',
    message: '서비스 이용을 위해서는 초대가 필요합니다. 대기자 등록을 먼저 진행해주세요.',
    action: '대기자 등록',
    actionUrl: '/',
  },

  // VM 개수/사양 제한 초과 (쿼터 초과)
  'QUOTA_EXCEEDED_VMS': {
    title: 'VM 개수 제한 초과',
    message: '시스템 전체 VM 개수 제한에 도달했습니다. 다른 VM을 종료한 후 다시 시도해주세요.',
    action: 'VM 목록 확인',
    actionUrl: '/dashboard',
  },
  'QUOTA_EXCEEDED_CPU': {
    title: 'CPU 할당량 초과',
    message: '시스템 전체 CPU 할당량을 초과했습니다. 실행 중인 VM의 CPU를 줄이거나 종료한 후 다시 시도해주세요.',
    action: 'VM 목록 확인',
    actionUrl: '/dashboard',
  },
  'QUOTA_EXCEEDED_MEMORY': {
    title: '메모리 할당량 초과',
    message: '시스템 전체 메모리 할당량을 초과했습니다. 실행 중인 VM의 메모리를 줄이거나 종료한 후 다시 시도해주세요.',
    action: 'VM 목록 확인',
    actionUrl: '/dashboard',
  },

  // 세션 만료/유휴 종료
  'SESSION_EXPIRED': {
    title: '세션 만료',
    message: '세션이 만료되었습니다. 다시 로그인해주세요.',
    action: '로그인',
    actionUrl: '/login',
  },
  'SESSION_IDLE_TIMEOUT': {
    title: '유휴 시간 초과',
    message: '10분간 활동이 없어 세션이 자동으로 종료되었습니다. 다시 로그인해주세요.',
    action: '로그인',
    actionUrl: '/login',
  },
  'SESSION_MAX_TIME': {
    title: '최대 사용 시간 초과',
    message: '최대 사용 시간을 초과했습니다. 잠시 후 다시 시도해주세요.',
    action: '대시보드로 이동',
    actionUrl: '/dashboard',
  },

  // 동시 접속 제한
  'CONCURRENT_SESSION_LIMIT': {
    title: '동시 접속 제한',
    message: '동시 접속 가능한 세션 수를 초과했습니다. 다른 세션을 종료한 후 다시 시도해주세요.',
    action: '세션 관리',
    actionUrl: '/dashboard',
  },

  // 서버 과부하/일시 장애
  'SERVER_OVERLOAD': {
    title: '서버 과부하',
    message: '현재 서버가 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
    action: '재시도',
  },
  'SERVICE_UNAVAILABLE': {
    title: '서비스 일시 중단',
    message: '서비스가 일시적으로 중단되었습니다. 잠시 후 다시 시도해주세요.',
    action: '서비스 상태 확인',
    actionUrl: '/status',
  },
  'NETWORK_ERROR': {
    title: '네트워크 오류',
    message: '네트워크 연결에 문제가 발생했습니다. 인터넷 연결을 확인한 후 다시 시도해주세요.',
    action: '재시도',
  },

  // 인증 오류
  'UNAUTHORIZED': {
    title: '인증 필요',
    message: '로그인이 필요합니다.',
    action: '로그인',
    actionUrl: '/login',
  },
  'FORBIDDEN': {
    title: '권한 없음',
    message: '이 작업을 수행할 권한이 없습니다.',
    action: '대시보드로 이동',
    actionUrl: '/dashboard',
  },
  'ACCOUNT_LOCKED': {
    title: '계정 잠금',
    message: '너무 많은 로그인 시도로 계정이 일시적으로 잠금되었습니다. 잠시 후 다시 시도해주세요.',
    action: '재시도',
  },

  // 기본 오류
  'UNKNOWN_ERROR': {
    title: '오류 발생',
    message: '예기치 않은 오류가 발생했습니다. 문제가 지속되면 문의해주세요.',
    action: '문의하기',
    actionUrl: 'mailto:support@limen.example.com',
  },
};

/**
 * 오류 코드로부터 사용자 친화적인 메시지 가져오기
 */
export function getErrorMessage(errorCode: string, customMessage?: string): ErrorMessage {
  const errorMessage = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES['UNKNOWN_ERROR'];
  
  if (customMessage) {
    return {
      ...errorMessage,
      message: customMessage,
    };
  }
  
  return errorMessage;
}

/**
 * 백엔드 오류 응답으로부터 오류 코드 추출
 */
export function extractErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as { code?: string; message?: string; error?: string };
    
    // 백엔드에서 제공하는 오류 코드
    if (errorObj.code) {
      return errorObj.code;
    }
    
    // 메시지에서 오류 코드 추출 시도
    if (errorObj.message) {
      const message = errorObj.message.toUpperCase();
      
      // 쿼터 관련
      if (message.includes('QUOTA') || message.includes('할당량')) {
        if (message.includes('VM') || message.includes('개수')) {
          return 'QUOTA_EXCEEDED_VMS';
        }
        if (message.includes('CPU')) {
          return 'QUOTA_EXCEEDED_CPU';
        }
        if (message.includes('MEMORY') || message.includes('메모리')) {
          return 'QUOTA_EXCEEDED_MEMORY';
        }
        return 'QUOTA_EXCEEDED_VMS';
      }
      
      // 세션 관련
      if (message.includes('SESSION') || message.includes('세션')) {
        if (message.includes('IDLE') || message.includes('유휴')) {
          return 'SESSION_IDLE_TIMEOUT';
        }
        if (message.includes('EXPIRED') || message.includes('만료')) {
          return 'SESSION_EXPIRED';
        }
        return 'SESSION_EXPIRED';
      }
      
      // 인증 관련
      if (message.includes('UNAUTHORIZED') || message.includes('인증')) {
        return 'UNAUTHORIZED';
      }
      if (message.includes('FORBIDDEN') || message.includes('권한')) {
        return 'FORBIDDEN';
      }
      if (message.includes('LOCKED') || message.includes('잠금')) {
        return 'ACCOUNT_LOCKED';
      }
    }
  }
  
  return 'UNKNOWN_ERROR';
}

/**
 * 오류 메시지 컴포넌트용 Props
 */
export interface ErrorDisplayProps {
  error: unknown;
  onAction?: () => void;
}



