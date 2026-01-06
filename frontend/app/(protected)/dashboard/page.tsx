'use client';

import { useState, useEffect, startTransition } from 'react';
import dynamicImport from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { removeToken, isAdmin, vmAPI } from '../../../lib/api';
import { isUserApproved } from '../../../lib/auth';
import { useToast } from '../../../components/ToastContainer';
import { useCreateVM, useVMAction } from '../../../hooks/useVMs';
import { useAuth } from '../../../components/AuthGuard';
import { useQueryClient } from '@tanstack/react-query';
import RevolverPicker from '../../../components/RevolverPicker';
import BootOrderSelector from '../../../components/BootOrderSelector';
import type { VM, BootOrder } from '../../../lib/types';

// Dynamic import: Client-side only rendering for authenticated components (prevents hydration mismatch)
const QuotaDisplay = dynamicImport(() => import('../../../components/QuotaDisplay').then(mod => mod.default), { ssr: false });
const VMListSection = dynamicImport(() => import('../../../components/VMListSection').then(mod => mod.default), { ssr: false });
const HealthStatus = dynamicImport(() => import('../../../components/HealthStatus').then(mod => mod.default), { ssr: false });
const AgentMetricsCard = dynamicImport(() => import('../../../components/AgentMetricsCard').then(mod => mod.default), { ssr: false });

// Loading and Skeleton are small components, load immediately for better UX
import Loading from '../../../components/Loading';
import { VMCardSkeleton } from '../../../components/Skeleton';

// Dynamic import: SnapshotManager is conditionally rendered, so code splitting is applied
const SnapshotManager = dynamicImport(
  () => import('../../../components/SnapshotManager'),
  {
    loading: () => <Loading message="Loading snapshot manager..." size="sm" />,
    ssr: false, // Client-side only rendering
  }
);

type Metrics = {
  cpu_usage: number;
  total_memory: number;
  used_memory: number;
  free_memory: number;
  cpu_cores: number;
};

type BackendHealth = {
  status: string;
  time: string;
  db: string;
  libvirt: string;
};

// VM type is now imported from api.ts

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  
  // Phase 4: isAdmin()이 비동기로 변경되어 useState로 관리
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [newVM, setNewVM] = useState({ name: '', cpu: 1, memory: 1024, os_type: 'ubuntu-desktop' });
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingVM, setEditingVM] = useState<VM | null>(null);
  
  // 모든 hooks를 항상 호출 (조건부 early return 전에)
  const createVMMutation = useCreateVM();
  const vmActionMutation = useVMAction();
  
  // 승인 여부 확인
  useEffect(() => {
    const checkApproval = async () => {
      try {
        const approved = await isUserApproved();
        if (!approved) {
          // 승인되지 않은 사용자는 대기 페이지로 이동
          router.replace('/waiting');
        }
      } catch (error) {
        console.error('Approval check failed:', error);
        // 에러 발생 시에도 대기 페이지로 이동 (안전하게)
        router.replace('/waiting');
      }
    };
    
    checkApproval();
  }, [router]);
  
  // Phase 4: isAdmin() 비동기 호출
  useEffect(() => {
    isAdmin().then(setIsUserAdmin).catch(() => setIsUserAdmin(false));
  }, []);
  
  // Don't render if not authenticated (prevents hydration mismatch)
  // AuthGuard already protects, but this is an additional safety measure
  if (isAuthenticated !== true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Authenticating...</div>
      </div>
    );
  }
  const [selectedVMForSnapshot, setSelectedVMForSnapshot] = useState<string | null>(null);

  // React Error #321 fix: Remove inline callbacks, wrap with startTransition
  const handleCreateVM = async (e: React.FormEvent) => {
    e.preventDefault();
    createVMMutation.mutate(newVM, {
      onSuccess: () => {
        // React Error #321 fix: Wrap state updates with startTransition
        startTransition(() => {
          setNewVM({ name: '', cpu: 1, memory: 1024, os_type: 'ubuntu-desktop' });
        });
      },
    });
  };

  // Edit popup은 Cancel 버튼으로만 닫히도록 변경 (드래그 중 닫힘 방지)

  // React Error #321 fix: Remove useCallback
  const handleUpdateVM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVM) return;
    
    setProcessingId(editingVM.uuid);
    vmActionMutation.mutate(
      {
        uuid: editingVM.uuid,
        action: 'update',
        name: editingVM.name,
        cpu: editingVM.cpu,
        memory: editingVM.memory,
      },
      {
        onSuccess: () => {
          // React Error #321 fix: Wrap state updates with startTransition
          startTransition(() => {
            setEditingVM(null);
            setProcessingId(null);
          });
        },
        onError: () => {
          startTransition(() => {
            setProcessingId(null);
          });
        },
      }
    );
  };

  const queryClient = useQueryClient();

  // 부팅 순서 변경 핸들러
  const handleBootOrderChange = async (uuid: string, bootOrder: BootOrder, retryCount: number = 0) => {
    window.console.log('[handleBootOrderChange] Called:', { uuid, bootOrder, retryCount });
    
    // 대기 상태 표시
    setProcessingId(uuid);
    
    try {
      window.console.log('[handleBootOrderChange] Calling API...');
      const updatedVM = await vmAPI.setBootOrder(uuid, bootOrder);
      window.console.log('[handleBootOrderChange] API success:', updatedVM);
      
      // API 응답에서 실제 boot_order 값 가져오기 (이미 프론트엔드 형식으로 변환됨)
      const actualBootOrder = updatedVM.boot_order || bootOrder;
      window.console.log('[handleBootOrderChange] Actual boot_order from API (normalized):', actualBootOrder);
      
      // 성공 시 처리 ID 제거
      setProcessingId(null);
      
      toast.success('부팅 순서가 변경되었습니다.');
      // React Query 자동 갱신
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ['vms'] });
        // VM 데이터 직접 업데이트 (API 응답의 실제 값 사용)
        queryClient.setQueryData<VM[]>(['vms'], (old) => {
          if (!old) return [];
          return old.map(v => v.uuid === uuid ? { ...v, boot_order: actualBootOrder } : v);
        });
      });
      
      // editingVM 상태도 업데이트 (모달이 열려있을 때)
      if (editingVM && editingVM.uuid === uuid) {
        setEditingVM({ ...editingVM, boot_order: actualBootOrder });
      }
    } catch (error) {
      window.console.error('[handleBootOrderChange] API error:', error);
      console.error('[handleBootOrderChange] API error:', error);
      
      const apiError = error as any;
      
      // wait 관련 오류인지 확인
      if (apiError.isWaitError) {
        window.console.log('[handleBootOrderChange] Wait error detected, will retry...');
        
        // 최대 5번까지 재시도 (약 25초)
        if (retryCount < 5) {
          const delay = (retryCount + 1) * 5000; // 5초, 10초, 15초, 20초, 25초
          window.console.log(`[handleBootOrderChange] Retrying in ${delay / 1000} seconds...`);
          
          toast.info(`대기 중... (${retryCount + 1}/5)`);
          
          setTimeout(() => {
            handleBootOrderChange(uuid, bootOrder, retryCount + 1);
          }, delay);
          
          return; // 처리 ID는 유지 (대기 상태 표시)
        } else {
          // 최대 재시도 횟수 초과
          setProcessingId(null);
          toast.error('부팅 순서 변경 대기 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
          return;
        }
      }
      
      // 일반 에러 처리
      setProcessingId(null);
      
      let errorMessage = '부팅 순서 변경 실패';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // 404 오류인 경우 특별 처리
        if (apiError.status === 404) {
          errorMessage = '부팅 순서 API 엔드포인트를 찾을 수 없습니다. 백엔드 서버를 확인해주세요.';
          window.console.error('[handleBootOrderChange] 404 Not Found - API endpoint not found:', {
            uuid,
            bootOrder,
            endpoint: `/api/vms/${uuid}/boot-order`
          });
        } else {
          // 백엔드에서 제공한 상세 에러 정보 확인
          if (apiError.details) {
            const details = apiError.details;
            if (details.error || details.message) {
              errorMessage = `${error.message}\n${details.error || details.message}`;
            }
          }
        }
      } else {
        errorMessage = String(error);
      }
      
      // 에러 메시지를 여러 줄로 표시 (toast는 한 줄만 지원하므로 첫 줄만 표시)
      const firstLine = errorMessage.split('\n')[0];
      toast.error(`부팅 순서 변경 실패: ${firstLine}`);
      
      // 전체 에러 메시지는 콘솔에만 출력
      if (errorMessage.includes('\n')) {
        window.console.error('[handleBootOrderChange] Full error message:', errorMessage);
      }
    }
  };

  const handleFinalizeInstall = async (uuid: string, retryCount: number = 0) => {
    window.console.log('[handleFinalizeInstall] Called with uuid:', uuid, 'retryCount:', retryCount);
    
    // 첫 호출 시에만 확인 다이얼로그 표시
    if (retryCount === 0) {
      if (!confirm('Finalize installation?\n\nThis will:\n- Remove CDROM device\n- Set boot order to HDD only\n- Mark installation as complete\n\nVM will be shut down if running.')) {
        window.console.log('[handleFinalizeInstall] User cancelled');
        return;
      }
    }

    window.console.log('[handleFinalizeInstall] Starting finalize install...');
    setProcessingId(uuid);
    try {
      window.console.log('[handleFinalizeInstall] Calling API...');
      const result = await vmAPI.finalizeInstall(uuid);
      window.console.log('[handleFinalizeInstall] API success:', result);
      
      // 성공 시 처리 ID 제거
      setProcessingId(null);
      
      toast.success(result.message || 'Installation finalized successfully');
      
      // 백엔드 응답에 VM 정보가 있으면 사용, 없으면 기존 값 유지
      // boot_order는 백엔드가 유지하므로 강제로 변경하지 않음
      queryClient.setQueryData<VM[]>(['vms'], (old) => {
        if (!old) return [];
        return old.map(v => 
          v.uuid === uuid 
            ? { 
                ...v, 
                installation_status: 'installed' as const,
                // 백엔드 응답에 VM 정보가 있으면 사용 (boot_order는 이미 변환됨)
                ...(result.vm ? { boot_order: result.vm.boot_order } : {})
              } 
            : v
        );
      });
      
      // 편집 모달은 닫지 않음 (Update 버튼으로만 닫히도록)
      // editingVM 상태만 업데이트 (boot_order는 백엔드가 유지하므로 강제 변경하지 않음)
      if (editingVM?.uuid === uuid) {
        setEditingVM({
          ...editingVM,
          installation_status: 'installed' as const,
          // 백엔드 응답에 VM 정보가 있으면 사용 (boot_order는 이미 변환됨)
          ...(result.vm ? { boot_order: result.vm.boot_order } : {})
        });
      }
      
      // VM 목록 새로고침
      queryClient.invalidateQueries({ queryKey: ['vms'] });
    } catch (error) {
      window.console.error('[handleFinalizeInstall] API error:', error);
      console.error('[handleFinalizeInstall] API error:', error);
      
      const apiError = error as any;
      
      // wait 관련 오류인지 확인
      if (apiError.isWaitError) {
        window.console.log('[handleFinalizeInstall] Wait error detected, will retry...');
        
        // 최대 5번까지 재시도 (약 25초)
        if (retryCount < 5) {
          const delay = (retryCount + 1) * 5000; // 5초, 10초, 15초, 20초, 25초
          window.console.log(`[handleFinalizeInstall] Retrying in ${delay / 1000} seconds...`);
          
          toast.info(`대기 중... (${retryCount + 1}/5)`);
          
          setTimeout(() => {
            handleFinalizeInstall(uuid, retryCount + 1);
          }, delay);
          
          return; // 처리 ID는 유지 (대기 상태 표시)
        } else {
          // 최대 재시도 횟수 초과
          setProcessingId(null);
          toast.error('설치 완료 처리 대기 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
          return;
        }
      }
      
      // 일반 에러 처리
      setProcessingId(null);
      
      let errorMessage = 'Failed to finalize installation';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // 백엔드에서 제공한 상세 에러 정보 확인
        if (apiError.details) {
          const details = apiError.details;
          if (details.error || details.message) {
            errorMessage = `${error.message}\n${details.error || details.message}`;
          }
        }
      } else {
        errorMessage = String(error);
      }
      
      // 에러 메시지를 여러 줄로 표시 (toast는 한 줄만 지원하므로 첫 줄만 표시)
      const firstLine = errorMessage.split('\n')[0];
      toast.error(`Failed to finalize installation: ${firstLine}`);
      
      // 전체 에러 메시지는 콘솔에만 출력
      if (errorMessage.includes('\n')) {
        window.console.error('[handleFinalizeInstall] Full error message:', errorMessage);
      }
    }
  };

  const handleAction = async (uuid: string, action: 'start' | 'stop' | 'delete') => {
    // 강제 로깅 - 가장 먼저 실행
    window.console.log('[handleAction] ====== HANDLE ACTION CALLED ======');
    window.console.log('[handleAction] Called:', { uuid, action, isPending: vmActionMutation.isPending, processingId });
    window.console.log('[handleAction] vmActionMutation:', vmActionMutation);
    
    // 중복 요청 방지: 이미 처리 중이면 무시
    if (vmActionMutation.isPending || processingId === uuid) {
      window.console.log('[handleAction] Request already in progress, ignoring');
      return;
    }
    
    if (action === 'delete' && !confirm('Are you sure you want to delete this VM?')) return;
    
    window.console.log('[handleAction] Setting processingId and calling mutation');
    setProcessingId(uuid);
    
    window.console.log('[handleAction] About to call mutate with:', { uuid, action });
    vmActionMutation.mutate(
      { uuid, action },
      {
        onSuccess: () => {
          window.console.log('[handleAction] Mutation success');
          // React Error #321 fix: Wrap state updates with startTransition
          startTransition(() => {
            setProcessingId(null);
          });
        },
        onError: (error) => {
          window.console.error('[handleAction] Mutation error:', error);
          startTransition(() => {
            setProcessingId(null);
          });
        },
      }
    );
    window.console.log('[handleAction] mutate called');
  };


  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 pb-12 bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Skip link - Quick navigation for keyboard users (accessibility: hidden off-screen) */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded focus:shadow-lg"
        aria-label="Skip to main content"
      >
        Skip to main content
      </a>
      
      <main id="main-content" className="max-w-7xl mx-auto flex flex-col gap-4 sm:gap-6 md:gap-8" role="main">
        <header role="banner" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-200">
          <h1 className="text-2xl sm:text-3xl font-bold">LIMEN Dashboard</h1>
          <div className="flex items-center gap-4">
            {isUserAdmin && (
              <a
                href="/admin/users"
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                aria-label="Navigate to user management page"
              >
                User Management
              </a>
            )}
            <button
              onClick={() => {
                removeToken();
                window.location.reload();
              }}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              aria-label="Logout from LIMEN"
            >
              Logout
            </button>
          </div>
        </header>
        
        <section aria-label="System Status" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 items-stretch">
          {/* Health Status - Regular component (polling mode) */}
          <HealthStatus />

          {/* Quota Display */}
          <QuotaDisplay />

          {/* Agent Metrics */}
          <AgentMetricsCard />
        </section>

        <section aria-label="VM Management" className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 items-stretch">
          <div className="lg:col-span-1 p-4 sm:p-6 bg-white rounded-xl shadow-lg border border-gray-200 transition-all" style={{ minHeight: '400px' }}>
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Create New VM</h2>
            <form onSubmit={handleCreateVM} className="space-y-4" aria-label="Create new virtual machine form">
              <div>
                <label htmlFor="vm-name" className="block text-sm font-medium mb-1">
                  VM Name
                  <span className="text-red-500 ml-1" aria-label="required">*</span>
                </label>
                    <input 
                      id="vm-name"
                      type="text" 
                      required 
                      maxLength={100}
                      className="w-full p-2 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all" 
                      value={newVM.name} 
                      onChange={e => {
                        const originalValue = e.target.value;
                        // Input validation: Only allow letters, numbers, hyphens, underscores (XSS prevention)
                        const sanitized = originalValue.replace(/[^a-zA-Z0-9_-]/g, '');
                        
                        // Check if invalid characters were entered
                        if (originalValue !== sanitized) {
                          toast.error('VM name can only contain letters, numbers, hyphens (-), and underscores (_).');
                        }
                        
                        setNewVM({...newVM, name: sanitized});
                      }} 
                      placeholder="e.g. web-server-01"
                      aria-describedby="vm-name-help"
                      aria-required="true"
                      aria-invalid={newVM.name.length > 0 && !/^[a-zA-Z0-9_-]+$/.test(newVM.name)}
                    />
                <p id="vm-name-help" className="text-xs text-gray-500 mt-1">
                  Only letters, numbers, hyphens (-), and underscores (_) are allowed.
                </p>
              </div>
              
              <div>
                <label htmlFor="os-type" className="block text-sm font-medium mb-1">
                  OS Image
                  <span className="text-red-500 ml-1" aria-label="required">*</span>
                </label>
                <select 
                  id="os-type"
                  className="w-full p-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  value={newVM.os_type}
                  onChange={e => setNewVM({...newVM, os_type: e.target.value})}
                  aria-describedby="os-type-help"
                  aria-required="true"
                >
                  <option value="ubuntu-desktop">Ubuntu Desktop (GUI Installer)</option>
                  <option value="ubuntu-server">Ubuntu Server (CLI Installer)</option>
                  <option value="kali">Kali Linux (GUI Installer)</option>
                  <option value="windows10">Windows 10 (GUI Installer)</option>
                </select>
                <p id="os-type-help" className="text-xs text-gray-500 mt-1">
                  * First boot will start OS installer via VNC Console.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">CPU Cores</label>
                  <div className="border border-gray-300 rounded-lg bg-gray-50 overflow-hidden">
                    <RevolverPicker
                      items={Array.from({ length: 32 }, (_, i) => i + 1)}
                      value={newVM.cpu}
                      onChange={(cpu) => setNewVM({...newVM, cpu})}
                      formatLabel={(v) => `${v}`}
                      itemHeight={40}
                      visibleItems={3}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-center">Selected: {newVM.cpu} core{newVM.cpu !== 1 ? 's' : ''}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Memory</label>
                  <div className="border border-gray-300 rounded-lg bg-gray-50 overflow-hidden">
                    <RevolverPicker
                      items={Array.from({ length: 160 }, (_, i) => i + 1)}
                      value={Math.round(newVM.memory / 1024)}
                      onChange={(gb) => setNewVM({...newVM, memory: gb * 1024})}
                      formatLabel={(v) => `${v} GB`}
                      itemHeight={40}
                      visibleItems={3}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-center">Selected: {Math.round(newVM.memory / 1024)} GB ({newVM.memory} MB)</p>
                </div>
              </div>
              <button 
                type="submit" 
                disabled={createVMMutation.isPending} 
                className="w-full py-2 px-4 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 hover:shadow-md disabled:opacity-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 font-medium"
                aria-busy={createVMMutation.isPending}
                aria-label={createVMMutation.isPending ? 'Creating virtual machine...' : 'Create new virtual machine'}
              >
                {createVMMutation.isPending ? 'Creating...' : 'Create VM'}
              </button>
            </form>
          </div>

          {/* VM List Section */}
          <VMListSection 
            onAction={handleAction}
            onEdit={(vm) => {
              // 최신 VM 데이터를 React Query 캐시에서 가져와서 설정
              if (vm) {
                const currentVMs = queryClient.getQueryData<VM[]>(['vms']);
                const latestVM = currentVMs?.find(v => v.uuid === vm.uuid);
                if (latestVM) {
                  window.console.log('[onEdit] Using latest VM data from cache:', {
                    uuid: latestVM.uuid,
                    name: latestVM.name,
                    cpu: latestVM.cpu,
                    memory: latestVM.memory,
                    boot_order: latestVM.boot_order,
                  });
                  setEditingVM(latestVM);
                } else {
                  window.console.log('[onEdit] VM not found in cache, using provided VM:', vm);
                  setEditingVM(vm);
                }
              } else {
                setEditingVM(null);
              }
            }}
            processingId={processingId}
            editingVM={editingVM}
            selectedVMForSnapshot={selectedVMForSnapshot}
            onSnapshotSelect={setSelectedVMForSnapshot}
          />
        </section>

        {/* Edit VM Popup */}
        {editingVM && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <div 
              className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto edit-popup-container"
              onClick={(e) => {
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
            >
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900">Edit VM: {editingVM.name}</h2>
                <form onSubmit={handleUpdateVM} className="space-y-4">
                <div>
                  <label htmlFor="edit-vm-name" className="block text-sm font-medium mb-1 text-gray-700">
                    VM Name
                  </label>
                  <input
                    id="edit-vm-name"
                    type="text"
                    required
                    maxLength={100}
                    className="w-full p-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    value={editingVM.name || ''}
                    onChange={(e) => {
                      const originalValue = e.target.value;
                      // Input validation: Only allow letters, numbers, hyphens, underscores
                      const sanitized = originalValue.replace(/[^a-zA-Z0-9_-]/g, '');
                      
                      // Check if invalid characters were entered
                      if (originalValue !== sanitized) {
                        toast.error('VM name can only contain letters, numbers, hyphens (-), and underscores (_).');
                      }
                      
                      setEditingVM({ ...editingVM, name: sanitized });
                    }}
                    onInvalid={(e) => {
                      const target = e.target as HTMLInputElement;
                      if (!/^[a-zA-Z0-9_-]+$/.test(target.value)) {
                        target.setCustomValidity('Only letters, numbers, hyphens (-), and underscores (_) are allowed.');
                      } else {
                        target.setCustomValidity('');
                      }
                    }}
                  />
                  <p className="text-xs text-gray-500">
                    Only letters, numbers, hyphens (-), and underscores (_) are allowed.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      CPU Cores
                    </label>
                    <div className="border border-gray-300 rounded-lg bg-gray-50 overflow-hidden">
                      <RevolverPicker
                        items={Array.from({ length: 32 }, (_, i) => i + 1)}
                        value={editingVM.cpu || 1}
                        onChange={(cpu) => setEditingVM({ ...editingVM, cpu })}
                        formatLabel={(v) => `${v}`}
                        itemHeight={40}
                        visibleItems={3}
                      />
                    </div>
                    <p className="text-xs text-gray-500">Selected: {editingVM.cpu || 1} core{(editingVM.cpu || 1) !== 1 ? 's' : ''}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      Memory
                    </label>
                    <div className="border border-gray-300 rounded-lg bg-gray-50 overflow-hidden">
                      <RevolverPicker
                        items={Array.from({ length: 160 }, (_, i) => i + 1)}
                        value={Math.round((editingVM.memory || 1024) / 1024)}
                        onChange={(gb) => {
                          setEditingVM({ ...editingVM, memory: gb * 1024 });
                        }}
                        formatLabel={(v) => `${v} GB`}
                        itemHeight={40}
                        visibleItems={3}
                      />
                    </div>
                    <p className="text-xs text-gray-500">Selected: {Math.round((editingVM.memory || 1024) / 1024)} GB ({editingVM.memory || 1024} MB)</p>
                  </div>
                </div>
                <div>
                  <BootOrderSelector
                    value={editingVM.boot_order}
                    onChange={(bootOrder) => {
                      if (editingVM) {
                        // 즉시 UI 업데이트 (낙관적 업데이트)
                        setEditingVM({ ...editingVM, boot_order: bootOrder });
                        // API 호출
                        handleBootOrderChange(editingVM.uuid, bootOrder);
                      }
                    }}
                    disabled={vmActionMutation.isPending || processingId === editingVM.uuid}
                  />
                </div>
                {editingVM.installation_status !== 'installed' && (
                  <div className="border-t border-gray-200 pt-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.console.log('[FinalizeInstall] Button clicked:', editingVM.uuid);
                        if (editingVM?.uuid) {
                          handleFinalizeInstall(editingVM.uuid);
                        }
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      disabled={vmActionMutation.isPending || processingId === editingVM.uuid}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {processingId === editingVM.uuid ? 'Finalizing...' : 'Finalize Installation'}
                    </button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Remove CDROM and boot from HDD only
                    </p>
                  </div>
                )}
                <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.console.log('[EditVM] Cancel button clicked');
                      setEditingVM(null);
                    }}
                    className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 hover:shadow-md transition-all duration-200 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    onClick={(e) => {
                      window.console.log('[EditVM] Update button clicked');
                    }}
                    disabled={vmActionMutation.isPending || processingId === editingVM.uuid}
                    className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 hover:shadow-md transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {vmActionMutation.isPending && processingId === editingVM.uuid ? 'Updating...' : 'Update'}
                  </button>
                </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
