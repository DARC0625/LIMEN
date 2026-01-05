/**
 * VM 목록 조회 훅 (React Query)
 * 통합된 API 클라이언트 사용
 */
import { useQuery, useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { startTransition, useState, useEffect } from 'react';
import { vmAPI } from '../lib/api/index';
import type { VM, QuotaUsage } from '../lib/types';
import { useToast } from '../components/ToastContainer';
import { useAuth } from '../components/AuthGuard';
import { QUERY_CONSTANTS } from '../lib/constants';
import { decodeToken } from '../lib/utils/token';
import { logger } from '../lib/utils/logger';
import { handleAuthError } from '../lib/utils/errorHelpers';
import { useMounted } from './useMounted';

/**
 * VM 목록 조회 훅
 * 트리거 방식: Mutation 성공 시 invalidateQueries로 자동 갱신
 * 최후의 수단으로만 폴링 (5분마다) - 백그라운드 동기화용
 */
export function useVMs() {
  const { isAuthenticated } = useAuth();
  const mounted = useMounted();
  
  // 서버와 클라이언트 초기 렌더링에서 동일한 값 반환 (false)
  // 마운트 후에만 인증 상태 확인
  const enabled = mounted && isAuthenticated === true;
  
  // 트리거 방식: Mutation이 성공하면 invalidateQueries로 자동 갱신
  // 최후의 수단으로만 폴링 (5분마다) - 백그라운드 동기화용
  const FALLBACK_POLLING_INTERVAL = 5 * 60 * 1000; // 5분
  
  return useQuery({
    queryKey: ['vms'],
    queryFn: async () => {
      try {
        const data = await vmAPI.list();
        // 배열이 아니면 빈 배열 반환
        if (!Array.isArray(data)) {
          logger.warn('[useVMs] Response is not an array, returning empty array');
          return [];
        }
        
        return data;
      } catch (error: unknown) {
        // 401/403 에러 처리
        handleAuthError(error);
        throw error;
      }
    },
    enabled: enabled,
    // 트리거 방식: Mutation 성공 시 invalidateQueries로 갱신
    // 최후의 수단으로만 폴링 (백그라운드 동기화)
    refetchInterval: enabled ? FALLBACK_POLLING_INTERVAL : false,
    staleTime: 2 * 60 * 1000, // 2분간 캐시 유지 (Mutation 트리거 우선)
    // 창 포커스 시 재요청 (조건부: 탭이 비활성화된 시간이 1분 이상이면만)
    // Mutation 트리거가 우선이므로, 창 포커스는 보조적 역할만
    refetchOnWindowFocus: true,
    // 네트워크 재연결 시 재요청
    refetchOnReconnect: true,
    // 마운트 시 재요청
    refetchOnMount: true,
    retry: QUERY_CONSTANTS.RETRY,
    retryDelay: QUERY_CONSTANTS.RETRY_DELAY,
    throwOnError: false,
  });
}

/**
 * VM 목록 조회 훅 (Suspense)
 * Suspense와 완전 통합된 버전 - Streaming SSR 최적화
 */
export function useVMsSuspense() {
  return useSuspenseQuery({
    queryKey: ['vms'],
    queryFn: async () => {
      try {
        return await vmAPI.list();
      } catch (error: unknown) {
        // 401/403 에러 처리
        handleAuthError(error);
        throw error;
      }
    },
    // WebSocket이 실시간 업데이트를 처리하므로 refetchInterval 제거
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지 (WebSocket이 실시간 업데이트)
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

/**
 * VM 생성 Mutation
 * Optimistic Updates 적용: 즉시 UI에 임시 VM 추가, 실패 시 롤백
 */
export function useCreateVM() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (vm: { name: string; cpu: number; memory: number; os_type?: string }) => 
      vmAPI.create(vm),
    
    // 낙관적 업데이트: 서버 응답 전에 임시 VM 추가
    onMutate: async (newVM) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ['vms'] });
      await queryClient.cancelQueries({ queryKey: ['quota'] });
      
      // 이전 데이터 백업
      const previousVMs = queryClient.getQueryData<VM[]>(['vms']);
      const previousQuota = queryClient.getQueryData(['quota']);
      
      // 현재 사용자 ID 가져오기
      // Phase 4: 보안 강화 - localStorage 직접 사용 제거, tokenManager 사용
      let token: string | null = null;
      if (typeof window !== 'undefined') {
        try {
          const { tokenManager } = await import('../lib/tokenManager');
          token = await tokenManager.getAccessToken();
        } catch (error) {
          // tokenManager 사용 실패 시 null 반환
          token = null;
        }
      }
      const decoded = token ? decodeToken(token) : null;
      const ownerId = decoded?.id || 0;
      
      // 임시 VM 생성 (ID는 -1로 설정, 서버 응답 시 실제 ID로 교체)
      const tempVM: VM = {
        id: -1, // 임시 ID
        name: newVM.name,
        cpu: newVM.cpu,
        memory: newVM.memory,
        os_type: newVM.os_type || 'ubuntu-desktop',
        status: 'Creating', // 생성 중 상태
        uuid: '', // 임시
        owner_id: ownerId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // React Error #321 완전 해결: setQueryData를 비동기로 처리 (렌더링 중 업데이트 방지)
      queueMicrotask(() => {
        startTransition(() => {
          // 즉시 목록에 추가
          queryClient.setQueryData<VM[]>(['vms'], (old) => {
            if (!old) return [tempVM];
            return [...old, tempVM];
          });
          
          // 할당량도 즉시 업데이트 (메모리는 MB 단위로 저장됨)
          queryClient.setQueryData(['quota'], (old: QuotaUsage | undefined) => {
            if (!old) return old;
            return {
              ...old,
              usage: {
                ...old.usage,
                vms: old.usage.vms + 1,
                cpu: old.usage.cpu + newVM.cpu,
                memory: old.usage.memory + newVM.memory, // MB 단위로 저장되므로 그냥 더함
              },
            };
          });
        });
      });
      
      return { previousVMs, previousQuota };
    },
    
    // 서버 응답 성공: 임시 VM을 실제 VM으로 교체
    onSuccess: (newVM, variables, context) => {
      // React Error #321 완전 해결: 비동기 처리로 렌더링 중 업데이트 방지
      queueMicrotask(() => {
        startTransition(() => {
          queryClient.setQueryData<VM[]>(['vms'], (old) => {
            if (!old) return [newVM];
            // 임시 VM(-1) 제거하고 실제 VM 추가
            return old.filter(v => v.id !== -1).concat(newVM);
          });
          
          // 할당량은 이미 onMutate에서 업데이트했지만, 서버 응답으로 최종 확인
          queryClient.invalidateQueries({ queryKey: ['quota'] });
        });
      });
      // toast는 startTransition 밖에서 호출 (사이드 이펙트)
      queueMicrotask(() => {
        toast.success('VM created successfully!');
      });
    },
    
    // 에러 발생: 롤백
    onError: (error: unknown, variables, context) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // React Error #321 완전 해결: 비동기 처리
      queueMicrotask(() => {
        startTransition(() => {
          // 이전 상태로 롤백
          if (context?.previousVMs) {
            queryClient.setQueryData(['vms'], context.previousVMs);
          }
          if (context?.previousQuota) {
            queryClient.setQueryData(['quota'], context.previousQuota);
          }
        });
      });
      queueMicrotask(() => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        toast.error(`Error creating VM: ${errorMessage}`);
      });
    },
    
    // 성공/실패 관계없이 항상 실행
    onSettled: () => {
      queueMicrotask(() => {
        startTransition(() => {
          // 최신 데이터 확보
          queryClient.invalidateQueries({ queryKey: ['vms'] });
          queryClient.invalidateQueries({ queryKey: ['quota'] });
        });
      });
    },
  });
}

/**
 * VM 액션 Mutation (start, stop, delete, update)
 * Optimistic Updates 적용: 즉시 UI 업데이트, 실패 시 롤백
 */
// 중복 요청 방지를 위한 Map (UUID + action 조합)
const pendingActions = new Map<string, boolean>();

export function useVMAction() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ uuid, action, cpu, memory, name }: { 
      uuid: string; 
      action: 'start' | 'stop' | 'restart' | 'delete' | 'update';
      cpu?: number;
      memory?: number;
      name?: string;
    }) => {
      // 중복 요청 방지: 같은 UUID + action 조합이 이미 진행 중이면 에러
      const actionKey = `${uuid}:${action}`;
      if (pendingActions.get(actionKey)) {
        throw new Error('This request was recently processed. Please wait a moment before retrying.');
      }
      
      // 요청 시작 표시
      pendingActions.set(actionKey, true);
      
      return vmAPI.action(uuid, action, { cpu, memory, name }).finally(() => {
        // 요청 완료 후 제거 (성공/실패 관계없이)
        setTimeout(() => {
          pendingActions.delete(actionKey);
        }, 2000); // 2초 후 제거 (백엔드의 중복 방지 시간과 맞춤)
      });
    },
    
    // 낙관적 업데이트: 서버 응답 전에 UI 즉시 업데이트
    onMutate: async ({ uuid, action, cpu, memory }) => {
      // 진행 중인 쿼리 취소하여 낙관적 업데이트가 덮어쓰이지 않도록
      await queryClient.cancelQueries({ queryKey: ['vms'] });
      await queryClient.cancelQueries({ queryKey: ['quota'] });
      
      // 이전 데이터 백업 (롤백용)
      const previousVMs = queryClient.getQueryData<VM[]>(['vms']);
      const previousQuota = queryClient.getQueryData(['quota']);
      
      // React Error #321 완전 해결: queueMicrotask로 비동기 처리
      queueMicrotask(() => {
        startTransition(() => {
          // 즉시 UI 업데이트
          if (action === 'delete') {
          // 삭제: 목록에서 즉시 제거
          queryClient.setQueryData<VM[]>(['vms'], (old) => {
            if (!old) return [];
            return old.filter(v => v.uuid !== uuid);
          });
          // 할당량도 즉시 업데이트 (VM 삭제 시 할당량 감소, 메모리는 MB 단위)
          queryClient.setQueryData(['quota'], (old: QuotaUsage | undefined) => {
            if (!old) return old;
            const deletedVM = previousVMs?.find(v => v.uuid === uuid);
            if (deletedVM) {
              return {
                ...old,
                usage: {
                  ...old.usage,
                  vms: Math.max(0, old.usage.vms - 1),
                  cpu: Math.max(0, old.usage.cpu - deletedVM.cpu),
                  memory: Math.max(0, old.usage.memory - deletedVM.memory), // MB 단위로 저장되므로 그냥 뺌
                },
              };
            }
            return old;
          });
        } else if (action === 'start' || action === 'stop' || action === 'restart') {
          // 시작/중지/재시작: 상태만 즉시 업데이트
          queryClient.setQueryData<VM[]>(['vms'], (old) => {
            if (!old) return [];
            return old.map(vm => {
              if (vm.uuid === uuid) {
                return {
                  ...vm,
                  status: action === 'start' ? 'Running' : action === 'restart' ? 'Restarting' : 'Stopped',
                };
              }
              return vm;
            });
          });
        } else if (action === 'update' && (cpu !== undefined || memory !== undefined || name !== undefined)) {
          // 업데이트: CPU/Memory/Name 즉시 업데이트
          queryClient.setQueryData<VM[]>(['vms'], (old) => {
            if (!old) return [];
            return old.map(vm => {
              if (vm.uuid === uuid) {
                return {
                  ...vm,
                  cpu: cpu !== undefined ? cpu : vm.cpu,
                  memory: memory !== undefined ? memory : vm.memory,
                  name: name !== undefined ? name : vm.name,
                };
              }
              return vm;
            });
          });
          // 할당량도 즉시 업데이트 (메모리는 MB 단위로 저장됨)
          queryClient.setQueryData(['quota'], (old: QuotaUsage | undefined) => {
            if (!old) return old;
            const updatedVM = previousVMs?.find(v => v.uuid === uuid);
            if (updatedVM) {
              const oldCpu = updatedVM.cpu;
              const oldMemory = updatedVM.memory; // MB 단위
              const newCpu = cpu !== undefined ? cpu : oldCpu;
              const newMemory = memory !== undefined ? memory : updatedVM.memory; // MB 단위
              
              return {
                ...old,
                usage: {
                  ...old.usage,
                  cpu: old.usage.cpu - oldCpu + newCpu,
                  memory: old.usage.memory - oldMemory + newMemory, // MB 단위로 계산
                },
              };
            }
            return old;
          });
        }
        });
      });
      
      // 롤백용 컨텍스트 반환
      return { previousVMs, previousQuota };
    },
    
    // 서버 응답 성공: 최종 데이터로 업데이트
    onSuccess: (updatedVM, variables) => {
      logger.log('[useVMAction] onSuccess called:', {
        action: variables.action,
        uuid: variables.uuid,
        updatedVMStatus: updatedVM.status,
        updatedVM: updatedVM,
      });
      
      // start 액션 실패 여부를 먼저 확인 (queueMicrotask 밖에서)
      const startFailed = variables.action === 'start' && updatedVM.status === 'Stopped';
      // stop 액션 실패 여부 확인 (서버가 Running을 반환하면 stop 실패)
      const stopFailed = variables.action === 'stop' && updatedVM.status === 'Running';
      
      logger.log('[useVMAction] Action result check:', {
        action: variables.action,
        expectedStatus: variables.action === 'start' ? 'Running' : variables.action === 'stop' ? 'Stopped' : 'any',
        actualStatus: updatedVM.status,
        startFailed,
        stopFailed,
      });
      
      queueMicrotask(() => {
        startTransition(() => {
        if (variables.action === 'delete') {
          // 삭제 성공: 목록에서 제거 확인 및 할당량 무효화
          queryClient.setQueryData<VM[]>(['vms'], (old) => {
            if (!old) return [];
            return old.filter(v => v.uuid !== variables.uuid);
          });
          queryClient.invalidateQueries({ queryKey: ['quota'] });
        } else {
          // 서버 응답으로 최종 업데이트
          // 중요: start 액션의 경우 서버 응답 상태를 확인
          // 만약 서버가 'Stopped'를 반환하면 VM이 시작 실패한 것
          if (startFailed) {
            // VM 시작 실패: 상태를 원래대로 되돌리고 에러 메시지 표시
            logger.warn('[useVMAction] VM start failed, status is Stopped', {
              uuid: variables.uuid,
              vm: updatedVM,
            });
            queryClient.setQueryData<VM[]>(['vms'], (old) => {
              if (!old) return [];
              return old.map(v => {
                if (v.uuid === variables.uuid) {
                  return { ...v, status: 'Stopped' };
                }
                return v;
              });
            });
            // 에러 토스트는 onError에서 처리하지 않고 여기서 처리
            queueMicrotask(() => {
              toast.error('VM failed to start. Please check VM configuration or logs.');
            });
            return; // 조기 반환하여 성공 토스트 방지
          }
          
          // stop 액션 실패 처리
          if (stopFailed) {
            logger.warn('[useVMAction] VM stop failed, status is Running', {
              uuid: variables.uuid,
              vm: updatedVM,
            });
            queryClient.setQueryData<VM[]>(['vms'], (old) => {
              if (!old) return [];
              return old.map(v => {
                if (v.uuid === variables.uuid) {
                  return { ...v, status: 'Running' };
                }
                return v;
              });
            });
            queueMicrotask(() => {
              toast.error('VM failed to stop. Please check VM configuration or logs.');
            });
            return; // 조기 반환하여 성공 토스트 방지
          }
          
          // 정상적인 경우: 서버 응답으로 업데이트 (무조건 서버 상태로 덮어쓰기)
          logger.log('[useVMAction] Updating VM with server response:', {
            uuid: variables.uuid,
            action: variables.action,
            newStatus: updatedVM.status,
          });
          queryClient.setQueryData<VM[]>(['vms'], (old) => {
            if (!old) return [];
            return old.map(v => {
              if (v.uuid === variables.uuid) {
                logger.log('[useVMAction] VM status update:', {
                  uuid: v.uuid,
                  oldStatus: v.status,
                  newStatus: updatedVM.status,
                });
                return updatedVM; // 서버 응답으로 완전히 교체
              }
              return v;
            });
          });
          
          // CPU/Memory 변경 시 할당량 무효화
          if (variables.action === 'update') {
            queryClient.invalidateQueries({ queryKey: ['quota'] });
          }
        }
        });
      });
      
      // start 또는 stop 액션이 실패한 경우는 토스트를 표시하지 않음
      if (startFailed || stopFailed) {
        return;
      }
      
      queueMicrotask(() => {
        const actionMessages = {
        start: 'VM started successfully',
        stop: 'VM stopped successfully',
        restart: 'VM restarted successfully',
        update: 'VM updated successfully',
          delete: 'VM deleted successfully',
        };
        toast.success(actionMessages[variables.action]);
      });
    },
    
    // 에러 발생: 롤백
    onError: (error: unknown, variables, context) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      queueMicrotask(() => {
        startTransition(() => {
        // 이전 상태로 롤백
        if (context?.previousVMs) {
          queryClient.setQueryData(['vms'], context.previousVMs);
        }
        if (context?.previousQuota) {
          queryClient.setQueryData(['quota'], context.previousQuota);
        }
        });
      });
      
      queueMicrotask(() => {
        const actionMessages = {
        start: 'starting',
        stop: 'stopping',
        restart: 'restarting',
        delete: 'deleting',
          update: 'updating',
        };
        const errorMessage = error instanceof Error ? error.message : String(error);
        toast.error(`Error ${actionMessages[variables.action]} VM: ${errorMessage}`);
      });
    },
    
    // 성공/실패 관계없이 항상 실행
    onSettled: (data, error, variables) => {
      // React Error #321 완전 해결: queueMicrotask로 비동기 처리
      queueMicrotask(() => {
        if (variables.action === 'delete') {
          // 삭제 후에는 조금 지연시켜서 무효화 (백엔드가 완전히 처리할 시간 확보)
          setTimeout(() => {
            queueMicrotask(() => {
              startTransition(() => {
                queryClient.invalidateQueries({ queryKey: ['vms'] });
                queryClient.invalidateQueries({ queryKey: ['quota'] });
              });
            });
          }, 500);
        } else {
          // 다른 액션은 즉시 무효화
          startTransition(() => {
            queryClient.invalidateQueries({ queryKey: ['vms'] });
            if (variables.action === 'update') {
              queryClient.invalidateQueries({ queryKey: ['quota'] });
            }
          });
        }
      });
    },
  });
}


