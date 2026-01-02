'use client';

import { useState, useEffect, startTransition } from 'react';
import dynamicImport from 'next/dynamic';
import { removeToken, isAdmin } from '../../../lib/api';
import { useToast } from '../../../components/ToastContainer';
import { useCreateVM, useVMAction } from '../../../hooks/useVMs';
import { useAuth } from '../../../components/AuthGuard';
import RevolverPicker from '../../../components/RevolverPicker';
import type { VM } from '../../../lib/types';

// Dynamic import: Client-side only rendering for authenticated components (prevents hydration mismatch)
const QuotaDisplay = dynamicImport(() => import('../../../components/QuotaDisplay').then(mod => mod.default), { ssr: false });
const VMListSection = dynamicImport(() => import('../../../components/VMListSection').then(mod => mod.default), { ssr: false });
const HealthStatus = dynamicImport(() => import('../../../components/HealthStatus').then(mod => mod.default), { ssr: false });
const AgentMetricsCard = dynamicImport(() => import('../../../components/AgentMetricsCard').then(mod => mod.default), { ssr: false });

// ThemeToggle is loaded immediately (dark mode toggle is important)
import ThemeToggle from '../../../components/ThemeToggle';
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
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const createVMMutation = useCreateVM();
  const vmActionMutation = useVMAction();
  
  // Phase 4: isAdmin()이 비동기로 변경되어 useState로 관리
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  
  // Don't render if not authenticated (prevents hydration mismatch)
  // AuthGuard already protects, but this is an additional safety measure
  if (isAuthenticated !== true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">Authenticating...</div>
      </div>
    );
  }
  
  // Phase 4: isAdmin() 비동기 호출
  useEffect(() => {
    isAdmin().then(setIsUserAdmin).catch(() => setIsUserAdmin(false));
  }, []);
  
  const [newVM, setNewVM] = useState({ name: '', cpu: 1, memory: 1024, os_type: 'ubuntu-desktop' });
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Edit VM State
  const [editingVM, setEditingVM] = useState<VM | null>(null);
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

  // Close Edit popup on outside click
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

  const handleAction = async (uuid: string, action: 'start' | 'stop' | 'restart' | 'delete') => {
    if (action === 'delete' && !confirm('Are you sure you want to delete this VM?')) return;
    if (action === 'restart' && !confirm('Are you sure you want to restart this VM? The VM will be stopped and then started.')) return;
    
    setProcessingId(uuid);
    vmActionMutation.mutate(
      { uuid, action },
      {
        onSuccess: () => {
          // React Error #321 fix: Wrap state updates with startTransition
          startTransition(() => {
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


  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 pb-12 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 font-sans transition-colors overflow-x-hidden">
      {/* Skip link - Quick navigation for keyboard users (accessibility: hidden off-screen) */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded focus:shadow-lg"
        aria-label="Skip to main content"
      >
        Skip to main content
      </a>
      
      <main id="main-content" className="max-w-7xl mx-auto flex flex-col gap-4 sm:gap-6 md:gap-8" role="main">
        <header role="banner" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
          <h1 className="text-2xl sm:text-3xl font-bold">LIMEN Dashboard</h1>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {isUserAdmin && (
              <a
                href="/admin/users"
                className="px-3 py-1 text-sm bg-purple-600 dark:bg-purple-700 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-800 transition-colors"
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
              className="px-3 py-1 text-sm bg-gray-500 dark:bg-gray-600 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-700 transition-colors"
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
          <div className="lg:col-span-1 p-4 sm:p-6 bg-white dark:bg-gray-800/90 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 transition-all backdrop-blur-sm flex flex-col" style={{ minHeight: '400px' }}>
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Create New VM</h2>
            <form onSubmit={handleCreateVM} className="space-y-4" aria-label="Create new virtual machine form">
              <div>
                <label htmlFor="vm-name" className="block text-sm font-medium mb-1">VM Name</label>
                    <input 
                      id="vm-name"
                      type="text" 
                      required 
                      maxLength={100}
                      pattern="[a-zA-Z0-9_-]+"
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
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
                    />
                <p id="vm-name-help" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Only letters, numbers, hyphens (-), and underscores (_) are allowed.
                </p>
              </div>
              
              <div>
                <label htmlFor="os-type" className="block text-sm font-medium mb-1">OS Image</label>
                <select 
                  id="os-type"
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={newVM.os_type}
                  onChange={e => setNewVM({...newVM, os_type: e.target.value})}
                  aria-describedby="os-type-help"
                >
                  <option value="ubuntu-desktop">Ubuntu Desktop (GUI Installer)</option>
                  <option value="ubuntu-server">Ubuntu Server (CLI Installer)</option>
                  <option value="kali">Kali Linux (GUI Installer)</option>
                  <option value="windows">Windows (Requires ISO file)</option>
                </select>
                <p id="os-type-help" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  * First boot will start OS installer via VNC Console.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">CPU Cores</label>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 overflow-hidden">
                    <RevolverPicker
                      items={Array.from({ length: 32 }, (_, i) => i + 1)}
                      value={newVM.cpu}
                      onChange={(cpu) => setNewVM({...newVM, cpu})}
                      formatLabel={(v) => `${v}`}
                      itemHeight={40}
                      visibleItems={3}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">Selected: {newVM.cpu} core{newVM.cpu !== 1 ? 's' : ''}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Memory</label>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 overflow-hidden">
                    <RevolverPicker
                      items={Array.from({ length: 160 }, (_, i) => i + 1)}
                      value={Math.round(newVM.memory / 1024)}
                      onChange={(gb) => setNewVM({...newVM, memory: gb * 1024})}
                      formatLabel={(v) => `${v} GB`}
                      itemHeight={40}
                      visibleItems={3}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">Selected: {Math.round(newVM.memory / 1024)} GB ({newVM.memory} MB)</p>
                </div>
              </div>
              <button 
                type="submit" 
                disabled={createVMMutation.isPending} 
                className="w-full py-2 px-4 bg-black dark:bg-gray-700 text-white rounded hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
            onEdit={setEditingVM}
            processingId={processingId}
            editingVM={editingVM}
            selectedVMForSnapshot={selectedVMForSnapshot}
            onSnapshotSelect={setSelectedVMForSnapshot}
          />
        </section>

        {/* Edit VM Popup */}
        {editingVM && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 edit-popup-container" onClick={(e) => {
            if (e.target === e.currentTarget) setEditingVM(null);
          }}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4 border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Edit VM: {editingVM.name}</h2>
              <form onSubmit={handleUpdateVM} className="space-y-4">
                <div>
                  <label htmlFor="edit-vm-name" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    VM Name
                  </label>
                  <input
                    id="edit-vm-name"
                    type="text"
                    required
                    maxLength={100}
                    pattern="[a-zA-Z0-9_-]+"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Only letters, numbers, hyphens (-), and underscores (_) are allowed.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      CPU Cores
                    </label>
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 overflow-hidden">
                      <RevolverPicker
                        items={Array.from({ length: 32 }, (_, i) => i + 1)}
                        value={editingVM.cpu}
                        onChange={(cpu) => setEditingVM({ ...editingVM, cpu })}
                        formatLabel={(v) => `${v}`}
                        itemHeight={40}
                        visibleItems={3}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">Selected: {editingVM.cpu} core{editingVM.cpu !== 1 ? 's' : ''}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Memory
                    </label>
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 overflow-hidden">
                      <RevolverPicker
                        items={Array.from({ length: 160 }, (_, i) => i + 1)}
                        value={Math.round(editingVM.memory / 1024)}
                        onChange={(gb) => setEditingVM({ ...editingVM, memory: gb * 1024 })}
                        formatLabel={(v) => `${v} GB`}
                        itemHeight={40}
                        visibleItems={3}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">Selected: {Math.round(editingVM.memory / 1024)} GB ({editingVM.memory} MB)</p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingVM(null)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={vmActionMutation.isPending || processingId === editingVM.uuid}
                    className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    {vmActionMutation.isPending && processingId === editingVM.uuid ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
