'use client';

import { memo } from 'react';
import { useQuota } from '../hooks/useQuota';
import { StatusCard } from './StatusCard';

/**
 * QuotaDisplay Component
 * Phase 4: React Best Practices - React.memo 적용으로 불필요한 리렌더링 방지
 */
const QuotaDisplay = memo(function QuotaDisplay() {
  // useQuery 사용: 로딩 상태 처리
  const { data: quota, isLoading, isError } = useQuota();
  
  // 오프라인 상태 확인 (에러 발생 또는 데이터 없음)
  const isOffline = isError || (!isLoading && !quota);

  // 서버 사이드에서는 로딩 상태로 표시
  if (typeof window === 'undefined') {
    return (
      <StatusCard title="Resource Quota" status="ok" subStatus="Loading...">
        <div className="text-sm text-gray-500">
          Loading...
        </div>
      </StatusCard>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-200 transition-all">
        <div className="h-6 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-2.5 bg-gray-200 rounded-full animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // 오프라인 상태 (에러 또는 데이터 없음)
  if (isOffline || !quota) {
    return (
      <StatusCard title="Resource Quota" status="error" subStatus="Offline">
        <div className="text-sm text-gray-500">
          Offline
        </div>
      </StatusCard>
    );
  }

  // React Error #310 완전 해결: useMemo 제거, 직접 계산 (hydration mismatch 방지)
  // 안전한 접근: quota.usage가 없을 수 있으므로 체크
  const vmPercent = quota && quota.usage && quota.quota ? (quota.usage.vms / quota.quota.max_vms) * 100 : 0;
  const cpuPercent = quota && quota.usage && quota.quota ? (quota.usage.cpu / quota.quota.max_cpu) * 100 : 0;
  const memoryPercent = quota && quota.usage && quota.quota ? (quota.usage.memory / quota.quota.max_memory) * 100 : 0;

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-200 transition-all">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-900">
        <span 
          className={`w-3 h-3 rounded-full ${
            vmPercent >= 90 || cpuPercent >= 90 || memoryPercent >= 90 ? 'bg-rose-500' : 
            vmPercent >= 70 || cpuPercent >= 70 || memoryPercent >= 70 ? 'bg-amber-500' : 
            'bg-emerald-500'
          }`}
          role="status"
          aria-label={`Quota status: ${vmPercent >= 90 || cpuPercent >= 90 || memoryPercent >= 90 ? 'Critical' : vmPercent >= 70 || cpuPercent >= 70 || memoryPercent >= 70 ? 'Warning' : 'Normal'}`}
        ></span>
        Resource Quota
      </h2>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between items-center p-2 bg-gray-100 rounded mb-2 transition-colors">
            <span className="font-medium text-sm text-gray-700">VMs</span>
            <span className="text-sm font-mono text-gray-900">{quota.usage.vms} / {quota.quota.max_vms}</span>
          </div>
          <div 
            className="w-full bg-gray-200 rounded-full h-2.5"
            role="progressbar"
            aria-valuenow={Math.min(vmPercent, 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Virtual machines: ${quota?.usage?.vms ?? 0} of ${quota?.quota?.max_vms ?? 0} used (${Math.min(vmPercent, 100).toFixed(1)}%)`}
          >
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                vmPercent >= 90 ? 'bg-rose-500' : vmPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(vmPercent, 100)}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center p-2 bg-gray-100 rounded mb-2 transition-colors">
            <span className="font-medium text-sm text-gray-700">CPU Cores</span>
            <span className="text-sm font-mono text-gray-900">{quota?.usage?.cpu ?? 0} / {quota?.quota?.max_cpu ?? 0}</span>
          </div>
          <div 
            className="w-full bg-gray-200 rounded-full h-2.5"
            role="progressbar"
            aria-valuenow={Math.min(cpuPercent, 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`CPU cores: ${quota?.usage?.cpu ?? 0} of ${quota?.quota?.max_cpu ?? 0} used (${Math.min(cpuPercent, 100).toFixed(1)}%)`}
          >
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                cpuPercent >= 90 ? 'bg-rose-500' : cpuPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(cpuPercent, 100)}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center p-2 bg-gray-100 rounded mb-2 transition-colors">
            <span className="font-medium text-sm text-gray-700">Memory</span>
            <span className="text-sm font-mono text-gray-900">{((quota?.usage?.memory ?? 0) / 1024).toFixed(1)} / {((quota?.quota?.max_memory ?? 0) / 1024).toFixed(1)} GB</span>
          </div>
          <div 
            className="w-full bg-gray-200 rounded-full h-2.5"
            role="progressbar"
            aria-valuenow={Math.min(memoryPercent, 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Memory: ${((quota?.usage?.memory ?? 0) / 1024).toFixed(1)} GB of ${((quota?.quota?.max_memory ?? 0) / 1024).toFixed(1)} GB used (${Math.min(memoryPercent, 100).toFixed(1)}%)`}
          >
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                memoryPercent >= 90 ? 'bg-rose-500' : memoryPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(memoryPercent, 100)}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </div>
  );
});

QuotaDisplay.displayName = 'QuotaDisplay';

export default QuotaDisplay;
