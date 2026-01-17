/**
 * 브라우저 Storage Adapter
 * localStorage/sessionStorage를 StoragePort 인터페이스로 래핑
 */
import { StoragePort, SessionStoragePort } from '../ports/storagePort';

export function createBrowserStoragePort(storage: Storage): StoragePort {
  return {
    get: (key: string) => storage.getItem(key),
    set: (key: string, value: string) => storage.setItem(key, value),
    remove: (key: string) => storage.removeItem(key),
    clear: () => storage.clear(),
  };
}

/**
 * 브라우저 localStorage 포트 (싱글톤)
 * 브라우저 환경에서만 사용 가능
 */
export const browserLocalStoragePort: StoragePort | null = typeof window !== 'undefined'
  ? createBrowserStoragePort(window.localStorage)
  : null;

/**
 * 브라우저 sessionStorage 포트 (싱글톤)
 * 브라우저 환경에서만 사용 가능
 */
export const browserSessionStoragePort: SessionStoragePort | null = typeof window !== 'undefined'
  ? createBrowserStoragePort(window.sessionStorage)
  : null;
