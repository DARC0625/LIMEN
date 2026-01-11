import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://10.0.0.100:18443';

export async function GET(request: NextRequest) {
  try {
    const cookies = request.headers.get('cookie') || '';
    const csrfToken = request.headers.get('x-csrf-token') || request.cookies.get('csrf_token')?.value || '';

    const response = await fetch(`${BACKEND_URL}/api/quota`, {
      method: 'GET',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
    });

    const data = await response.json();
    const responseHeaders = new Headers();
    
    // Set-Cookie 헤더 전달
    response.headers.getSetCookie().forEach(cookie => {
      responseHeaders.append('Set-Cookie', cookie);
    });

    return NextResponse.json(data, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[API /api/quota] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quota', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const cookies = request.headers.get('cookie') || '';
    const csrfToken = request.headers.get('x-csrf-token') || request.cookies.get('csrf_token')?.value || '';

    const response = await fetch(`${BACKEND_URL}/api/quota`, {
      method: 'PUT',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    const responseHeaders = new Headers();
    
    // Set-Cookie 헤더 전달
    response.headers.getSetCookie().forEach(cookie => {
      responseHeaders.append('Set-Cookie', cookie);
    });

    return NextResponse.json(data, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[API /api/quota] PUT Error:', error);
    return NextResponse.json(
      { error: 'Failed to update quota', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
