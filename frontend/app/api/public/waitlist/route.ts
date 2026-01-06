import { NextRequest, NextResponse } from 'next/server';

// Rate limiting을 위한 간단한 메모리 저장소 (프로덕션에서는 Redis 사용 권장)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Rate limiting 설정
const RATE_LIMIT = {
  maxRequests: 5, // 5분당 최대 5회
  windowMs: 5 * 60 * 1000, // 5분
};

function getRateLimitKey(request: NextRequest): string {
  // IP 주소 기반 rate limiting
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 
             request.headers.get('x-real-ip') || 
             'unknown';
  return `waitlist:${ip}`;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record || now > record.resetTime) {
    // 새 윈도우 시작
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs,
    });
    return true;
  }
  
  if (record.count >= RATE_LIMIT.maxRequests) {
    return false; // Rate limit 초과
  }
  
  record.count++;
  return true;
}

// 허니팟 필드 (스팸 봇이 채우는 숨겨진 필드)
const HONEYPOT_FIELD = 'website';

// 입력 검증
function validateInput(data: any): { valid: boolean; error?: string } {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
    return { valid: false, error: '이름은 2자 이상이어야 합니다.' };
  }
  
  if (!data.email || typeof data.email !== 'string') {
    return { valid: false, error: '이메일이 필요합니다.' };
  }
  
  // 간단한 이메일 형식 검증
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    return { valid: false, error: '유효한 이메일 형식이 아닙니다.' };
  }
  
  if (!data.organization || typeof data.organization !== 'string' || data.organization.trim().length < 2) {
    return { valid: false, error: '소속은 2자 이상이어야 합니다.' };
  }
  
  // 허니팟 필드 확인 (스팸 봇이 채우면 차단)
  if (data[HONEYPOT_FIELD] && data[HONEYPOT_FIELD].trim().length > 0) {
    return { valid: false, error: '스팸으로 감지되었습니다.' };
  }
  
  // 입력 길이 제한
  if (data.name.length > 100 || data.email.length > 255 || 
      data.organization.length > 200 || (data.purpose && data.purpose.length > 1000)) {
    return { valid: false, error: '입력 길이가 제한을 초과했습니다.' };
  }
  
  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting 확인
    const rateLimitKey = getRateLimitKey(request);
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { 
          code: 429, 
          message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          error_code: 'RATE_LIMIT_EXCEEDED' 
        },
        { status: 429 }
      );
    }
    
    // 요청 본문 파싱
    const body = await request.json();
    
    // 입력 검증
    const validation = validateInput(body);
    if (!validation.valid) {
      return NextResponse.json(
        { 
          code: 400, 
          message: validation.error || '입력 검증 실패',
          error_code: 'VALIDATION_ERROR' 
        },
        { status: 400 }
      );
    }
    
    // 백엔드로 전달할 데이터 준비
    const waitlistData = {
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      organization: body.organization.trim(),
      purpose: body.purpose ? body.purpose.trim() : '',
    };
    
    // 백엔드 API 호출
    const backendHost = process.env.BACKEND_HOST || process.env.NEXT_PUBLIC_BACKEND_HOST || '10.0.0.100';
    const backendPort = process.env.BACKEND_PORT || process.env.NEXT_PUBLIC_BACKEND_PORT || '18443';
    const backendUrl = `http://${backendHost}:${backendPort}`;
    
    const backendResponse = await fetch(`${backendUrl}/api/waitlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(waitlistData),
    });
    
    if (!backendResponse.ok) {
      const errorData = await backendResponse.text();
      console.error('[Waitlist] Backend error:', {
        status: backendResponse.status,
        error: errorData,
      });
      
      return NextResponse.json(
        { 
          code: backendResponse.status, 
          message: '대기자 등록에 실패했습니다. 잠시 후 다시 시도해주세요.',
          error_code: 'BACKEND_ERROR' 
        },
        { status: backendResponse.status }
      );
    }
    
    const result = await backendResponse.json();
    
    // 성공 응답
    return NextResponse.json(
      { 
        code: 201, 
        message: '대기자 등록이 완료되었습니다.',
        data: {
          id: result.id || null,
          email: waitlistData.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // 이메일 마스킹
        }
      },
      { status: 201 }
    );
    
  } catch (error) {
    console.error('[Waitlist] Error:', error);
    
    return NextResponse.json(
      { 
        code: 500, 
        message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        error_code: 'INTERNAL_ERROR' 
      },
      { status: 500 }
    );
  }
}

// OPTIONS 메서드 지원 (CORS preflight)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}





