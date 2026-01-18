/**
 * ✅ P1-Next-Fix-Module-2B: 브라우저 전용 TokenManager 싱글톤
 * 
 * 'use client' 지시어로 Next.js가 이 파일을 클라이언트 전용으로 보장
 * SSR/node 환경에서는 import 자체가 안 되므로 사이드이펙트 제거
 * 
 * ⚠️ 중요: core(node) 테스트는 이 파일을 절대 import하면 안 됨
 */

'use client';

import { createTokenManager } from './tokenManager';
import { createBrowserStoragePort } from './adapters/browserStoragePort';
import { createBrowserLocationPort } from './adapters/browserLocationPort';
import { createBrowserClockPort } from './adapters/browserClockPort';
import { createBrowserCryptoPort } from './adapters/browserCryptoPort';

// ✅ P1-Next-Fix-Module-2B: 브라우저에서만 실행되는 top-level 생성
// 'use client' 파일이므로 window는 항상 존재함 (fallback 제거)
export const tokenManager = createTokenManager(
  createBrowserStoragePort(window.localStorage),
  createBrowserStoragePort(window.sessionStorage),
  createBrowserClockPort(),
  createBrowserCryptoPort(), // ✅ P1-Next-Fix-Module-2D: CryptoPort 주입
  createBrowserLocationPort(window.location)
);
