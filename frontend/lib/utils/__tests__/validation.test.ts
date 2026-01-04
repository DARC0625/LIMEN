/**
 * 유효성 검사 유틸리티 함수 테스트
 */

import {
  isValidEmail,
  isValidUsername,
  isValidPassword,
  isValidUUID,
  isValidURL,
  isInRange,
  isEmpty,
  isValidLength,
  sanitizeInput,
  isValidVMName,
  sanitizeText,
} from '../validation';

describe('isValidEmail', () => {
  it('should validate correct email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('test.email@domain.co.uk')).toBe(true);
    expect(isValidEmail('user+tag@example.com')).toBe(true);
    expect(isValidEmail('user_name@example.com')).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('user@domain')).toBe(false); // no TLD
    expect(isValidEmail('user space@example.com')).toBe(false); // space
  });

  it('should handle non-string inputs', () => {
    expect(isValidEmail(null as any)).toBe(false);
    expect(isValidEmail(123 as any)).toBe(false);
    expect(isValidEmail(undefined as any)).toBe(false);
  });

  it('should trim whitespace', () => {
    expect(isValidEmail('  user@example.com  ')).toBe(true);
    expect(isValidEmail(' user@example.com')).toBe(true);
  });
});

describe('isValidUsername', () => {
  it('should validate correct usernames', () => {
    expect(isValidUsername('user123')).toBe(true);
    expect(isValidUsername('user_name')).toBe(true);
    expect(isValidUsername('user-name')).toBe(true);
    expect(isValidUsername('abc')).toBe(true);
    expect(isValidUsername('a'.repeat(20))).toBe(true);
  });

  it('should reject invalid usernames', () => {
    expect(isValidUsername('ab')).toBe(false); // too short
    expect(isValidUsername('a'.repeat(21))).toBe(false); // too long
    expect(isValidUsername('user@name')).toBe(false); // invalid character
    expect(isValidUsername('user name')).toBe(false); // space
    expect(isValidUsername('')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('should validate correct passwords', () => {
    expect(isValidPassword('password123')).toBe(true); // letters + numbers
    expect(isValidPassword('password!')).toBe(true); // letters + special
    expect(isValidPassword('12345678!')).toBe(true); // numbers + special (8자 이상)
    expect(isValidPassword('Pass123!')).toBe(true); // all three
  });

  it('should reject invalid passwords', () => {
    expect(isValidPassword('short')).toBe(false); // too short
    expect(isValidPassword('password')).toBe(false); // only letters
    expect(isValidPassword('12345678')).toBe(false); // only numbers
    expect(isValidPassword('!!!!!!!!')).toBe(false); // only special
    expect(isValidPassword('123456!')).toBe(false); // too short (7자)
  });
});

describe('isValidUUID', () => {
  it('should validate correct UUIDs', () => {
    expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(isValidUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
  });

  it('should reject invalid UUIDs', () => {
    expect(isValidUUID('invalid-uuid')).toBe(false);
    expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false);
    expect(isValidUUID('')).toBe(false);
  });
});

describe('isValidURL', () => {
  it('should validate correct URLs', () => {
    expect(isValidURL('https://example.com')).toBe(true);
    expect(isValidURL('http://localhost:3000')).toBe(true);
    expect(isValidURL('https://example.com/path?query=value')).toBe(true);
    expect(isValidURL('https://example.com:8080/path')).toBe(true);
    expect(isValidURL('ftp://example.com')).toBe(true);
  });

  it('should reject invalid URLs', () => {
    expect(isValidURL('not-a-url')).toBe(false);
    expect(isValidURL('')).toBe(false);
    expect(isValidURL('example.com')).toBe(false); // no protocol
  });

  it('should handle non-string inputs', () => {
    expect(isValidURL(null as any)).toBe(false);
    expect(isValidURL(123 as any)).toBe(false);
    expect(isValidURL(undefined as any)).toBe(false);
  });
});

describe('isInRange', () => {
  it('should validate numbers in range', () => {
    expect(isInRange(5, 1, 10)).toBe(true);
    expect(isInRange(1, 1, 10)).toBe(true);
    expect(isInRange(10, 1, 10)).toBe(true);
    expect(isInRange(0, 0, 0)).toBe(true);
  });

  it('should reject numbers out of range', () => {
    expect(isInRange(0, 1, 10)).toBe(false);
    expect(isInRange(11, 1, 10)).toBe(false);
    expect(isInRange(-1, 0, 10)).toBe(false);
  });

  it('should handle non-number inputs', () => {
    expect(isInRange('5' as any, 1, 10)).toBe(false);
    expect(isInRange(null as any, 1, 10)).toBe(false);
    expect(isInRange(undefined as any, 1, 10)).toBe(false);
  });
});

describe('isEmpty', () => {
  it('should detect empty values', () => {
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty(undefined)).toBe(true);
    expect(isEmpty('')).toBe(true);
    expect(isEmpty('   ')).toBe(true);
    expect(isEmpty([])).toBe(true);
    expect(isEmpty({})).toBe(true);
  });

  it('should detect non-empty values', () => {
    expect(isEmpty('text')).toBe(false);
    expect(isEmpty([1])).toBe(false);
    expect(isEmpty({ key: 'value' })).toBe(false);
    expect(isEmpty(0)).toBe(false);
    expect(isEmpty(false)).toBe(false);
    expect(isEmpty(true)).toBe(false);
    expect(isEmpty(NaN)).toBe(false);
  });

  it('should handle arrays with whitespace strings', () => {
    expect(isEmpty([''])).toBe(false); // 배열에 요소가 있으면 비어있지 않음
    expect(isEmpty(['   '])).toBe(false);
  });
});

describe('isValidLength', () => {
  it('should validate string lengths', () => {
    expect(isValidLength('abc', 1, 5)).toBe(true);
    expect(isValidLength('a', 1, 5)).toBe(true);
    expect(isValidLength('abcde', 1, 5)).toBe(true);
  });

  it('should reject invalid lengths', () => {
    expect(isValidLength('', 1, 5)).toBe(false);
    expect(isValidLength('abcdef', 1, 5)).toBe(false);
    expect(isValidLength(123 as any, 1, 5)).toBe(false);
  });
});

describe('sanitizeInput', () => {
  it('should remove HTML tags', () => {
    // HTML 태그 제거 후 위험한 문자(")도 제거됨
    expect(sanitizeInput('<script>alert("xss")</script>')).toBe('alert(xss)');
    expect(sanitizeInput('<div>content</div>')).toBe('content');
  });

  it('should remove dangerous characters', () => {
    // < > 문자는 제거되고, 위험한 문자(" ' &)도 제거됨
    expect(sanitizeInput('user<input>')).toBe('user');
    expect(sanitizeInput('text"quote')).toBe('textquote');
    expect(sanitizeInput('text\'quote')).toBe('textquote');
    expect(sanitizeInput('text&quote')).toBe('textquote');
  });

  it('should normalize whitespace', () => {
    expect(sanitizeInput('  multiple   spaces  ')).toBe('multiple spaces');
  });

  it('should handle non-string inputs', () => {
    expect(sanitizeInput(null as any)).toBe('');
    expect(sanitizeInput(123 as any)).toBe('');
  });
});

describe('isValidVMName', () => {
  it('should validate correct VM names', () => {
    expect(isValidVMName('vm-01')).toBe(true);
    expect(isValidVMName('vm_name')).toBe(true);
    expect(isValidVMName('a')).toBe(true);
    expect(isValidVMName('a'.repeat(100))).toBe(true);
  });

  it('should reject invalid VM names', () => {
    expect(isValidVMName('')).toBe(false);
    expect(isValidVMName('vm name')).toBe(false); // space
    expect(isValidVMName('vm@name')).toBe(false); // invalid character
    expect(isValidVMName('a'.repeat(101))).toBe(false); // too long
  });
});

describe('sanitizeText', () => {
  it('should sanitize text and limit length', () => {
    // sanitizeInput이 먼저 실행되어 HTML 태그와 위험한 문자 제거
    // 그 다음 maxLength로 제한
    const result = sanitizeText('<script>alert("xss")</script>', 10);
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    
    expect(sanitizeText('a'.repeat(100), 50)).toBe('a'.repeat(50));
  });

  it('should handle empty inputs', () => {
    expect(sanitizeText('')).toBe('');
    expect(sanitizeText(null as any)).toBe('');
  });
});

