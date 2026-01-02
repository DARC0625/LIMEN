'use client';

import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { vmAPI, removeToken, VM, isAdmin } from '../lib/api';
import SnapshotManager from '../components/SnapshotManager';
import QuotaDisplay from '../components/QuotaDisplay';
import { useToast } from '../components/ToastContainer';
import { useVMWebSocket } from '../hooks/useVMWebSocket';

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
  const toast = useToast();
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [agentMetrics, setAgentMetrics] = useState<Metrics | null>(null);
  const [agentStatus, setAgentStatus] = useState<string>('Connecting...');
  
  const [vms, setVms] = useState<VM[]>([]);
  const [newVM, setNewVM] = useState({ name: '', cpu: 1, memory: 1024, os_type: 'ubuntu-desktop' });
  const [isCreating, setIsCreating] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  
  // Edit VM State
  const [editingVM, setEditingVM] = useState<VM | null>(null);
  const [selectedVMForSnapshot, setSelectedVMForSnapshot] = useState<number | null>(null);
  
  // Carousel State
  const [currentIndex, setCurrentIndex] = useState(1); // 복제된 배열의 중간부터 시작 (인덱스 1)
  const [isTransitioning, setIsTransitioning] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);
  
  // 무한 루프를 위한 카드 배열 생성
  const getCarouselCards = () => {
    if (vms.length === 0) return [];
    if (vms.length === 1) return vms;
    // 마지막 카드 + 모든 카드 + 첫 번째 카드
    return [vms[vms.length - 1], ...vms, vms[0]];
  };
  
  const carouselCards = getCarouselCards();
  
  // vms 변경 시 인덱스 리셋
  useEffect(() => {
    if (vms.length > 1) {
      setCurrentIndex(1);
      setIsTransitioning(false);
    }
  }, [vms.length]);
  
  // 전환 효과 제어
  useEffect(() => {
    if (carouselRef.current) {
      carouselRef.current.style.transition = isTransitioning ? 'transform 0.3s ease-in-out' : 'none';
    }
  }, [isTransitioning]);

  useEffect(() => {
    const fetchHealth = () => {
      fetch('/api/health_proxy')
        .then(res => res.json())
        .then(data => setHealth(data))
        .catch(err => console.error("Health check failed", err));
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000); // 10 seconds - good balance
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchMetrics = () => {
      fetch('/agent/metrics')
        .then(res => res.json())
        .then(data => {
          setAgentMetrics(data);
          setAgentStatus('Online');
        })
        .catch(() => setAgentStatus('Offline'));
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // 5 seconds - responsive for system metrics
    return () => clearInterval(interval);
  }, []);

  const fetchVMs = async () => {
    try {
      const data = await vmAPI.list();
      setVms(data);
    } catch (err: any) {
      console.error("Failed to fetch VMs", err);
      // If unauthorized, remove token and reload to show login
      if (err.message?.includes('401') || 
          err.message?.includes('Unauthorized') || 
          err.message?.includes('Authentication required') ||
          err.message?.includes('HTTP error! status: 401')) {
        removeToken();
        // Force reload to trigger AuthGuard
        setTimeout(() => window.location.href = '/', 100);
        return;
      }
      // For other errors, just log but don't reload
      console.error('VM fetch error:', err);
    }
  };

  // Track last quota update time to prevent excessive events
  const lastQuotaUpdateRef = useRef<number>(0);
  const QUOTA_UPDATE_THROTTLE = 1000; // Minimum 1 second between quota updates

  // WebSocket handlers - optimized to prevent unnecessary re-renders and freezing
  const handleVMUpdate = useCallback((vm: VM) => {
    // Use startTransition to mark this as a non-urgent update
    startTransition(() => {
      setVms((prevVms) => {
        const index = prevVms.findIndex((v) => v.id === vm.id);
        if (index >= 0) {
          // Check if VM actually changed to avoid unnecessary updates
          const prevVM = prevVms[index];
          const vmChanged = prevVM.status !== vm.status || 
                          prevVM.cpu !== vm.cpu || 
                          prevVM.memory !== vm.memory ||
                          prevVM.name !== vm.name ||
                          prevVM.os_type !== vm.os_type;
          
          if (!vmChanged) {
            // No changes, return same array reference to prevent re-render
            return prevVms;
          }
          
          // Update existing VM - only trigger quota refresh if CPU/Memory changed
          const cpuChanged = prevVM.cpu !== vm.cpu;
          const memoryChanged = prevVM.memory !== vm.memory;
          if (cpuChanged || memoryChanged) {
            const now = Date.now();
            if (now - lastQuotaUpdateRef.current > QUOTA_UPDATE_THROTTLE) {
              lastQuotaUpdateRef.current = now;
              // Use setTimeout to defer quota update
              setTimeout(() => {
                window.dispatchEvent(new Event('vmChanged'));
              }, 300);
            }
          }
          // Create new array with updated VM (including os_type)
          const updated = [...prevVms];
          updated[index] = { ...vm }; // 전체 VM 객체 복사 (os_type 포함)
          return updated;
        } else {
          // New VM, add to list
          // Trigger quota refresh only once for new VMs (throttled)
          const now = Date.now();
          if (now - lastQuotaUpdateRef.current > QUOTA_UPDATE_THROTTLE) {
            lastQuotaUpdateRef.current = now;
            // Use setTimeout to defer quota update
            setTimeout(() => {
              window.dispatchEvent(new Event('vmChanged'));
            }, 300);
          }
          return [...prevVms, vm];
        }
      });
    });
  }, []);

  const handleVMList = useCallback((vms: VM[]) => {
    // Use startTransition to mark this as a non-urgent update
    startTransition(() => {
      setVms((prevVms) => {
        // Check if list actually changed (deep comparison would be expensive, so check length and IDs)
        if (prevVms.length === vms.length) {
          // Same length, check if IDs match (quick check)
          const prevIds = new Set(prevVms.map(v => v.id));
          const newIds = new Set(vms.map(v => v.id));
          if (prevIds.size === newIds.size && 
              [...prevIds].every(id => newIds.has(id))) {
            // Same VMs, return same array reference to prevent re-render
            return prevVms;
          }
        }
        
        // Only trigger quota refresh if list size changed (e.g., VM deleted)
        if (prevVms.length !== vms.length) {
          const now = Date.now();
          if (now - lastQuotaUpdateRef.current > QUOTA_UPDATE_THROTTLE) {
            lastQuotaUpdateRef.current = now;
            // Use setTimeout to defer quota update
            setTimeout(() => {
              window.dispatchEvent(new Event('vmChanged'));
            }, 300);
          }
        }
        return vms;
      });
    });
  }, []);

  // WebSocket connection for real-time updates
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  useVMWebSocket(handleVMUpdate, handleVMList, !!token);

  useEffect(() => {
    // Initial fetch and fallback polling (slower interval when WebSocket is active)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token && token.trim() !== '') {
        fetchVMs();
        // Fallback polling every 30 seconds (WebSocket handles real-time updates)
        // Good balance between responsiveness and performance
        const interval = setInterval(fetchVMs, 30000);
        return () => clearInterval(interval);
      }
    }
  }, []);

  const handleCreateVM = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const createdVM = await vmAPI.create(newVM);
      setNewVM({ name: '', cpu: 1, memory: 1024, os_type: 'ubuntu-desktop' });
      
      // Optimistically update local state immediately to prevent UI freezing
      // WebSocket update will sync later, but we don't wait for it
      startTransition(() => {
        setVms((prevVms) => {
          // Check if VM already exists (from WebSocket update that might have arrived first)
          const exists = prevVms.some(v => v.id === createdVM.id);
          if (exists) {
            // Update existing VM to ensure os_type is included
            const index = prevVms.findIndex(v => v.id === createdVM.id);
            if (index >= 0) {
              const newVms = [...prevVms];
              newVms[index] = { ...createdVM }; // 전체 VM 객체 복사 (os_type 포함)
              return newVms;
            }
            return prevVms;
          }
          return [...prevVms, createdVM];
        });
      });
      
      // Trigger quota update after a delay to avoid blocking
      setTimeout(() => {
        const now = Date.now();
        if (now - lastQuotaUpdateRef.current > QUOTA_UPDATE_THROTTLE) {
          lastQuotaUpdateRef.current = now;
          window.dispatchEvent(new Event('vmChanged'));
        }
      }, 500);
      
      toast.success('VM created successfully!');
    } catch (err: any) {
      toast.error(`Error creating VM: ${err.message}${err.message.includes('timeout') ? ' (Check the list after a while)' : ''}`);
    } finally {
      setIsCreating(false);
    }
  };

  // 외부 클릭 시 Edit 팝업 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingVM && !(event.target as Element).closest('.edit-popup-container')) {
        setEditingVM(null);
      }
    };
    if (editingVM) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [editingVM]);

  const handleUpdateVM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVM) return;
    
    setProcessingId(editingVM.id);
    try {
        await vmAPI.action(editingVM.id, 'update', editingVM.cpu, editingVM.memory);
        setEditingVM(null);
        // Don't call fetchVMs() - WebSocket will handle the update
        // Don't dispatch vmChanged here - handleVMUpdate will handle it (throttled)
        toast.success('VM updated successfully!');
    } catch (err: any) {
        toast.error(`Error updating VM: ${err.message}`);
    } finally {
        setProcessingId(null);
    }
  };

  const handleAction = async (id: number, action: 'start' | 'stop' | 'delete') => {
    if (action === 'delete' && !confirm('Are you sure you want to delete this VM?')) return;
    
    setProcessingId(id);
    try {
      await vmAPI.action(id, action);
      // Don't call fetchVMs() - WebSocket will handle the update
      // Don't dispatch vmChanged here - handleVMList will handle it for delete (throttled)
      
      const actionMessages = {
        start: 'VM started successfully',
        stop: 'VM stopped successfully',
        delete: 'VM deleted successfully',
      };
      toast.success(actionMessages[action]);
    } catch (err: any) {
      toast.error(`Error performing ${action}: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  const copyToClipboard = async (text: string, label: string = 'UUID') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleString('ko-KR', { 
        timeZone: 'Asia/Seoul', 
        year: 'numeric', month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
      });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50 text-gray-900 font-sans">
      <main className="max-w-6xl mx-auto flex flex-col gap-8">
        <header className="flex justify-between items-center border-b pb-4">
          <h1 className="text-3xl font-bold">LIMEN Dashboard</h1>
          <div className="flex items-center gap-4">
            {isAdmin() && (
              <a
                href="/admin/users"
                className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                User Management
              </a>
            )}
            <button
              onClick={() => {
                removeToken();
                window.location.reload();
              }}
              className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Logout
            </button>
          </div>
        </header>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <StatusCard title="Connection Status" status={health?.status === 'ok' ? 'ok' : 'error'}>
            <StatusRow label="Database" value={health?.db} />
            <StatusRow label="VM Service" value={health?.libvirt} />
            <div className="text-xs text-gray-400 text-right mt-2">
              Last update: {health ? formatDate(health.time) : '-'}
            </div>
          </StatusCard>

          <QuotaDisplay />

          <StatusCard title="Agent Metrics" status={agentStatus === 'Online' ? 'ok' : 'error'} subStatus={agentStatus}>
            {agentMetrics ? (
              <div className="space-y-4 mt-2">
                <ProgressBar label="CPU Usage" value={agentMetrics.cpu_usage} color="bg-blue-600" />
                <ProgressBar label={`Memory (${formatBytes(agentMetrics.used_memory)} / ${formatBytes(agentMetrics.total_memory)})`} value={(agentMetrics.used_memory / agentMetrics.total_memory) * 100} color="bg-purple-600" />
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">Waiting...</div>
            )}
          </StatusCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 p-6 bg-white rounded-xl shadow-sm border border-gray-200 h-fit">
            <h2 className="text-xl font-semibold mb-4">Create New VM</h2>
            <form onSubmit={handleCreateVM} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">VM Name</label>
                <input type="text" required className="w-full p-2 border rounded" value={newVM.name} onChange={e => setNewVM({...newVM, name: e.target.value})} placeholder="e.g. web-server-01" />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">OS Image</label>
                <select 
                  className="w-full p-2 border rounded"
                  value={newVM.os_type}
                  onChange={e => setNewVM({...newVM, os_type: e.target.value})}
                >
                  <option value="ubuntu-desktop">Ubuntu Desktop (GUI Installer)</option>
                  <option value="ubuntu-server">Ubuntu Server (CLI Installer)</option>
                  <option value="kali">Kali Linux (GUI Installer)</option>
                  <option value="windows">Windows (Requires ISO file)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  * First boot will start OS installer via VNC Console.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">CPU</label>
                  <input 
                    type="number" 
                    className="w-full p-2 border rounded" 
                    value={newVM.cpu || ''} 
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                      setNewVM({...newVM, cpu: val});
                    }} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Memory (MB)</label>
                  <input 
                    type="number" 
                    className="w-full p-2 border rounded" 
                    value={newVM.memory || ''} 
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                      setNewVM({...newVM, memory: val});
                    }} 
                  />
                </div>
              </div>
              <button type="submit" disabled={isCreating} className="w-full py-2 px-4 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50">
                {isCreating ? 'Creating...' : 'Create VM'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">Virtual Machines</h2>
            {vms.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No VMs found.</div>
            ) : (
              <div className="relative">
                {/* 이전 버튼 */}
                {vms.length > 1 && (
                  <button
                    onClick={() => {
                      setIsTransitioning(true);
                      setCurrentIndex((prev) => {
                        const newIndex = prev - 1;
                        if (newIndex === 0) {
                          // 첫 번째 카드(복제된 배열의 인덱스 1)에서 이전으로 가면 마지막 카드(인덱스 vms.length)로 점프
                          setTimeout(() => {
                            setIsTransitioning(false);
                            setCurrentIndex(vms.length);
                          }, 300);
                        }
                        return newIndex;
                      });
                    }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-white rounded-full p-2 shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    aria-label="Previous VM"
                  >
                    <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                
                {/* 카루셀 컨테이너 */}
                <div className="overflow-hidden">
                  <div
                    ref={carouselRef}
                    className="flex gap-6"
                    style={{
                      transform: `translateX(calc(50% - ${currentIndex * 248}px - 112px))`,
                    }}
                  >
                    {carouselCards.map((vm, index) => {
                      // OS 타입에 따른 로고 결정
                      const getOSLogo = (osType?: string) => {
                      if (!osType || osType.trim() === '') {
                        // os_type이 없으면 기본 로고 반환
                        return (
                          <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" fill="#9CA3AF"/>
                            <path d="M12 2L15 9L12 7L9 9L12 2Z" fill="white"/>
                            <path d="M12 22L9 15L12 17L15 15L12 22Z" fill="white"/>
                            <path d="M2 12L9 9L7 12L9 15L2 12Z" fill="white"/>
                            <path d="M22 12L15 15L17 12L15 9L22 12Z" fill="white"/>
                          </svg>
                        );
                      }
                      const os = osType.toLowerCase().trim();
                      
                      // 정확한 매칭: ubuntu-desktop
                      if (os === 'ubuntu-desktop' || (os.includes('ubuntu') && os.includes('desktop'))) {
                        // 우분투 데스크탑 로고
                        return (
                        <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" fill="#E95420"/>
                          <circle cx="12" cy="12" r="8" fill="#77216F"/>
                          <circle cx="12" cy="12" r="6" fill="#5E2750"/>
                          <path d="M12 2L15 9L12 7L9 9L12 2Z" fill="white"/>
                          <path d="M12 22L9 15L12 17L15 15L12 22Z" fill="white"/>
                          <path d="M2 12L9 9L7 12L9 15L2 12Z" fill="white"/>
                          <path d="M22 12L15 15L17 12L15 9L22 12Z" fill="white"/>
                        </svg>
                      );
                      // 정확한 매칭: ubuntu-server
                      } else if (os === 'ubuntu-server' || (os.includes('ubuntu') && os.includes('server'))) {
                        // 우분투 서버 로고
                        return (
                          <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" fill="#E95420"/>
                            <circle cx="12" cy="12" r="8" fill="#77216F"/>
                            <circle cx="12" cy="12" r="6" fill="#5E2750"/>
                            <path d="M12 2L15 9L12 7L9 9L12 2Z" fill="white"/>
                            <path d="M12 22L9 15L12 17L15 15L12 22Z" fill="white"/>
                            <path d="M2 12L9 9L7 12L9 15L2 12Z" fill="white"/>
                            <path d="M22 12L15 15L17 12L15 9L22 12Z" fill="white"/>
                          </svg>
                        );
                      // 정확한 매칭: kali
                      } else if (os === 'kali' || os.includes('kali')) {
                        // 칼리 리눅스 로고
                        return (
                          <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" fill="#557C94"/>
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#557C94"/>
                            <path d="M8 10c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm4 4c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z" fill="#557C94"/>
                            <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" fill="#557C94"/>
                          </svg>
                        );
                      // 정확한 매칭: windows
                      } else if (os === 'windows' || os.includes('windows')) {
                      // 윈도우 로고
                      return (
                        <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
                          <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" fill="#0078D4"/>
                        </svg>
                      );
                      }
                      return null;
                    };

                    const osLogo = getOSLogo(vm.os_type);
                    
                      return (
                        <div
                          key={`${vm.id}-${index}`}
                          className="relative border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow flex flex-col w-56 flex-shrink-0 h-[280px]"
                        >
                          {/* VM 정보 */}
                          <div className="space-y-2 text-center flex-1 flex flex-col justify-between">
                          {/* OS 로고 (상단, 항상 표시) */}
                          <div className="flex justify-center mb-2">
                            <div className="flex items-center justify-center">
                              {osLogo}
                            </div>
                          </div>
                            
                            {/* 이름, 스펙, 상태 영역 (하단, 호버 시 액션 버튼으로 전환) */}
                            <div className="group relative flex-1 flex flex-col justify-center min-h-[120px]">
                            {/* 기본 내용 (이름, 스펙, 상태) - 호버 시 숨김 */}
                            <div className="group-hover:opacity-0 group-hover:pointer-events-none transition-opacity duration-200 flex flex-col gap-2">
                              {/* VM 이름 */}
                              <h3 className="text-base font-semibold text-gray-900 truncate px-1" title={vm.name}>{vm.name}</h3>
                              
                              {/* 스펙 */}
                              <div className="flex flex-col gap-1.5 items-center">
                                <div className="flex items-center gap-2 text-sm justify-center">
                                  <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                  </svg>
                                  <span className="font-medium text-gray-700">{vm.cpu} vCPU</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm justify-center">
                                  <svg className="w-4 h-4 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                  </svg>
                                  <span className="font-medium text-gray-700">{formatBytes(vm.memory * 1024 * 1024)}</span>
                                </div>
                              </div>

                              {/* 상태 */}
                              <div className="flex justify-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                  vm.status === 'Running' ? 'bg-green-100 text-green-800' : 
                                  vm.status === 'Stopped' ? 'bg-gray-100 text-gray-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {vm.status}
                                </span>
                              </div>
                            </div>

                            {/* 액션 버튼들 (호버 시 표시) */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200 flex items-center justify-center">
                              <div className="flex flex-col gap-2 items-center">
                                {/* 첫 번째 줄: 실행, 종료, 콘솔 */}
                                <div className="flex items-center gap-2 justify-center">
                                  <button 
                                    onClick={() => handleAction(vm.id, 'start')}
                                    disabled={processingId === vm.id || vm.status === 'Running'}
                                    title="Start VM"
                                    className="p-2 text-green-600 hover:bg-green-50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </button>
                                  <button 
                                    onClick={() => handleAction(vm.id, 'stop')}
                                    disabled={processingId === vm.id || vm.status !== 'Running'}
                                    title="Stop VM"
                                    className="p-2 text-yellow-600 hover:bg-yellow-50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9v-4z" />
                                    </svg>
                                  </button>
                                  <a 
                                    href={`/vnc/${vm.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Open Console"
                                    className={`p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors ${vm.status !== 'Running' ? 'pointer-events-none opacity-30' : ''}`}
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                  </a>
                                </div>
                                {/* 두 번째 줄: 에딧, 스냅샷, 삭제 */}
                                <div className="flex items-center gap-2 justify-center">
                                  <div className="relative edit-popup-container">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingVM(editingVM?.id === vm.id ? null : vm);
                                      }}
                                      disabled={processingId === vm.id || vm.status === 'Running'}
                                      title="Edit VM"
                                      className="p-2 text-gray-600 hover:bg-gray-50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    {/* Edit 팝업 */}
                                    {editingVM?.id === vm.id && (
                                      <div 
                                        className="absolute right-0 top-full mt-2 z-50 bg-white p-4 rounded-xl shadow-2xl border border-gray-200 w-80"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <h3 className="text-lg font-bold mb-4 text-gray-900">Edit VM: {vm.name}</h3>
                                        <form onSubmit={handleUpdateVM} className="space-y-4">
                                          <div>
                                            <label className="block text-sm font-medium mb-1 text-gray-700">CPU Cores</label>
                                            <input 
                                              type="number" 
                                              className="w-full p-2 border rounded text-gray-900"
                                              value={editingVM.cpu || ''}
                                              onChange={e => {
                                                const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                                setEditingVM({...editingVM, cpu: val});
                                              }}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-sm font-medium mb-1 text-gray-700">Memory (MB)</label>
                                            <input 
                                              type="number"
                                              className="w-full p-2 border rounded text-gray-900"
                                              value={editingVM.memory || ''}
                                              onChange={e => {
                                                const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                                setEditingVM({...editingVM, memory: val});
                                              }}
                                            />
                                          </div>
                                          <div className="flex justify-end gap-3 mt-4">
                                            <button 
                                              type="button" 
                                              onClick={() => setEditingVM(null)}
                                              className="px-4 py-2 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
                                            >
                                              Cancel
                                            </button>
                                            <button 
                                              type="submit" 
                                              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                            >
                                              Save
                                            </button>
                                          </div>
                                        </form>
                                      </div>
                                    )}
                                  </div>
                                  <button 
                                    onClick={() => setSelectedVMForSnapshot(selectedVMForSnapshot === vm.id ? null : vm.id)}
                                    title="Manage Snapshots"
                                    className={`p-2 text-purple-600 hover:bg-purple-50 rounded transition-colors ${selectedVMForSnapshot === vm.id ? 'bg-purple-100' : ''}`}
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                  </button>
                                  <button 
                                    onClick={() => handleAction(vm.id, 'delete')}
                                    disabled={processingId === vm.id}
                                    title="Delete VM"
                                    className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* UUID (맨 하단) - 간결하게 표시 */}
                          <div className="pt-1.5 border-t border-gray-100 mt-auto">
                            <button
                              onClick={() => copyToClipboard(vm.uuid || '', 'VM UUID')}
                              className="w-full text-xs text-gray-400 font-mono hover:text-blue-600 hover:underline cursor-pointer transition-colors text-center truncate"
                              title="Click to copy full UUID"
                            >
                              {vm.uuid ? `${vm.uuid.substring(0, 8)}...` : 'N/A'}
                            </button>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* 다음 버튼 */}
                {vms.length > 1 && (
                  <button
                    onClick={() => {
                      setIsTransitioning(true);
                      setCurrentIndex((prev) => {
                        const newIndex = prev + 1;
                        if (newIndex === vms.length + 1) {
                          // 마지막 카드(복제된 배열의 인덱스 vms.length)에서 다음으로 가면 첫 번째 카드(인덱스 1)로 점프
                          setTimeout(() => {
                            setIsTransitioning(false);
                            setCurrentIndex(1);
                          }, 300);
                        }
                        return newIndex;
                      });
                    }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-white rounded-full p-2 shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    aria-label="Next VM"
                  >
                    <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            {selectedVMForSnapshot && vms.find(vm => vm.id === selectedVMForSnapshot) && (
              <div className="mt-4">
                <SnapshotManager 
                  vmId={selectedVMForSnapshot} 
                  vmName={vms.find(vm => vm.id === selectedVMForSnapshot)!.name} 
                />
              </div>
            )}
          </div>
        </div>
      </main>


    </div>
  );
}

function StatusCard({ title, status, subStatus, children }: { title: string, status: 'ok'|'error', subStatus?: string, children: React.ReactNode }) {
  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`}></span>
          {title}
        </h2>
        {subStatus && <span className="text-xs font-mono text-gray-500">{subStatus}</span>}
      </div>
      {children}
    </div>
  );
}

function StatusRow({ label, value }: { label: string, value?: string }) {
  return (
    <div className="flex justify-between items-center p-2 bg-gray-100 rounded mb-2">
      <span className="font-medium">{label}</span>
      <span className={`px-2 py-0.5 text-xs rounded-full ${
        value === 'connected' ? 'bg-green-100 text-green-800' : 
        'bg-red-100 text-red-800'
      }`}>
        {value || 'Unknown'}
      </span>
    </div>
  );
}

function ProgressBar({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-mono">{value.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div className={`${color} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${Math.min(value, 100)}%` }}></div>
      </div>
    </div>
  );
}
