/**
 * ✅ P1-Next-Fix-Module-2A: 브라우저 전용 API Client 엔트리포인트
 * 
 * 'use client' 지시어로 Next.js가 이 파일을 클라이언트 전용으로 보장
 * SSR/node 환경에서는 import 자체가 안 되므로 사이드이펙트 제거
 * 
 * ⚠️ 중요: core(node) 테스트는 이 파일을 절대 import하면 안 됨
 */

'use client';

// ✅ P1-Next-Fix-Module-4E: createApiClient는 apiClient.ts에서 import
import { createApiClient } from './apiClient';
// ✅ P1-Next-Fix-Module-2B: tokenManager는 별도 client 엔트리에서 import
import { tokenManager } from '../tokenManager.client';
// ✅ P1-Next-Fix-Module-2C: authAPI는 factory로 생성
import { createAuthAPI } from './auth';

const api = createApiClient({
  tokenManager,
});

// 브라우저 전용 기본 인스턴스 export
export const apiRequest = api.apiRequest;
export { tokenManager };

// ✅ P1-Next-Fix-Module-4E: fetch를 lazy proxy로 처리 (import-time throw 제거)
// import 시점에 throw하지 않고, 실제 호출 시점에만 검증
function getFetch(): typeof fetch {
  const f =
    (typeof globalThis !== 'undefined' && (globalThis as { fetch?: typeof fetch }).fetch) ||
    (typeof window !== 'undefined' && (window as { fetch?: typeof fetch }).fetch) ||
    undefined;

  if (!f) {
    throw new Error('fetch is required but not available');
  }
  return f.bind(globalThis || window);
}

// ✅ P1-Next-Fix-Module-4E: fetch proxy (호출 시점에만 getFetch() 실행)
// any 타입 제거, unknown으로 안전하게 처리
const fetchProxy: typeof fetch = ((input: unknown, init?: unknown) => {
  return getFetch()(input as RequestInfo | URL, init as RequestInit | undefined);
}) as typeof fetch;

// ✅ P1-Next-Fix-Module-2C: authAPI를 DI로 생성
export const authAPI = createAuthAPI({
  tokenManager,
  apiRequest,
  fetch: fetchProxy,
});

// 하위 호환성 함수들도 함께 export
export {
  getUserRole,
  isApproved,
  isAdmin,
  setToken,
  removeToken,
  setTokens,
} from './clientHelpers';

// ✅ P1-Next-Fix-Module-4E: 브라우저 전용 API 모듈들은 client.ts에서만 export
// clientApi.ts는 하위 호환성을 위해 유지하되, 실제 싱글톤은 client.ts에서 제공
