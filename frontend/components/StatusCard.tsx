'use client';

import React, { memo } from 'react';

/**
 * Status Card Component
 * 재사용 가능한 상태 카드 컴포넌트
 * Phase 4: React Best Practices - React.memo 적용으로 불필요한 리렌더링 방지
 */
export const StatusCard = memo(function StatusCard({ 
  title, 
  status, 
  subStatus, 
  children 
}: { 
  title: string; 
  status: 'ok' | 'error'; 
  subStatus?: string; 
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 sm:p-6 bg-white dark:bg-gray-800/90 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 transition-all backdrop-blur-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
          <span 
            className={`w-3 h-3 rounded-full ${status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`}
            role="status"
            aria-label={`Status: ${status === 'ok' ? 'OK' : 'Error'}`}
          ></span>
          {title}
        </h2>
        {subStatus && (
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400" aria-label={`Sub status: ${subStatus}`}>
            {subStatus}
          </span>
        )}
      </div>
      {children}
    </div>
  );
});

StatusCard.displayName = 'StatusCard';

/**
 * Status Row Component
 * Phase 4: React Best Practices - React.memo 적용
 */
export const StatusRow = memo(function StatusRow({ label, value }: { label: string; value?: string }) {
  const isConnected = value === 'connected';
  const isOffline = value === 'Offline' || value === 'Loading...';
  const isError = !isConnected && !isOffline && value !== 'Unknown';
  
  // 상태에 따른 색상 결정
  let statusColor = '';
  if (isConnected) {
    statusColor = 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
  } else if (isOffline) {
    statusColor = 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
  } else if (isError) {
    statusColor = 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
  } else {
    statusColor = 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  }
  
  return (
    <div className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-700 rounded mb-2 transition-colors">
      <span className="font-medium">{label}</span>
      <span 
        className={`px-2 py-0.5 text-xs rounded-full ${statusColor}`}
        role="status"
        aria-label={`${label}: ${value || 'Unknown'}`}
      >
        {value || 'Unknown'}
      </span>
    </div>
  );
});

StatusRow.displayName = 'StatusRow';

/**
 * Progress Bar Component
 * Phase 4: React Best Practices - React.memo 적용
 */
export const ProgressBar = memo(function ProgressBar({ label, value, color }: { label: string; value: number; color: string }) {
  const percentage = Math.min(value, 100);
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-mono" aria-label={`${label}: ${percentage.toFixed(1)} percent`}>
          {percentage.toFixed(1)}%
        </span>
      </div>
      <div 
        className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${percentage.toFixed(1)}%`}
      >
        <div 
          className={`${color} h-2.5 rounded-full transition-all duration-500`} 
          style={{ width: `${percentage}%` }}
          aria-hidden="true"
        ></div>
      </div>
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

