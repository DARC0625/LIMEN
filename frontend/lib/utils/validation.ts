/**
 * 유효성 검증 유틸리티
 */

/**
 * 이메일 유효성 검증
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 사용자명 유효성 검증
 */
export function isValidUsername(username: string): boolean {
  // 3-20자, 영문/숫자/언더스코어만 허용
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

/**
 * 비밀번호 유효성 검증
 */
export function isValidPassword(password: string): boolean {
  // 최소 6자
  return password.length >= 6;
}

/**
 * VM 이름 유효성 검증
 */
export function isValidVMName(name: string): boolean {
  // 1-50자, 영문/숫자/하이픈/언더스코어만 허용 (XSS 방지)
  const nameRegex = /^[a-zA-Z0-9_-]{1,50}$/;
  return nameRegex.test(name);
}

/**
 * 숫자 범위 유효성 검증
 */
export function isValidRange(
  value: number,
  min: number,
  max: number
): boolean {
  return value >= min && value <= max;
}




