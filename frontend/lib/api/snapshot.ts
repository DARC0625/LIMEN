/**
 * 스냅샷 API 클라이언트 (Factory 패턴)
 * ✅ P1-Next-Fix-Module-3B: core 모듈은 DI로만 동작
 */

import type { VMSnapshot } from '../types';
import type { ApiRequestFn } from './admin';

export interface SnapshotAPIDeps {
  apiRequest: ApiRequestFn;
}

export function createSnapshotAPI(deps: SnapshotAPIDeps) {
  const { apiRequest } = deps;

  return {
    /**
     * 스냅샷 목록 조회
     */
    list: async (vmUuid: string): Promise<VMSnapshot[]> => {
      return apiRequest<VMSnapshot[]>(`/vms/${vmUuid}/snapshots`);
    },

    /**
     * 스냅샷 생성
     */
    create: async (
      vmUuid: string,
      name: string,
      description?: string
    ): Promise<VMSnapshot> => {
      return apiRequest<VMSnapshot>(`/vms/${vmUuid}/snapshots`, {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
    },

    /**
     * 스냅샷 복원
     */
    restore: async (snapshotId: number): Promise<{ message: string; snapshot_id: number }> => {
      return apiRequest(`/snapshots/${snapshotId}/restore`, {
        method: 'POST',
      });
    },

    /**
     * 스냅샷 삭제
     */
    delete: async (snapshotId: number): Promise<{ message: string }> => {
      return apiRequest(`/snapshots/${snapshotId}`, {
        method: 'DELETE',
      });
    },
  };
}
