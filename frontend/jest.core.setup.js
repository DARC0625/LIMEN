// ✅ P1-Next-Fix-1: core 프로젝트(node 환경)에서도 analytics 테스트가 가능하도록 window mock
// analytics 모듈이 typeof window === 'undefined' 체크를 하므로, window를 전역 변수로 정의해야 함
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: {
      href: 'http://localhost:3000',
    },
  };
  // typeof window가 작동하도록 전역 변수로 선언
  // eslint-disable-next-line no-undef
  global.window = globalThis.window;
}
