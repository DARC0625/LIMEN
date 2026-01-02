// 에이전트 메트릭스 조회 훅 (React Query)
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthGuard';

interface AgentMetrics {
  cpu_usage: number;
  total_memory: number;
  used_memory: number;
  free_memory: number;
  cpu_cores: number;
}

/**
 * 에이전트 메트릭스 조회 훅
 */
export function useAgentMetrics() {
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
    queryKey: ['agent', 'metrics'],
    queryFn: async () => {
      // 상대 경로 사용 (Next.js rewrites를 통해 프록시)
      // 모든 환경에서 동일하게 작동
      const response = await fetch('/agent/metrics');
      if (!response.ok) {
        // 503 에러는 Agent 서비스가 다운된 것으로 간주하고 조용히 실패
        if (response.status === 503) {
          throw new Error('Agent service unavailable');
        }
        throw new Error(`Failed to fetch agent metrics: ${response.status}`);
      }
      return response.json() as Promise<AgentMetrics>;
    },
    // 인증 상태가 확인된 후에만 쿼리 활성화 (null이 아닐 때만)
    // null이면 아직 인증 체크 중이므로 대기
    enabled: enabled,
    // 에이전트 메트릭스는 자주 변경되므로 짧은 간격으로 재요청
    staleTime: 5000, // 5초
    refetchInterval: 5000, // 5초마다 자동 재요청
    retry: (failureCount, error) => {
      // 503 에러는 재시도하지 않음 (Agent 서비스가 다운된 경우)
      if (error instanceof Error && (error.message.includes('503') || error.message.includes('Service Unavailable'))) {
        return false;
      }
      return failureCount < 1; // 다른 에러는 1번만 재시도
    },
    // 503 에러는 조용히 처리 (에러로 표시하지 않음)
    throwOnError: false,
  });
}

/**
 * 에이전트 메트릭스 조회 훅 (Suspense)
 * Suspense와 완전 통합된 버전 - Streaming SSR 최적화
 */
export function useAgentMetricsSuspense() {
  return useSuspenseQuery({
    queryKey: ['agent', 'metrics'],
    queryFn: async () => {
      // 상대 경로 사용 (Next.js rewrites를 통해 프록시)
      // 모든 환경에서 동일하게 작동
      const response = await fetch('/agent/metrics');
      if (!response.ok) {
        throw new Error('Failed to fetch agent metrics');
      }
      return response.json() as Promise<AgentMetrics>;
    },
    staleTime: 5000, // 5초
    refetchInterval: 5000, // 5초마다 자동 재요청
    retry: 1, // 실패 시 1번만 재시도
  });
}


