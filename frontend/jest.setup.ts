import '@testing-library/jest-dom';

// TextEncoder/TextDecoder (jsdom에서 종종 누락)
import { TextEncoder, TextDecoder } from 'util';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder as any;

// ✅ 정책: undici 직접 로드 및 전역 주입 금지
// 테스트는 jest.fn()으로 fetch를 mock하여 사용
// 프로덕션 코드는 globalThis 기반 표준 API 사용
