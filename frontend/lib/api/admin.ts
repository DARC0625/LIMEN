/**
 * Admin API 클라이언트 (Factory 패턴)
 * ✅ P1-Next-Fix-Module-3B: core 모듈은 DI로만 동작
 */

import type {
  User,
  UserWithStats,
  CreateUserRequest,
  UpdateUserRequest,
  VM,
} from '../types';

export type ApiRequestFn = <T>(endpoint: string, options?: RequestInit & { skipAuth?: boolean; retry?: boolean; timeout?: number }) => Promise<T>;

export interface AdminAPIDeps {
  apiRequest: ApiRequestFn;
}

export function createAdminAPI(deps: AdminAPIDeps) {
  const { apiRequest } = deps;

  return {
    /**
     * 사용자 목록 조회
     */
    listUsers: async (): Promise<UserWithStats[]> => {
      return apiRequest<UserWithStats[]>('/admin/users');
    },

    /**
     * 사용자 상세 조회
     */
    getUser: async (id: number): Promise<User & { vms: VM[] }> => {
      return apiRequest<User & { vms: VM[] }>(`/admin/users/${id}`);
    },

    /**
     * 사용자 생성
     */
    createUser: async (data: CreateUserRequest): Promise<User> => {
      return apiRequest<User>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    /**
     * 사용자 업데이트
     */
    updateUser: async (id: number, data: UpdateUserRequest): Promise<User> => {
      return apiRequest<User>(`/admin/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    /**
     * 사용자 삭제
     */
    deleteUser: async (id: number): Promise<void> => {
      return apiRequest<void>(`/admin/users/${id}`, {
        method: 'DELETE',
      });
    },

    /**
     * 사용자 역할 업데이트
     */
    updateUserRole: async (id: number, role: string): Promise<User> => {
      return apiRequest<User>(`/admin/users/${id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
    },

    /**
     * 사용자 승인
     */
    approveUser: async (id: number): Promise<User> => {
      return apiRequest<User>(`/admin/users/${id}/approve`, {
        method: 'PUT',
      });
    },
  };
}
