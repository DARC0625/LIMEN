// Admin 사용자 관리 훅 (React Query)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { startTransition } from 'react';
import { adminAPI } from '../lib/api';
import type { UserWithStats, CreateUserRequest, UpdateUserRequest } from '../lib/types';
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
 * ✅ Optimistic Update: 클릭 즉시 UI 반영 (1 frame 내)
 */
export function useApproveUser() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (userId: number) => adminAPI.approveUser(userId),
    // ✅ onMutate: 네트워크 요청 전에 즉시 캐시 업데이트 (optimistic update)
    onMutate: async (userId) => {
      // 진행 중인 쿼리 취소 (낙관적 업데이트와 충돌 방지)
      await queryClient.cancelQueries({ queryKey: ['admin', 'users'] });
      await queryClient.cancelQueries({ queryKey: ['admin', 'users', userId] });

      // 이전 캐시 스냅샷 저장 (rollback용)
      const previousUsers = queryClient.getQueryData<UserWithStats[]>(['admin', 'users']);
      const previousUser = queryClient.getQueryData<UserWithStats>(['admin', 'users', userId]);

      // ✅ 즉시 캐시 업데이트 (1 frame 내 반영)
      queryClient.setQueryData<UserWithStats[]>(['admin', 'users'], (old) => {
        if (!old) return [];
        return old.map(user => 
          user.id === userId 
            ? { ...user, approved: true } as UserWithStats
            : user
        );
      });

      // 사용자 상세 캐시도 동시 업데이트 (queryKey 정합성)
      queryClient.setQueryData<UserWithStats>(['admin', 'users', userId], (old) => {
        if (!old) return undefined;
        return { ...old, approved: true } as UserWithStats;
      });

      // rollback용 컨텍스트 반환
      return { previousUsers, previousUser };
    },
    // ✅ onError: 이전 캐시로 rollback
    onError: (error: unknown, userId, context) => {
      // 이전 캐시로 복구
      if (context?.previousUsers) {
        queryClient.setQueryData(['admin', 'users'], context.previousUsers);
      }
      if (context?.previousUser) {
        queryClient.setQueryData(['admin', 'users', userId], context.previousUser);
      }
      toast.error(`Failed to approve user: ${getErrorMessage(error)}`);
    },
    // ✅ onSuccess: 서버 응답으로 최종 확인 (이미 optimistic update로 반영됨)
    onSuccess: (updatedUser, userId) => {
      // 서버 응답으로 최종 캐시 업데이트 (정합성 보장)
      queryClient.setQueryData<UserWithStats[]>(['admin', 'users'], (old) => {
        if (!old) return [];
        return old.map(user => 
          user.id === userId 
            ? { ...user, approved: updatedUser.approved } as UserWithStats
            : user
        );
      });
      queryClient.setQueryData<UserWithStats>(['admin', 'users', userId], (old) => {
        if (!old) return undefined;
        return { ...old, approved: updatedUser.approved } as UserWithStats;
      });
      toast.success('User approved successfully');
    },
    // ✅ onSettled: 성공/실패 관계없이 서버 정합성 회수
    onSettled: (data, error, userId) => {
      // 서버 정합성 회수 (optimistic update와 서버 상태 동기화)
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] });
    },
  });
}







