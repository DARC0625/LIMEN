import '@testing-library/jest-dom';

// Response is not defined 해결
// jest-environment-jsdom에서 Response가 없을 수 있으므로 폴리필 제공
// 간단한 Response 클래스 구현 (테스트용)
if (typeof globalThis.Response === 'undefined') {
  class ResponsePolyfill {
    body: ReadableStream | null;
    bodyUsed: boolean;
    headers: Headers;
    ok: boolean;
    redirected: boolean;
    status: number;
    statusText: string;
    type: ResponseType;
    url: string;

    constructor(body?: BodyInit | null, init?: ResponseInit) {
      this.body = body ? new ReadableStream() : null;
      this.bodyUsed = false;
      this.headers = new Headers(init?.headers);
      this.ok = (init?.status ?? 200) >= 200 && (init?.status ?? 200) < 300;
      this.redirected = false;
      this.status = init?.status ?? 200;
      this.statusText = init?.statusText ?? '';
      this.type = 'default';
      this.url = '';
      
      // body를 저장
      if (body) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any)._body = body;
      }
    }

    async text(): Promise<string> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = (this as any)._body;
      if (typeof body === 'string') return body;
      if (body instanceof ArrayBuffer) return new TextDecoder().decode(body);
      return JSON.stringify(body);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async json(): Promise<any> {
      const text = await this.text();
      return JSON.parse(text);
    }

    async blob(): Promise<Blob> {
      return new Blob([await this.text()]);
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
      const text = await this.text();
      return new TextEncoder().encode(text).buffer;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clone(): any {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new ResponsePolyfill((this as any)._body, {
        status: this.status,
        statusText: this.statusText,
        headers: this.headers,
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.Response = ResponsePolyfill as any;
}
