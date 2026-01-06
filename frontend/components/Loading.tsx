'use client';

interface LoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Loading({ message = 'Loading...', size = 'md' }: LoadingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center p-4" role="status" aria-live="polite" aria-label={message || 'Loading'}>
      <div
        className={`${sizeClasses[size]} border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin`}
        aria-hidden="true"
      />
      {message && (
        <p className="mt-2 text-sm text-gray-600">
          {message}
        </p>
      )}
      <span className="sr-only">{message || 'Loading, please wait'}</span>
    </div>
  );
}










