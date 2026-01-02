/**
 * API 클라이언트 통합 진입점 (하위 호환성)
 * 
 * 이 파일은 하위 호환성을 위해 유지되며,
 * 내부적으로는 lib/api/ 디렉토리의 새로운 구조를 사용합니다.
 * 
 * @deprecated 새로운 코드는 lib/api/index.ts에서 직접 import하세요.
 */

// 새로운 구조에서 모든 것을 re-export
export * from './api/index';

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
