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
        
        // 보호된 VM 상태가 있으면 서버 응답 상태를 우선
        // boot_order는 이미 vmAPI.list()에서 변환됨
        const protectedData = data.map(vm => {
          const protectedState = protectedVMStates.get(vm.uuid);
          if (protectedState && (Date.now() - protectedState.timestamp) < 30000) {
            // 보호 기간 내이고, 서버 응답 상태가 보호된 상태와 다르면 보호된 상태를 우선
            if (vm.status !== protectedState.status) {
              const timeSinceProtection = Date.now() - protectedState.timestamp;
              window.console.log('[useVMs] ====== PRESERVING PROTECTED VM STATE ======');
              window.console.log('[useVMs] UUID:', vm.uuid);
              window.console.log('[useVMs] Protected status:', protectedState.status);
              window.console.log('[useVMs] Server status:', vm.status);
              window.console.log('[useVMs] Time since protection:', timeSinceProtection, 'ms');
              
              logger.log('[useVMs] Preserving protected VM state:', {
                uuid: vm.uuid,
                protectedStatus: protectedState.status,
                serverStatus: vm.status,
                timeSinceProtection: timeSinceProtection
              });
              return { ...vm, status: protectedState.status };
            }
          }
          return vm;
        });
        
        logger.log('[useVMs] Fetched VM list:', {
          count: protectedData.length,
          protectedCount: Array.from(protectedVMStates.keys()).length,
          vms: protectedData.map(v => ({ uuid: v.uuid, status: v.status }))
        });
        
        return protectedData;
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
    // 창 포커스 시 재요청 (보호된 상태가 있으면 서버 응답을 덮어쓰지 않도록 주의)
    refetchOnWindowFocus: true,
    // 네트워크 재연결 시 재요청
    refetchOnReconnect: true,
    // 마운트 시 재요청 (보호된 상태가 있으면 서버 응답을 덮어쓰지 않도록 주의)
    // 중요: protectedVMStates가 있으면 서버 응답을 덮어쓰지 않음
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
      
      // 에러 메시지 처리
      queueMicrotask(() => {
        let errorMessage = error instanceof Error ? error.message : String(error);
        
        // 500 에러인 경우 상세 정보 확인
        if (error instanceof Error && (error as any).status === 500) {
          const apiError = error as any;
          if (apiError.details) {
            const details = apiError.details;
            // 백엔드에서 제공한 상세 에러 메시지 사용
            if (details.error || details.message) {
              errorMessage = `${errorMessage}\n${details.error || details.message}`;
            }
          }
          
          window.console.error('[useCreateVM] 500 Internal Server Error:', {
            errorMessage,
            errorDetails: apiError.details,
            requestData: variables,
          });
        }
        
        // 에러 메시지를 여러 줄로 표시 (toast는 한 줄만 지원하므로 첫 줄만 표시)
        const firstLine = errorMessage.split('\n')[0];
        toast.error(`VM 생성 실패: ${firstLine}`);
        
        // 전체 에러 메시지는 콘솔에만 출력
        if (errorMessage.includes('\n')) {
          window.console.error('[useCreateVM] Full error message:', errorMessage);
        }
      });
    },
    
    // 성공/실패 관계없이 항상 실행
    // 중요: delete 액션은 useVMAction의 onSettled에서 처리하므로 여기서는 호출하지 않음
    onSettled: () => {
      // create 액션만 여기서 처리 (delete는 useVMAction에서 처리)
      // delete 액션은 useVMAction의 onSettled에서 처리하므로 중복 호출 방지
    },
  });
}

/**
 * VM 액션 Mutation (start, stop, delete, update)
 * Optimistic Updates 적용: 즉시 UI 업데이트, 실패 시 롤백
 */
// 중복 요청 방지를 위한 Map (UUID + action 조합)
const pendingActions = new Map<string, boolean>();

// 서버 응답 상태 보호: start/stop 액션 후 서버 응답 상태를 일정 시간 보호
const protectedVMStates = new Map<string, { status: string; timestamp: number }>();

// localStorage에서 보호된 상태 복원 (새로고침 후에도 유지)
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem('protectedVMStates');
    if (stored) {
      const parsed = JSON.parse(stored);
      const now = Date.now();
      Object.entries(parsed).forEach(([uuid, state]: [string, any]) => {
        // 30초 이내의 보호 상태만 복원
        if (state && state.timestamp && (now - state.timestamp) < 30000) {
          protectedVMStates.set(uuid, { status: state.status, timestamp: state.timestamp });
        }
      });
      // 만료된 항목 제거
      const validStates: Record<string, any> = {};
      Object.entries(parsed).forEach(([uuid, state]: [string, any]) => {
        if (state && state.timestamp && (now - state.timestamp) < 30000) {
          validStates[uuid] = state;
        }
      });
      localStorage.setItem('protectedVMStates', JSON.stringify(validStates));
    }
  } catch (e) {
    // localStorage 복원 실패는 무시
  }
}

export function useVMAction() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ uuid, action, cpu, memory, name }: { 
      uuid: string; 
      action: 'start' | 'stop' | 'delete' | 'update';
      cpu?: number;
      memory?: number;
      name?: string;
    }) => {
      // 중복 요청 방지: 같은 UUID + action 조합이 이미 진행 중이면 에러
      const actionKey = `${uuid}:${action}`;
      if (pendingActions.get(actionKey)) {
        // 프론트엔드에서 중복 요청을 조용히 무시 (에러를 throw하지 않음)
        // 사용자에게는 이미 처리 중이라는 메시지만 표시
        return Promise.reject(new Error('This request is already being processed. Please wait a moment.'));
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
    
    // 낙관적 업데이트 제거: 서버 응답만 신뢰하여 VM 실행 문제 해결
    // start/stop 액션은 서버 응답을 기다린 후에만 상태 업데이트
    onMutate: async ({ uuid, action, cpu, memory }) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ['vms'] });
      await queryClient.cancelQueries({ queryKey: ['quota'] });
      
      // 이전 데이터 백업 (롤백용)
      const previousVMs = queryClient.getQueryData<VM[]>(['vms']);
      const previousQuota = queryClient.getQueryData(['quota']);
      
      // delete 액션만 낙관적 업데이트 (즉시 피드백 제공)
      // start/stop은 서버 응답을 기다려서 정확한 상태 반영
      if (action === 'delete') {
        queueMicrotask(() => {
          startTransition(() => {
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
          });
        });
      } else if (action === 'update' && (cpu !== undefined || memory !== undefined)) {
        // update 액션도 낙관적 업데이트 (CPU/Memory 변경)
        queueMicrotask(() => {
          startTransition(() => {
            queryClient.setQueryData<VM[]>(['vms'], (old) => {
              if (!old) return [];
              return old.map(vm => {
                if (vm.uuid === uuid) {
                  return {
                    ...vm,
                    cpu: cpu !== undefined ? cpu : vm.cpu,
                    memory: memory !== undefined ? memory : vm.memory,
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
          });
        });
      }
      // start/stop 액션은 낙관적 업데이트 하지 않음 - 서버 응답만 신뢰
      
      // 롤백용 컨텍스트 반환
      return { previousVMs, previousQuota };
    },
    
    // 서버 응답 성공: 최종 데이터로 업데이트
    onSuccess: (updatedVM, variables, context) => {
      // 강제 로깅 (콘솔 필터링 우회)
      window.console.log('[useVMAction] ====== ON SUCCESS CALLED ======');
      window.console.log('[useVMAction] Action:', variables.action);
      window.console.log('[useVMAction] UUID:', variables.uuid);
      window.console.log('[useVMAction] Server response:', updatedVM);
      
      logger.log('[useVMAction] onSuccess called:', {
        action: variables.action,
        uuid: variables.uuid,
        updatedVM: updatedVM,
      });
      
      queueMicrotask(() => {
        startTransition(() => {
        if (variables.action === 'delete') {
          // 삭제 성공: 목록에서 제거 및 할당량 무효화
          // 백엔드는 delete 액션에 대해 VM 객체가 아닌 메시지만 반환하므로
          // 목록에서 직접 제거
          
          // protectedVMStates에서 삭제된 VM 제거
          protectedVMStates.delete(variables.uuid);
          // localStorage에서도 제거
          try {
            const protectedStates = JSON.parse(localStorage.getItem('protectedVMStates') || '{}');
            delete protectedStates[variables.uuid];
            localStorage.setItem('protectedVMStates', JSON.stringify(protectedStates));
            window.console.log('[useVMAction] Delete: Removed from protectedVMStates:', { uuid: variables.uuid });
          } catch (e) {
            // localStorage 제거 실패는 무시
          }
          
          // 캐시에서 VM 목록 가져오기
          const currentVMs = queryClient.getQueryData<VM[]>(['vms']);
          
          window.console.log('[useVMAction] Delete: Current cache state:', {
            hasCache: !!currentVMs,
            cacheLength: currentVMs?.length || 0,
            deletedUUID: variables.uuid,
          });
          
          // 캐시에 VM 목록이 있으면 필터링
          if (currentVMs && currentVMs.length > 0) {
            queryClient.setQueryData<VM[]>(['vms'], (old) => {
              if (!old) return [];
              
              const filtered = old.filter(v => v.uuid !== variables.uuid);
              
              window.console.log('[useVMAction] Delete: VM list updated:', {
                beforeCount: old.length,
                afterCount: filtered.length,
                deletedUUID: variables.uuid,
                removedCount: old.length - filtered.length,
              });
              
              return filtered;
            });
          }
          
          // 할당량 무효화
          queryClient.invalidateQueries({ queryKey: ['quota'] });
          
          // 삭제 성공 후 강제로 invalidateQueries 실행 (백엔드가 삭제를 완료한 후)
          // 약간의 지연을 두어 백엔드가 완전히 삭제를 완료할 시간 확보
          setTimeout(() => {
            queueMicrotask(() => {
              startTransition(() => {
                window.console.log('[useVMAction] Delete: Forcing invalidateQueries after delay');
                queryClient.invalidateQueries({ queryKey: ['vms'] });
                queryClient.invalidateQueries({ queryKey: ['quota'] });
              });
            });
          }, 1000); // 1초 지연
          
          // 성공 토스트 표시
          queueMicrotask(() => {
            toast.success('VM deleted successfully');
          });
          return; // delete 액션은 여기서 종료
        } else if (variables.action === 'start' || variables.action === 'stop') {
          // start/stop 액션: 서버 응답 상태를 신뢰하여 업데이트
          // 서버가 반환한 상태가 예상과 다르면 실패로 간주
          const expectedStatus = variables.action === 'start' ? 'Running' : 'Stopped';
          const actualStatus = updatedVM?.status;
          
          // 강제 로깅
          window.console.log('[useVMAction] ====== ACTION RESULT CHECK ======');
          window.console.log('[useVMAction] Action:', variables.action);
          window.console.log('[useVMAction] Expected status:', expectedStatus);
          window.console.log('[useVMAction] Actual status from server:', actualStatus);
          window.console.log('[useVMAction] Status match:', actualStatus === expectedStatus);
          window.console.log('[useVMAction] Full VM response:', updatedVM);
          
          logger.log('[useVMAction] Action result check:', {
            action: variables.action,
            expectedStatus,
            actualStatus,
            uuid: variables.uuid,
            fullVMResponse: updatedVM,
          });
          
          // 서버 응답 상태를 일단 반영 (서버가 최종 상태를 결정)
          // 하지만 예상과 다르면 경고 표시
          if (actualStatus !== expectedStatus) {
            // 액션 실패: 서버가 예상과 다른 상태를 반환
            logger.warn(`[useVMAction] VM ${variables.action} returned unexpected status, expected ${expectedStatus} but got ${actualStatus}`, {
              uuid: variables.uuid,
              vm: updatedVM,
            });
            
            // 서버 응답 상태를 그대로 사용하되, 에러 메시지 표시
            queryClient.setQueryData<VM[]>(['vms'], (old) => {
              if (!old) return [];
              return old.map(v => {
                if (v.uuid === variables.uuid) {
                  // 서버가 반환한 상태를 그대로 사용
                  return updatedVM;
                }
                return v;
              });
            });
            
            // 에러 메시지 표시
            queueMicrotask(() => {
              toast.error(`VM ${variables.action} may have failed. Server returned status: ${actualStatus}. Expected: ${expectedStatus}. Please check VM logs.`);
            });
            return; // 조기 반환하여 성공 토스트 방지
          }
          
          // 정상적인 경우: 서버 응답으로 즉시 업데이트
          logger.log('[useVMAction] Updating VM with server response:', {
            uuid: variables.uuid,
            action: variables.action,
            newStatus: updatedVM.status,
            fullVMResponse: updatedVM,
          });
          
          // 서버 응답 상태를 즉시 보호 설정 (refetch가 덮어쓰기 전에)
          // localStorage에도 저장하여 새로고침 후에도 보호 상태 유지
          const protectionTimestamp = Date.now();
          protectedVMStates.set(variables.uuid, {
            status: updatedVM.status,
            timestamp: protectionTimestamp
          });
          
          // localStorage에 저장 (새로고침 후에도 보호 상태 유지)
          try {
            const protectedStates = JSON.parse(localStorage.getItem('protectedVMStates') || '{}');
            protectedStates[variables.uuid] = {
              status: updatedVM.status,
              timestamp: protectionTimestamp
            };
            localStorage.setItem('protectedVMStates', JSON.stringify(protectedStates));
          } catch (e) {
            // localStorage 저장 실패는 무시
          }
          
          window.console.log('[useVMAction] Protected VM state set:', {
            uuid: variables.uuid,
            protectedStatus: updatedVM.status,
            timestamp: protectionTimestamp,
            protectedUntil: new Date(protectionTimestamp + 30000).toISOString()
          });
          
          // 서버 응답으로 업데이트 (서버가 최종 상태를 결정)
          queryClient.setQueryData<VM[]>(['vms'], (old) => {
            if (!old) return [];
            const updated = old.map(v => {
              if (v.uuid === variables.uuid) {
                logger.log('[useVMAction] VM status update in cache:', {
                  uuid: v.uuid,
                  oldStatus: v.status,
                  newStatus: updatedVM.status,
                });
                // 서버 응답으로 완전히 교체 (서버가 최종 상태를 결정)
                return updatedVM;
              }
              return v;
            });
            
            logger.log('[useVMAction] Updated VM list in cache:', {
              count: updated.length,
              updatedVM: updated.find(v => v.uuid === variables.uuid)
            });
            
            return updated;
          });
          
          // 리소스 쿼타 무효화 (VM start/stop 시 리소스 사용량 변경)
          queryClient.invalidateQueries({ queryKey: ['quota'] });
          
          // 30초 후 보호 해제 (백그라운드 폴링이 정상 상태를 가져올 때까지)
          setTimeout(() => {
            logger.log('[useVMAction] Removing protection for VM:', { uuid: variables.uuid });
            protectedVMStates.delete(variables.uuid);
            // localStorage에서도 제거
            try {
              const protectedStates = JSON.parse(localStorage.getItem('protectedVMStates') || '{}');
              delete protectedStates[variables.uuid];
              localStorage.setItem('protectedVMStates', JSON.stringify(protectedStates));
            } catch (e) {
              // localStorage 제거 실패는 무시
            }
          }, 30000);
          
          // 성공 메시지 표시
          queueMicrotask(() => {
            if (variables.action === 'start') {
              toast.success('VM started successfully');
            } else if (variables.action === 'stop') {
              toast.success('VM stopped successfully');
            }
          });
        } else if (variables.action === 'update') {
          // 업데이트: 서버 응답으로 업데이트
          queryClient.setQueryData<VM[]>(['vms'], (old) => {
            if (!old) return [];
            return old.map(v => {
              if (v.uuid === variables.uuid) {
                return updatedVM;
              }
              return v;
            });
          });
          
          // 할당량 무효화
          queryClient.invalidateQueries({ queryKey: ['quota'] });
          
          // 성공 메시지 표시
          queueMicrotask(() => {
            toast.success('VM updated successfully');
          });
        }
        });
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
        delete: 'deleting',
          update: 'updating',
        };
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // 특정 에러 메시지는 사용자 친화적으로 변경
        let userFriendlyMessage = errorMessage;
        if (errorMessage.includes('Memory limit exceeded')) {
          userFriendlyMessage = 'Memory limit exceeded. Maximum 8192 MB per VM.';
        } else if (errorMessage.includes('This request is already being processed')) {
          // 중복 요청은 조용히 무시 (이미 처리 중이라는 메시지만 표시)
          userFriendlyMessage = 'This request is already being processed. Please wait a moment.';
        } else if (errorMessage.includes('This request was recently processed')) {
          // 백엔드에서 온 중복 요청 메시지도 사용자 친화적으로 변경
          userFriendlyMessage = 'This request was recently processed. Please wait a moment before retrying.';
        }
        
        toast.error(`Error ${actionMessages[variables.action]} VM: ${userFriendlyMessage}`);
      });
    },
    
    // 성공/실패 관계없이 항상 실행
    onSettled: (data, error, variables) => {
      // React Error #321 완전 해결: queueMicrotask로 비동기 처리
      queueMicrotask(() => {
        if (variables.action === 'delete') {
          // delete 액션: onSuccess에서 이미 처리했으므로 여기서는 아무것도 하지 않음
          // invalidateQueries를 호출하면 백엔드가 아직 삭제를 완료하지 않아서
          // 삭제 전 목록이 다시 로드될 수 있음
          // 백그라운드 폴링(5분마다)이 최신 상태를 가져옴
          window.console.log('[useVMAction] Delete: onSettled - skipping invalidateQueries to prevent race condition');
        } else if (variables.action === 'start' || variables.action === 'stop') {
          // start/stop 액션: 서버 응답을 신뢰하되, 적절한 타이밍에 invalidateQueries 호출
          // 서버가 start/stop 액션에 대해 반환한 상태(Running/Stopped)를 우선하되,
          // 새로고침 시 최신 상태를 가져올 수 있도록 약간의 지연 후 invalidateQueries 호출
          // 너무 빠르면 서버가 아직 상태를 업데이트하지 않았을 수 있고,
          // 너무 늦으면 새로고침 시 최신 상태를 가져오지 못함
          setTimeout(() => {
            queueMicrotask(() => {
              startTransition(() => {
                // 서버 응답 후 1초 지연하여 invalidateQueries 호출
                // 이렇게 하면 서버가 DB에 상태를 저장하고 WebSocket으로 브로드캐스트한 후에
                // 최신 상태를 가져올 수 있음
                queryClient.invalidateQueries({ queryKey: ['vms'] });
                queryClient.invalidateQueries({ queryKey: ['quota'] });
              });
            });
          }, 1000); // 1초 지연
        } else if (variables.action === 'update') {
          // 업데이트: 즉시 무효화
          startTransition(() => {
            queryClient.invalidateQueries({ queryKey: ['vms'] });
            queryClient.invalidateQueries({ queryKey: ['quota'] });
          });
        }
      });
    },
  });
}


