'use client';

// 동적 렌더링 강제
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import LoginForm from '../../components/LoginForm';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

