/**
 * ✅ P1-Next-Fix-Module-2D: 브라우저 CryptoPort 구현
 * 
 * crypto.getRandomValues 사용
 */

import type { CryptoPort } from '../ports/cryptoPort';

export function createBrowserCryptoPort(): CryptoPort {
  return {
    randomHex(bytes: number): string {
      if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
        throw new Error('crypto.getRandomValues is not available');
      }
      
      const array = new Uint8Array(bytes);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },
  };
}
