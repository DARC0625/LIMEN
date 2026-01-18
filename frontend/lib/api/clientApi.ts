/**
 * ✅ P1-Next-Fix-Module: 브라우저 전용 API Client 엔트리포인트
 * 
 * 'use client' 지시어로 Next.js가 이 파일을 클라이언트 전용으로 보장
 * SSR/node 환경에서는 import 자체가 안 되므로 사이드이펙트 제거
 */

'use client';

import { createApiClient } from './client';
import { createTokenManager } from '../tokenManager';
import { createBrowserStoragePort } from '../adapters/browserStoragePort';
import { createBrowserLocationPort } from '../adapters/browserLocationPort';
import { createBrowserClockPort } from '../adapters/browserClockPort';

// ✅ P1-Next-Fix-Module: 브라우저에서만 실행되는 top-level 생성
const tokenManager = createTokenManager(
  createBrowserStoragePort(typeof window !== 'undefined' ? window.localStorage : ({} as Storage)),
  createBrowserStoragePort(typeof window !== 'undefined' ? window.sessionStorage : ({} as Storage)),
  createBrowserClockPort(),
  createBrowserLocationPort(typeof window !== 'undefined' ? window.location : ({} as Location))
);

const api = createApiClient({
  tokenManager,
});

// 브라우저 전용 기본 인스턴스 export
export const apiRequest = api.apiRequest;
export { tokenManager };
