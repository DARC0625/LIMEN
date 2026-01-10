// API client for backend communication
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

export interface VM {
  id: number;
  uuid: string;
  name: string;
  cpu: number;
  memory: number;
  status: string;
  os_type?: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
}

export interface VMSnapshot {
  id: number;
  vm_id: number;
  name: string;
  description?: string;
  libvirt_name: string;
  created_at: string;
  updated_at: string;
}

export interface QuotaUsage {
  quota: {
    id: number;
    user_id: number;
    max_vms: number;
    max_cpu: number;
    max_memory: number;
  };
  usage: {
    vms: number;
    cpu: number;
    memory: number;
  };
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expires_at: string;
  user: {
    id: number;
    username: string;
  };
}

export interface RegisterRequest {
  username: string;
  password: string;
}

// Get auth token from localStorage
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

// Decode JWT token to get user info (without verification, client-side only)
function decodeToken(token: string): { id: number; username: string; role: string; approved?: boolean } | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Get current user role from token
export function getUserRole(): string | null {
  const token = getToken();
  if (!token) return null;
  const decoded = decodeToken(token);
  return decoded?.role || null;
}

// Check if current user is approved
export function isApproved(): boolean {
  const token = getToken();
  if (!token) return false;
  const decoded = decodeToken(token);
  // Admin users are always approved
  if (decoded?.role === 'admin') return true;
  return decoded?.approved === true;
}

// Check if current user is admin
export function isAdmin(): boolean {
  return getUserRole() === 'admin';
}

// Set auth token in localStorage
export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', token);
}

// Remove auth token from localStorage
export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
}

// API request helper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Handle 401 Unauthorized - remove token immediately
    if (response.status === 401) {
      removeToken();
      // Don't throw error for public endpoints
      if (endpoint.includes('/health')) {
        return {} as T;
      }
      throw new Error('Authentication required');
    }
    
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Auth API
export const authAPI = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    return apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  register: async (data: RegisterRequest): Promise<{ id: number; username: string; message: string }> => {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// VM API
export const vmAPI = {
  list: async (): Promise<VM[]> => {
    return apiRequest<VM[]>('/vms');
  },

  create: async (vm: { name: string; cpu: number; memory: number; os_type?: string }): Promise<VM> => {
    return apiRequest<VM>('/vms', {
      method: 'POST',
      body: JSON.stringify(vm),
    });
  },

  action: async (id: number, action: string, cpu?: number, memory?: number): Promise<VM> => {
    return apiRequest<VM>(`/vms/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, cpu, memory }),
    });
  },
};

// Snapshot API
export const snapshotAPI = {
  list: async (vmId: number): Promise<VMSnapshot[]> => {
    return apiRequest<VMSnapshot[]>(`/vms/${vmId}/snapshots`);
  },

  create: async (vmId: number, name: string, description?: string): Promise<VMSnapshot> => {
    return apiRequest<VMSnapshot>(`/vms/${vmId}/snapshots`, {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  },

  restore: async (snapshotId: number): Promise<{ message: string; snapshot_id: number }> => {
    return apiRequest(`/snapshots/${snapshotId}/restore`, {
      method: 'POST',
    });
  },

  delete: async (snapshotId: number): Promise<{ message: string; snapshot_id: number }> => {
    return apiRequest(`/snapshots/${snapshotId}`, {
      method: 'DELETE',
    });
  },
};

// Quota API
export const quotaAPI = {
  get: async (): Promise<QuotaUsage> => {
    return apiRequest<QuotaUsage>('/quota');
  },
  update: async (quota: { max_vms?: number; max_cpu?: number; max_memory?: number }): Promise<QuotaUsage> => {
    return apiRequest<QuotaUsage>('/quota', {
      method: 'PUT',
      body: JSON.stringify(quota),
    });
  },
};

// VM Stats API
export interface VMStats {
  cpu_usage_percent: number;
  memory_used_mb: number;
  memory_total_mb: number;
  memory_usage_percent: number;
  timestamp: number;
}

export const vmStatsAPI = {
  get: async (vmId: number): Promise<VMStats> => {
    return apiRequest<VMStats>(`/vms/${vmId}/stats`);
  },
};

// User types
export interface User {
  id: number;
  uuid: string;
  username: string;
  role: string;
  approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserWithStats extends User {
  vm_count: number;
  total_cpu: number;
  total_memory: number;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role?: string;
}

export interface UpdateUserRequest {
  username?: string;
  password?: string;
  role?: string;
}

// Admin API (Admin only)
export const adminAPI = {
  listUsers: async (): Promise<UserWithStats[]> => {
    return apiRequest<UserWithStats[]>('/admin/users');
  },

  getUser: async (id: number): Promise<User & { vms: VM[] }> => {
    return apiRequest<User & { vms: VM[] }>(`/admin/users/${id}`);
  },

  createUser: async (data: CreateUserRequest): Promise<User> => {
    return apiRequest<User>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateUser: async (id: number, data: UpdateUserRequest): Promise<User> => {
    return apiRequest<User>(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteUser: async (id: number): Promise<void> => {
    return apiRequest<void>(`/admin/users/${id}`, {
      method: 'DELETE',
    });
  },

  updateUserRole: async (id: number, role: string): Promise<User> => {
    return apiRequest<User>(`/admin/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  approveUser: async (id: number): Promise<User> => {
    return apiRequest<User>(`/admin/users/${id}/approve`, {
      method: 'PUT',
    });
  },
};

