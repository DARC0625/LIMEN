'use client';

import { useState, useEffect, useRef } from 'react';
import { authAPI, setToken, setTokens } from '../lib/api';
import { useRouter, useSearchParams } from 'next/navigation';

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
        
        const response = await fetch('/api/health', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(3000), // 3초 타임아웃
          // credentials 제거 (헬스체크는 인증 불필요, 로그인 페이지 깜빡임 방지)
        });
        
        // 이전 상태와 비교하여 변경이 있을 때만 업데이트
        if (response.ok) {
          setIsOffline(prev => prev ? false : prev); // false로 변경할 때만 업데이트
        } else {
          setIsOffline(prev => !prev ? true : prev); // true로 변경할 때만 업데이트
        }
      } catch (err) {
        // 네트워크 오류 또는 타임아웃
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
    
    setError('');
    setLoading(true);

    try {
      console.log('[LoginForm] Starting login...');
      const response = await authAPI.login({ username, password });
      console.log('[LoginForm] Login API response received:', {
        hasAccessToken: !!response.access_token,
        hasRefreshToken: !!response.refresh_token,
        expiresIn: response.expires_in,
      });
      
      // 최신 방식: Access Token + Refresh Token 분리
      if (response.access_token && response.refresh_token) {
        const expiresIn = response.expires_in || 900; // 기본 15분
        
        // 1. TokenManager에 토큰 저장 (authAPI.login() 내부에서도 저장하지만, 여기서도 명시적으로 저장)
        // authAPI.login()에서 이미 저장했지만, 확실히 하기 위해 다시 저장
        const { tokenManager } = await import('../lib/tokenManager');
        console.log('[LoginForm] Saving tokens to tokenManager...', {
          accessTokenLength: response.access_token.length,
          refreshTokenLength: response.refresh_token.length,
          expiresIn,
        });
        
        // 토큰 저장
        tokenManager.setTokens(response.access_token, response.refresh_token, expiresIn);
        
        // 즉시 localStorage 확인 (동기적으로)
        const refreshTokenInStorage = localStorage.getItem('refresh_token');
        const expiresAtInStorage = localStorage.getItem('token_expires_at');
        
        // 토큰 저장 확인 (즉시 확인)
        const verifyResult = {
          hasRefreshToken: tokenManager.hasValidToken(),
          refreshTokenInStorage: !!refreshTokenInStorage,
          expiresAt: expiresAtInStorage,
          refreshTokenValue: refreshTokenInStorage ? refreshTokenInStorage.substring(0, 20) + '...' : 'none',
        };
        console.log('[LoginForm] Tokens saved, verifying...', verifyResult);
        
        // 저장 실패 시 에러
        if (!verifyResult.hasRefreshToken || !verifyResult.refreshTokenInStorage) {
          console.error('[LoginForm] Token save failed!', verifyResult);
          setError('토큰 저장에 실패했습니다. 다시 시도해주세요.');
          setLoading(false);
          return;
        }
        
        // 추가 확인: localStorage에 직접 확인
        console.log('[LoginForm] Direct localStorage check:', {
          refresh_token: localStorage.getItem('refresh_token') ? 'exists' : 'missing',
          token_expires_at: localStorage.getItem('token_expires_at') ? 'exists' : 'missing',
        });
        
        // 2. 로그인 응답 후 브라우저 쿠키 확인 및 로깅
        // authAPI.login() 내부에서 이미 Set-Cookie 헤더를 로깅함
        // 브라우저 쿠키 확인 (로그인 응답 후)
        await new Promise(resolve => setTimeout(resolve, 200)); // 쿠키 설정 대기
        const cookies = document.cookie;
        console.log('[LoginForm] Browser cookies after login:', {
          hasCookies: !!cookies,
          cookieCount: cookies ? cookies.split(';').length : 0,
          cookies: cookies ? cookies.substring(0, 300) : 'none',
        });
        
        // 3. 로그인 응답에서 쿠키가 설정되기를 대기 (브라우저가 쿠키를 처리할 시간)
        // 쿠키는 비동기로 설정되므로 짧은 대기 시간 필요
        await new Promise(resolve => setTimeout(resolve, 300)); // 300ms 대기
        
        // 3. 백엔드 세션 생성 (명시적으로 호출)
        let sessionCreationSuccess = false;
        try {
          const { authAPI } = await import('../lib/api/auth');
          console.log('[LoginForm] Creating session with tokens...');
          await authAPI.createSession(response.access_token, response.refresh_token);
          sessionCreationSuccess = true;
          console.log('[LoginForm] Session created successfully');
          
          // 세션 생성 후 쿠키가 설정되기를 대기
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (sessionError: any) {
          console.error('[LoginForm] Session creation failed:', {
            error: sessionError,
            message: sessionError?.message,
            status: sessionError?.status,
            stack: sessionError?.stack?.substring(0, 500),
          });
          // 세션 생성 실패해도 계속 진행 (재시도 로직에서 처리)
        }
        
        if (!sessionCreationSuccess) {
          console.warn('[LoginForm] Session creation failed, but will retry verification');
        }
        
        // 4. 세션 생성 완료 확인 (최대 5초 대기, 더 많은 재시도)
        let sessionCreated = false;
        for (let i = 0; i < 25; i++) { // 25회 * 200ms = 5초
          try {
            // 쿠키 확인 (개발 환경)
            if (process.env.NODE_ENV === 'development' && i === 0) {
              const cookies = document.cookie;
              console.log('[LoginForm] Cookies before session check:', {
                hasCookies: !!cookies,
                cookieCount: cookies ? cookies.split(';').length : 0,
                cookies: cookies ? cookies.substring(0, 200) : 'none',
              });
            }
            
            const sessionCheck = await fetch('/api/auth/session', {
              method: 'GET',
              credentials: 'include', // 쿠키 포함 필수
              headers: {
                'Content-Type': 'application/json',
              },
            });
            
            if (process.env.NODE_ENV === 'development' && i === 0) {
              console.log('[LoginForm] Session check response:', {
                status: sessionCheck.status,
                ok: sessionCheck.ok,
                hasSetCookie: sessionCheck.headers.getSetCookie().length > 0,
              });
            }
            
            if (sessionCheck.ok) {
              const sessionData = await sessionCheck.json();
              if (sessionData.valid === true) {
                sessionCreated = true;
                console.log('[LoginForm] Session verified successfully');
                break;
              }
            } else if (sessionCheck.status === 401) {
              // 401이면 세션이 아직 생성되지 않음, 계속 재시도
              if (process.env.NODE_ENV === 'development') {
                console.log(`[LoginForm] Session not ready yet (attempt ${i + 1}/25)`);
              }
            }
          } catch (err) {
            // 세션 확인 실패는 무시하고 재시도
            if (process.env.NODE_ENV === 'development') {
              console.warn(`[LoginForm] Session check failed (attempt ${i + 1}/25):`, err);
            }
          }
          
          // 200ms 대기 후 재시도
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        if (!sessionCreated) {
          console.error('[LoginForm] Session creation verification failed after 5 seconds');
          setError('로그인에 성공했지만 세션 설정에 실패했습니다. 페이지를 새로고침해주세요.');
          setLoading(false);
          return;
        }
      } else if (response.token) {
        // 하위 호환성: 단일 토큰
        setToken(response.token);
        // 단일 토큰의 경우 세션 생성 대기
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // 로그인 성공 시 대시보드로 이동
      // 대시보드는 /dashboard 경로 사용
      if (typeof window !== 'undefined') {
        // tokenManager 다시 가져오기 (스코프 문제 해결)
        const { tokenManager: tm } = await import('../lib/tokenManager');
        
        // Storage 이벤트를 트리거하여 AuthGuard가 인증 상태를 업데이트하도록 함
        window.dispatchEvent(new Event('authTokenUpdated'));
        
        // router.push()를 사용하여 클라이언트 사이드 네비게이션
        // 이렇게 하면 페이지 새로고침 없이 이동하고 콘솔 로그가 유지됨
        console.log('[LoginForm] Redirecting to /dashboard using router.push()...');
        
        // 리다이렉트 직전 최종 확인
        const refreshTokenValue = localStorage.getItem('refresh_token');
        const lastCheck = {
          hasRefreshToken: tm.hasValidToken(),
          refreshTokenInStorage: !!refreshTokenValue,
          refreshTokenValue: refreshTokenValue ? refreshTokenValue.substring(0, 20) + '...' : 'none',
        };
        console.log('[LoginForm] Last check before redirect:', lastCheck);
        
        if (!lastCheck.hasRefreshToken || !lastCheck.refreshTokenInStorage) {
          console.error('[LoginForm] Token lost before redirect!', lastCheck);
          setError('토큰이 사라졌습니다. 다시 시도해주세요.');
          setLoading(false);
          return;
        }
        
        // 클라이언트 사이드 네비게이션 (페이지 새로고침 없음)
        router.push('/dashboard');
      }
    } catch (err: any) {
      // 네트워크 에러 또는 백엔드 연결 실패 처리
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('network')) {
        setIsOffline(true);
        setError('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
      } else if (err.message?.includes('approval') || err.message?.includes('pending')) {
        setError('Your account is pending admin approval. Please wait for approval.');
      } else if (err.message?.includes('401') || err.message?.includes('Unauthorized') || err.message?.includes('인증')) {
        setError('사용자 이름 또는 비밀번호가 올바르지 않습니다.');
      } else if (err.message?.includes('403') || err.message?.includes('Forbidden') || err.message?.includes('권한')) {
        setError('권한이 없습니다. 관리자에게 문의하세요.');
      } else {
        setError(err.message || '로그인에 실패했습니다. 다시 시도해주세요.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 transition-colors">
        <header>
          <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-gray-100">LIMEN</h1>
          <p className="mt-2 text-center text-gray-600 dark:text-gray-400">VM Management System</p>
        </header>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit} aria-label="Login form">
          {/* 백엔드 연결 상태 표시 */}
          {isCheckingBackend ? (
            <div 
              className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 px-4 py-3 rounded transition-colors flex items-center gap-2"
              role="status"
              aria-live="polite"
            >
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 dark:border-blue-400"></div>
              <span>백엔드 연결 확인 중...</span>
            </div>
          ) : isOffline ? (
            <div 
              className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded transition-colors flex items-center gap-2"
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
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded transition-colors"
              role="alert"
              aria-live="assertive"
            >
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                aria-describedby={error ? "username-error" : undefined}
                aria-invalid={!!error}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                aria-describedby={error ? "password-error" : undefined}
                aria-invalid={!!error}
              />
            </div>
          </div>
          <div className="space-y-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
              aria-busy={loading}
              aria-label={loading ? 'Logging in, please wait' : 'Sign in to LIMEN'}
            >
              {loading ? 'Logging in...' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/register')}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
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
