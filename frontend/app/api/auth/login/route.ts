import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 백엔드 API URL 가져오기
    const backendUrl = process.env.BACKEND_URL || 'http://10.0.0.100:18443';
    const apiUrl = `${backendUrl}/api/auth/login`;
    
    // 요청 본문 가져오기
    const body = await request.json();
    
    // 쿠키 전달 (백엔드로)
    const cookies = request.headers.get('cookie') || '';
    
    // CSRF 토큰 전달
    const csrfToken = request.headers.get('X-CSRF-Token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (cookies) {
      headers['Cookie'] = cookies;
    }
    
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    
    // 백엔드로 로그인 요청
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
      return NextResponse.json(
        { error: errorData.message || 'Login failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // 백엔드 응답의 Set-Cookie 헤더를 클라이언트로 전달
    const responseHeaders = new Headers();
    
    // Set-Cookie 헤더를 직접 읽어서 전달
    // Next.js의 fetch는 Set-Cookie를 배열로 반환하지 않으므로 직접 읽어야 함
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      responseHeaders.append('Set-Cookie', setCookieHeader);
    }
    
    // 모든 Set-Cookie 헤더를 확인 (여러 개일 수 있음)
    const allSetCookieHeaders = response.headers.getSetCookie();
    if (allSetCookieHeaders && allSetCookieHeaders.length > 0) {
      allSetCookieHeaders.forEach(cookie => {
        responseHeaders.append('Set-Cookie', cookie);
      });
    }
    
    // 백엔드가 JSON에 토큰을 포함하지 않고 쿠키로만 전달하는 경우를 대비
    // Set-Cookie 헤더에서 토큰을 추출하여 JSON 응답에 포함
    if (!data.access_token || !data.refresh_token) {
      // Set-Cookie 헤더에서 토큰 추출 시도
      const setCookieValue = setCookieHeader || (allSetCookieHeaders && allSetCookieHeaders.length > 0 ? allSetCookieHeaders.join('; ') : '');
      
      if (setCookieValue) {
        // refresh_token 쿠키에서 값 추출
        const refreshTokenMatch = setCookieValue.match(/refresh_token=([^;]+)/);
        if (refreshTokenMatch && !data.refresh_token) {
          data.refresh_token = decodeURIComponent(refreshTokenMatch[1]);
        }
      }
    }
    
    // 응답 데이터 로깅 (디버깅용)
    console.log('[API /auth/login] Response data:', {
      hasAccessToken: !!data.access_token,
      hasRefreshToken: !!data.refresh_token,
      hasSetCookie: !!setCookieHeader || (allSetCookieHeaders && allSetCookieHeaders.length > 0),
      dataKeys: Object.keys(data),
    });
    
    // 백엔드 응답을 반환 (토큰이 JSON에 포함되도록 보장)
    return NextResponse.json(data, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[API /auth/login] Error:', error);
    
    // 네트워크 오류 또는 타임아웃
    return NextResponse.json(
      { 
        error: 'Backend connection failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
