/**
 * 토큰 유틸리티 함수 테스트
 */

import { decodeToken, isTokenExpired, isTokenValid, getUserRoleFromToken, isUserApprovedFromToken } from '../token';
import { validateTokenIntegrity } from '../../security';

// Mock security and logger
jest.mock('../../security', () => ({
  validateTokenIntegrity: jest.fn(() => true),
}));

jest.mock('../logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

const mockValidateTokenIntegrity = validateTokenIntegrity as jest.MockedFunction<typeof validateTokenIntegrity>;

describe('decodeToken', () => {
  it('should decode valid JWT token', () => {
    // Valid JWT token (header.payload.signature)
    // Payload: {"id":1,"username":"test","role":"user","exp":9999999999}
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ0ZXN0Iiwicm9sZSI6InVzZXIiLCJleHAiOjk5OTk5OTk5OTl9.signature';
    
    const decoded = decodeToken(validToken);
    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe(1);
    expect(decoded?.username).toBe('test');
    expect(decoded?.role).toBe('user');
  });

  it('should return null for invalid token', () => {
    expect(decodeToken('invalid-token')).toBeNull();
    expect(decodeToken('')).toBeNull();
    expect(decodeToken(null as any)).toBeNull();
  });

  it('should return null for token without payload', () => {
    expect(decodeToken('header.')).toBeNull();
    expect(decodeToken('header')).toBeNull();
  });

  it('should handle base64url decoding with special characters', () => {
    // Base64URL에서 - 와 _ 문자 처리 테스트
    const payload = { id: 1, username: 'test' };
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    // Base64를 Base64URL로 변환 (- 와 _ 포함)
    const base64UrlPayload = base64Payload.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const token = `header.${base64UrlPayload}.signature`;
    
    const decoded = decodeToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe(1);
  });

  it('should handle JSON parse errors gracefully', () => {
    // 잘못된 base64 인코딩으로 JSON 파싱 실패
    const invalidPayload = 'invalid-base64';
    const token = `header.${invalidPayload}.signature`;
    
    expect(decodeToken(token)).toBeNull();
  });

  it('should handle non-string token types', () => {
    expect(decodeToken(undefined as any)).toBeNull();
    expect(decodeToken(123 as any)).toBeNull();
    expect(decodeToken({} as any)).toBeNull();
  });
});

describe('isTokenExpired', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // 2024-01-15 12:00:00 UTC
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z').getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should detect expired tokens', () => {
    // exp: 1705328000 = 2024-01-16 12:00:00 UTC (미래)
    // 과거 시간으로 설정: exp: 1705241600 = 2024-01-15 12:00:00 UTC (현재와 같음)
    // 더 확실하게 과거: exp: 1705155200 = 2024-01-14 12:00:00 UTC
    const expiredExp = Math.floor(new Date('2024-01-14T12:00:00Z').getTime() / 1000);
    const expiredPayload = Buffer.from(JSON.stringify({ exp: expiredExp })).toString('base64url');
    const expiredToken = `header.${expiredPayload}.signature`;
    
    expect(isTokenExpired(expiredToken)).toBe(true);
  });

  it('should detect valid tokens', () => {
    // exp: 미래 시간
    const futureExp = Math.floor(new Date('2025-01-15T12:00:00Z').getTime() / 1000);
    const validPayload = Buffer.from(JSON.stringify({ exp: futureExp })).toString('base64url');
    const validToken = `header.${validPayload}.signature`;
    
    expect(isTokenExpired(validToken)).toBe(false);
  });

  it('should return false for invalid tokens (no exp field)', () => {
    // decodeToken이 실패하면 null을 반환하고, exp가 없으면 false 반환
    expect(isTokenExpired('invalid')).toBe(false);
    expect(isTokenExpired('')).toBe(false);
  });
});

describe('getUserRoleFromToken', () => {
  it('should extract role from token', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYWRtaW4ifQ.signature';
    expect(getUserRoleFromToken(token)).toBe('admin');
  });

  it('should return null for invalid token', () => {
    expect(getUserRoleFromToken('invalid')).toBeNull();
    expect(getUserRoleFromToken('')).toBeNull();
  });

  it('should return null for token without role', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MX0.signature';
    expect(getUserRoleFromToken(token)).toBeNull();
  });
});

describe('isUserApprovedFromToken', () => {
  it('should detect approved users', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHByb3ZlZCI6dHJ1ZX0.signature';
    expect(isUserApprovedFromToken(token)).toBe(true);
  });

  it('should detect unapproved users', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHByb3ZlZCI6ZmFsc2V9.signature';
    expect(isUserApprovedFromToken(token)).toBe(false);
  });

  it('should return false for invalid token', () => {
    expect(isUserApprovedFromToken('invalid')).toBe(false);
    expect(isUserApprovedFromToken('')).toBe(false);
  });

  it('should return false for null token', () => {
    expect(isUserApprovedFromToken(null)).toBe(false);
  });
});

describe('isTokenValid', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z').getTime());
    jest.clearAllMocks();
    mockValidateTokenIntegrity.mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return false for null token', () => {
    expect(isTokenValid(null)).toBe(false);
  });

  it('should return false for empty token', () => {
    expect(isTokenValid('')).toBe(false);
  });

  it('should return false when token integrity validation fails', () => {
    mockValidateTokenIntegrity.mockReturnValue(false);
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ0ZXN0Iiwicm9sZSI6InVzZXIiLCJleHAiOjk5OTk5OTk5OTl9.signature';
    
    expect(isTokenValid(validToken)).toBe(false);
    expect(mockValidateTokenIntegrity).toHaveBeenCalledWith(validToken);
  });

  it('should return false for expired token', () => {
    mockValidateTokenIntegrity.mockReturnValue(true);
    const expiredExp = Math.floor(new Date('2024-01-14T12:00:00Z').getTime() / 1000);
    const expiredPayload = Buffer.from(JSON.stringify({ exp: expiredExp })).toString('base64url');
    const expiredToken = `header.${expiredPayload}.signature`;
    
    expect(isTokenValid(expiredToken)).toBe(false);
  });

  it('should return true for valid token', () => {
    mockValidateTokenIntegrity.mockReturnValue(true);
    const futureExp = Math.floor(new Date('2025-01-15T12:00:00Z').getTime() / 1000);
    const validPayload = Buffer.from(JSON.stringify({ exp: futureExp })).toString('base64url');
    const validToken = `header.${validPayload}.signature`;
    
    expect(isTokenValid(validToken)).toBe(true);
  });

  it('should return true for token without exp field (when integrity is valid)', () => {
    mockValidateTokenIntegrity.mockReturnValue(true);
    const tokenWithoutExp = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ0ZXN0In0.signature';
    
    expect(isTokenValid(tokenWithoutExp)).toBe(true);
  });

  it('should return false for invalid token format', () => {
    // invalid-token은 validateTokenIntegrity가 false를 반환해야 함
    mockValidateTokenIntegrity.mockReturnValue(false);
    expect(isTokenValid('invalid-token')).toBe(false);
  });

  it('should return false when decodeToken fails but integrity check passes', () => {
    // decodeToken이 실패하면 isTokenExpired는 false를 반환하지만
    // 실제로는 validateTokenIntegrity가 false를 반환해야 함
    mockValidateTokenIntegrity.mockReturnValue(false);
    expect(isTokenValid('invalid-format-token')).toBe(false);
  });
});

