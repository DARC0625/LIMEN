/**
 * React Query 클라이언트 설정
 * 통합된 상수 사용
 */

import { QueryClient } from '@tanstack/react-query';
import { QUERY_CONSTANTS } from './constants';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_CONSTANTS.STALE_TIME,
      gcTime: QUERY_CONSTANTS.GC_TIME,
      retry: QUERY_CONSTANTS.RETRY ? 1 : 0,
      retryDelay: QUERY_CONSTANTS.RETRY_DELAY,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: {
      retry: false,
    },
  },
});







