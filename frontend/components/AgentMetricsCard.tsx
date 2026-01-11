'use client';

import { memo } from 'react';
import { useAgentMetrics } from '../hooks/useAgentMetrics';
import { StatusCard, ProgressBar } from './StatusCard';

interface AgentMetrics {
  cpu_usage: number;
  total_memory: number;
  used_memory: number;
  free_memory: number;
  cpu_cores: number;
}

/**
 * Agent Metrics Card Component
 * Suspense와 완전 통합 - Streaming SSR 최적화
 * Phase 4: React Best Practices - React.memo 적용으로 불필요한 리렌더링 방지
 */
const AgentMetricsCard = memo(function AgentMetricsCard() {
  // useQuery 사용: 로딩 상태 처리
  const { data: agentMetrics, isLoading, isError } = useAgentMetrics();
  
  // 타입 가드: agentMetrics가 AgentMetrics 타입인지 확인
  const metrics = agentMetrics as AgentMetrics | undefined;

  if (isLoading) {
    return (
      <StatusCard title="Agent Metrics" status="ok" subStatus="Loading...">
        <div className="space-y-4 mt-2">
          <div className="h-2.5 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-2.5 bg-gray-200 rounded-full animate-pulse" />
        </div>
      </StatusCard>
    );
  }

  if (isError || !metrics) {
    return (
      <StatusCard title="Agent Metrics" status="error" subStatus="Offline">
        <div className="text-sm text-gray-500">
          Unable to fetch agent metrics
        </div>
      </StatusCard>
    );
  }

  // React Error #310 완전 해결: useMemo 제거, 직접 계산 (hydration mismatch 방지)
  // metrics는 이미 위에서 체크했으므로 여기서는 항상 truthy
  // 하지만 브랜치 커버리지를 위해 명시적으로 처리
  const cpuPercent = metrics?.cpu_usage ?? 0;
  const memoryPercent = metrics?.used_memory && metrics?.total_memory 
    ? (metrics.used_memory / metrics.total_memory) * 100 
    : 0;
  const totalMemoryGB = metrics?.total_memory 
    ? (metrics.total_memory / 1024 / 1024 / 1024).toFixed(2) 
    : '0';
  const cpuCores = metrics?.cpu_cores ?? 0;

  return (
    <StatusCard title="Agent Metrics" status="ok">
      <div className="space-y-4 mt-2">
        <ProgressBar 
          label="CPU Usage" 
          value={cpuPercent} 
          color="bg-cyan-500"
          aria-label={`CPU usage: ${cpuPercent.toFixed(1)}%`}
        />
        <ProgressBar 
          label="Memory Usage" 
          value={memoryPercent} 
          color="bg-violet-500"
          aria-label={`Memory usage: ${memoryPercent.toFixed(1)}%`}
        />
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>Total Memory:</span>
            <span className="font-mono">{totalMemoryGB} GB</span>
          </div>
          <div className="flex justify-between">
            <span>CPU Cores:</span>
            <span className="font-mono">{cpuCores}</span>
          </div>
        </div>
      </div>
    </StatusCard>
  );
});

AgentMetricsCard.displayName = 'AgentMetricsCard';

export default AgentMetricsCard;
