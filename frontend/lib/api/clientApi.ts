/**
 * ✅ P1-Next-Fix-Module-2A: 브라우저 전용 API Client 엔트리포인트
 * 
 * 'use client' 지시어로 Next.js가 이 파일을 클라이언트 전용으로 보장
 * SSR/node 환경에서는 import 자체가 안 되므로 사이드이펙트 제거
 * 
 * ⚠️ 중요: core(node) 테스트는 이 파일을 절대 import하면 안 됨
 */

'use client';

import { createApiClient } from './client';
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

// ✅ P1-Next-Fix-Module-4C: fetch를 lazy proxy로 처리 (import-time throw 제거)
// import 시점에 throw하지 않고, 실제 호출 시점에만 검증
function getFetch(): typeof fetch {
  const f =
    (typeof globalThis !== 'undefined' && (globalThis as any).fetch) ||
    (typeof window !== 'undefined' && (window as any).fetch) ||
    undefined;

  if (!f) {
    throw new Error('fetch is required but not available');
  }
  return f.bind(globalThis || window);
}

// ✅ P1-Next-Fix-Module-4C: fetch proxy (호출 시점에만 getFetch() 실행)
const fetchProxy: typeof fetch = ((input: any, init?: any) => {
  return getFetch()(input, init);
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

// ✅ P1-Next-Fix-Module-2F: 브라우저 전용 API 모듈들 export
// 이들은 내부적으로 clientApi를 import하므로 브라우저에서만 사용 가능
export { vmAPI } from './vm';
export { snapshotAPI } from './snapshot';
export { quotaAPI } from './quota';
export { adminAPI } from './admin';
