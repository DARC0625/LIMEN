/**
 * 브라우저 Location Adapter
 * window.location을 LocationPort 인터페이스로 래핑
 */
import { LocationPort } from '../ports/locationPort';

export function createBrowserLocationPort(): LocationPort | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return {
    getPathname: () => window.location.pathname,
    redirect: (url: string) => {
      window.location.href = url;
    },
  };
}
