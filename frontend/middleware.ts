import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 프록시 설정: 환경 변수에서 백엔드 호스트/포트만 가져오기
// ⚠️ 중요: 프론트엔드 서버 IP 정보
// - 내부망 IP: 10.0.0.10 (enp1s0 인터페이스) - 백엔드와 통신용
// - 인터넷 IP: 14.54.57.159 (enp3s0 인터페이스) - 외부 사용자 접근용
// ⚠️ 중요: 백엔드 서버 정보
// - 백엔드 경로: /home/darc0/LIMEN/backend
// - 프론트엔드 경로: /home/darc/LIMEN/frontend
// - RAG 문서 기준: http://10.0.0.100:18443/api
// - 포트: 18443 (내부망)
const getBackendHost = () => {
  // ⚠️ 중요: Edge Runtime에서는 process.env 접근이 제한될 수 있음
  // 환경 변수 우선, 없으면 RAG 문서 기준 IP 사용
  const host = process.env.BACKEND_HOST || process.env.NEXT_PUBLIC_BACKEND_HOST || '10.0.0.100';
  // 디버깅: 항상 로그 출력
  console.log('[getBackendHost] Called:', { host, envBackendHost: process.env.BACKEND_HOST, envNextPublic: process.env.NEXT_PUBLIC_BACKEND_HOST });
  return host;
};

const getBackendPort = () => {
  // 내부망 포트만 사용 (절대 외부 포트 사용 금지)
  return process.env.BACKEND_PORT || process.env.NEXT_PUBLIC_BACKEND_PORT || '18443';
};

const getAgentHost = () => {
  // 환경 변수 우선, 없으면 RAG 문서 기준 IP 사용
  return process.env.AGENT_HOST || process.env.NEXT_PUBLIC_AGENT_HOST || '10.0.0.100';
};

const getAgentPort = () => {
  // 내부망 포트만 사용
  return process.env.AGENT_PORT || process.env.NEXT_PUBLIC_AGENT_PORT || '9000';
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 정적 파일 경로는 미들웨어에서 완전히 제외 (Next.js가 직접 처리)
  // 이 체크는 가장 먼저 실행되어야 함
  if (
    // Next.js 내부 경로
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/_next/image') ||
    pathname.startsWith('/_next/webpack') ||
    pathname.startsWith('/_next/chunks/') ||
    // 정적 파일 확장자
    pathname.match(/\.(js|css|map|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif)$/i) ||
    // 기타 정적 파일
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/manifest.json') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap.xml') ||
    // 이미지 파일
    pathname.startsWith('/images/') ||
    pathname.startsWith('/icon-') ||
    pathname.startsWith('/logo')
  ) {
    return NextResponse.next();
  }
  
  const backendHost = getBackendHost();
  const backendPort = getBackendPort();
  const agentHost = getAgentHost();
  const agentPort = getAgentPort();
  
  // 디버깅: 환경 변수 확인
  console.log('[Middleware] Backend host check:', {
    backendHost,
    envBackendHost: process.env.BACKEND_HOST,
    envNextPublicBackendHost: process.env.NEXT_PUBLIC_BACKEND_HOST,
    default: '10.0.0.100',
  });
  
  // 동적으로 URL 구성 (절대 경로 사용하지 않음)
  const backendUrl = `http://${backendHost}:${backendPort}`;
  const agentUrl = `http://${agentHost}:${agentPort}`;

  // API 프록시: /api/* -> 백엔드
  if (pathname.startsWith('/api/')) {
    // Next.js 내부 경로 및 정적 파일은 제외
    if (
      pathname.startsWith('/api/_next/') ||
      pathname.startsWith('/_next/') ||
      pathname.match(/\.(js|css|map|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif)$/i)
    ) {
      return NextResponse.next();
    }

    // 절대 URL 생성
    const targetUrl = `${backendUrl}${pathname}`;
    
    // 쿠키 추출 (세션 쿠키 포함)
    // 중요: Next.js middleware는 자동으로 쿠키를 전달하지 않으므로 명시적으로 추출해야 함
    const cookies = request.headers.get('cookie') || '';
    
    // 모든 요청 헤더 확인 (디버깅)
    const allHeaders = Object.fromEntries(request.headers.entries());
    
    // 세션 및 로그인 관련 요청 플래그 (상단에서 정의)
    const isSessionRequest = pathname.includes('/auth/session');
    const isLoginRequest = pathname.includes('/auth/login');
    
    if (isSessionRequest) {
      console.log(`[Proxy] ${request.method} ${pathname} -> ${targetUrl}`, {
        hasCookies: !!cookies,
        cookieCount: cookies ? cookies.split(';').length : 0,
        cookies: cookies ? cookies.substring(0, 200) : 'none',
        allHeaders: Object.keys(allHeaders),
        cookieHeader: request.headers.get('cookie'),
      });
    } else {
      // 로깅: 프록시 요청 시작
      console.log(`[Proxy] ${request.method} ${pathname} -> ${targetUrl}`);
    }
    
      try {
        const startTime = Date.now();
        
        // 백엔드로 전송할 헤더 구성
        // 중요: Next.js middleware는 자동으로 쿠키를 전달하지 않으므로 명시적으로 추가해야 함
        const backendHeaders: Record<string, string> = {
          'Content-Type': request.headers.get('content-type') || 'application/json',
          'x-forwarded-for': request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
          'x-forwarded-host': request.headers.get('host') || '',
          'x-forwarded-proto': request.headers.get('x-forwarded-proto') || 'https',
        };
        
        // 쿠키 명시적으로 추가 (중요!)
        if (cookies) {
          backendHeaders['Cookie'] = cookies;
        }
        
        // CSRF 토큰 전달
        const csrfToken = request.headers.get('x-csrf-token');
        if (csrfToken) {
          backendHeaders['X-CSRF-Token'] = csrfToken;
        }
        
        // Authorization 헤더 전달
        const authorization = request.headers.get('authorization');
        if (authorization) {
          backendHeaders['Authorization'] = authorization;
        }
        
        // Accept 헤더 전달
        const accept = request.headers.get('accept');
        if (accept) {
          backendHeaders['Accept'] = accept;
        }
        
        if (isSessionRequest) {
          console.log(`[Proxy] Backend request headers:`, {
            hasCookie: !!backendHeaders['Cookie'],
            cookieLength: backendHeaders['Cookie']?.length || 0,
            hasCSRF: !!backendHeaders['X-CSRF-Token'],
            hasAuth: !!backendHeaders['Authorization'],
            allHeaders: Object.keys(backendHeaders),
          });
        }
        
        // 타임아웃 설정 (10초)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        let response: Response;
        try {
          response = await fetch(targetUrl, {
            method: request.method,
            headers: backendHeaders,
            body: request.method !== 'GET' && request.method !== 'HEAD'
              ? await request.text()
              : undefined,
            signal: controller.signal,
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);
          const error = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
          console.error(`[Proxy] Fetch error for ${request.method} ${pathname}:`, {
            error: error.message,
            targetUrl,
            backendUrl,
            pathname,
          });
          
          // 연결 실패 시 503 에러 반환
          return NextResponse.json(
            {
              error: 'Backend service unavailable',
              message: `Failed to connect to backend: ${error.message}`,
              debug: {
                targetUrl,
                backendUrl,
                pathname,
                errorMessage: error.message,
              },
            },
            { status: 503 }
          );
        } finally {
          clearTimeout(timeoutId);
        }

      const duration = Date.now() - startTime;
      const data = await response.text();
      
      // 로그인 요청인 경우 Set-Cookie에서 refresh_token 추출하여 JSON에 추가
      let modifiedData = data;
      
      // Set-Cookie 헤더 추출 (모든 인증 관련 요청)
      const setCookieHeaders = response.headers.getSetCookie();
      
      // Set-Cookie 헤더 상세 로깅
      if (setCookieHeaders.length > 0) {
        console.log(`[Proxy] Set-Cookie headers received from backend (${setCookieHeaders.length}):`, {
          count: setCookieHeaders.length,
          headers: setCookieHeaders.map((cookie, idx) => ({
            index: idx,
            full: cookie.substring(0, 200),
            hasRefreshToken: cookie.includes('refresh_token'),
            hasCSRFToken: cookie.includes('csrf_token'),
            attributes: {
              hasSecure: cookie.includes('Secure'),
              hasHttpOnly: cookie.includes('HttpOnly'),
              hasSameSite: cookie.match(/SameSite=(\w+)/)?.[1] || 'none',
              hasDomain: cookie.match(/Domain=([^;]+)/)?.[1] || 'none',
              hasPath: cookie.match(/Path=([^;]+)/)?.[1] || '/',
            },
          })),
        });
      }
      
      if (isLoginRequest && response.status === 200) {
        try {
          let refreshTokenFromCookie: string | null = null;
          
          // Set-Cookie에서 refresh_token 찾기
          for (const cookie of setCookieHeaders) {
            const match = cookie.match(/refresh_token=([^;]+)/);
            if (match && match[1]) {
              refreshTokenFromCookie = match[1];
              console.log('[Proxy] Extracted refresh_token from Set-Cookie');
              break;
            }
          }
          
          // JSON 응답에 refresh_token 추가 (쿠키가 HttpOnly인 경우를 대비)
          if (refreshTokenFromCookie) {
            const jsonData = JSON.parse(data);
            jsonData.refresh_token = refreshTokenFromCookie;
            modifiedData = JSON.stringify(jsonData);
            console.log('[Proxy] Added refresh_token to JSON response');
          }
        } catch (error) {
          console.error('[Proxy] Failed to parse/modify login response:', error);
        }
      }
      
      // NextResponse 생성 (Set-Cookie 헤더 전달을 위해)
      const nextResponse = new NextResponse(modifiedData, {
        status: response.status,
        statusText: response.statusText,
        headers: {},
      });
      
      // CORS 헤더 먼저 설정 (쿠키 전달을 위해 필수)
      const corsHeaders = [
        'access-control-allow-credentials',
        'access-control-allow-headers',
        'access-control-allow-origin',
        'access-control-allow-methods',
        'access-control-expose-headers',
      ];
      
      corsHeaders.forEach(headerName => {
        const value = response.headers.get(headerName);
        if (value) {
          nextResponse.headers.set(headerName, value);
        }
      });
      
      // Set-Cookie 헤더를 가장 먼저 추가 (중요: 브라우저가 쿠키를 저장하려면)
      // Next.js의 getSetCookie()는 배열을 반환하므로 각각 append
      if (setCookieHeaders.length > 0) {
        setCookieHeaders.forEach((cookie, idx) => {
          // 쿠키 속성 확인 및 수정 (필요시)
          let modifiedCookie = cookie;
          
          // Domain이 설정되지 않았거나 잘못된 경우 제거 (브라우저가 자동으로 설정)
          // Domain=limen.kr이면 그대로 유지, Domain=localhost나 잘못된 도메인이면 제거
          if (modifiedCookie.includes('Domain=')) {
            const domainMatch = modifiedCookie.match(/Domain=([^;]+)/);
            if (domainMatch) {
              const domain = domainMatch[1].trim();
              // localhost, 127.0.0.1, IP 주소 등은 제거
              if (domain === 'localhost' || domain === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
                modifiedCookie = modifiedCookie.replace(/Domain=[^;]+;?\s*/gi, '');
                console.log(`[Proxy] Removed invalid Domain from cookie ${idx}: ${domain}`);
              }
            }
          }
          
          // Secure 플래그 확인 (HTTPS 환경에서만 필요)
          // 현재는 limen.kr이 HTTPS이므로 Secure 유지
          // 하지만 개발 환경에서는 Secure 제거 필요할 수 있음
          const isSecure = modifiedCookie.includes('Secure');
          const isHttps = request.headers.get('x-forwarded-proto') === 'https' || 
                         request.headers.get('x-forwarded-proto') === 'http' && 
                         request.headers.get('host')?.includes('limen.kr');
          
          if (!isHttps && isSecure) {
            // HTTP 환경에서는 Secure 제거
            modifiedCookie = modifiedCookie.replace(/;\s*Secure/gi, '');
            console.log(`[Proxy] Removed Secure flag from cookie ${idx} (HTTP environment)`);
          }
          
          // SameSite 설정 확인 및 수정
          // 크로스 사이트 요청을 허용하려면 SameSite=None; Secure 필요
          // 하지만 현재는 같은 도메인이므로 SameSite=Lax가 적절
          if (!modifiedCookie.includes('SameSite=')) {
            // SameSite가 없으면 Lax 추가 (보안과 호환성 균형)
            modifiedCookie = modifiedCookie.replace(/;?\s*$/, '') + '; SameSite=Lax';
            console.log(`[Proxy] Added SameSite=Lax to cookie ${idx}`);
          }
          
          nextResponse.headers.append('Set-Cookie', modifiedCookie);
          console.log(`[Proxy] Set-Cookie ${idx} added to response:`, {
            cookie: modifiedCookie.substring(0, 150),
            hasRefreshToken: modifiedCookie.includes('refresh_token'),
            hasCSRFToken: modifiedCookie.includes('csrf_token'),
          });
        });
      }
      
      // 나머지 응답 헤더 복사 (Set-Cookie 제외, 이미 처리됨)
      response.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        // Set-Cookie와 CORS 헤더는 이미 처리했으므로 제외
        if (lowerKey !== 'set-cookie' && !corsHeaders.includes(lowerKey)) {
          nextResponse.headers.set(key, value);
        }
      });
      
      // 세션 및 로그인 관련 요청은 상세 로깅
      if (isSessionRequest || isLoginRequest) {
        console.log(`[Proxy] ${request.method} ${pathname} -> ${response.status} (${duration}ms)`, {
          status: response.status,
          statusText: response.statusText,
          setCookieCount: setCookieHeaders.length,
          setCookies: setCookieHeaders.map(c => c.substring(0, 150)),
          responseData: data ? data.substring(0, 200) : 'empty',
          allResponseHeaders: Array.from(response.headers.keys()),
          nextResponseSetCookieCount: nextResponse.headers.getSetCookie().length,
        });
      } else {
        // 로깅: 성공
        console.log(`[Proxy] ${request.method} ${pathname} -> ${response.status} (${duration}ms)`);
      }
      
      return nextResponse;
    } catch (error) {
      // 로깅: 오류
      console.error(`[Proxy] ${request.method} ${pathname} -> ERROR:`, {
        error: error instanceof Error ? error.message : String(error),
        targetUrl,
        backendUrl,
        pathname,
      });
      return NextResponse.json(
        { 
          error: '프록시 오류', 
          message: error instanceof Error ? error.message : 'Unknown error',
          debug: {
            targetUrl,
            backendUrl,
            pathname,
          },
        },
        { status: 502 }
      );
    }
  }

  // WebSocket 프록시: /ws/* -> 백엔드
  if (pathname.startsWith('/ws/')) {
    const targetUrl = `${backendUrl}${pathname}`;
    return NextResponse.rewrite(new URL(targetUrl));
  }

  // VNC 프록시: /vnc -> 백엔드 (WebSocket만)
  // 백엔드가 /vnc 경로를 public endpoint로 처리하므로 인증 미들웨어 우회
  // VNC 핸들러에서 자체 인증 처리
  // 중요: 일반 HTTP GET 요청은 Next.js 페이지로 전달, WebSocket 업그레이드만 Envoy가 백엔드로 프록시
  // ⚠️ /vnc/ 경로는 matcher에서 제외되었으므로 이 블록은 실행되지 않음
  // 하지만 혹시 모를 경우를 대비해 유지 (실제로는 도달하지 않음)
  // 일반 HTTP GET 요청은 Next.js 페이지 라우팅으로 처리됨
  // WebSocket 업그레이드 요청은 Envoy가 직접 처리함
  if (pathname === '/vnc' || pathname.startsWith('/vnc/')) {
    // 이 코드는 실행되지 않아야 함 (matcher에서 제외)
    // 하지만 혹시 모를 경우를 대비해 로깅만 수행
    console.warn(`[Proxy] VNC ${request.method} ${pathname} -> This should not be reached (matcher excludes /vnc/)`);
    return NextResponse.next();
  }

  // Agent 프록시: /agent/* -> Agent
  if (pathname.startsWith('/agent/')) {
    const agentPath = pathname.replace('/agent', '');
    const targetUrl = `${agentUrl}${agentPath}`;
    
    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers.entries()),
          'x-forwarded-for': request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
          'x-forwarded-host': request.headers.get('host') || '',
        },
        body: request.method !== 'GET' && request.method !== 'HEAD' 
          ? await request.text() 
          : undefined,
      });

      const data = await response.text();
      return new NextResponse(data, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          'x-proxied-from': agentUrl,
        },
      });
    } catch (error) {
      console.error('[Middleware] Agent 프록시 오류:', error);
      return NextResponse.json(
        { error: 'Agent 프록시 오류', message: error instanceof Error ? error.message : 'Unknown error' },
        { status: 502 }
      );
    }
  }

  // 모든 응답에 보안 헤더 추가 (darc.kr 포함)
  const response = NextResponse.next();
  
  // 보안 헤더 추가
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  
  return response;
}

export const config = {
  matcher: [
    /*
     * 정적 파일은 제외하고 API 경로만 매칭
     * - /_next/static/* 제외
     * - .js, .css, .map 등 정적 파일 확장자 제외
     */
    '/api/:path*',
    '/ws/:path*',
    // ⚠️ 중요: /vnc/ 경로는 matcher에서 제외
    // WebSocket 업그레이드 요청은 Envoy가 직접 처리해야 하므로
    // Next.js middleware를 거치지 않도록 함
    // '/vnc/:path*', // 제외: Envoy가 직접 처리
    '/agent/:path*',
    /*
     * 정적 파일 제외 패턴 (negative lookahead)
     * 하지만 Next.js middleware는 negative lookahead를 지원하지 않으므로
     * 위의 if 문에서 처리
     * 
     * ⚠️ /vnc/ 경로 처리:
     * - 일반 HTTP GET 요청: Next.js 페이지로 전달 (VNCViewer 렌더링)
     * - WebSocket 업그레이드 요청: Envoy가 직접 처리 (middleware 우회)
     * 
     * matcher에서 /vnc/를 제외하면:
     * - 일반 HTTP GET: Next.js 페이지 라우팅으로 처리됨
     * - WebSocket 업그레이드: Envoy가 직접 라우팅 규칙에 따라 백엔드로 프록시
     */
  ],
};

