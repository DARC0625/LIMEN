/**
 * 메모리 Location Adapter (테스트용)
 * LocationPort 인터페이스를 구현하지만 실제 redirect는 하지 않음
 * Node 환경이나 테스트에서 사용
 */
import { LocationPort } from '../ports/locationPort';

export interface MemoryLocationPort extends LocationPort {
  // 테스트용 헬퍼 메서드
  getRedirectUrl(): string | null;
  setPathname(pathname: string): void;
}

export function createMemoryLocationPort(initialPathname: string = '/'): MemoryLocationPort {
  let pathname = initialPathname;
  let redirectUrl: string | null = null;

  return {
    getPathname: () => pathname,
    redirect: (url: string) => {
      redirectUrl = url;
      // 테스트에서 redirect 호출 여부 확인 가능
    },
    // 테스트용 헬퍼
    getRedirectUrl: () => redirectUrl,
    setPathname: (p: string) => { pathname = p; },
  };
}
