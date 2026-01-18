/**
 * ✅ P1-Next-Fix-Module-3: 브라우저 전용 API Client 엔트리포인트
 * 
 * 'use client' 지시어로 Next.js가 이 파일을 클라이언트 전용으로 보장
 * SSR/node 환경에서는 import 자체가 안 되므로 사이드이펙트 제거
 * 
 * ⚠️ 중요: core(node) 테스트는 이 파일을 절대 import하면 안 됨
 * 
 * 이 파일은 앱이 기대하는 모든 싱글톤 export를 제공합니다:
 * - tokenManager (브라우저 싱글톤)
 * - apiRequest (브라우저 전용)
 * - authAPI, vmAPI, snapshotAPI, quotaAPI, adminAPI
 * - 편의 함수들: setToken, removeToken, setTokens, isAdmin
 */

'use client';

// ✅ P1-Next-Fix-Module-3B: createApiClient는 core 파일에서 import
import { createApiClient } from './apiClient';
// ✅ P1-Next-Fix-Module-2B: tokenManager는 별도 client 엔트리에서 import
import { tokenManager } from '../tokenManager.client';
// ✅ P1-Next-Fix-Module-2C: authAPI는 factory로 생성
import { createAuthAPI } from './auth';
// ✅ P1-Next-Fix-Module-3B: factory들을 import
import { createAdminAPI } from './admin';
import { createQuotaAPI } from './quota';
import { createSnapshotAPI } from './snapshot';
import { createVMAPI } from './vm';

const api = createApiClient({
  tokenManager,
});

// 브라우저 전용 기본 인스턴스 export
export const apiRequest = api.apiRequest;
export { tokenManager };

// ✅ P1-Next-Fix-Module-4: fetch를 globalThis 기반으로 안전하게 처리
const fetchImpl = (() => {
  if (typeof globalThis !== 'undefined' && globalThis.fetch) {
    return globalThis.fetch.bind(globalThis);
  }
  if (typeof window !== 'undefined' && window.fetch) {
    return window.fetch.bind(window);
  }
  throw new Error('fetch is required but not available');
})();

// ✅ P1-Next-Fix-Module-2C: authAPI를 DI로 생성
export const authAPI = createAuthAPI({
  tokenManager,
  apiRequest,
  fetch: fetchImpl,
});

// ✅ P1-Next-Fix-Module-3B: factory들을 wiring하여 싱글톤 생성
export const adminAPI = createAdminAPI({ apiRequest });
export const quotaAPI = createQuotaAPI({ apiRequest });
export const snapshotAPI = createSnapshotAPI({ apiRequest });
export const vmAPI = createVMAPI({ apiRequest });

// 하위 호환성 함수들도 함께 export
export {
  getUserRole,
  isApproved,
  isAdmin,
  setToken,
  removeToken,
  setTokens,
} from './clientHelpers';
