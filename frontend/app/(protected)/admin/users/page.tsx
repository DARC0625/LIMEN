'use client';

// 동적 렌더링 강제
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { isAdmin } from '../../../../lib/api';
import { useToast } from '../../../../components/ToastContainer';
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
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const toast = useToast();
  const router = useRouter();
  
  // React Query hooks
  const { data: users = [], isLoading, error } = useAdminUsers();
  const { data: expandedUserData } = useAdminUser(expandedUser);
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const approveUserMutation = useApproveUser();

  // Phase 4: isAdmin()이 비동기로 변경되어 useEffect에서 처리
  useEffect(() => {
    // Check if user is admin
    isAdmin().then((admin) => {
      if (!admin) {
        toast.error('Admin access required');
        router.push('/');
      }
    }).catch(() => {
      toast.error('Admin access required');
      router.push('/');
    });
  }, [toast, router]);

  // 외부 클릭 시 Create User 팝업 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showCreateModal && !(event.target as Element).closest('.create-user-popup-container')) {
        setShowCreateModal(false);
      }
    };
    if (showCreateModal) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
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

  if (error) {
    if (error instanceof Error && (error.message?.includes('403') || error.message?.includes('Forbidden'))) {
      toast.error('Admin access required');
      router.push('/');
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors">
        <main className="max-w-6xl mx-auto flex flex-col gap-8">
          <Loading message="Loading users..." size="md" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors">
      <main className="max-w-7xl mx-auto flex flex-col gap-4 sm:gap-6 md:gap-8">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-3 py-1 text-sm bg-gray-500 dark:bg-gray-600 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-700 transition-colors"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold">User Management</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative create-user-popup-container">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCreateModal(!showCreateModal);
                }}
                className="px-3 py-1 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                + New User
              </button>
              {/* Create User Popup */}
              {showCreateModal && (
                <div 
                  className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">Create New User</h3>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                      <input
                        type="text"
                        name="username"
                        required
                        minLength={3}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                      <input
                        type="password"
                        name="password"
                        required
                        minLength={6}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                      <select name="role" className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 transition-colors" defaultValue="user">
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button
                        type="button"
                        onClick={() => setShowCreateModal(false)}
                        className="flex-1 px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
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
        <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">VMs</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Resources</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <React.Fragment key={user.id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{user.username}</div>
                      <button
                        onClick={() => copyToClipboard(user.uuid || '', 'User UUID')}
                        className="text-sm text-gray-500 dark:text-gray-400 font-mono hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer transition-colors"
                        title="Click to copy full UUID"
                      >
                        {formatUUID(user.uuid || '')}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span className={`inline-block px-3 py-1 text-xs rounded text-center min-w-[60px] ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}>
                          {user.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.approved ? (
                        <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">Approved</span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{user.vm_count}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        CPU: {user.total_cpu} | Memory: {formatBytes(user.total_memory)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 flex-wrap items-center">
                        {!user.approved && (
                          <button
                            onClick={() => handleApproveUser(user.id)}
                          className="px-3 py-1 text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                        >
                          Approve
                        </button>
                        )}
                        <button
                          onClick={() => handleToggleExpand(user.id)}
                          className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors whitespace-nowrap"
                        >
                          {expandedUser === user.id ? 'Hide' : 'Details'}
                        </button>
                        <button
                          onClick={() => setEditingUser(user.id)}
                          className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors whitespace-nowrap"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedUser === user.id && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50">
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <strong className="text-gray-700 dark:text-gray-300">UUID:</strong>
                              <button
                                onClick={() => copyToClipboard(user.uuid || '', 'User UUID')}
                                className="text-sm text-gray-600 dark:text-gray-400 font-mono mt-1 hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer transition-colors text-left"
                                title="Click to copy full UUID"
                              >
                                {user.uuid || 'N/A'}
                              </button>
                            </div>
                            <div>
                              <strong className="text-gray-700 dark:text-gray-300">Role:</strong>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{user.role}</div>
                            </div>
                            <div>
                              <strong className="text-gray-700 dark:text-gray-300">Total CPU:</strong>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{user.total_cpu} cores</div>
                            </div>
                            <div>
                              <strong className="text-gray-700 dark:text-gray-300">Total Memory:</strong>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{formatBytes(user.total_memory)}</div>
                            </div>
                            <div>
                              <strong className="text-gray-700 dark:text-gray-300">Created:</strong>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{new Date(user.created_at).toLocaleString()}</div>
                            </div>
                            <div>
                              <strong className="text-gray-700 dark:text-gray-300">Updated:</strong>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{new Date(user.updated_at).toLocaleString()}</div>
                            </div>
                          </div>
                          {expandedUserData?.vms && expandedUserData.vms.length > 0 && (
                            <div>
                              <strong className="text-gray-700 dark:text-gray-300">VMs ({expandedUserData.vms.length}):</strong>
                              <ul className="list-disc list-inside mt-2 space-y-1">
                                {expandedUserData.vms.map((vm) => (
                                  <li key={vm.uuid} className="text-sm text-gray-600 dark:text-gray-400">
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
                      <td colSpan={7} className="px-6 py-4 bg-blue-50 dark:bg-blue-900/20">
                        <form onSubmit={handleUpdateUser} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                              <input
                                type="text"
                                name="username"
                                defaultValue={user.username}
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password (leave empty to keep current)</label>
                              <input
                                type="password"
                                name="password"
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                                placeholder="Leave empty to keep current"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                              <select name="role" className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 transition-colors" defaultValue={user.role}>
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setEditingUser(null)}
                              className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-2 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
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
            <div key={user.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-1">{user.username}</div>
                  <button
                    onClick={() => copyToClipboard(user.uuid || '', 'User UUID')}
                    className="text-xs text-gray-500 dark:text-gray-400 font-mono hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer transition-colors"
                    title="Click to copy full UUID"
                  >
                    {formatUUID(user.uuid || '')}
                  </button>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <span className={`inline-block px-3 py-1 text-xs rounded ${
                    user.role === 'admin' 
                      ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}>
                    {user.role}
                  </span>
                  {user.approved ? (
                    <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">Approved</span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">Pending</span>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">VMs:</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">{user.vm_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">CPU:</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">{user.total_cpu} cores</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Memory:</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">{formatBytes(user.total_memory)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Created:</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">{new Date(user.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                {!user.approved && (
                  <button
                    onClick={() => handleApproveUser(user.id)}
                    className="flex-1 px-3 py-2 text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                  >
                    Approve
                  </button>
                )}
                <button
                  onClick={() => handleToggleExpand(user.id)}
                  className="flex-1 px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                >
                  {expandedUser === user.id ? 'Hide' : 'Details'}
                </button>
                <button
                  onClick={() => setEditingUser(user.id)}
                  className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteUser(user.id, user.username)}
                  className="flex-1 px-3 py-2 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                >
                  Delete
                </button>
              </div>

              {expandedUser === user.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300 block mb-1">UUID:</strong>
                      <button
                        onClick={() => copyToClipboard(user.uuid || '', 'User UUID')}
                        className="text-xs text-gray-600 dark:text-gray-400 font-mono hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer transition-colors text-left break-all"
                        title="Click to copy full UUID"
                      >
                        {user.uuid || 'N/A'}
                      </button>
                    </div>
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300 block mb-1">Role:</strong>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{user.role}</div>
                    </div>
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300 block mb-1">Total CPU:</strong>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{user.total_cpu} cores</div>
                    </div>
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300 block mb-1">Total Memory:</strong>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{formatBytes(user.total_memory)}</div>
                    </div>
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300 block mb-1">Created:</strong>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{new Date(user.created_at).toLocaleString()}</div>
                    </div>
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300 block mb-1">Updated:</strong>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{new Date(user.updated_at).toLocaleString()}</div>
                    </div>
                  </div>
                  {expandedUserData?.vms && expandedUserData.vms.length > 0 && (
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300 block mb-2">VMs ({expandedUserData.vms.length}):</strong>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
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
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <form onSubmit={handleUpdateUser} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                      <input
                        type="text"
                        name="username"
                        defaultValue={user.username}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password (leave empty to keep current)</label>
                      <input
                        type="password"
                        name="password"
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                        placeholder="Leave empty to keep current"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                      <select name="role" className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 transition-colors" defaultValue={user.role}>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingUser(null)}
                        className="flex-1 px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
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
