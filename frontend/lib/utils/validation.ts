/**
 * 유효성 검사 유틸리티 함수
 * 공통적으로 사용되는 유효성 검사 로직
 */

/**
 * 이메일 유효성 검사
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * 사용자 이름 유효성 검사
 * - 3-20자
 * - 영문, 숫자, 언더스코어, 하이픈만 허용
 */
export function isValidUsername(username: string): boolean {
  if (!username || typeof username !== 'string') return false;
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username.trim());
}

/**
 * 비밀번호 유효성 검사
 * - 최소 8자
 * - 영문, 숫자, 특수문자 중 2가지 이상 포함
 */
export function isValidPassword(password: string): boolean {
  if (!password || typeof password !== 'string' || password.length < 8) {
    return false;
  }
  
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  // 영문, 숫자, 특수문자 중 2가지 이상 포함
  const criteriaCount = [hasLetter, hasNumber, hasSpecial].filter(Boolean).length;
  return criteriaCount >= 2;
}

/**
 * UUID 유효성 검사
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * URL 유효성 검사
 */
export function isValidURL(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 숫자 범위 유효성 검사
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return typeof value === 'number' && value >= min && value <= max;
}

/**
 * 빈 값 체크 (null, undefined, 빈 문자열, 빈 배열, 빈 객체)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * 문자열 길이 유효성 검사
 */
export function isValidLength(str: string, min: number, max: number): boolean {
  if (typeof str !== 'string') return false;
  const length = str.trim().length;
  return length >= min && length <= max;
}
