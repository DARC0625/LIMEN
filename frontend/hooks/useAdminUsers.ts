// Admin 사용자 관리 훅 (React Query)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { startTransition } from 'react';
import { adminAPI } from '../lib/api';
import type { UserWithStats, User, VM, CreateUserRequest, UpdateUserRequest } from '../lib/types';
import { useToast } from '../components/ToastContainer';

/**
 * 사용자 목록 조회 훅 (Admin 전용)
 */
export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const data = await adminAPI.listUsers();
      // 역할별 정렬: admin 먼저, 그 다음 username 순
      return [...data].sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return a.username.localeCompare(b.username);
      });
    },
    staleTime: 30000, // 30초간 캐시 유지
    refetchInterval: 60000, // 60초마다 자동 재요청
  });
}

/**
 * 사용자 상세 조회 훅 (VM 목록 포함)
 */
export function useAdminUser(userId: number | null) {
  return useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => adminAPI.getUser(userId!),
    enabled: !!userId, // userId가 있을 때만 실행
    staleTime: 30000,
  });
}

/**
 * 사용자 생성 Mutation
 */
export function useCreateUser() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: CreateUserRequest) => adminAPI.createUser(data),
    onSuccess: () => {
      // React Error #321 완전 해결: queueMicrotask로 비동기 처리
      queueMicrotask(() => {
        startTransition(() => {
          queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        });
      });
      queueMicrotask(() => {
        toast.success('User created successfully');
      });
    },
    onError: (error: any) => {
      toast.error(`Failed to create user: ${error.message}`);
    },
  });
}

/**
 * 사용자 수정 Mutation
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserRequest }) =>
      adminAPI.updateUser(id, data),
    onSuccess: (updatedUser, variables) => {
      // React Error #321 완전 해결: queueMicrotask로 비동기 처리
      queueMicrotask(() => {
        startTransition(() => {
          // 사용자 목록 캐시 업데이트
          queryClient.setQueryData<UserWithStats[]>(['admin', 'users'], (old) => {
            if (!old) return [];
            return old.map(user => 
              user.id === variables.id 
                ? { ...user, ...updatedUser } as UserWithStats
                : user
            );
          });
          // 사용자 상세 캐시 무효화
          queryClient.invalidateQueries({ queryKey: ['admin', 'users', variables.id] });
        });
      });
      queueMicrotask(() => {
        toast.success('User updated successfully');
      });
    },
    onError: (error: any) => {
      toast.error(`Failed to update user: ${error.message}`);
    },
  });
}

/**
 * 사용자 삭제 Mutation
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (userId: number) => adminAPI.deleteUser(userId),
    onSuccess: (_, userId) => {
      // React Error #321 완전 해결: queueMicrotask로 비동기 처리
      queueMicrotask(() => {
        startTransition(() => {
          // 사용자 목록에서 제거 (Optimistic update)
          queryClient.setQueryData<UserWithStats[]>(['admin', 'users'], (old) => {
            if (!old) return [];
            return old.filter(user => user.id !== userId);
          });
          // 사용자 상세 캐시 제거
          queryClient.removeQueries({ queryKey: ['admin', 'users', userId] });
        });
      });
      queueMicrotask(() => {
        toast.success('User deleted successfully');
      });
    },
    onError: (error: any) => {
      // React Error #321 완전 해결: queueMicrotask로 비동기 처리
      queueMicrotask(() => {
        startTransition(() => {
          queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        });
      });
      queueMicrotask(() => {
        toast.error(`Failed to delete user: ${error.message}`);
      });
    },
  });
}

/**
 * 사용자 승인 Mutation
 */
export function useApproveUser() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (userId: number) => adminAPI.approveUser(userId),
    onSuccess: (updatedUser, userId) => {
      // React Error #321 완전 해결: queueMicrotask로 비동기 처리
      queueMicrotask(() => {
        startTransition(() => {
          // 사용자 목록 캐시 업데이트
          queryClient.setQueryData<UserWithStats[]>(['admin', 'users'], (old) => {
            if (!old) return [];
            return old.map(user => 
              user.id === userId 
                ? { ...user, approved: updatedUser.approved } as UserWithStats
                : user
            );
          });
        });
      });
      queueMicrotask(() => {
        toast.success('User approved successfully');
      });
    },
    onError: (error: any) => {
      toast.error(`Failed to approve user: ${error.message}`);
    },
  });
}







