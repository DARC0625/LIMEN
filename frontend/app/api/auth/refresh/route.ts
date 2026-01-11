import { NextRequest, NextResponse } from 'next/server';

const backendUrl = process.env.BACKEND_URL || 'http://10.0.0.100:18443';

export async function POST(request: NextRequest) {
  try {
    const apiUrl = `${backendUrl}/api/auth/refresh`;
    const body = await request.json();
    const cookies = request.headers.get('cookie') || '';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cookie': cookies,
    };
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      // 서버 사이드에서는 credentials 옵션이 의미 없음, 쿠키는 헤더로 전달
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Token refresh failed' }));
      return NextResponse.json(
        { error: errorData.message || 'Token refresh failed' },
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
    console.error('[API /auth/refresh] Error:', error);
    return NextResponse.json(
      { error: 'Backend connection failed' },
      { status: 503 }
    );
  }
}
