import '@testing-library/jest-dom';

// TextEncoder/TextDecoder (jsdom에서 종종 누락)
import { TextEncoder, TextDecoder } from 'util';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder as any;

// localStorage mock (node 환경에서 필요)
// jsdom/node 둘 다 안전하게 동작
if (!globalThis.localStorage) {
  const store = new Map<string, string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as any;
}

// ✅ 정책: undici 직접 로드 및 전역 주입 금지
// 테스트는 jest.fn()으로 fetch를 mock하여 사용
// 프로덕션 코드는 globalThis 기반 표준 API 사용
