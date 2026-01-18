/**
 * ✅ P1-Next-Fix-Module-2D: 테스트용 Fake CryptoPort 구현
 * 
 * Deterministic 랜덤 값 생성 (테스트용)
 */

import type { CryptoPort } from '../ports/cryptoPort';

export function createFakeCryptoPort(seed: number = 0): CryptoPort {
  let counter = seed;
  
  return {
    randomHex(bytes: number): string {
      let result = '';
      for (let i = 0; i < bytes; i++) {
        // Deterministic "random" 값 생성
        counter++;
        const value = (counter * 17 + 31) % 256;
        result += value.toString(16).padStart(2, '0');
      }
      return result;
    },
  };
}
