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

/**
 * 백엔드 부팅 순서 형식을 프론트엔드 형식으로 변환
 * 백엔드: cdrom, hd, cdrom_hd, hd_cdrom
 * 프론트엔드: cdrom-only, hdd-only, cdrom-hdd, hdd-cdrom
 */
export function normalizeBootOrderFromBackend(backendBootOrder: string | undefined | null): BootOrder {
  if (!backendBootOrder) {
    return 'hdd-only';
  }
  
  const mapping: Record<string, BootOrder> = {
    'cdrom': 'cdrom-only',
    'hd': 'hdd-only',
    'cdrom_hd': 'cdrom-hdd',
    'hd_cdrom': 'hdd-cdrom',
  };
  
  return mapping[backendBootOrder] || 'hdd-only';
}

/**
 * 프론트엔드 부팅 순서 형식을 백엔드 형식으로 변환
 * 프론트엔드: cdrom-only, hdd-only, cdrom-hdd, hdd-cdrom
 * 백엔드: cdrom, hd, cdrom_hd, hd_cdrom
 */
export function normalizeBootOrderToBackend(frontendBootOrder: BootOrder): string {
  const mapping: Record<BootOrder, string> = {
    'cdrom-only': 'cdrom',
    'hdd-only': 'hd',
    'cdrom-hdd': 'cdrom_hd',
    'hdd-cdrom': 'hd_cdrom',
  };
  
  return mapping[frontendBootOrder] || 'hd';
}

export const vmAPI = {
  /**
   * VM 목록 조회
   */
  list: async (): Promise<VM[]> => {
    const vms = await apiRequest<VM[]>('/vms');
    // 백엔드 부팅 순서 형식을 프론트엔드 형식으로 변환
    return vms.map(vm => ({
      ...vm,
      boot_order: normalizeBootOrderFromBackend(vm.boot_order as any),
    }));
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
    
    // 백엔드 호환성: windows10을 windows로 변환
    const backendOsType = vm.os_type === 'windows10' ? 'windows' : vm.os_type;
    
    const vmData: VMCreateData = {
      name: vm.name,
      cpu: vm.cpu,
      memory: vm.memory,
      os_type: backendOsType,
    };
    
    // Add VNC graphics configuration (if explicitly specified)
    if (vm.graphics_type !== undefined) {
      vmData.graphics_type = vm.graphics_type;
    }
    if (vm.vnc_enabled !== undefined) {
      vmData.vnc_enabled = vm.vnc_enabled;
    } else {
      // Default: Enable VNC for GUI OS
      const guiOS = ['ubuntu-desktop', 'kali', 'windows10'];
      if (vm.os_type && guiOS.includes(vm.os_type)) {
        vmData.vnc_enabled = true;
        vmData.graphics_type = 'vnc';
      }
    }
    
    // VM 생성 요청 전 로깅
    window.console.log('[vmAPI.create] Creating VM with data:', {
      name: vmData.name,
      cpu: vmData.cpu,
      memory: vmData.memory,
      os_type: vmData.os_type,
      graphics_type: vmData.graphics_type,
      vnc_enabled: vmData.vnc_enabled,
      original_os_type: vm.os_type,
    });
    
    try {
      const result = await apiRequest<VM>('/vms', {
        method: 'POST',
        body: JSON.stringify(vmData),
      });
      
      window.console.log('[vmAPI.create] VM created successfully:', {
        uuid: result.uuid,
        name: result.name,
        status: result.status,
      });
      
      return result;
    } catch (error) {
      // 500 에러인 경우 상세 정보 로깅
      if (error instanceof Error && (error as any).status === 500) {
        const apiError = error as any;
        
        // errorDetails에서 실제 에러 메시지 추출
        let actualErrorMessage = apiError.message;
        if (apiError.details) {
          const details = apiError.details;
          
          // 다양한 구조에서 에러 메시지 추출 시도
          if (details.error) {
            if (typeof details.error === 'string') {
              actualErrorMessage = details.error;
            } else if (typeof details.error === 'object' && details.error.message) {
              actualErrorMessage = details.error.message;
            }
          } else if (details.message) {
            actualErrorMessage = details.message;
          } else if (details.detail) {
            actualErrorMessage = details.detail;
          } else if (typeof details === 'string') {
            actualErrorMessage = details;
          }
          
          // libvirt/XML 관련 에러인지 확인
          const isLibvirtError = actualErrorMessage.toLowerCase().includes('libvirt') ||
                                 actualErrorMessage.toLowerCase().includes('virerror') ||
                                 actualErrorMessage.toLowerCase().includes('domain_definition') ||
                                 actualErrorMessage.toLowerCase().includes('xml') ||
                                 actualErrorMessage.toLowerCase().includes('failed to define domain');
          
          if (isLibvirtError) {
            // libvirt 에러인 경우 사용자 친화적인 메시지
            actualErrorMessage = `VM 생성 중 백엔드 오류가 발생했습니다.\n\n기술적 세부사항:\n${actualErrorMessage}\n\n이 문제는 백엔드 서버의 libvirt 설정 문제일 수 있습니다. 관리자에게 문의해주세요.`;
          }
        }
        
        window.console.error('[vmAPI.create] 500 Internal Server Error:', {
          endpoint: '/vms',
          method: 'POST',
          errorMessage: actualErrorMessage,
          errorDetails: apiError.details,
          requestData: vmData,
        });
        
        // 더 구체적인 에러 메시지로 재생성
        const enhancedError = new Error(actualErrorMessage);
        (enhancedError as any).status = 500;
        (enhancedError as any).details = apiError.details;
        throw enhancedError;
      }
      
      throw error;
    }
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
        // 백엔드 호환성: windows10을 windows로 변환
        body.os_type = options.os_type === 'windows10' ? 'windows' : options.os_type;
      }
      // Add VNC graphics configuration
      if (options.graphics_type !== undefined) {
        body.graphics_type = options.graphics_type;
      }
      if (options.vnc_enabled !== undefined) {
        body.vnc_enabled = options.vnc_enabled;
      } else if (options.os_type) {
        // If OS type is changed, enable VNC for GUI OS
        const guiOS = ['ubuntu-desktop', 'kali', 'windows10'];
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
      // 프론트엔드 형식을 백엔드 형식으로 변환
      const backendBootOrder = normalizeBootOrderToBackend(bootOrder);
      logger.log('[vmAPI.setBootOrder] Converted to backend format:', { frontend: bootOrder, backend: backendBootOrder });
      
      const result = await apiRequest<VM>(`/vms/${uuid}/boot-order`, {
        method: 'POST',
        body: JSON.stringify({ boot_order: backendBootOrder }),
      });
      
      // 백엔드 응답을 프론트엔드 형식으로 변환
      const normalizedResult = {
        ...result,
        boot_order: normalizeBootOrderFromBackend(result.boot_order as any),
      };
      
      logger.log('[vmAPI.setBootOrder] API success:', normalizedResult);
      return normalizedResult;
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
      
      window.console.error('[vmAPI.setBootOrder] API error details:', {
        uuid,
        bootOrder,
        ...errorContext,
      });
      
      logger.error('[vmAPI.setBootOrder] API error:', errorContext);
      
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
            if (details.error.includes('libvirt') || details.error.includes('XML')) {
              enhancedMessage += '\n\nVM 설정을 업데이트하는 중 오류가 발생했습니다. VM이 실행 중이거나 설정 파일에 문제가 있을 수 있습니다.';
            } else if (details.error.includes('running') || details.error.includes('shutdown')) {
              enhancedMessage += '\n\nVM이 실행 중일 수 있습니다. VM을 중지한 후 다시 시도해주세요.';
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

  /**
   * 부팅 순서 조회
   */
  getBootOrder: async (uuid: string): Promise<{ boot_order: BootOrder }> => {
    const result = await apiRequest<{ boot_order: string }>(`/vms/${uuid}/boot-order`);
    // 백엔드 형식을 프론트엔드 형식으로 변환
    return {
      boot_order: normalizeBootOrderFromBackend(result.boot_order),
    };
  },

  /**
   * VM 설치 완료 처리
   * CDROM 제거 및 디스크 부팅으로 전환
   */
  finalizeInstall: async (uuid: string): Promise<{ message: string; vm_uuid: string; vm?: VM }> => {
    const logger = (await import('../utils/logger')).logger;
    logger.log('[vmAPI.finalizeInstall] Calling API:', { uuid });
    try {
      // finalize-install 작업은 VM graceful shutdown, XML 수정, DB 업데이트 등 시간이 오래 걸릴 수 있음
      // 타임아웃을 60초로 설정
      const result = await apiRequest<{ message: string; vm_uuid: string; vm?: VM }>(
        `/vms/${uuid}/finalize-install`,
        {
          method: 'POST',
          timeout: 60000, // 60초
        }
      );
      
      // VM 정보가 있으면 boot_order 변환
      if (result.vm) {
        result.vm = {
          ...result.vm,
          boot_order: normalizeBootOrderFromBackend(result.vm.boot_order as any),
        };
      }
      
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




