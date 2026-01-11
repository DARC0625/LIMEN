'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ToastContainer';
import DashboardInner from './DashboardInner';

export default function DashboardClient() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <DashboardInner />
      </ToastProvider>
    </QueryClientProvider>
  );
}
