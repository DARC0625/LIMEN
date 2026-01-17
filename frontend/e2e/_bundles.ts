/**
 * ✅ E2E 테스트 번들 빌더
 * 
 * esbuild로 tokenManager/harness 번들 생성
 * spec 파일 안에 빌드 로직을 계속 늘리지 않고 별도 유틸로 분리
 */

import { join } from 'path';
import * as esbuild from 'esbuild';

/**
 * ✅ tokenManager를 브라우저에서 import 가능하게 ESM 번들로 생성
 * 
 * A안: esbuild 번들링에서 process/env 완전 치환
 * 브라우저 번들에서 process 자체가 사라지게 만들기
 */
export async function buildTokenManagerESM(): Promise<string> {
  const tokenManagerPath = join(__dirname, '../lib/tokenManager.ts');
  
  const result = await esbuild.build({
    entryPoints: [tokenManagerPath],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    external: ['next'], // Next.js는 외부 의존성으로 처리
    // ✅ process.env 완전 치환 (브라우저에서 process가 사라지게)
    define: {
      'process.env.NODE_ENV': '"test"',
      'process.env.NEXT_PUBLIC_API_URL': '"/api"',
      'process.env.NEXT_PUBLIC_SENTRY_DSN': 'undefined',
      'process.env.NEXT_PUBLIC_ERROR_TRACKING_API': 'undefined',
      'process.env': '{}', // 나머지 모든 process.env 접근은 {}로 치환
    },
  });
  
  return result.outputFiles[0].text;
}

/**
 * ✅ harness를 IIFE로 번들링하여 window에 전역 함수 등록
 * 
 * 원인 A 해결: esbuild 번들이 ESM(export) 형태라 <script>로 넣어도 전역이 안 생김
 * 해결: harness 번들을 IIFE로 만들고 window에 명시적으로 붙이기
 */
export async function buildHarnessIIFE(): Promise<string> {
  const harnessPath = join(__dirname, 'harness-entry.ts');
  
  const result = await esbuild.build({
    entryPoints: [harnessPath],
    bundle: true,
    write: false,
    format: 'iife', // ✅ IIFE로 변경 (전역 함수 생성)
    platform: 'browser',
    target: 'es2020',
    globalName: '__E2E__', // 필요시 전역 이름 지정
  });
  
  return result.outputFiles[0].text;
}
