/**
 * E2E Test Feature Flags
 * 
 * 이 파일은 E2E 테스트 전용 기능 플래그를 관리합니다.
 * 프로덕션 빌드에서는 이 코드가 dead-code elimination으로 제거됩니다.
 * 
 * 사용법:
 * - E2E 테스트에서만 import하여 사용
 * - 빌드 타임 플래그 E2E_MODE=true가 없으면 컴파일 경로에서 제거됨
 */

export const E2E_MODE = process.env.E2E_MODE === 'true';

/**
 * E2E 테스트용 HTTP 헤더
 * 백엔드가 이 헤더를 받으면 VM 스펙을 자동으로 4C/4GB+VNC로 오버라이드합니다.
 */
export const E2E_HEADER = 'X-Limen-E2E';
export const E2E_HEADER_VALUE = '1';

/**
 * E2E 테스트용 HTTP 헤더 객체 반환
 */
export function getE2EHeaders(): Record<string, string> {
  if (!E2E_MODE) {
    return {};
  }
  return {
    [E2E_HEADER]: E2E_HEADER_VALUE,
  };
}

/**
 * E2E 모드인지 확인
 */
export function isE2EMode(): boolean {
  return E2E_MODE;
}
