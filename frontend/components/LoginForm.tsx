'use client';

import { useState, useEffect, useRef } from 'react';
import { authAPI, setToken } from '@/lib/api/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { logger } from '@/lib/utils/logger';
import { sanitizeInput } from '@/lib/utils/validation';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isCheckingBackend, setIsCheckingBackend] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // URL 파라미터에서 로그아웃 사유 확인
  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason) {
      setError(decodeURIComponent(reason));
    }
  }, [searchParams]);

  // 백엔드 연결 상태 확인
  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        // 상태 변경을 최소화하여 불필요한 리렌더링 방지
        setIsCheckingBackend(prev => {
          // 이미 체크 중이면 업데이트하지 않음
          if (prev) return prev;
          return true;
        });
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃으로 증가
        
        try {
          const response = await fetch('/api/health', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
            // credentials 제거 (헬스체크는 인증 불필요, 로그인 페이지 깜빡임 방지)
          });
          
          clearTimeout(timeoutId);
          
          // 이전 상태와 비교하여 변경이 있을 때만 업데이트
          if (response.ok) {
            setIsOffline(prev => prev ? false : prev); // false로 변경할 때만 업데이트
          } else {
            setIsOffline(prev => !prev ? true : prev); // true로 변경할 때만 업데이트
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      } catch (err) {
        // 네트워크 오류 또는 타임아웃
        const error = err instanceof Error ? err : new Error(String(err));
        // AbortError는 타임아웃이므로 조용히 처리
        if (error.name !== 'AbortError') {
          logger.warn('[LoginForm] Backend health check failed:', error);
        }
        setIsOffline(prev => !prev ? true : prev); // true로 변경할 때만 업데이트
      } finally {
        setIsCheckingBackend(false);
      }
    };

    // 즉시 확인
    checkBackendHealth();

    // 30초마다 재확인 (로그인 페이지 깜빡임 방지)
    checkIntervalRef.current = setInterval(checkBackendHealth, 30000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 오프라인 상태면 로그인 시도하지 않음
    if (isOffline) {
      setError('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
      return;
    }
    
    // 입력 sanitization (XSS 방지)
    const sanitizedUsername = sanitizeInput(username);
    const sanitizedPassword = password; // 비밀번호는 sanitization하지 않음
    
    // 기본 검증
    if (!sanitizedUsername || sanitizedUsername.length < 1) {
      setError('사용자 이름을 입력해주세요.');
      return;
    }
    
    if (!sanitizedPassword || sanitizedPassword.length < 1) {
      setError('비밀번호를 입력해주세요.');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      logger.log('[LoginForm] Starting login...');
      // Sanitized username 사용
      const response = await authAPI.login({ username: sanitizedUsername, password: sanitizedPassword });
      logger.log('[LoginForm] Login API response received:', {
        success: response.success,
        hasAccessToken: !!response.access_token,
        hasRefreshToken: !!response.refresh_token,
      });
      
      // 쿠키 기반 인증: 토큰은 쿠키로만 전달되므로 JSON 응답에서 토큰을 기대하지 않음
      // 로그인 성공 여부만 확인
      if (!response.success) {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
        setLoading(false);
        return;
      }
      
      // 쿠키 설정 대기 (브라우저가 쿠키를 처리할 시간)
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 세션 확인: /api/auth/session 호출로 인증 여부 확인
      let sessionValid = false;
      for (let i = 0; i < 10; i++) { // 10회 * 200ms = 2초
        try {
          const sessionCheck = await fetch('/api/auth/session', {
            method: 'GET',
            credentials: 'include', // 쿠키 포함 필수
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (sessionCheck.ok) {
            const sessionData = await sessionCheck.json();
            if (sessionData.valid === true) {
              sessionValid = true;
              logger.log('[LoginForm] Session verified successfully');
              break;
            }
          }
        } catch (err) {
          // 세션 확인 실패는 무시하고 재시도
          logger.warn(`[LoginForm] Session check failed (attempt ${i + 1}/10):`, err);
        }
        
        // 200ms 대기 후 재시도
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // 로그인 성공 시 대시보드로 이동
      // redirect 조건: "token 존재"가 아니라 "login() 성공 반환"으로 변경
      if (typeof window !== 'undefined') {
        logger.log('[LoginForm] Login successful, redirecting to /dashboard...', {
          success: response.success,
          sessionValid,
          hasAccessToken: !!response.access_token,
          hasRefreshToken: !!response.refresh_token,
        });
        
        // 하위 호환성: 단일 토큰이 있는 경우만 저장
        if (response.token) {
          setToken(response.token);
        }
        
        // Storage 이벤트를 트리거하여 AuthGuard가 인증 상태를 업데이트하도록 함
        window.dispatchEvent(new Event('authTokenUpdated'));
        
        // 승인 여부 확인 후 적절한 페이지로 이동
        try {
          const { isUserApproved } = await import('@/lib/auth');
          const approved = await isUserApproved();
          
          if (approved) {
            // 승인된 사용자는 대시보드로 이동
            logger.log('[LoginForm] User is approved, redirecting to dashboard');
            router.push('/dashboard');
          } else {
            // 승인되지 않은 사용자도 대시보드로 이동 (대시보드에서 승인 상태 표시)
            logger.log('[LoginForm] User is not approved, redirecting to dashboard (will show approval status)');
            router.push('/dashboard');
          }
        } catch (approvalError) {
          // 승인 확인 실패 시에도 대시보드로 이동 (기존 동작 유지)
          logger.warn('[LoginForm] Failed to check approval status, redirecting to dashboard', approvalError);
          router.push('/dashboard');
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      // 네트워크 에러 또는 백엔드 연결 실패 처리
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('network')) {
        setIsOffline(true);
        setError('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
      } else if (errorMessage.includes('approval') || errorMessage.includes('pending')) {
        setError('계정이 관리자 승인 대기 중입니다. 승인을 기다려주세요.');
      } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('인증')) {
        setError('사용자 이름 또는 비밀번호가 올바르지 않습니다.');
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('권한')) {
        setError('권한이 없습니다. 관리자에게 문의하세요.');
      } else {
        setError(errorMessage || '로그인에 실패했습니다. 다시 시도해주세요.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 transition-colors">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md border border-gray-200 transition-colors">
        <header>
          <h1 className="text-3xl font-bold text-center text-gray-900">LIMEN</h1>
          <p className="mt-2 text-center text-gray-600">VM Management System</p>
        </header>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit} aria-label="Login form">
          {/* 백엔드 연결 상태 표시 */}
          {isCheckingBackend ? (
            <div 
              className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded transition-colors flex items-center gap-2"
              role="status"
              aria-live="polite"
            >
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
              <span>백엔드 연결 확인 중...</span>
            </div>
          ) : isOffline ? (
            <div 
              className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded transition-colors flex items-center gap-2"
              role="alert"
              aria-live="assertive"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>오프라인: 백엔드 서버에 연결할 수 없습니다.</span>
            </div>
          ) : null}
          
          {error && (
            <div 
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded transition-colors"
              role="alert"
              aria-live="assertive"
            >
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                aria-describedby={error ? "username-error" : undefined}
                aria-invalid={!!error}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                aria-describedby={error ? "password-error" : undefined}
                aria-invalid={!!error}
              />
            </div>
          </div>
          <div className="space-y-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
              aria-busy={loading}
              aria-label={loading ? 'Logging in, please wait' : 'Sign in to LIMEN'}
            >
              {loading ? 'Logging in...' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/register')}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              aria-label="Navigate to registration page"
            >
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
