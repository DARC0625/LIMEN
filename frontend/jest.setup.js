require('@testing-library/jest-dom');

// ✅ Node 20 + Jest + jsdom 환경에서는 TextEncoder/TextDecoder가 이미 글로벌로 존재
// polyfill 시대의 유물이므로 제거 (최신/표준 철학에 맞음)

// localStorage mock (node 환경에서 필요)
// jsdom/node 둘 다 안전하게 동작
// ✅ P0-2: 순수 JavaScript로 변경 (Babel 파서 호환성)
if (!globalThis.localStorage) {
  const store = new Map();
  
  const localStorageMock = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },

    setItem(key, value) {
      store.set(key, String(value));
    },

    removeItem(key) {
      store.delete(key);
    },

    clear() {
      store.clear();
    },

    key(index) {
      return Array.from(store.keys())[index] || null;
    },

    get length() {
      return store.size;
    },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    configurable: true,
    writable: true,
  });
}

// ✅ 정책: undici 직접 로드 및 전역 주입 금지
// 테스트는 jest.fn()으로 fetch를 mock하여 사용
// 프로덕션 코드는 globalThis 기반 표준 API 사용
