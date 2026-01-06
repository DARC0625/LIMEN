// Admin 사용자 관리 훅 (React Query)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { startTransition } from 'react';
import { adminAPI } from '../lib/api';
import type { UserWithStats, User, VM, CreateUserRequest, UpdateUserRequest } from '../lib/types';
import { useToast } from '../components/ToastContainer';
import { getErrorMessage } from '../lib/types/errors';
import { useAuth } from '../components/AuthGuard';
import { useMounted } from './useMounted';
import { handleAuthError } from '../lib/utils/errorHelpers';

/**
 * 사용자 목록 조회 훅 (Admin 전용)
 */
export function useAdminUsers() {
  // hooks는 항상 같은 순서로 호출되어야 함
  const { isAuthenticated } = useAuth();
  const mounted = useMounted();
  
  // React Error #310 해결: 최소한의 조건만 확인
  const enabled = mounted && isAuthenticated === true;
  
  // useQuery는 항상 호출되어야 함 (조건부 호출 금지)
  // React Error #310 해결: useQuery는 항상 같은 순서로 호출
  // enabled가 false일 때는 queryFn이 실행되지 않으므로 안전
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      try {
        const data = await adminAPI.listUsers();
        // 역할별 정렬: admin 먼저, 그 다음 username 순
        return [...data].sort((a, b) => {
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (a.role !== 'admin' && b.role === 'admin') return 1;
          return a.username.localeCompare(b.username);
        });
      } catch (error: unknown) {
        // 401/403 에러 처리
        handleAuthError(error);
        throw error;
      }
    },
    enabled: enabled,
    staleTime: 2 * 60 * 1000, // 2분간 캐시 유지
    // 트리거 방식: Mutation 성공 시 invalidateQueries로 갱신
    // 최후의 수단으로만 폴링 (5분마다) - 백그라운드 동기화용
    refetchInterval: enabled ? 5 * 60 * 1000 : false, // 5분마다 (최후의 수단)
    refetchOnWindowFocus: enabled, // enabled일 때만 refetch
    refetchOnReconnect: enabled, // enabled일 때만 refetch
    refetchOnMount: enabled, // enabled일 때만 refetch
    throwOnError: false,
  });
}

/**
 * 사용자 상세 조회 훅 (VM 목록 포함)
 */
export function useAdminUser(userId: number | null) {
  // React Error #310 해결: useAuth와 useMounted를 항상 호출하여 hooks 순서 일관성 유지
  const { isAuthenticated } = useAuth();
  const mounted = useMounted();
  
  // enabled 조건: mounted, authenticated, userId가 모두 있어야 함
  const enabled = mounted && isAuthenticated === true && !!userId;
  
  return useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => adminAPI.getUser(userId!),
    enabled: enabled,
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
    onError: (error: unknown) => {
      toast.error(`Failed to create user: ${getErrorMessage(error)}`);
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
    onError: (error: unknown) => {
      toast.error(`Failed to update user: ${getErrorMessage(error)}`);
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
    onError: (error: unknown) => {
      // React Error #321 완전 해결: queueMicrotask로 비동기 처리
      queueMicrotask(() => {
        startTransition(() => {
          queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        });
      });
      queueMicrotask(() => {
        toast.error(`Failed to delete user: ${getErrorMessage(error)}`);
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
    onError: (error: unknown) => {
      toast.error(`Failed to approve user: ${getErrorMessage(error)}`);
    },
  });
}







