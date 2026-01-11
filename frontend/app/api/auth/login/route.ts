import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 백엔드 API URL 가져오기
    const backendUrl = process.env.BACKEND_URL || 'http://10.0.0.100:18443';
    const apiUrl = `${backendUrl}/api/auth/login`;
    
    // 요청 본문 가져오기
    const body = await request.json();
    
    // CSRF 토큰 전달
    const csrfToken = request.headers.get('X-CSRF-Token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    
    // 백엔드로 로그인 요청
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      // 쿠키를 백엔드로 전달
      credentials: 'include',
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
    const setCookieHeaders = response.headers.getSetCookie();
    
    // Set-Cookie 헤더를 그대로 전달
    setCookieHeaders.forEach(cookie => {
      responseHeaders.append('Set-Cookie', cookie);
    });
    
    // 백엔드 응답을 그대로 반환
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
