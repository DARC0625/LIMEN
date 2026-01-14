import '@testing-library/jest-dom';

// ✅ Node 20 + Jest + jsdom 환경에서는 TextEncoder/TextDecoder가 이미 글로벌로 존재
// polyfill 시대의 유물이므로 제거 (최신/표준 철학에 맞음)

// localStorage mock (node 환경에서 필요)
// jsdom/node 둘 다 안전하게 동작
if (!globalThis.localStorage) {
  class LocalStorageMock implements Storage {
    private store = new Map<string, string>();

    getItem(key: string): string | null {
      return this.store.has(key) ? this.store.get(key)! : null;
    }

    setItem(key: string, value: string): void {
      this.store.set(key, String(value));
    }

    removeItem(key: string): void {
      this.store.delete(key);
    }

    clear(): void {
      this.store.clear();
    }

    key(index: number): string | null {
      return Array.from(this.store.keys())[index] ?? null;
    }

    get length(): number {
      return this.store.size;
    }
  }

  Object.defineProperty(globalThis, 'localStorage', {
    value: new LocalStorageMock(),
    configurable: true,
    writable: true,
  });
}

// ✅ 정책: undici 직접 로드 및 전역 주입 금지
// 테스트는 jest.fn()으로 fetch를 mock하여 사용
// 프로덕션 코드는 globalThis 기반 표준 API 사용
