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
  BootOrder,
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
    const logger = (await import('../utils/logger')).logger;
    
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
    
    logger.log('[vmAPI.action] Calling API:', { uuid, action, body });
    
    try {
      // delete 액션의 경우 백엔드가 다른 형식의 응답을 반환함
      if (action === 'delete') {
        const result = await apiRequest<{ message: string; vm_uuid: string }>(`/vms/${uuid}/action`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        
        logger.log('[vmAPI.action] Delete API success:', {
          uuid,
          action,
          response: result,
        });
        
        // delete 액션은 VM 객체를 반환하지 않으므로, 기존 VM 정보를 기반으로 빈 객체 반환
        // 실제로는 useVMAction의 onSuccess에서 목록에서 제거하므로 이 값은 사용되지 않음
        return {} as VM;
      }
      
      // start, stop, update 액션은 VM 객체를 반환
      const result = await apiRequest<VM>(`/vms/${uuid}/action`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      
      logger.log('[vmAPI.action] API success:', {
        uuid,
        action,
        responseStatus: result.status,
        responseVM: result,
      });
      
      return result;
    } catch (error) {
      const errorContext = error instanceof Error 
        ? { 
            message: error.message, 
            stack: error.stack, 
            name: error.name,
            status: (error as any).status,
            details: (error as any).details,
          }
        : { error: String(error) };
      
      window.console.error('[vmAPI.action] API error details:', {
        uuid,
        action,
        ...errorContext,
      });
      
      logger.error('[vmAPI.action] API error:', { uuid, action, ...errorContext });
      throw error;
    }
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
   * ISO 파일(.iso, .img) 또는 VM 디스크(.qcow2) 지원
   */
  media: async (
    uuid: string,
    action: 'detach' | 'attach',
    media_path?: string
  ): Promise<{ message: string; vm_uuid?: string; previous_media_path?: string }> => {
    interface MediaActionBody {
      action: 'detach' | 'attach';
      iso_path?: string; // 하위 호환성
      media_path?: string; // 새로운 파라미터 (ISO 및 VM 디스크 지원)
    }
    
    const body: MediaActionBody = { action };
    
    if (action === 'attach') {
      if (!media_path || !media_path.trim()) {
        throw new Error('Media path is required for attach action');
      }
      const trimmedPath = media_path.trim();
      // media_path를 우선 사용하고, 하위 호환성을 위해 iso_path도 설정
      body.media_path = trimmedPath;
      body.iso_path = trimmedPath;
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

  /**
   * 부팅 순서 설정
   */
  setBootOrder: async (uuid: string, bootOrder: BootOrder): Promise<VM> => {
    const logger = (await import('../utils/logger')).logger;
    logger.log('[vmAPI.setBootOrder] Calling API:', { uuid, bootOrder });
    try {
      const result = await apiRequest<VM>(`/vms/${uuid}/boot-order`, {
        method: 'POST',
        body: JSON.stringify({ boot_order: bootOrder }),
      });
      logger.log('[vmAPI.setBootOrder] API success:', result);
      return result;
    } catch (error) {
      const errorContext = error instanceof Error 
        ? { message: error.message, stack: error.stack, name: error.name }
        : { error: String(error) };
      logger.error('[vmAPI.setBootOrder] API error:', errorContext);
      throw error;
    }
  },

  /**
   * 부팅 순서 조회
   */
  getBootOrder: async (uuid: string): Promise<{ boot_order: BootOrder }> => {
    return apiRequest<{ boot_order: BootOrder }>(`/vms/${uuid}/boot-order`);
  },

  /**
   * VM 설치 완료 처리
   * CDROM 제거 및 디스크 부팅으로 전환
   */
  finalizeInstall: async (uuid: string): Promise<{ message: string; vm_uuid: string }> => {
    const logger = (await import('../utils/logger')).logger;
    logger.log('[vmAPI.finalizeInstall] Calling API:', { uuid });
    try {
      const result = await apiRequest<{ message: string; vm_uuid: string }>(
        `/vms/${uuid}/finalize-install`,
        {
          method: 'POST',
        }
      );
      logger.log('[vmAPI.finalizeInstall] API success:', result);
      return result;
    } catch (error) {
      const errorContext = error instanceof Error 
        ? { 
            message: error.message, 
            stack: error.stack, 
            name: error.name,
            status: (error as any).status,
            details: (error as any).details,
          }
        : { error: String(error) };
      
      window.console.error('[vmAPI.finalizeInstall] API error details:', {
        uuid,
        ...errorContext,
      });
      
      logger.error('[vmAPI.finalizeInstall] API error:', errorContext);
      
      // 더 명확한 에러 메시지 생성
      if (error instanceof Error) {
        const apiError = error as any;
        if (apiError.status === 500 && apiError.details) {
          const details = apiError.details;
          let enhancedMessage = error.message;
          
          // 백엔드에서 제공한 상세 에러 정보 추가
          if (details.error || details.message) {
            enhancedMessage = `${error.message}: ${details.error || details.message}`;
          }
          
          // 특정 에러 타입에 대한 안내 추가
          if (details.error && typeof details.error === 'string') {
            if (details.error.includes('running') || details.error.includes('shutdown')) {
              enhancedMessage += '\n\nVM이 실행 중일 수 있습니다. VM을 중지한 후 다시 시도해주세요.';
            } else if (details.error.includes('CDROM') || details.error.includes('cdrom')) {
              enhancedMessage += '\n\nCDROM 디바이스를 찾을 수 없습니다.';
            } else if (details.error.includes('XML') || details.error.includes('libvirt')) {
              enhancedMessage += '\n\nVM 설정을 업데이트하는 중 오류가 발생했습니다.';
            }
          }
          
          const enhancedError = new Error(enhancedMessage);
          (enhancedError as any).status = 500;
          (enhancedError as any).details = details;
          throw enhancedError;
        }
      }
      
      throw error;
    }
  },
};




