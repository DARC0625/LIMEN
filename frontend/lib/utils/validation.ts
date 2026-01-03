/**
 * 유효성 검사 유틸리티 함수
 * 공통적으로 사용되는 유효성 검사 로직
 */

/**
 * 이메일 유효성 검사
 * @param email - 검사할 이메일 주소
 * @returns 이메일 형식이 유효한 경우 true, 그렇지 않으면 false
 * @example
 * ```ts
 * isValidEmail('user@example.com') // true
 * isValidEmail('invalid-email') // false
 * ```
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
 * @param username - 검사할 사용자 이름
 * @returns 사용자 이름이 유효한 경우 true, 그렇지 않으면 false
 * @example
 * ```ts
 * isValidUsername('user123') // true
 * isValidUsername('ab') // false (너무 짧음)
 * isValidUsername('user@name') // false (특수문자 포함)
 * ```
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
 * @param password - 검사할 비밀번호
 * @returns 비밀번호가 유효한 경우 true, 그렇지 않으면 false
 * @example
 * ```ts
 * isValidPassword('password123') // true (영문 + 숫자)
 * isValidPassword('password') // false (8자 이상이지만 조건 불만족)
 * isValidPassword('pass123!') // true (영문 + 숫자 + 특수문자)
 * ```
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

/**
 * XSS 방지를 위한 입력 sanitization
 * HTML 태그 및 스크립트 제거
 * @param input - sanitization할 입력 문자열
 * @returns HTML 태그와 위험한 문자가 제거된 안전한 문자열
 * @example
 * ```ts
 * sanitizeInput('<script>alert("xss")</script>') // 'alertxss'
 * sanitizeInput('user<input>') // 'userinput'
 * ```
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  // HTML 태그 제거
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // 위험한 문자 제거
  sanitized = sanitized.replace(/[<>'"&]/g, '');
  
  // 연속된 공백 정리
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}

/**
 * VM 이름 유효성 검사 및 sanitization
 * - 영문, 숫자, 하이픈, 언더스코어만 허용
 * - 1-100자
 */
export function isValidVMName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const sanitized = name.trim();
  if (sanitized.length < 1 || sanitized.length > 100) return false;
  const vmNameRegex = /^[a-zA-Z0-9_-]+$/;
  return vmNameRegex.test(sanitized);
}

/**
 * 일반 텍스트 입력 sanitization (XSS 방지)
 */
export function sanitizeText(text: string, maxLength?: number): string {
  if (typeof text !== 'string') return '';
  
  let sanitized = sanitizeInput(text);
  
  // 최대 길이 제한
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}
