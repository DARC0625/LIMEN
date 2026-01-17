/**
 * ✅ E2E 테스트 번들 빌더
 * 
 * esbuild로 tokenManager/harness 번들 생성
 * spec 파일 안에 빌드 로직을 계속 늘리지 않고 별도 유틸로 분리
 */

import { join } from 'path';
import * as esbuild from 'esbuild';

/**
 * ✅ tokenManager를 브라우저에서 import 가능하게 IIFE 번들로 생성
 * 
 * A안: esbuild 번들링에서 process/env 완전 치환
 * 브라우저 번들에서 process 자체가 사라지게 만들기
 * 
 * ✅ format=iife 강제: ESM이 아니라 IIFE로 만들어서 전역에 붙음
 * window.__TOKEN_MANAGER에 직접 할당되도록 번들링
 */
export async function buildTokenManagerIIFE(): Promise<string> {
  const tokenManagerPath = join(__dirname, '../lib/tokenManager.ts');
  
  const result = await esbuild.build({
    entryPoints: [tokenManagerPath],
    bundle: true,
    write: false,
    format: 'iife', // ✅ IIFE로 변경 (전역에 붙음)
    platform: 'browser',
    target: 'es2020',
    external: ['next'], // Next.js는 외부 의존성으로 처리
    globalName: '__TOKEN_MANAGER_MODULE', // 전역 이름 지정
    // ✅ process.env 완전 치환 (브라우저에서 process가 사라지게)
    define: {
      'process.env.NODE_ENV': '"test"',
      'process.env.NEXT_PUBLIC_API_URL': '"/api"',
      'process.env.NEXT_PUBLIC_SENTRY_DSN': 'undefined',
      'process.env.NEXT_PUBLIC_ERROR_TRACKING_API': 'undefined',
      'process.env': '{}', // 나머지 모든 process.env 접근은 {}로 치환
    },
  });
  
  // ✅ IIFE 번들 결과물에 window.__TOKEN_MANAGER 할당 코드 추가
  const bundleCode = result.outputFiles[0].text;
  return `${bundleCode}\nwindow.__TOKEN_MANAGER = __TOKEN_MANAGER_MODULE.tokenManager;`;
}

/**
 * ✅ harness를 IIFE로 번들링하여 window에 전역 함수 등록
 * 
 * 원인 A 해결: esbuild 번들이 ESM(export) 형태라 <script>로 넣어도 전역이 안 생김
 * 해결: harness 번들을 IIFE로 만들고 window에 명시적으로 붙이기
 * 
 * ✅ 정석: harness-entry 번들은 반드시 IIFE(즉시 실행)로 빌드
 * - format: 'iife'
 * - globalName 불필요 (IIFE면 즉시 실행)
 * - 번들 결과가 (() => { ... window.runS3 = ... })(); 형태여야 함
 */
export async function buildHarnessIIFE(): Promise<string> {
  const harnessPath = join(__dirname, 'harness-entry.ts');
  
  const result = await esbuild.build({
    entryPoints: [harnessPath],
    bundle: true,
    write: false,
    format: 'iife', // ✅ IIFE로 변경 (즉시 실행)
    platform: 'browser',
    target: 'es2020',
    // ✅ globalName 불필요 (IIFE면 즉시 실행)
  });
  
  return result.outputFiles[0].text;
}
