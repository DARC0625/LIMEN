'use client';

import { useEffect } from 'react';
import { handleError } from '../lib/utils/error';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 에러 추적
    handleError(error, {
      component: 'ErrorBoundary',
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">오류가 발생했습니다</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          예기치 않은 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </p>
        <div className="space-y-3">
        <button
          onClick={() => {
            // 오류 상태 초기화 후 대시보드로 이동
            reset();
            if (typeof window !== 'undefined') {
              // 약간의 지연 후 대시보드로 이동 (상태 초기화 시간 확보)
              setTimeout(() => {
                window.location.replace('/');
              }, 100);
            }
          }}
          className="w-full px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
        >
          다시 시도
        </button>
        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              // 로그인 페이지로 이동 (히스토리 교체)
              window.location.replace('/login');
            }
          }}
          className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          로그인 페이지로 이동
        </button>
        </div>
      </div>
    </div>
  );
}







