/**
 * 타입 정의 통합 파일
 * 모든 공통 타입을 여기에 정의하여 재사용성과 일관성 확보
 */

// ============================================================================
// 인증 관련 타입
// ============================================================================

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  token?: string; // 하위 호환성
}

export interface TokenRefreshResponse {
  access_token: string;
  refresh_token?: string; // 선택적 (Rotation)
  expires_in: number;
}

export interface SessionResponse {
  valid: boolean;
  access_token?: string;
  token?: string; // 하위 호환성
  user?: {
    id: number;
    username: string;
    role: string;
  };
  reason?: string;
}

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

// ============================================================================
// VM 관련 타입
// ============================================================================

export type BootOrder = 'cdrom-hdd' | 'hdd-only' | 'cdrom-only' | 'hdd-cdrom';
export type InstallationStatus = 'not_installed' | 'installing' | 'installed';

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
  boot_order?: BootOrder;
  installation_status?: InstallationStatus;
  disk_path?: string;
  disk_size?: number;
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

export interface VMStats {
  cpu_usage_percent: number;
  memory_used_mb: number;
  memory_total_mb: number;
  memory_usage_percent: number;
  timestamp: number;
}

export interface VMDisk {
  path: string;
  name: string;
  vm_name: string;
  vm_uuid: string;
  size: number;
  size_gb: number;
  type: string; // "qcow2"
}

export interface VMMedia {
  vm_uuid: string;
  media_path: string | null;
  attached: boolean;
  available_media?: {
    isos?: ISO[];
    vm_disk?: {
      path: string;
      exists: boolean;
      name: string;
    };
  };
}

export interface ISO {
  name: string;
  path: string;
  size: number;
  modified: string;
}

export interface ISOList {
  isos: ISO[];
  count: number;
  vm_disks?: VMDisk[];
}

// ============================================================================
// Quota 관련 타입
// ============================================================================

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

// ============================================================================
// 에러 관련 타입
// ============================================================================

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: number;
  timestamp?: string;
  [key: string]: unknown;
}

export interface APIError extends Error {
  status?: number;
  response?: Response;
  data?: unknown;
  isWaitError?: boolean;
  details?: unknown;
}

// ============================================================================
// Register 관련 타입
// ============================================================================

export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
}

export interface RegisterResponse {
  id: number;
  username: string;
  message: string;
}




