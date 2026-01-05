'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import dynamicImport from 'next/dynamic';
import { queryClient } from '../lib/queryClient';
import { ReactNode } from 'react';

// React Query Devtools 타입
type ReactQueryDevtoolsType = React.ComponentType<{ initialIsOpen?: boolean }> | null;

// React Query Devtools는 개발 환경에서만 동적 로드 (번들 크기 최적화)
// Next.js는 빌드 시점에 process.env.NODE_ENV를 치환
const ReactQueryDevtools = process.env.NODE_ENV === 'development'
  ? dynamicImport(
      () => import('@tanstack/react-query-devtools').then((mod) => ({ default: mod.ReactQueryDevtools })),
      { ssr: false }
    ) as ReactQueryDevtoolsType
  : null;

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const DevToolsComponent = ReactQueryDevtools;
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* 개발 환경에서만 DevTools 표시 */}
      {process.env.NODE_ENV === 'development' && DevToolsComponent && (
        <DevToolsComponent initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
