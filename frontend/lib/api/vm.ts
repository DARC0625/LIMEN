/**
 * VM API 클라이언트
 */

import { apiRequest } from './client';
import type {
  VM,
  VMSnapshot,
  VMStats,
  VMMedia,
  ISOList,
} from '../types';

export const vmAPI = {
  /**
   * VM 목록 조회
   */
  list: async (): Promise<VM[]> => {
    return apiRequest<VM[]>('/vms');
  },

  /**
   * VM 생성
   */
  create: async (vm: {
    name: string;
    cpu: number;
    memory: number;
    os_type?: string;
    graphics_type?: string; // VNC graphics type (e.g., 'vnc')
    vnc_enabled?: boolean; // Enable VNC graphics
  }): Promise<VM> => {
    // VNC graphics configuration: Enable VNC by default for GUI OS
    interface VMCreateData {
      name: string;
      cpu: number;
      memory: number;
      os_type?: string;
      graphics_type?: string;
      vnc_enabled?: boolean;
    }
    
    const vmData: VMCreateData = {
      name: vm.name,
      cpu: vm.cpu,
      memory: vm.memory,
      os_type: vm.os_type,
    };
    
    // Add VNC graphics configuration (if explicitly specified)
    if (vm.graphics_type !== undefined) {
      vmData.graphics_type = vm.graphics_type;
    }
    if (vm.vnc_enabled !== undefined) {
      vmData.vnc_enabled = vm.vnc_enabled;
    } else {
      // Default: Enable VNC for GUI OS
      const guiOS = ['ubuntu-desktop', 'kali', 'windows'];
      if (vm.os_type && guiOS.includes(vm.os_type)) {
        vmData.vnc_enabled = true;
        vmData.graphics_type = 'vnc';
      }
    }
    
    return apiRequest<VM>('/vms', {
      method: 'POST',
      body: JSON.stringify(vmData),
    });
  },

  /**
   * VM 작업 (시작, 중지, 재시작, 업데이트 등)
   */
  action: async (
    uuid: string,
    action: string,
    options?: {
      cpu?: number;
      memory?: number;
      name?: string;
      os_type?: string;
      graphics_type?: string;
      vnc_enabled?: boolean;
    }
  ): Promise<VM> => {
    interface VMActionBody {
      action: string;
      cpu?: number;
      memory?: number;
      name?: string;
      os_type?: string;
      graphics_type?: string;
      vnc_enabled?: boolean;
    }
    
    const body: VMActionBody = { action };
    
    if (options) {
      if (options.cpu !== undefined && options.cpu !== null) {
        body.cpu = options.cpu;
      }
      if (options.memory !== undefined && options.memory !== null) {
        body.memory = options.memory;
      }
      if (options.name !== undefined && options.name !== null && options.name.trim() !== '') {
        body.name = options.name.trim();
      }
      if (options.os_type !== undefined && options.os_type !== null) {
        body.os_type = options.os_type;
      }
      // Add VNC graphics configuration
      if (options.graphics_type !== undefined) {
        body.graphics_type = options.graphics_type;
      }
      if (options.vnc_enabled !== undefined) {
        body.vnc_enabled = options.vnc_enabled;
      } else if (options.os_type) {
        // If OS type is changed, enable VNC for GUI OS
        const guiOS = ['ubuntu-desktop', 'kali', 'windows'];
        if (guiOS.includes(options.os_type)) {
          body.vnc_enabled = true;
          body.graphics_type = 'vnc';
        }
      }
    }
    
    return apiRequest<VM>(`/vms/${uuid}/action`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /**
   * 현재 연결된 미디어 조회
   */
  getMedia: async (uuid: string): Promise<VMMedia> => {
    return apiRequest<VMMedia>(`/vms/${uuid}/media`);
  },

  /**
   * 사용 가능한 ISO 목록 조회
   */
  getISOs: async (): Promise<ISOList> => {
    return apiRequest<ISOList>('/vms/isos');
  },

  /**
   * 미디어 연결/분리
   */
  media: async (
    uuid: string,
    action: 'detach' | 'attach',
    iso_path?: string
  ): Promise<{ message: string; vm_uuid?: string; previous_media_path?: string }> => {
    interface MediaActionBody {
      action: 'detach' | 'attach';
      iso_path?: string;
    }
    
    const body: MediaActionBody = { action };
    
    if (action === 'attach') {
      if (!iso_path || !iso_path.trim()) {
        throw new Error('ISO path is required for attach action');
      }
      body.iso_path = iso_path.trim();
    }
    
    return apiRequest<{ message: string; vm_uuid?: string; previous_media_path?: string }>(
      `/vms/${uuid}/media`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  },

  /**
   * VM 통계 조회
   */
  getStats: async (uuid: string): Promise<VMStats> => {
    return apiRequest<VMStats>(`/vms/${uuid}/stats`);
  },
};




