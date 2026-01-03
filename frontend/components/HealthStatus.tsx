'use client';

import { useState, useEffect, useRef } from 'react';
import { StatusCard, StatusRow } from './StatusCard';
import { formatDateKR } from '../lib/utils/format';
import { logger } from '../lib/utils/logger';

type BackendHealth = {
  status: string;
  time: string;
  db: string;
  libvirt: string;
};

/**
 * Health Status Component
 * 백엔드 상태를 표시하는 컴포넌트
 * 일반 useState/useEffect 사용 (Suspense 불필요 - 폴링 방식)
 */
export default function HealthStatus() {
  const [health, setHealth] = useState<BackendHealth | null>(null);
  // 서버 사이드에서는 false로 시작, 클라이언트에서는 true로 시작하여 즉시 체크
  const [isLoading, setIsLoading] = useState(typeof window === 'undefined' ? false : true);
  const [isError, setIsError] = useState(false);
  // 최적화: 불필요한 리렌더링 방지를 위한 ref 사용
  const consecutiveErrorsRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let retryTimeout: NodeJS.Timeout | null = null;
    const MAX_CONSECUTIVE_ERRORS = 5;
    const BASE_RETRY_DELAY = 500; // 0.5초 - 빠른 재시도
    const MAX_RETRY_DELAY = 3000; // 3초 - 최대 재시도 간격
    
    const fetchHealth = async () => {
      if (!mountedRef.current) return;
      
        let timeoutId: NodeJS.Timeout | null = null;
        
      try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 3000); // 3초 타임아웃 (더 빠른 실패 감지)
        
        // 프로덕션에서는 Envoy 프록시 사용, 개발에서는 직접 백엔드 호출
        let apiUrl: string;
        if (typeof window !== 'undefined') {
          const hostname = window.location.hostname;
          // 프로덕션 도메인인 경우 상대 경로 사용 (Envoy 프록시)
          if (hostname === 'limen.kr' || hostname === 'www.limen.kr') {
            apiUrl = '/api/health';
          } else {
            // 개발 환경: 직접 백엔드 호출
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:18443';
            apiUrl = `${backendUrl}/api/health`;
          }
        } else {
          // 서버 사이드: 기본값
          apiUrl = '/api/health';
        }
        
        // 개발 환경에서만 로그 출력 (성능 최적화)
        logger.log('[HealthStatus] Fetching health from:', apiUrl);
        
        // 헬스체크는 인증 없이도 가능하므로 credentials를 선택적으로 설정
        // 로그인 페이지에서 불필요한 쿠키 전송 방지
        const res = await fetch(apiUrl, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
          // credentials: 'include' 제거 (헬스체크는 인증 불필요, 로그인 페이지 깜빡임 방지)
          signal: controller.signal,
        });
        
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        if (!mountedRef.current) return;
        
        if (!res.ok) {
          const errorText = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
        }
        
        const data = await res.json();
        
        if (!mountedRef.current) return;
        
        // 성공 시 즉시 상태 업데이트 및 에러 카운터 리셋
        const hadErrors = consecutiveErrorsRef.current > 0;
        consecutiveErrorsRef.current = 0;
        
        // 함수형 업데이트로 확실하게 반영 (불필요한 리렌더링 방지)
        // 이전 상태와 비교하여 변경이 있을 때만 업데이트
        setHealth(prevHealth => {
          // 데이터가 동일하면 업데이트하지 않음 (리렌더링 방지)
          if (prevHealth && 
              prevHealth.status === data.status && 
              prevHealth.db === data.db && 
              prevHealth.libvirt === data.libvirt &&
              prevHealth.time === data.time) {
            return prevHealth; // 동일한 객체 반환하여 리렌더링 방지
          }
          return data;
        });
        setIsError(false);
        setIsLoading(false);
        
        // 성공했는데 이전에 에러가 있었다면 즉시 다음 체크 예약 (빠른 동기화)
        if (hadErrors) {
          if (retryTimeout) {
            clearTimeout(retryTimeout);
            retryTimeout = null;
          }
          // 성공 후 0.5초 뒤에 다시 한 번 체크하여 안정성 확인 (더 빠른 검증)
          retryTimeout = setTimeout(() => {
            if (mountedRef.current) {
              fetchHealth();
            }
          }, 500);
        }
      } catch (err) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        if (!mountedRef.current) return;
        
        // AbortError는 타임아웃이므로 조용히 처리
        if (err instanceof Error && err.name === 'AbortError') {
          logger.warn("[HealthStatus] Request timeout");
        } else {
          logger.error(err instanceof Error ? err : new Error(String(err)), {
            component: 'HealthStatus',
            action: 'health_check',
          });
        }
        
        consecutiveErrorsRef.current++;
        setHealth(null);
        setIsLoading(false);
        setIsError(true);
        
        // 연속 에러가 발생하면 더 자주 재시도 (백엔드가 다시 올라왔을 때 빠르게 감지)
        // 첫 번째 에러: 0.5초, 두 번째: 1초, 세 번째: 2초, 네 번째: 3초 (최대)
        if (consecutiveErrorsRef.current <= MAX_CONSECUTIVE_ERRORS) {
          const retryDelay = Math.min(
            BASE_RETRY_DELAY * Math.pow(2, consecutiveErrorsRef.current - 1),
            MAX_RETRY_DELAY
          );
          
          if (retryTimeout) {
            clearTimeout(retryTimeout);
          }
          
          retryTimeout = setTimeout(() => {
            if (mountedRef.current) {
              fetchHealth();
            }
          }, retryDelay);
        }
      }
    };
    
    // 네트워크 상태 변화 감지 (온라인/오프라인 이벤트)
    const handleOnline = () => {
      if (mountedRef.current) {
        logger.log("[HealthStatus] Network online, checking health immediately");
        setIsLoading(true);
        setIsError(false);
        consecutiveErrorsRef.current = 0;
        fetchHealth();
      }
    };
    
    const handleOffline = () => {
      if (mountedRef.current) {
        logger.log("[HealthStatus] Network offline");
        setIsError(true);
        setHealth(null);
      }
    };
    
    // 클라이언트에서만 실행
    if (typeof window === 'undefined') {
      return () => {
        mountedRef.current = false;
      };
    }
    
    // 네트워크 이벤트 리스너 등록
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // 클라이언트에서 즉시 첫 체크 실행
    setIsLoading(true);
    setIsError(false);
    consecutiveErrorsRef.current = 0;
    
    // 즉시 첫 체크 실행
    fetchHealth();
    
    // 30초마다 자동 갱신 (로그인 페이지 깜빡임 방지)
    // 오프라인 상태에서도 계속 시도하되, 연속 에러가 많으면 retryTimeout이 처리
    interval = setInterval(() => {
      // 연속 에러가 많으면 간격을 늘림 (retryTimeout이 처리)
      if (consecutiveErrorsRef.current > MAX_CONSECUTIVE_ERRORS) {
        return; // retryTimeout이 처리
      }
      fetchHealth();
    }, 30000); // 2초 → 30초로 변경 (로그인 페이지 깜빡임 방지)
    
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // formatDateKR은 lib/utils/format에서 import
  
  // React Error #310 완전 해결: useMemo 제거, 직접 계산 (hydration mismatch 방지)
  const isOffline = isError || !health || (health && health.status !== 'ok');

  // 서버 사이드에서는 로딩 상태로 렌더링 (hydration mismatch 방지)
  if (typeof window === 'undefined') {
    return (
      <StatusCard title="Connection Status" status="ok" subStatus="Loading...">
        <div className="space-y-2">
          <StatusRow label="Database" value="Loading..." />
          <StatusRow label="VM Service" value="Loading..." />
        </div>
      </StatusCard>
    );
  }
  
  // 클라이언트에서 로딩 중이면 로딩 상태 표시
  // health 데이터가 있으면 즉시 표시 (로딩 중이어도 health가 있으면 표시)
  if (isLoading && !health && !isError) {
    return (
      <StatusCard title="Connection Status" status="ok" subStatus="Loading...">
        <div className="space-y-2">
          <StatusRow label="Database" value="Loading..." />
          <StatusRow label="VM Service" value="Loading..." />
        </div>
      </StatusCard>
    );
  }

  return (
    <StatusCard 
      title="Connection Status" 
      status={isOffline ? 'error' : 'ok'}
      subStatus={isOffline ? 'Offline' : undefined}
    >
      <div className="space-y-2" suppressHydrationWarning>
        <StatusRow 
          label="Database" 
          value={isOffline ? 'Offline' : (health?.db || 'Unknown')} 
        />
        <StatusRow 
          label="VM Service" 
          value={isOffline ? 'Offline' : (health?.libvirt || 'Unknown')} 
        />
      </div>
      {health && !isOffline && (
        <div className="text-xs text-gray-400 dark:text-gray-500 text-right mt-2" aria-live="polite" aria-atomic="true" suppressHydrationWarning>
          <span className="sr-only">Last update:</span>
          {formatDateKR(health.time)}
        </div>
      )}
    </StatusCard>
  );
}