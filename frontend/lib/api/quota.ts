/**
 * Quota API 클라이언트
 */

import { apiRequest } from './clientApi';
import type { QuotaUsage } from '../types';

export const quotaAPI = {
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




