/**
 * ✅ P1-Next-Fix-Module-4F: HTTP 계약 타입 정의
 * 
 * fetch와 Response의 타입을 DI 포트 계약으로 명확히 정의
 * 테스트에서 mock 타입 불일치 문제를 해결
 */

/**
 * FetchPort: fetch 함수의 단일 시그니처 계약
 * DOM fetch의 overload 전체를 요구하지 않고, 우리가 실제로 사용하는 시그니처만 정의
 */
export type FetchPort = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/**
 * ResponseLike: Response의 최소 계약
 * 테스트에서 실제 Response 전체가 아닌 필요한 필드만 구현
 */
export interface ResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers | {
    get(name: string): string | null;
    getSetCookie?(): string[];
  };
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/**
 * ResponseLike를 실제 Response로 변환하는 헬퍼
 * 테스트에서 사용
 */
export function createResponseFromLike(like: ResponseLike): Response {
  return new Response(JSON.stringify(like), {
    status: like.status,
    statusText: like.statusText,
    headers: like.headers instanceof Headers 
      ? like.headers 
      : new Headers(Object.fromEntries(
          Object.entries(like.headers).map(([k, v]) => [k, String(v)])
        )),
  });
}
