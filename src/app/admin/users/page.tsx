'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { adminAPI, UserWithStats, User, VM, isAdmin } from '../../../lib/api';
import { useToast } from '../../../components/ToastContainer';
import { removeToken } from '../../../lib/api';

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [expandedUserVMs, setExpandedUserVMs] = useState<VM[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithStats | null>(null);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    // Check if user is admin
    if (!isAdmin()) {
      toast.error('Admin access required');
      router.push('/');
      return;
    }
    fetchUsers();
  }, []);

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

  const fetchUsers = async () => {
    try {
      const data = await adminAPI.listUsers();
      // Sort users by role: admin first, then by username
      const sortedData = [...data].sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return a.username.localeCompare(b.username);
      });
      setUsers(sortedData);
    } catch (err: any) {
      if (err.message?.includes('403') || err.message?.includes('Forbidden')) {
        toast.error('Admin access required');
        router.push('/');
      } else {
        toast.error(`Failed to fetch users: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId: number) => {
    try {
      const data = await adminAPI.getUser(userId);
      setExpandedUserVMs(data.vms);
    } catch (err: any) {
      toast.error(`Failed to fetch user details: ${err.message}`);
    }
  };

  const handleToggleExpand = async (userId: number) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      setExpandedUserVMs([]);
    } else {
      setExpandedUser(userId);
      await fetchUserDetails(userId);
    }
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;

    try {
      await adminAPI.createUser({ username, password, role: role || 'user' });
      toast.success('User created successfully');
      setShowCreateModal(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(`Failed to create user: ${err.message}`);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;

    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;

    const updateData: any = {};
    if (username && username !== editingUser.username) updateData.username = username;
    if (password) updateData.password = password;
    if (role && role !== editingUser.role) updateData.role = role;

    try {
      await adminAPI.updateUser(editingUser.id, updateData);
      toast.success('User updated successfully');
      setEditingUser(null);
      fetchUsers();
      if (expandedUser === editingUser.id) {
        await fetchUserDetails(editingUser.id);
      }
    } catch (err: any) {
      toast.error(`Failed to update user: ${err.message}`);
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;

    try {
      await adminAPI.deleteUser(userId);
      toast.success('User deleted successfully');
      if (expandedUser === userId) {
        setExpandedUser(null);
        setExpandedUserVMs([]);
      }
      fetchUsers();
    } catch (err: any) {
      toast.error(`Failed to delete user: ${err.message}`);
    }
  };

  const handleApproveUser = async (userId: number) => {
    try {
      await adminAPI.approveUser(userId);
      toast.success('User approved successfully');
      fetchUsers();
    } catch (err: any) {
      toast.error(`Failed to approve user: ${err.message}`);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen p-8 bg-gray-50 text-gray-900 font-sans">
        <main className="max-w-6xl mx-auto flex flex-col gap-8">
          <div className="text-center py-12 text-gray-700">Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50 text-gray-900 font-sans">
      <main className="max-w-6xl mx-auto flex flex-col gap-8">
        <header className="flex justify-between items-center border-b pb-4">
          <h1 className="text-3xl font-bold">User Management</h1>
          <div className="flex items-center gap-4">
            <div className="relative create-user-popup-container">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCreateModal(!showCreateModal);
                }}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + New User
              </button>
              {/* Create User Popup */}
              {showCreateModal && (
                <div 
                  className="absolute right-0 top-full mt-2 z-50 bg-white p-6 rounded-xl shadow-2xl border border-gray-200 w-80"
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
                        className="w-full p-2 border rounded text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <input
                        type="password"
                        name="password"
                        required
                        minLength={6}
                        className="w-full p-2 border rounded text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <select name="role" className="w-full p-2 border rounded text-gray-900 bg-white" defaultValue="user">
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button
                        type="button"
                        onClick={() => setShowCreateModal(false)}
                        className="flex-1 px-4 py-2 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              ← Back to Dashboard
            </button>
          </div>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                  <tr className="hover:bg-gray-50">
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
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Approved</span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">Pending</span>
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
                      <div className="flex gap-2 flex-wrap">
                        {!user.approved && (
                          <button
                            onClick={() => handleApproveUser(user.id)}
                            className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                          >
                            Approve
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleExpand(user.id)}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        >
                          {expandedUser === user.id ? 'Hide' : 'Details'}
                        </button>
                        <button
                          onClick={() => setEditingUser(user)}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
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
                          {expandedUserVMs.length > 0 && (
                            <div>
                              <strong className="text-gray-700">VMs ({expandedUserVMs.length}):</strong>
                              <ul className="list-disc list-inside mt-2 space-y-1">
                                {expandedUserVMs.map((vm) => (
                                  <li key={vm.id} className="text-sm text-gray-600">
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
                  {editingUser && editingUser.id === user.id && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 bg-blue-50">
                        <form onSubmit={handleUpdateUser} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                              <input
                                type="text"
                                name="username"
                                defaultValue={editingUser.username}
                                className="w-full p-2 border rounded text-gray-900 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">New Password (leave empty to keep current)</label>
                              <input
                                type="password"
                                name="password"
                                className="w-full p-2 border rounded text-gray-900 bg-white"
                                placeholder="Leave empty to keep current"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                              <select name="role" className="w-full p-2 border rounded text-gray-900 bg-white" defaultValue={editingUser.role}>
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

      </main>
    </div>
  );
}
