/**
 * 클라이언트 마운트 확인 훅
 * SSR/Hydration mismatch 방지를 위한 공통 훅
 */
import { useState, useEffect } from 'react';

/**
 * 컴포넌트가 클라이언트에서 마운트되었는지 확인
 * @returns 마운트 여부
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}




