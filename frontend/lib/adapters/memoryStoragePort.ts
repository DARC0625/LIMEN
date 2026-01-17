/**
 * 메모리 Storage Adapter (테스트용)
 * Map 기반으로 StoragePort 인터페이스 구현
 * Node 환경이나 테스트에서 사용
 */
import { StoragePort, SessionStoragePort } from '../ports/storagePort';

export function createMemoryStoragePort(): StoragePort {
  const storage = new Map<string, string>();
  return {
    get: (key: string) => storage.get(key) || null,
    set: (key: string, value: string) => storage.set(key, value),
    remove: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  };
}

/**
 * 메모리 SessionStorage Adapter (테스트용)
 */
export function createMemorySessionStoragePort(): SessionStoragePort {
  return createMemoryStoragePort();
}
