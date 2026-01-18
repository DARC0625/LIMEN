/**
 * ✅ P1-Next-Fix-Module-2A: API 클라이언트 통합 진입점 (순수 core 모듈)
 * 
 * 이 파일은 core(node)에서도 안전하게 import 가능한 순수 모듈만 export합니다.
 * 브라우저 전용 싱글톤(apiRequest, tokenManager)은 clientApi.ts에서만 제공됩니다.
 */

// ✅ Factory 함수들 (core에서 사용 가능)
export { createApiClient, type ApiClientDeps } from './client';

// ✅ 비즈니스 로직 모듈들 (Factory 패턴만 export)
export { createAuthAPI, type AuthAPIDeps } from './auth';

// ✅ P1-Next-Fix-Module-2F: 브라우저 전용 API 모듈 export 제거
// vmAPI, snapshotAPI, quotaAPI, adminAPI는 내부적으로 clientApi를 import하므로
// 브라우저 전용입니다. 이들은 lib/api/clientApi.ts에서만 export됩니다.
// core 테스트에서는 이들을 import하지 않아야 하며, 필요시 Factory 패턴으로 전환해야 합니다.

// ✅ 타입 재export
export type * from '../types';

