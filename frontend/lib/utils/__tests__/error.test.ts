/**
 * 에러 처리 유틸리티 함수 테스트
 */

import { classifyError, getUserFriendlyMessage, handleError, ErrorType } from '../error';
import type { APIError } from '../../types';

// Mock errorTracking
jest.mock('../../errorTracking', () => ({
  trackError: jest.fn(),
  trackAPIError: jest.fn(),
}));

describe('classifyError', () => {
  it('should classify AUTH errors', () => {
    const error = new Error('Unauthorized') as APIError;
    error.status = 401;
    
    const result = classifyError(error);
    expect(result.type).toBe(ErrorType.AUTH);
    expect(result.message).toContain('인증');
    expect(result.status).toBe(401);
  });

  it('should classify SERVER errors', () => {
    const error = new Error('Internal Server Error') as APIError;
    error.status = 500;
    
    const result = classifyError(error);
    expect(result.type).toBe(ErrorType.SERVER);
    expect(result.message).toContain('서버');
    expect(result.status).toBe(500);
  });

  it('should classify VALIDATION errors', () => {
    const error = new Error('Not Found') as APIError;
    error.status = 404;
    
    const result = classifyError(error);
    expect(result.type).toBe(ErrorType.VALIDATION);
    expect(result.status).toBe(404);
  });

  it('should classify NETWORK errors', () => {
    const error = new TypeError('Failed to fetch');
    
    const result = classifyError(error);
    expect(result.type).toBe(ErrorType.NETWORK);
    expect(result.message).toContain('네트워크');
  });

  it('should classify UNKNOWN errors', () => {
    const error = new Error('Unknown error');
    
    const result = classifyError(error);
    expect(result.type).toBe(ErrorType.UNKNOWN);
  });

  it('should handle non-Error objects', () => {
    const result = classifyError('string error');
    expect(result.type).toBe(ErrorType.UNKNOWN);
  });
});

describe('getUserFriendlyMessage', () => {
  it('should return user-friendly messages for AUTH errors', () => {
    const error = new Error('Unauthorized') as APIError;
    error.status = 401;
    
    const message = getUserFriendlyMessage(error);
    expect(message).toContain('인증');
  });

  it('should return user-friendly messages for SERVER errors', () => {
    const error = new Error('Internal Server Error') as APIError;
    error.status = 500;
    
    const message = getUserFriendlyMessage(error);
    expect(message).toContain('서버');
  });

  it('should return user-friendly messages for NETWORK errors', () => {
    const error = new TypeError('Failed to fetch');
    
    const message = getUserFriendlyMessage(error);
    expect(message).toContain('네트워크');
  });

  it('should return default message for unknown errors', () => {
    const error = new Error('Unknown error');
    
    const message = getUserFriendlyMessage(error);
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
  });
});

describe('handleError', () => {
  it('should handle errors with context', () => {
    const error = new Error('Test error');
    const context = { component: 'TestComponent', action: 'test' };
    
    expect(() => handleError(error, context)).not.toThrow();
  });

  it('should handle errors without context', () => {
    const error = new Error('Test error');
    
    expect(() => handleError(error)).not.toThrow();
  });

  it('should handle non-Error objects', () => {
    expect(() => handleError('string error')).not.toThrow();
    expect(() => handleError(null)).not.toThrow();
  });
});

