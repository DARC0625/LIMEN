import '@testing-library/jest-dom';

// 0) TextEncoder/TextDecoder (jsdom에서 종종 누락)
import { TextEncoder, TextDecoder } from 'util';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder as any;

// 1) ✅ ReadableStream을 "undici 로드 전에" 먼저 주입
// Node 18/20에서는 stream/web가 존재합니다.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const web = require('stream/web');
  if (typeof globalThis.ReadableStream === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.ReadableStream = web.ReadableStream as any;
  }
} catch {
  // stream/web가 없는 환경이면 polyfill 사용
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ReadableStream } = require('web-streams-polyfill/ponyfill/es2018');
  if (typeof globalThis.ReadableStream === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.ReadableStream = ReadableStream as any;
  }
}

// 2) 그 다음에 undici 로드 (이제 ReadableStream이 존재하므로 안전)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetch, Headers, Request, Response } = require('undici');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
globalThis.fetch = fetch as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
globalThis.Headers = Headers as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
globalThis.Request = Request as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
globalThis.Response = Response as any;
