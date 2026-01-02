'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    // 루트 경로는 로그인 페이지로 리다이렉트
    router.replace('/login');
  }, [router]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-gray-500 dark:text-gray-400">리다이렉트 중...</div>
    </div>
  );
}
