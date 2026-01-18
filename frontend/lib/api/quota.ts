/**
 * Quota API 클라이언트 (Factory 패턴)
 * ✅ P1-Next-Fix-Module-3B: core 모듈은 DI로만 동작
 */

import type { QuotaUsage } from '../types';
import type { ApiRequestFn } from './admin';

export interface QuotaAPIDeps {
  apiRequest: ApiRequestFn;
}

export function createQuotaAPI(deps: QuotaAPIDeps) {
  const { apiRequest } = deps;

  return {
    /**
     * Quota 조회
     */
    get: async (): Promise<QuotaUsage> => {
      return apiRequest<QuotaUsage>('/quota');
    },

    /**
     * Quota 업데이트
     */
    update: async (quota: {
      max_vms?: number;
      max_cpu?: number;
      max_memory?: number;
    }): Promise<QuotaUsage> => {
      return apiRequest<QuotaUsage>('/quota', {
        method: 'PUT',
        body: JSON.stringify(quota),
      });
    },
  };
}
