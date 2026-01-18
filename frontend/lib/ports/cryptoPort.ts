/**
 * ✅ P1-Next-Fix-Module-2D: CryptoPort 인터페이스
 * 
 * 랜덤 값 생성에 대한 Port 인터페이스
 * 브라우저/Node/테스트 환경별 구현 제공
 */

export interface CryptoPort {
  /**
   * 랜덤 16진수 문자열 생성
   * @param bytes 생성할 바이트 수
   * @returns 16진수 문자열 (bytes * 2 길이)
   */
  randomHex(bytes: number): string;
}
