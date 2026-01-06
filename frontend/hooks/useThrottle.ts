/**
 * Throttle 훅
 * 함수 호출을 제한하여 성능 최적화
 */
import { useRef, useCallback } from 'react';

/**
 * 함수를 throttle하는 훅
 * @param func - throttle할 함수
 * @param delay - 제한 시간 (ms)
 * @returns throttle된 함수
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number = 300
): T {
  const lastRun = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastRun.current >= delay) {
        lastRun.current = now;
        func(...args);
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          lastRun.current = Date.now();
          func(...args);
        }, delay - (now - lastRun.current));
      }
    }) as T,
    [func, delay]
  );
}




