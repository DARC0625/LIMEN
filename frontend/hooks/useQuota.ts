// 할당량 조회 훅 (React Query)
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { quotaAPI } from '../lib/api/index';
import type { QuotaUsage } from '../lib/types';
import { useAuth } from '../components/AuthGuard';
import { logger } from '../lib/utils/logger';
import { handleAuthError } from '../lib/utils/errorHelpers';

/**
 * 할당량 조회 훅 (일반)
 */
export function useQuota() {
  const { isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);
  
  // React Error #310 완전 해결: 클라이언트 마운트 확인 (hydration mismatch 방지)
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // 서버와 클라이언트 초기 렌더링에서 동일한 값 반환 (false)
  // 마운트 후에만 인증 상태 확인
  const enabled = mounted && isAuthenticated === true;
  
  return useQuery({
    queryKey: ['quota'],
    queryFn: async () => {
      try {
        const data = await quotaAPI.get();
        logger.log('[useQuota] Quota data received:', {
          hasData: !!data,
          hasUsage: !!data?.usage,
          hasQuota: !!data?.quota,
          dataKeys: data ? Object.keys(data) : [],
          dataPreview: data ? JSON.stringify(data).substring(0, 300) : 'empty',
        });
        
        // 데이터가 없거나 형식이 맞지 않으면 null 반환 (컴포넌트에서 처리)
        if (!data || !data.usage || !data.quota) {
          logger.warn('[useQuota] Invalid quota data structure');
          return null;
        }
        
        return data;
      } catch (error: unknown) {
        // 401/403 에러 처리
        handleAuthError(error);
        throw error;
      }
    },
    // 인증 상태가 확인된 후에만 쿼리 활성화 (null이 아닐 때만)
    // null이면 아직 인증 체크 중이므로 대기
    enabled: enabled,
    // 할당량은 VM 생성/삭제/업데이트 시에만 변경되므로 긴 staleTime
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    // Optimistic Updates와 Mutation이 할당량을 관리하므로 refetchInterval 제거
    // refetchInterval: false,
    // Background refetch 비활성화
    refetchOnWindowFocus: false,
    // 네트워크 재연결 시에만 재요청
    refetchOnReconnect: true,
    // 마운트 시에만 재요청
    refetchOnMount: true,
  });
}

/**
 * 할당량 조회 훅 (Suspense)
 * Suspense와 완전 통합된 버전
 */
export function useQuotaSuspense() {
  return useSuspenseQuery({
    queryKey: ['quota'],
    queryFn: async () => {
      try {
        return await quotaAPI.get();
      } catch (error: unknown) {
        // 401/403 에러 처리
        handleAuthError(error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}



