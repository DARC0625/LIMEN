import '@testing-library/jest-dom';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import { TextEncoder, TextDecoder } from 'util';

// jsdom/Node 환경에서 일부 누락될 수 있음
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder as any;

// ✅ fetch/Response/Request/Headers/ReadableStream까지 한 번에 제공
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

// ReadableStream은 Node 18+에서 기본 제공이지만, 혹시 없으면 polyfill
if (typeof globalThis.ReadableStream === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ReadableStream } = require('web-streams-polyfill/ponyfill/es6');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.ReadableStream = ReadableStream as any;
}
