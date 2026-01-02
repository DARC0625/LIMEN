'use client';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export default function Skeleton({ 
  className = '', 
  variant = 'rectangular',
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded';
  
  if (variant === 'text' && lines > 1) {
    return (
      <div className={className}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${baseClasses} mb-2 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
            style={{ 
              height: height || '1rem',
              width: i === lines - 1 ? '75%' : width || '100%',
            }}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }
  
  const variantClasses = {
    text: 'h-4',
    circular: 'rounded-full',
    rectangular: 'rounded',
    card: 'rounded-lg',
  };
  
  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{ 
        width: width || '100%',
        height: height || (variant === 'circular' ? width : '1rem'),
      }}
      aria-hidden="true"
    />
  );
}

// VM 카드 스켈레톤
export function VMCardSkeleton() {
  return (
    <div className="relative border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 flex flex-col w-[280px] sm:w-56 flex-shrink-0 h-[280px] sm:h-[300px] bg-white dark:bg-gray-800">
      {/* OS 로고 스켈레톤 */}
      <div className="flex justify-center mb-2">
        <Skeleton variant="circular" width={48} height={48} />
      </div>
      
      {/* VM 이름 스켈레톤 */}
      <div className="flex-1 flex flex-col justify-center gap-2">
        <Skeleton variant="text" width="80%" height="1.25rem" className="mx-auto" />
        
        {/* 스펙 스켈레톤 */}
        <div className="flex flex-col gap-1.5 items-center">
          <Skeleton variant="text" width="60%" height="1rem" />
          <Skeleton variant="text" width="70%" height="1rem" />
        </div>
        
        {/* 상태 스켈레톤 */}
        <div className="flex justify-center mt-2">
          <Skeleton variant="rectangular" width={80} height={24} className="rounded-full" />
        </div>
      </div>
      
      {/* UUID 스켈레톤 */}
      <div className="pt-1.5 border-t border-gray-100 dark:border-gray-700 mt-auto">
        <Skeleton variant="text" width="70%" height="0.75rem" className="mx-auto" />
      </div>
    </div>
  );
}

// 카드 그리드 스켈레톤
export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 sm:p-6 bg-white dark:bg-gray-800/90 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <Skeleton variant="text" width="60%" height="1.5rem" className="mb-4" />
          <Skeleton variant="text" lines={3} />
        </div>
      ))}
    </div>
  );
}








