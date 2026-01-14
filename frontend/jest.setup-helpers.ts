/**
 * Jest 테스트용 fetch mock helper
 * 
 * 정책:
 * - 프로덕션 코드: globalThis 기반 표준 API 사용 (undici 직접 사용 금지)
 * - 테스트 코드: jest.fn()으로 fetch mock (undici 로드 금지)
 * - Node 18+ 내장 Response 사용 (ReadableStream/MessagePort 참조 최소화)
 */

/**
 * Mock fetch 응답 생성 헬퍼
 * Node 18+ 내장 Response 사용 (undici 로드 없이)
 * 
 * @example
 * const mockResponse = createMockFetchResponse({ 
 *   ok: true, 
 *   status: 200, 
 *   body: { data: 'test' } 
 * });
 * global.fetch = jest.fn().mockResolvedValue(mockResponse);
 */
export function createMockFetchResponse(options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  body?: unknown;
  headers?: Record<string, string>;
}): Response {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    body = {},
    headers = { 'Content-Type': 'application/json' },
  } = options;

  // Node 18+ 내장 Response 사용 (undici 로드 없이)
  // ReadableStream은 Response 생성 시 자동으로 처리됨
  if (typeof globalThis.Response !== 'undefined') {
    return new Response(JSON.stringify(body), {
      status,
      statusText,
      headers,
    });
  }

  // 폴백: Response가 없는 환경 (거의 발생하지 않음)
  return {
    ok,
    status,
    statusText,
    headers: new Headers(headers),
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    blob: async () => new Blob([JSON.stringify(body)]),
    arrayBuffer: async () => {
      const text = typeof body === 'string' ? body : JSON.stringify(body);
      return new TextEncoder().encode(text).buffer;
    },
    clone: function () {
      return createMockFetchResponse(options);
    },
    body: null,
    bodyUsed: false,
    redirected: false,
    type: 'default' as ResponseType,
    url: '',
  } as Response;
}

/**
 * Mock fetch를 설정하는 헬퍼
 * 
 * @example
 * setupMockFetch((url) => {
 *   if (url.includes('/api/users')) {
 *     return createMockFetchResponse({ ok: true, body: [] });
 *   }
 *   return createMockFetchResponse({ ok: false, status: 404 });
 * });
 */
export function setupMockFetch(
  implementation?: (input: RequestInfo | URL) => Promise<Response>
): jest.MockedFunction<typeof fetch> {
  if (implementation) {
    global.fetch = jest.fn(implementation) as jest.MockedFunction<typeof fetch>;
  } else {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  }
  return global.fetch as jest.MockedFunction<typeof fetch>;
}
