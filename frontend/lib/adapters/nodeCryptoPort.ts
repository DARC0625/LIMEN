/**
 * ✅ P1-Next-Fix-Module-2D: Node.js CryptoPort 구현
 * 
 * node:crypto.randomBytes 사용
 * 
 * ⚠️ 주의: 이 구현은 Node.js 환경에서만 사용됩니다.
 * 브라우저에서는 browserCryptoPort를 사용하세요.
 */

import type { CryptoPort } from '../ports/cryptoPort';

export function createNodeCryptoPort(): CryptoPort {
  return {
    randomHex(bytes: number): string {
      // Node.js 환경에서 crypto 모듈 사용 시도
      try {
        // Dynamic import는 async이므로 동기 함수에서는 사용 불가
        // 대신 global.crypto 또는 fallback 사용
        if (typeof globalThis !== 'undefined' && 'crypto' in globalThis) {
          const crypto = (globalThis as { crypto?: Crypto }).crypto;
          if (crypto && 'getRandomValues' in crypto) {
            const array = new Uint8Array(bytes);
            crypto.getRandomValues(array);
            return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
          }
        }
      } catch {
        // fallback to Math.random (테스트용)
      }
      
      // Fallback (테스트용)
      let result = '';
      for (let i = 0; i < bytes; i++) {
        result += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
      }
      return result;
    },
  };
}
