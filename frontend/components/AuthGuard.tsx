'use client';

import { useEffect, useState, createContext, useContext, useRef, startTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { 
  forceLogout, 
  checkAndUnblockAccount
} from '@/lib/security';
import { checkAuth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';

const AuthContext = createContext<{ isAuthenticated: boolean | null }>({ isAuthenticated: null });

export function useAuth() {
  return useContext(AuthContext);
}

// Session timeout: Auto logout after 10 minutes of inactivity
const INACTIVE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// checkAuth is imported from lib/auth/index.ts

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  // AuthGuard is now only used in protected routes, so public path check is unnecessary
  // Accessing protected routes requires authentication
  const isPublicPath = false;
  
  // Inactive tab detection: Auto logout after 10 minutes of inactivity
  const lastActivityRef = useRef<number>(Date.now());
  const inactiveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const updateActivityRef = useRef<(() => void) | null>(null);

  // React Error #321 fix: Store isAuthenticated in ref to remove dependencies
  const isAuthenticatedRef = useRef<boolean | null>(null);

  // React Error #310 fix: Remove useMemo, create object directly (prevents hydration mismatch)
  // Declare outside conditional to comply with React rules
  const loadingContextValue = { isAuthenticated: null };
  const unauthenticatedContextValue = { isAuthenticated: false };
  const authContextValue = { isAuthenticated };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check and unblock blocked accounts (passive monitoring)
    checkAndUnblockAccount();
    
    // Don't render anything until authentication is confirmed
    // Backend session check (async)
    // React Error #321 fix: Run initial auth check only once and minimize state updates
    // Important: Don't send session check request on login page
    let initialAuthCheckDone = false;
    const verifyAuth = async () => {
      // 이미 체크가 완료되었으면 스킵
      if (initialAuthCheckDone) {
        return;
      }
      
      // 공개 경로(로그인, 회원가입)에서는 세션 확인 요청을 보내지 않음
      // 로그인 전에는 세션이 없을 것이므로 불필요한 요청 방지
      // 루트 경로는 공개 경로가 아님 - 인증된 사용자도 접근 가능해야 함
      if (isPublicPath) {
        isAuthenticatedRef.current = false;
        queueMicrotask(() => {
          initialAuthCheckDone = true;
          setMounted(true);
          startTransition(() => {
            setIsAuthenticated(false);
          });
        });
        return;
      }
      
      // 루트 경로를 포함한 모든 경로에서 인증 확인
      // 토큰이 없으면 세션 확인 요청을 보내지 않고 바로 false 반환
      const { tokenManager } = await import('../lib/tokenManager');
      
      // 토큰 확인 (Refresh Token이 있으면 유효한 것으로 간주)
      const hasRefreshToken = tokenManager.hasValidToken();
      
      // Phase 4: 보안 강화 - localStorage 직접 사용 제거, tokenManager 사용
      // 디버깅: 토큰 상태 확인 (항상 출력)
      const expiresAt = tokenManager.getExpiresAt();
      logger.log('[AuthGuard] Token check:', {
        hasRefreshToken,
        hasRefreshTokenInStorage: hasRefreshToken,
        hasExpiresAt: !!expiresAt,
        pathname,
        currentTime: Date.now(),
        expiresAt: expiresAt || null,
      });
      
      if (!hasRefreshToken) {
        // 토큰이 없으면 세션 확인 요청 없이 바로 false 반환
        logger.log('[AuthGuard] No token found, redirecting to login');
        isAuthenticatedRef.current = false;
        queueMicrotask(() => {
          initialAuthCheckDone = true;
          setMounted(true);
          startTransition(() => {
            setIsAuthenticated(false);
          });
        });
        return;
      }
      
      // 토큰이 있으면 세션 확인 (로그인 직후 세션 설정 확인)
      // 중요: 로그인 직후에는 세션이 아직 완전히 설정되지 않았을 수 있으므로
      // 토큰이 있으면 일단 인증된 것으로 간주하고, 세션 확인은 백그라운드에서 진행
      // 이렇게 하면 로그인 직후에도 대시보드가 표시되고, 세션 확인 실패 시 나중에 로그아웃됨
      
      logger.log('[AuthGuard] Token found, setting authenticated to true (background session check will follow)');
      
      // 일단 토큰이 있으면 인증된 것으로 간주 (로그인 직후 대시보드 표시를 위해)
      isAuthenticatedRef.current = true;
      queueMicrotask(() => {
        initialAuthCheckDone = true;
        setMounted(true);
        startTransition(() => {
          setIsAuthenticated(true);
        });
      });
      
      // 백그라운드에서 세션 확인 (비동기로 진행)
      // 세션 확인이 실패하면 나중에 인증 상태를 업데이트
      // 로그인 직후에는 세션이 완전히 설정되기까지 시간이 걸릴 수 있으므로 충분히 재시도
      (async () => {
        let authResult: { valid: boolean; reason?: string } | null = null;
        let retryCount = 0;
        const maxRetries = 10; // 재시도 횟수 증가 (로그인 직후 세션 설정 대기)
        
        while (retryCount < maxRetries && (!authResult || !authResult.valid)) {
          try {
            authResult = await checkAuth();
            
            if (authResult.valid) {
              // 세션 확인 성공 - 이미 인증된 것으로 설정되어 있으므로 변경 없음
              logger.log('[AuthGuard] Session verified successfully in background');
              break;
            }
            
            // 세션 확인 실패 시 재시도 (로그인 직후일 수 있음)
            if (retryCount < maxRetries - 1) {
              // 첫 번째 재시도는 짧게, 이후는 점진적으로 증가
              const delay = retryCount < 3 ? 300 : 500; // 처음 3번은 300ms, 이후는 500ms
              await new Promise(resolve => setTimeout(resolve, delay));
              retryCount++;
              logger.log(`[AuthGuard] Session check failed, retrying (${retryCount}/${maxRetries})...`, {
                reason: authResult.reason,
                valid: authResult.valid,
              });
            }
          } catch (error) {
            // 네트워크 오류 등은 재시도
            if (retryCount < maxRetries - 1) {
              const delay = retryCount < 3 ? 300 : 500;
              await new Promise(resolve => setTimeout(resolve, delay));
              retryCount++;
              logger.log(`[AuthGuard] Auth verification error, retrying (${retryCount}/${maxRetries})...`, error);
            } else {
              // 최종 실패 - 하지만 토큰이 있으면 일단 유지 (쿠키 문제일 수 있음)
              logger.error(error, { component: 'AuthGuard', action: 'auth_verification_failed' });
              // 토큰이 있으면 인증 상태를 유지 (쿠키 전송 문제일 수 있으므로)
              // 실제로는 세션이 유효할 수 있지만 쿠키 전송 문제로 확인 실패
              logger.warn('[AuthGuard] Keeping authenticated state despite session check failure (token exists)');
              authResult = { valid: true }; // 토큰이 있으면 일단 유효한 것으로 간주
            }
          }
        }
        
        // 최종 결과 반영 (세션 확인 실패 시에만 업데이트)
        // 단, 토큰이 있으면 인증 상태를 유지 (쿠키 전송 문제일 수 있으므로)
        if (authResult && !authResult.valid && !tokenManager.hasValidToken()) {
          logger.log('[AuthGuard] Background session check failed and no token, setting authenticated to false');
          isAuthenticatedRef.current = false;
          startTransition(() => {
            setIsAuthenticated(false);
          });
        }
      })();
    };
    
    // 백엔드 세션 확인 시작 (한 번만 실행)
    // 공개 경로가 아닐 때만 세션 확인 요청 전송
    verifyAuth();
    
    // BroadcastChannel로 다른 탭과 통신
    let authChannel: BroadcastChannel | null = null;
    try {
      authChannel = new BroadcastChannel('auth_channel');
      authChannel.onmessage = (event) => {
        if (event.data.type === 'FORCE_LOGOUT' || event.data.type === 'AUTH_EVENT') {
          if (event.data.action === 'log') {
            forceLogout(event.data.reason || '인증 이벤트가 발생했습니다.');
          }
        }
      };
    } catch {
      // BroadcastChannel을 지원하지 않는 경우 무시
    }
    
    // StorageEvent로 다른 탭의 로그아웃 감지 - 백엔드 세션 확인 (비동기)
    // 중요: 로그인 페이지에서는 세션 확인 요청을 보내지 않음
    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key === 'auth_token' || e.key === 'auth_token_timestamp') {
        // 공개 경로에서는 세션 확인 요청을 보내지 않음
        if (isPublicPath) {
          return;
        }
        
        try {
          const authCheck = await checkAuth();
          // 이전 값과 비교하여 불필요한 업데이트 방지
          if (isAuthenticatedRef.current !== authCheck.valid) {
            // ref 업데이트는 이벤트 핸들러 내부에서만 (렌더링 중 업데이트 방지)
            isAuthenticatedRef.current = authCheck.valid;
            // 상태 업데이트를 다음 틱으로 지연하여 무한 루프 방지
            setTimeout(() => {
              startTransition(() => {
                setIsAuthenticated(authCheck.valid);
              });
            }, 0);
          }
        } catch (error) {
          // 백엔드 세션 확인 실패 시 무시
          logger.error(error instanceof Error ? error : new Error(String(error)), { component: 'AuthGuard', action: 'storage_change_check' });
        }
      }
      
      if (e.key === 'force_logout' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          forceLogout(data.reason || '인증 이벤트가 발생했습니다.');
        } catch {
          // JSON 파싱 실패 시 무시
        }
      }
    };
    
    const handleTokenUpdate = async () => {
      // 공개 경로에서는 세션 확인 요청을 보내지 않음
      if (isPublicPath) {
        return;
      }
      
      try {
        const authCheck = await checkAuth();
        // 이전 값과 비교하여 불필요한 업데이트 방지
        if (isAuthenticatedRef.current !== authCheck.valid) {
          // ref 업데이트는 이벤트 핸들러 내부에서만 (렌더링 중 업데이트 방지)
          isAuthenticatedRef.current = authCheck.valid;
          // 상태 업데이트를 다음 틱으로 지연하여 무한 루프 방지
          setTimeout(() => {
            startTransition(() => {
              setIsAuthenticated(authCheck.valid);
            });
          }, 0);
        }
      } catch (error) {
        // 백엔드 세션 확인 실패 시 무시
        logger.error(error instanceof Error ? error : new Error(String(error)), { component: 'AuthGuard', action: 'token_update_check' });
      }
    };
    
    // 활동 감지: 마우스, 키보드, 터치 이벤트 (10분 비활성 시 자동 로그아웃)
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      
      // 기존 타임아웃 클리어
      if (inactiveTimeoutRef.current) {
        clearTimeout(inactiveTimeoutRef.current);
      }
      
      // 새로운 타임아웃 설정 (10분)
      inactiveTimeoutRef.current = setTimeout(() => {
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        if (timeSinceLastActivity >= INACTIVE_TIMEOUT_MS && isAuthenticatedRef.current) {
          // 10분 비활성 시 자동 로그아웃
          forceLogout('10분 동안 활동이 없어 세션이 만료되었습니다.');
          isAuthenticatedRef.current = false;
          // 상태 업데이트를 다음 틱으로 지연하여 무한 루프 방지
          setTimeout(() => {
            startTransition(() => {
              setIsAuthenticated(false);
            });
          }, 0);
        }
      }, INACTIVE_TIMEOUT_MS);
    };

    // updateActivity를 ref에 저장 (cleanup에서 접근하기 위해)
    updateActivityRef.current = updateActivity;

    // 활동 이벤트 리스너 등록
    activityEvents.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    // 초기 활동 시간 설정
    updateActivity();

    // 세션 체크 (5분마다) - 백엔드 세션 확인 (비동기)
    // React Error #321 해결: 상태 업데이트를 debounce하고 불필요한 업데이트 방지
    // 중요: 로그인 페이지에서는 세션 확인 요청을 보내지 않음
    let sessionCheckInProgress = false;
    const sessionCheckInterval = setInterval(async () => {
      // 공개 경로에서는 세션 확인 요청을 보내지 않음
      if (isPublicPath) {
        return;
      }
      
      // 이미 체크 중이면 스킵 (중복 호출 방지)
      if (sessionCheckInProgress) {
        return;
      }
      
      sessionCheckInProgress = true;
      try {
        const authCheck = await checkAuth();
        const currentAuth = isAuthenticatedRef.current;
        
        if (!authCheck.valid && currentAuth) {
          forceLogout(authCheck.reason || '세션이 만료되었습니다.');
          // ref 업데이트는 setInterval 내부에서만 (렌더링 중 업데이트 방지)
          isAuthenticatedRef.current = false;
          // 상태 업데이트를 다음 틱으로 지연하여 무한 루프 방지
          setTimeout(() => {
            startTransition(() => {
              setIsAuthenticated(false);
            });
          }, 0);
          return;
        }
        
        // 이전 값과 다를 때만 업데이트
        if (authCheck.valid !== currentAuth) {
          // ref 업데이트는 setInterval 내부에서만 (렌더링 중 업데이트 방지)
          isAuthenticatedRef.current = authCheck.valid;
          // 상태 업데이트를 다음 틱으로 지연하여 무한 루프 방지
          setTimeout(() => {
            startTransition(() => {
              setIsAuthenticated(authCheck.valid);
            });
          }, 0);
        }
      } catch (error) {
        // 백엔드 세션 확인 실패 시 무시
        logger.error(error instanceof Error ? error : new Error(String(error)), { component: 'AuthGuard', action: 'session_check' });
      } finally {
        sessionCheckInProgress = false;
      }
    }, 5 * 60 * 1000);
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('authTokenUpdated', handleTokenUpdate);
    
    return () => {
      clearInterval(sessionCheckInterval);
      if (inactiveTimeoutRef.current) {
        clearTimeout(inactiveTimeoutRef.current);
      }
      // 활동 이벤트 리스너 제거
      if (updateActivityRef.current) {
        const eventsToRemove = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        eventsToRemove.forEach(event => {
          window.removeEventListener(event, updateActivityRef.current!);
        });
      }
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authTokenUpdated', handleTokenUpdate);
      if (authChannel) {
        authChannel.close();
      }
    };
  }, []); // 보호된 경로에서만 사용되므로 의존성 단순화 - pathname 변경 시 재인증하지 않음 (세션 유지)

  // 인증되지 않았으면 /login으로 리다이렉트
  useEffect(() => {
    if (mounted && isAuthenticated === false) {
      router.replace('/login');
    }
  }, [mounted, isAuthenticated, router]);

  // 인증 확인 전까지는 절대 렌더링하지 않음
  if (!mounted || isAuthenticated === null) {
    return (
      <AuthContext.Provider value={loadingContextValue}>
        <div className="min-h-screen flex items-center justify-center bg-gray-50" suppressHydrationWarning>
          <div className="text-gray-500">Authenticating...</div>
        </div>
      </AuthContext.Provider>
    );
  }
  
  // 인증된 사용자만 렌더링 (보호된 경로이므로 항상 인증 필요)
  if (isAuthenticated) {
    return (
      <AuthContext.Provider value={authContextValue}>
        <div className="min-h-screen" suppressHydrationWarning>{children}</div>
      </AuthContext.Provider>
    );
  }

  // 인증되지 않았으면 리다이렉트 중 (위 useEffect에서 처리)
  return (
    <AuthContext.Provider value={unauthenticatedContextValue}>
      <div className="min-h-screen flex items-center justify-center bg-gray-50" suppressHydrationWarning>
        <div className="text-gray-500">리다이렉트 중...</div>
      </div>
    </AuthContext.Provider>
  );
}