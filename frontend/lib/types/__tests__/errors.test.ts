/**
 * 에러 타입 및 유틸리티 함수 테스트
 */

import { isAPIError, isAppError, getErrorMessage, type APIError, type AppError } from '../errors';

describe('isAPIError', () => {
  it('should return true for valid APIError', () => {
    const error: APIError = {
      error: 'API Error',
      message: 'Something went wrong',
      statusCode: 500,
    };
    expect(isAPIError(error)).toBe(true);
  });

  it('should return true for APIError without message', () => {
    const error: APIError = {
      error: 'API Error',
    };
    expect(isAPIError(error)).toBe(true);
  });

  it('should return false for AppError', () => {
    const error: AppError = {
      message: 'App Error',
    };
    expect(isAPIError(error)).toBe(false);
  });

  it('should return false for Error instance', () => {
    const error = new Error('Standard error');
    expect(isAPIError(error)).toBe(false);
  });

  it('should return false for string', () => {
    expect(isAPIError('string error')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isAPIError(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isAPIError(undefined)).toBe(false);
  });

  it('should return false for object without error property', () => {
    expect(isAPIError({ message: 'test' })).toBe(false);
  });
});

describe('isAppError', () => {
  it('should return true for valid AppError', () => {
    const error: AppError = {
      message: 'App Error',
      code: 'ERR001',
      statusCode: 400,
    };
    expect(isAppError(error)).toBe(true);
  });

  it('should return true for AppError without optional fields', () => {
    const error: AppError = {
      message: 'App Error',
    };
    expect(isAppError(error)).toBe(true);
  });

  it('should return false for APIError', () => {
    const error: APIError = {
      error: 'API Error',
    };
    expect(isAppError(error)).toBe(false);
  });

  it('should return true for Error instance (has message property)', () => {
    const error = new Error('Standard error');
    // Error 인스턴스는 message 속성을 가지고 있으므로 isAppError가 true를 반환함
    // 이는 실제 구현의 동작을 반영
    expect(isAppError(error)).toBe(true);
  });

  it('should return false for string', () => {
    expect(isAppError('string error')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isAppError(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isAppError(undefined)).toBe(false);
  });

  it('should return false for object without message property', () => {
    expect(isAppError({ error: 'test' })).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it('should extract message from APIError', () => {
    const error: APIError = {
      error: 'API Error',
      message: 'Detailed message',
    };
    expect(getErrorMessage(error)).toBe('Detailed message');
  });

  it('should use error field when message is missing in APIError', () => {
    const error: APIError = {
      error: 'API Error',
    };
    expect(getErrorMessage(error)).toBe('API Error');
  });

  it('should extract message from AppError', () => {
    const error: AppError = {
      message: 'App Error',
    };
    expect(getErrorMessage(error)).toBe('App Error');
  });

  it('should extract message from Error instance', () => {
    const error = new Error('Standard error');
    expect(getErrorMessage(error)).toBe('Standard error');
  });

  it('should return string as-is', () => {
    expect(getErrorMessage('string error')).toBe('string error');
  });

  it('should return default message for unknown error types', () => {
    expect(getErrorMessage(null)).toBe('An unknown error occurred');
    expect(getErrorMessage(undefined)).toBe('An unknown error occurred');
    expect(getErrorMessage({})).toBe('An unknown error occurred');
    expect(getErrorMessage(123)).toBe('An unknown error occurred');
  });

  it('should handle APIError with empty error field', () => {
    const error: APIError = {
      error: '',
      message: 'Message',
    };
    expect(getErrorMessage(error)).toBe('Message');
  });

  it('should handle APIError with both empty error and message', () => {
    const error: APIError = {
      error: '',
    };
    expect(getErrorMessage(error)).toBe('An error occurred');
  });
});

