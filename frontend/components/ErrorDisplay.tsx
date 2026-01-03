'use client';

import { useRouter } from 'next/navigation';
import { getErrorMessage, extractErrorCode, type ErrorDisplayProps } from '@/lib/utils/errorMessages';
import Link from 'next/link';

export function ErrorDisplay({ error, onAction }: ErrorDisplayProps) {
  const router = useRouter();
  const errorCode = extractErrorCode(error);
  const errorMessage = getErrorMessage(errorCode);

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else if (errorMessage.actionUrl) {
      if (errorMessage.actionUrl.startsWith('mailto:')) {
        window.location.href = errorMessage.actionUrl;
      } else {
        router.push(errorMessage.actionUrl);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          {errorMessage.title}
        </h2>
        <p className="text-gray-700 mb-6">
          {errorMessage.message}
        </p>
        
        {errorMessage.action && (
          <div className="space-y-2">
            {errorMessage.actionUrl ? (
              errorMessage.actionUrl.startsWith('mailto:') ? (
                <a
                  href={errorMessage.actionUrl}
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                >
                  {errorMessage.action}
                </a>
              ) : (
                <Link
                  href={errorMessage.actionUrl}
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                >
                  {errorMessage.action}
                </Link>
              )
            ) : (
              <button
                onClick={handleAction}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
              >
                {errorMessage.action}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

