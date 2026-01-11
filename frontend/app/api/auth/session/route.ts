import { NextRequest, NextResponse } from 'next/server';

const backendUrl = process.env.BACKEND_URL || 'http://10.0.0.100:18443';

export async function GET(request: NextRequest) {
  try {
    const apiUrl = `${backendUrl}/api/auth/session`;
    
    // 쿠키를 백엔드로 전달
    const cookies = request.headers.get('cookie') || '';
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies, // 서버 사이드에서는 쿠키를 헤더로 직접 전달
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Session check failed', valid: false },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Set-Cookie 헤더 전달
    const responseHeaders = new Headers();
    const setCookieHeaders = response.headers.getSetCookie();
    setCookieHeaders.forEach(cookie => {
      responseHeaders.append('Set-Cookie', cookie);
    });
    
    return NextResponse.json(data, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[API /auth/session] Error:', error);
    return NextResponse.json(
      { error: 'Backend connection failed', valid: false },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiUrl = `${backendUrl}/api/auth/session`;
    const body = await request.json();
    
    const csrfToken = request.headers.get('X-CSRF-Token');
    const cookies = request.headers.get('cookie') || '';
    const authHeader = request.headers.get('authorization');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cookie': cookies,
    };
    
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      // 서버 사이드에서는 credentials 옵션이 의미 없음, 쿠키는 헤더로 전달
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Session creation failed' }));
      return NextResponse.json(
        { error: errorData.message || 'Session creation failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Set-Cookie 헤더 전달
    const responseHeaders = new Headers();
    const setCookieHeaders = response.headers.getSetCookie();
    setCookieHeaders.forEach(cookie => {
      responseHeaders.append('Set-Cookie', cookie);
    });
    
    return NextResponse.json(data, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[API /auth/session] Error:', error);
    return NextResponse.json(
      { error: 'Backend connection failed' },
      { status: 503 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const apiUrl = `${backendUrl}/api/auth/session`;
    const cookies = request.headers.get('cookie') || '';
    
    const csrfToken = request.headers.get('X-CSRF-Token');
    const headers: Record<string, string> = {
      'Cookie': cookies,
    };
    
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers,
      // 서버 사이드에서는 credentials 옵션이 의미 없음, 쿠키는 헤더로 전달
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Session deletion failed' },
        { status: response.status }
      );
    }

    const data = await response.json().catch(() => ({}));
    
    // Set-Cookie 헤더 전달 (세션 삭제 시 쿠키 제거)
    const responseHeaders = new Headers();
    const setCookieHeaders = response.headers.getSetCookie();
    setCookieHeaders.forEach(cookie => {
      responseHeaders.append('Set-Cookie', cookie);
    });
    
    return NextResponse.json(data, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[API /auth/session] Error:', error);
    return NextResponse.json(
      { error: 'Backend connection failed' },
      { status: 503 }
    );
  }
}
