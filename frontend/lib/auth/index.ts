/**
 * 인증 관련 로직 통합
 * ✅ P1-2: Factory 패턴으로 전환, 기본 deps로 createAuth 호출
 */

import { tokenManager } from '../tokenManager';
import { authAPI } from '../api/auth';
import { createBrowserClockPort } from '../adapters/browserClockPort';
import { createAuth, type AuthCheckResult, type CheckAuthOptions } from './createAuth';

// ✅ P1-2: 기본 deps로 auth 인스턴스 생성
const defaultDeps = {
  tokenManager,
  authAPI: {
    checkSession: async () => {
      // authAPI.checkSession 사용
      try {
        const data = await authAPI.checkSession();
        return {
          ok: true,
          status: 200,
          data,
        };
      } catch (error: any) {
        // 에러 처리
        return {
          ok: false,
          status: error?.status || 500,
          data: { valid: false, reason: error?.message || '세션 확인 실패' },
        };
      }
    },
    deleteSession: authAPI.deleteSession,
  },
  clock: createBrowserClockPort(),
  fetch: typeof fetch !== 'undefined' ? fetch : undefined,
};

const auth = createAuth(defaultDeps);

// ✅ P1-2: 기존 API 호환성 유지 (export)
export type { AuthCheckResult, CheckAuthOptions };

// ✅ P1-2: 기존 API 호환성 유지 (auth 인스턴스 메서드로 위임)
export async function checkAuth(options?: CheckAuthOptions): Promise<AuthCheckResult> {
  if (typeof window === 'undefined') {
    return { 
      valid: false, 
      reason: '서버 환경에서는 인증을 확인할 수 없습니다.',
      ...(options?.debug ? { debug: { checkLocalStorageTokenCalled: false, checkBackendSessionCalled: false, hasAccessToken: false, hasRefreshToken: false, expiresAt: null, usedCache: false, reasonPath: 'none' } } : {}),
    };
  }
  return auth.checkAuth(options);
}

export async function getUserRole(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  return auth.getUserRole();
}

export async function isUserApproved(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  return auth.isUserApproved();
}

export async function isAdmin(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  return auth.isAdmin();
}

export function logout(): void {
  if (typeof window === 'undefined') return;
  auth.logout();
}

