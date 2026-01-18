/**
 * ✅ P1-Next-Fix-Module-2A: API 클라이언트 통합 진입점 (순수 core 모듈)
 * 
 * 이 파일은 core(node)에서도 안전하게 import 가능한 순수 모듈만 export합니다.
 * 브라우저 전용 싱글톤(apiRequest, tokenManager)은 clientApi.ts에서만 제공됩니다.
 */

// ✅ Factory 함수들 (core에서 사용 가능)
export { createApiClient, type ApiClientDeps } from './apiClient';

// ✅ 비즈니스 로직 모듈들 (Factory 패턴만 export)
export { createAuthAPI, type AuthAPIDeps } from './auth';

// ✅ P1-Next-Fix-Module-3B: Factory 패턴으로 전환된 API 모듈들 export
export { createAdminAPI, type AdminAPIDeps } from './admin';
export { createQuotaAPI, type QuotaAPIDeps } from './quota';
export { createSnapshotAPI, type SnapshotAPIDeps } from './snapshot';
export { createVMAPI, type VMAPIDeps } from './vm';

// ✅ 타입 재export
export type * from '../types';

