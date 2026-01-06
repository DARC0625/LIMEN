'use client';

// 동적 렌더링 강제
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { isAdmin } from '../../../../lib/api';
import { useToast } from '../../../../components/ToastContainer';
import { useAuth } from '../../../../components/AuthGuard';
import { 
  useAdminUsers, 
  useAdminUser, 
  useCreateUser, 
  useUpdateUser, 
  useDeleteUser, 
  useApproveUser 
} from '../../../../hooks/useAdminUsers';
import type { UpdateUserRequest } from '../../../../lib/types';
import Loading from '../../../../components/Loading';

export default function UserManagementPage() {
  // 모든 hooks를 항상 같은 순서로 호출 (React Hooks 규칙 준수)
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [isUserAdmin, setIsUserAdmin] = useState<boolean | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const toast = useToast();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  
  // 리다이렉트 상태 관리
  const [shouldRedirect, setShouldRedirect] = useState(false);
  
  // 인증 및 Admin 권한 확인 (hooks 호출 전에 먼저 확인)
  // React Error #310 해결: Admin 권한 확인을 먼저 수행하여 불필요한 API 호출 방지
  // useEffect 내에서 상태 업데이트를 startTransition으로 감싸서 hydration mismatch 방지
  useEffect(() => {
    // 인증 상태 확인
    if (isAuthenticated === null) {
      // 아직 확인 중이면 상태 유지
      return;
    }
    
    // 인증되지 않았으면 리다이렉트
    if (isAuthenticated === false) {
      // React Error #310 해결: 모든 상태 업데이트를 startTransition으로 감싸기
      startTransition(() => {
        setIsCheckingAuth(false);
        setIsUserAdmin(false);
        setShouldRedirect(true);
      });
      return;
    }
    
    // 인증되었으면 Admin 권한 확인
    let cancelled = false;
    isAdmin().then((admin) => {
      if (cancelled) return;
      // React Error #310 해결: 모든 상태 업데이트를 startTransition으로 감싸기
      startTransition(() => {
        setIsUserAdmin(admin);
        setIsCheckingAuth(false);
        // Admin이 아니면 리다이렉트
        if (!admin) {
          setShouldRedirect(true);
        }
      });
      // toast는 startTransition 밖에서 호출 (사이드 이펙트)
      if (!admin) {
        toast.error('Admin 권한이 필요합니다.');
      }
    }).catch((error) => {
      if (cancelled) return;
      console.error('[UserManagement] Admin check failed:', error);
      // React Error #310 해결: 모든 상태 업데이트를 startTransition으로 감싸기
      startTransition(() => {
        setIsUserAdmin(false);
        setIsCheckingAuth(false);
        setShouldRedirect(true);
      });
      // toast는 startTransition 밖에서 호출 (사이드 이펙트)
      toast.error('Admin 권한 확인에 실패했습니다. 다시 시도해주세요.');
    });
    
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, toast]);
  
  // 리다이렉트 처리 (별도 useEffect로 분리)
  useEffect(() => {
    if (shouldRedirect) {
      router.push('/dashboard');
    }
  }, [shouldRedirect, router]);
  
  // React Query hooks - 항상 호출 (조건부로만 사용)
  // 중요: 모든 hooks는 조건부 return 전에 호출되어야 함
  // Admin 권한이 확인된 후에만 데이터를 가져오도록 isUserAdmin 전달
  // React Error #310 해결: useAdminUsers에 isUserAdmin을 전달하여 Admin 권한 확인 후에만 API 호출
  const { data: users = [], isLoading, error } = useAdminUsers(isUserAdmin);
  const { data: expandedUserData } = useAdminUser(expandedUser);
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const approveUserMutation = useApproveUser();
  
  // 인증 확인 중이거나 Admin 권한 확인 중이면 로딩 표시
  if (isCheckingAuth || isAuthenticated === null || isUserAdmin === null) {
    return (
      <div className="min-h-screen p-8 bg-gray-50 text-gray-900 font-sans transition-colors">
        <main className="max-w-6xl mx-auto flex flex-col gap-8">
          <Loading message="Checking permissions..." size="md" />
        </main>
      </div>
    );
  }
  
  // Admin이 아니면 리다이렉트 중 (조건부 렌더링으로 처리)
  if (isAuthenticated === false || isUserAdmin === false || shouldRedirect) {
    return (
      <div className="min-h-screen p-8 bg-gray-50 text-gray-900 font-sans transition-colors">
        <main className="max-w-6xl mx-auto flex flex-col gap-8">
          <Loading message="Redirecting..." size="md" />
        </main>
      </div>
    );
  }

  // 외부 클릭 시 Create User 팝업 닫기
  useEffect(() => {
    if (!showCreateModal) return; // showCreateModal이 false면 아무것도 하지 않음
    
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as Element).closest('.create-user-popup-container')) {
        // React Error #310 해결: startTransition 제거 (불필요한 복잡성 제거)
        setShowCreateModal(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCreateModal]);

  const handleToggleExpand = (userId: number) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
    } else {
      setExpandedUser(userId);
    }
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;

    createUserMutation.mutate(
      { username, password, role: role || 'user' },
      {
        onSuccess: () => {
          // React Error #321 완전 해결: 상태 업데이트를 startTransition으로 감싸기
          startTransition(() => {
            setShowCreateModal(false);
          });
          // 폼 리셋은 DOM 조작이므로 startTransition 불필요
          (e.target as HTMLFormElement).reset();
        },
      }
    );
  };

  const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;

    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;

    const currentUser = users.find(u => u.id === editingUser);
    if (!currentUser) return;

    const updateData: UpdateUserRequest = {};
    if (username && username !== currentUser.username) updateData.username = username;
    if (password) updateData.password = password;
    if (role && role !== currentUser.role) updateData.role = role;

    updateUserMutation.mutate(
      { id: editingUser, data: updateData },
      {
        onSuccess: () => {
          // React Error #321 완전 해결: 상태 업데이트를 startTransition으로 감싸기
          startTransition(() => {
            setEditingUser(null);
          });
        },
      }
    );
  };

  const handleDeleteUser = (userId: number, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;

    // Optimistic update는 mutation에서 처리됨
    if (expandedUser === userId) {
      setExpandedUser(null);
    }
    if (editingUser === userId) {
      setEditingUser(null);
    }

    deleteUserMutation.mutate(userId);
  };

  const handleApproveUser = (userId: number) => {
    approveUserMutation.mutate(userId);
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / 1024;
    return `${gb.toFixed(1)} GB`;
  };

  const formatUUID = (uuid: string) => {
    if (!uuid) return 'N/A';
    return uuid.substring(0, 8) + '...';
  };

  const copyToClipboard = async (text: string, label: string = 'UUID') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  // 에러 처리: 401/403 에러 시 대시보드로 리다이렉트
  useEffect(() => {
    // React Error #310 해결: 조건을 더 명확하게 설정하고, 상태 업데이트를 분리
    if (!error || isUserAdmin !== true) {
      return; // 에러가 없거나 Admin 권한이 확인되지 않았으면 처리하지 않음
    }
    
    // Admin 권한이 확인된 후에만 에러 처리 (권한 확인 중 에러는 무시)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('401') || errorMessage.includes('Authentication required') || 
        errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      // React Error #310 해결: router.push와 toast를 분리하여 처리
      toast.error('인증이 만료되었습니다. 다시 로그인해주세요.');
      // router.push는 startTransition 밖에서 호출 (리다이렉트는 즉시 필요)
      setTimeout(() => {
        router.push('/dashboard');
      }, 100);
    } else {
      // 기타 에러는 사용자에게 표시
      const friendlyMessage = errorMessage.includes('Network') || errorMessage.includes('fetch')
        ? '네트워크 오류가 발생했습니다. 연결을 확인하고 다시 시도해주세요.'
        : `오류가 발생했습니다: ${errorMessage}`;
      toast.error(friendlyMessage);
    }
  }, [error, isUserAdmin, toast, router]);

  // Admin 권한이 확인되지 않았으면 로딩 표시 (리다이렉트 중)
  if (isUserAdmin !== true) {
    return (
      <div className="min-h-screen p-8 bg-gray-50 text-gray-900 font-sans transition-colors">
        <main className="max-w-6xl mx-auto flex flex-col gap-8">
          <Loading message="Checking permissions..." size="md" />
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 bg-gray-50 text-gray-900 font-sans transition-colors">
        <main className="max-w-6xl mx-auto flex flex-col gap-8">
          <Loading message="Loading users..." size="md" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gray-50 text-gray-900 font-sans transition-colors">
      <main className="max-w-7xl mx-auto flex flex-col gap-4 sm:gap-6 md:gap-8">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
          <h1 className="text-2xl sm:text-3xl font-bold">User Management</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              ← Back to Dashboard
            </button>
            <div className="relative create-user-popup-container">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCreateModal(!showCreateModal);
                }}
                className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 hover:shadow-md transition-all duration-200 font-medium"
              >
                + New User
              </button>
              {/* Create User Popup */}
              {showCreateModal && (
                <div 
                  className="absolute right-0 top-full mt-2 z-50 bg-white p-6 rounded-xl shadow-lg border border-gray-200 w-80 transition-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-bold mb-4 text-gray-900">Create New User</h3>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                      <input
                        type="text"
                        name="username"
                        required
                        minLength={3}
                        className="w-full p-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <input
                        type="password"
                        name="password"
                        required
                        minLength={6}
                        className="w-full p-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <select name="role" className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white transition-colors" defaultValue="user">
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button
                        type="button"
                        onClick={() => setShowCreateModal(false)}
                        className="flex-1 px-4 py-2 text-sm bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 hover:shadow-md transition-all duration-200 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 hover:shadow-md transition-all duration-200 font-medium"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 데스크톱: 테이블 뷰 */}
        <div className="hidden md:block bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden transition-all">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">VMs</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Resources</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <React.Fragment key={user.id}>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{user.username}</div>
                      <button
                        onClick={() => copyToClipboard(user.uuid || '', 'User UUID')}
                        className="text-sm text-gray-500 font-mono hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                        title="Click to copy full UUID"
                      >
                        {formatUUID(user.uuid || '')}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span className={`inline-block px-3 py-1 text-xs rounded text-center min-w-[60px] ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.approved ? (
                        <span className="px-2 py-1 text-xs bg-emerald-100 text-emerald-800 rounded-lg">Approved</span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded-lg">Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-900">{user.vm_count}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        CPU: {user.total_cpu} | Memory: {formatBytes(user.total_memory)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 flex-wrap items-center">
                        {!user.approved && (
                          <button
                            onClick={() => handleApproveUser(user.id)}
                          className="px-3 py-1 text-sm bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 hover:shadow-md transition-all duration-200"
                        >
                          Approve
                        </button>
                        )}
                        <button
                          onClick={() => handleToggleExpand(user.id)}
                          className="px-3 py-1 text-sm bg-cyan-100 text-cyan-700 rounded-lg hover:bg-cyan-200 hover:shadow-md transition-all duration-200 whitespace-nowrap"
                        >
                          {expandedUser === user.id ? 'Hide' : 'Details'}
                        </button>
                        <button
                          onClick={() => setEditingUser(user.id)}
                          className="px-3 py-1 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 hover:shadow-md transition-all duration-200 whitespace-nowrap"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          className="px-3 py-1 text-sm bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 hover:shadow-md transition-all duration-200 whitespace-nowrap"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedUser === user.id && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 bg-gray-50">
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <strong className="text-gray-700">UUID:</strong>
                              <button
                                onClick={() => copyToClipboard(user.uuid || '', 'User UUID')}
                                className="text-sm text-gray-600 font-mono mt-1 hover:text-blue-600 hover:underline cursor-pointer transition-colors text-left"
                                title="Click to copy full UUID"
                              >
                                {user.uuid || 'N/A'}
                              </button>
                            </div>
                            <div>
                              <strong className="text-gray-700">Role:</strong>
                              <div className="text-sm text-gray-600 mt-1">{user.role}</div>
                            </div>
                            <div>
                              <strong className="text-gray-700">Total CPU:</strong>
                              <div className="text-sm text-gray-600 mt-1">{user.total_cpu} cores</div>
                            </div>
                            <div>
                              <strong className="text-gray-700">Total Memory:</strong>
                              <div className="text-sm text-gray-600 mt-1">{formatBytes(user.total_memory)}</div>
                            </div>
                            <div>
                              <strong className="text-gray-700">Created:</strong>
                              <div className="text-sm text-gray-600 mt-1">{new Date(user.created_at).toLocaleString()}</div>
                            </div>
                            <div>
                              <strong className="text-gray-700">Updated:</strong>
                              <div className="text-sm text-gray-600 mt-1">{new Date(user.updated_at).toLocaleString()}</div>
                            </div>
                          </div>
                          {expandedUserData?.vms && expandedUserData.vms.length > 0 && (
                            <div>
                              <strong className="text-gray-700">VMs ({expandedUserData.vms.length}):</strong>
                              <ul className="list-disc list-inside mt-2 space-y-1">
                                {expandedUserData.vms.map((vm) => (
                                  <li key={vm.uuid} className="text-sm text-gray-600">
                                    {vm.name} ({vm.status}) - {vm.cpu} CPU, {formatBytes(vm.memory * 1024)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  {editingUser === user.id && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 bg-blue-50">
                        <form onSubmit={handleUpdateUser} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                              <input
                                type="text"
                                name="username"
                                defaultValue={user.username}
                                className="w-full p-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">New Password (leave empty to keep current)</label>
                              <input
                                type="password"
                                name="password"
                                className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white placeholder-gray-400 transition-colors"
                                placeholder="Leave empty to keep current"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                              <select name="role" className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white transition-colors" defaultValue={user.role}>
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setEditingUser(null)}
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
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* 모바일: 카드 뷰 */}
        <div className="md:hidden space-y-4">
          {users.map((user) => (
            <div key={user.id} className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 transition-all">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="font-semibold text-lg text-gray-900 mb-1">{user.username}</div>
                  <button
                    onClick={() => copyToClipboard(user.uuid || '', 'User UUID')}
                    className="text-xs text-gray-500 font-mono hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                    title="Click to copy full UUID"
                  >
                    {formatUUID(user.uuid || '')}
                  </button>
                </div>
                <div className="flex flex-col gap-2 items-end">
                        <span className={`inline-block px-3 py-1 text-xs rounded-lg ${
                          user.role === 'admin' 
                            ? 'bg-violet-100 text-violet-800' 
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                    {user.role}
                  </span>
                  {user.approved ? (
                    <span className="px-2 py-1 text-xs bg-emerald-100 text-emerald-800 rounded-lg">Approved</span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded-lg">Pending</span>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">VMs:</span>
                  <span className="text-gray-900 font-medium">{user.vm_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">CPU:</span>
                  <span className="text-gray-900 font-medium">{user.total_cpu} cores</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Memory:</span>
                  <span className="text-gray-900 font-medium">{formatBytes(user.total_memory)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="text-gray-900 font-medium">{new Date(user.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
                {!user.approved && (
                  <button
                    onClick={() => handleApproveUser(user.id)}
                    className="flex-1 px-3 py-2 text-sm bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 hover:shadow-md transition-all duration-200"
                  >
                    Approve
                  </button>
                )}
                <button
                  onClick={() => handleToggleExpand(user.id)}
                  className="flex-1 px-3 py-2 text-sm bg-cyan-100 text-cyan-700 rounded-lg hover:bg-cyan-200 hover:shadow-md transition-all duration-200"
                >
                  {expandedUser === user.id ? 'Hide' : 'Details'}
                </button>
                <button
                  onClick={() => setEditingUser(user.id)}
                  className="flex-1 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 hover:shadow-md transition-all duration-200"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteUser(user.id, user.username)}
                  className="flex-1 px-3 py-2 text-sm bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 hover:shadow-md transition-all duration-200"
                >
                  Delete
                </button>
              </div>

              {expandedUser === user.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <strong className="text-gray-700 block mb-1">UUID:</strong>
                      <button
                        onClick={() => copyToClipboard(user.uuid || '', 'User UUID')}
                        className="text-xs text-gray-600 font-mono hover:text-blue-600 hover:underline cursor-pointer transition-colors text-left break-all"
                        title="Click to copy full UUID"
                      >
                        {user.uuid || 'N/A'}
                      </button>
                    </div>
                    <div>
                      <strong className="text-gray-700 block mb-1">Role:</strong>
                      <div className="text-sm text-gray-600">{user.role}</div>
                    </div>
                    <div>
                      <strong className="text-gray-700 block mb-1">Total CPU:</strong>
                      <div className="text-sm text-gray-600">{user.total_cpu} cores</div>
                    </div>
                    <div>
                      <strong className="text-gray-700 block mb-1">Total Memory:</strong>
                      <div className="text-sm text-gray-600">{formatBytes(user.total_memory)}</div>
                    </div>
                    <div>
                      <strong className="text-gray-700 block mb-1">Created:</strong>
                      <div className="text-sm text-gray-600">{new Date(user.created_at).toLocaleString()}</div>
                    </div>
                    <div>
                      <strong className="text-gray-700 block mb-1">Updated:</strong>
                      <div className="text-sm text-gray-600">{new Date(user.updated_at).toLocaleString()}</div>
                    </div>
                  </div>
                  {expandedUserData?.vms && expandedUserData.vms.length > 0 && (
                    <div>
                      <strong className="text-gray-700 block mb-2">VMs ({expandedUserData.vms.length}):</strong>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                        {expandedUserData.vms.map((vm) => (
                          <li key={vm.uuid}>
                            {vm.name} ({vm.status}) - {vm.cpu} CPU, {formatBytes(vm.memory * 1024)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {editingUser === user.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <form onSubmit={handleUpdateUser} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                      <input
                        type="text"
                        name="username"
                        defaultValue={user.username}
                        className="w-full p-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Password (leave empty to keep current)</label>
                      <input
                        type="password"
                        name="password"
                        className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white placeholder-gray-400 transition-colors"
                        placeholder="Leave empty to keep current"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <select name="role" className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white transition-colors" defaultValue={user.role}>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingUser(null)}
                        className="flex-1 px-4 py-2 text-sm bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 hover:shadow-md transition-all duration-200 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 hover:shadow-md transition-all duration-200 font-medium"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}
