/**
 * Storage 포트 인터페이스
 * 브라우저 localStorage/sessionStorage 의존성을 추상화
 * 
 * 정석 원칙: core 로직은 StoragePort 인터페이스에만 의존하고,
 * 실제 구현(localStorage/memory)은 adapter에서 주입받음
 */
export interface StoragePort {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  clear(): void;
}

export interface SessionStoragePort {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  clear(): void;
}
