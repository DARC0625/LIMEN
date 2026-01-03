/**
 * 에러 처리 헬퍼 함수 테스트
 */

import { isAuthError, handleAuthError } from '../errorHelpers';
import type { APIError } from '../../types';

// Mock removeToken
jest.mock('../../api/index', () => ({
  removeToken: jest.fn(),
}));

describe('isAuthError', () => {
  it('should detect 401 errors', () => {
    const error = new Error('Unauthorized') as APIError;
    error.status = 401;
    expect(isAuthError(error)).toBe(true);
  });

  it('should detect 403 errors', () => {
    const error = new Error('Forbidden') as APIError;
    error.status = 403;
    expect(isAuthError(error)).toBe(true);
  });

  it('should detect 401 in message', () => {
    const error = new Error('Error 401: Unauthorized');
    expect(isAuthError(error)).toBe(true);
  });

  it('should detect 403 in message', () => {
    const error = new Error('Error 403: Forbidden');
    expect(isAuthError(error)).toBe(true);
  });

  it('should detect "Unauthorized" in message', () => {
    const error = new Error('Unauthorized access');
    expect(isAuthError(error)).toBe(true);
  });

  it('should detect "Forbidden" in message', () => {
    const error = new Error('Forbidden access');
    expect(isAuthError(error)).toBe(true);
  });

  it('should detect "Authentication required" in message', () => {
    const error = new Error('Authentication required');
    expect(isAuthError(error)).toBe(true);
  });

  it('should return false for non-auth errors', () => {
    const error = new Error('Not found');
    expect(isAuthError(error)).toBe(false);
  });

  it('should return false for non-Error objects', () => {
    expect(isAuthError('string error')).toBe(false);
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
  });
});

describe('handleAuthError', () => {
  const { removeToken } = require('../../api/index');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call removeToken for 401 errors', () => {
    const error = new Error('Unauthorized') as APIError;
    error.status = 401;
    
    handleAuthError(error);
    expect(removeToken).toHaveBeenCalledTimes(1);
  });

  it('should call removeToken for 403 errors', () => {
    const error = new Error('Forbidden') as APIError;
    error.status = 403;
    
    handleAuthError(error);
    expect(removeToken).toHaveBeenCalledTimes(1);
  });

  it('should call removeToken for errors with "Unauthorized" in message', () => {
    const error = new Error('Unauthorized access');
    
    handleAuthError(error);
    expect(removeToken).toHaveBeenCalledTimes(1);
  });

  it('should not call removeToken for non-auth errors', () => {
    const error = new Error('Not found');
    
    handleAuthError(error);
    expect(removeToken).not.toHaveBeenCalled();
  });

  it('should not call removeToken for non-Error objects', () => {
    handleAuthError('string error');
    expect(removeToken).not.toHaveBeenCalled();
  });
});

