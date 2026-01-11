/**
 * 테스트 환경에서 process.env를 안전하게 조작하기 위한 유틸리티
 * TypeScript의 readonly 제약을 우회하여 테스트에서 환경 변수를 설정할 수 있게 함
 */

type EnvMap = Record<string, string | undefined>;

/**
 * 환경 변수 설정
 * @param key 환경 변수 키
 * @param value 설정할 값 (undefined로 삭제 가능)
 */
export function setEnv(key: string, value: string | undefined): void {
  const env = process.env as unknown as EnvMap;
  env[key] = value;
}

/**
 * 환경 변수 가져오기
 * @param key 환경 변수 키
 * @returns 환경 변수 값 또는 undefined
 */
export function getEnv(key: string): string | undefined {
  const env = process.env as unknown as EnvMap;
  return env[key];
}
