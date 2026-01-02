'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <svg
            className="w-24 h-24 mx-auto text-gray-400 dark:text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.464-2.83m-1.414 5.658a9 9 0 01-2.12-4.308m1.414-5.658a5 5 0 011.414-1.414m4.243 2.829a4.978 4.978 0 011.464-2.83M8.464 8.464l-2.829-2.829m0 0L3 3m2.635 2.635L8.464 8.464"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          오프라인 상태
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          인터넷 연결을 확인해주세요. 네트워크가 복구되면 자동으로 다시 시도합니다.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="페이지 새로고침"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}








