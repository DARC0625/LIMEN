/**
 * ✅ P1-Next-Fix-4: Typed fetch mock + Response helpers
 * 
 * 테스트에서 fetch를 mock할 때 타입 안전성을 보장하고,
 * Response 객체를 정석으로 생성하는 유틸리티
 */

/**
 * Mock fetch 설치 (타입 안전)
 * @returns jest.MockedFunction<typeof fetch>
 */
export function installMockFetch(): jest.MockedFunction<typeof fetch> {
  const mockFetch = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  // ✅ P1-Next-Fix-4: 타입 안전한 fetch mock 설치
  (globalThis as { fetch?: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
  return mockFetch;
}

/**
 * JSON Response 생성 (정석)
 * @param body - Response body (JSON.stringify됨)
 * @param init - ResponseInit 옵션
 * @returns Response 객체
 */
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const res = new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  return res;
}

/**
 * Set-Cookie 헤더 메서드 추가
 * @param res - Response 객체
 * @param cookies - Set-Cookie 헤더 값 배열
 * @returns Response 객체 (getSetCookie 메서드 추가됨)
 */
export function attachSetCookie(res: Response, cookies: string[]): Response {
  // ✅ P1-Next-Fix-4: Headers에 getSetCookie 메서드 추가 (타입 안전)
  (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie = () => cookies;
  return res;
}

/**
 * 에러 Response 생성
 * @param status - HTTP status code
 * @param statusText - HTTP status text
 * @param init - ResponseInit 옵션
 * @returns Response 객체
 */
export function errorResponse(status: number, statusText: string = 'Error', init: ResponseInit = {}): Response {
  return new Response(null, {
    ...init,
    status,
    statusText,
    ...init,
  });
}
