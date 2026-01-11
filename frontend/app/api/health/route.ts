import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  try {
    // 백엔드 API URL 가져오기
    const backendUrl = process.env.BACKEND_URL || 'http://10.0.0.100:18443';
    const apiUrl = `${backendUrl}/api/health`;
    
    // 백엔드로 헬스체크 요청
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // 타임아웃 설정 (5초)
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Backend health check failed', status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // 백엔드 응답을 그대로 반환
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[API /health] Error:', error);
    
    // 네트워크 오류 또는 타임아웃
    return NextResponse.json(
      { 
        error: 'Backend connection failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      },
      { status: 503 }
    );
  }
}
