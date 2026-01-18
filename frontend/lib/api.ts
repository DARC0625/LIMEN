/**
 * API 클라이언트 통합 진입점 (하위 호환성)
 * 
 * 이 파일은 하위 호환성을 위해 유지되며,
 * 내부적으로는 lib/api/ 디렉토리의 새로운 구조를 사용합니다.
 * 
 * ⚠️ 중요: 브라우저 전용 싱글톤(authAPI, apiRequest, tokenManager)은 clientApi.ts에서만 제공됩니다.
 * 
 * @deprecated 새로운 코드는 lib/api/index.ts에서 직접 import하세요.
 */

// ✅ P1-Next-Fix-Module-2A: core 모듈만 re-export (clientApi 제외)
export * from './api/index';

// ✅ P1-Next-Fix-Module-2F: clientApi re-export 완전 제거
// 브라우저 전용 싱글톤(authAPI, apiRequest, tokenManager)은 lib/api/clientApi.ts에서만 제공
// 앱에서는 직접 import: import { apiRequest } from 'lib/api/clientApi'

// 하위 호환성을 위한 타입 export
export type {
  VM,
  VMSnapshot,
  VMStats,
  VMMedia,
  ISO,
  ISOList,
  QuotaUsage,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  User,
  UserWithStats,
  CreateUserRequest,
  UpdateUserRequest,
} from './types';
