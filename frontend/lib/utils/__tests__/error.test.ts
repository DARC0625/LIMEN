/**
 * 에러 처리 유틸리티 함수 테스트
 */

import { classifyError, getUserFriendlyMessage, handleError, handleAPIError, ErrorType } from '../error';
import type { APIError } from '../../types';
import { trackError, trackAPIError } from '../../errorTracking';

// Mock errorTracking
jest.mock('../../errorTracking', () => ({
  trackError: jest.fn(),
  trackAPIError: jest.fn(),
}));

const mockTrackError = trackError as jest.MockedFunction<typeof trackError>;
const mockTrackAPIError = trackAPIError as jest.MockedFunction<typeof trackAPIError>;

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

  it('should classify VALIDATION errors (404)', () => {
    const error = new Error('Not Found') as APIError;
    error.status = 404;
    
    const result = classifyError(error);
    expect(result.type).toBe(ErrorType.VALIDATION);
    expect(result.status).toBe(404);
  });

  it('should classify VALIDATION errors (400)', () => {
    const error = new Error('Bad Request') as APIError;
    error.status = 400;
    
    const result = classifyError(error);
    expect(result.type).toBe(ErrorType.VALIDATION);
    expect(result.status).toBe(400);
    expect(result.message).toBe('Bad Request');
  });

  it('should classify VALIDATION errors (400) with empty message', () => {
    const error = new Error('') as APIError;
    error.status = 400;
    error.message = '';
    
    const result = classifyError(error);
    expect(result.type).toBe(ErrorType.VALIDATION);
    expect(result.status).toBe(400);
    expect(result.message).toBe('잘못된 요청입니다.');
  });

  it('should classify VALIDATION errors (422)', () => {
    const error = new Error('Unprocessable Entity') as APIError;
    error.status = 422;
    
    const result = classifyError(error);
    expect(result.type).toBe(ErrorType.VALIDATION);
    expect(result.status).toBe(422);
  });

  it('should classify AUTH errors (403)', () => {
    const error = new Error('Forbidden') as APIError;
    error.status = 403;
    
    const result = classifyError(error);
    expect(result.type).toBe(ErrorType.AUTH);
    expect(result.status).toBe(403);
  });

  it('should classify NETWORK errors (Failed to fetch)', () => {
    const error = new TypeError('Failed to fetch');
    
    const result = classifyError(error);
    expect(result.type).toBe(ErrorType.NETWORK);
    expect(result.message).toContain('네트워크');
  });

  it('should classify NETWORK errors (NetworkError)', () => {
    const error = new Error('NetworkError occurred');
    
    const result = classifyError(error);
    expect(result.type).toBe(ErrorType.NETWORK);
  });

  it('should classify NETWORK errors (network)', () => {
    const error = new Error('network connection failed');
    
    const result = classifyError(error);
    expect(result.type).toBe(ErrorType.NETWORK);
  });

  it('should classify NETWORK errors (timeout)', () => {
    const error = new Error('Request timeout');
    
    const result = classifyError(error);
    expect(result.type).toBe(ErrorType.NETWORK);
  });

  it('should classify UNKNOWN errors', () => {
    const error = new Error('Unknown error');
    
    const result = classifyError(error);
    expect(result.type).toBe(ErrorType.UNKNOWN);
  });

  it('should classify UNKNOWN errors with empty message', () => {
    const error = new Error('');
    error.message = '';
    
    const result = classifyError(error);
    expect(result.type).toBe(ErrorType.UNKNOWN);
    expect(result.message).toBe('알 수 없는 오류가 발생했습니다.');
  });

  it('should handle non-Error objects (string)', () => {
    const result = classifyError('string error');
    expect(result.type).toBe(ErrorType.UNKNOWN);
  });

  it('should handle non-Error objects (number)', () => {
    const result = classifyError(500);
    expect(result.type).toBe(ErrorType.UNKNOWN);
  });

  it('should handle non-Error objects (null)', () => {
    const result = classifyError(null);
    expect(result.type).toBe(ErrorType.UNKNOWN);
  });

  it('should handle non-Error objects (undefined)', () => {
    const result = classifyError(undefined);
    expect(result.type).toBe(ErrorType.UNKNOWN);
  });

  it('should handle API error with status 200 (should not be error)', () => {
    const error = new Error('OK') as APIError;
    error.status = 200;
    
    const result = classifyError(error);
    // 200은 에러가 아니므로 UNKNOWN으로 분류될 수 있음
    expect(result.type).toBeDefined();
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle errors with context', () => {
    const error = new Error('Test error');
    const context = { component: 'TestComponent', action: 'test' };
    
    const result = handleError(error, context);
    expect(result.type).toBe(ErrorType.UNKNOWN);
    expect(mockTrackError).toHaveBeenCalledWith(error, context);
  });

  it('should handle errors without context', () => {
    const error = new Error('Test error');
    
    const result = handleError(error);
    expect(result.type).toBe(ErrorType.UNKNOWN);
    expect(mockTrackError).toHaveBeenCalledWith(error, undefined);
  });

  it('should handle NETWORK errors with tracking', () => {
    const error = new Error('Failed to fetch');
    
    const result = handleError(error);
    expect(result.type).toBe(ErrorType.NETWORK);
    expect(mockTrackError).toHaveBeenCalledWith(error, { type: 'NETWORK_ERROR' });
  });

  it('should handle AUTH errors with tracking', () => {
    const error = new Error('Unauthorized') as APIError;
    error.status = 401;
    
    const result = handleError(error);
    expect(result.type).toBe(ErrorType.AUTH);
    expect(mockTrackError).toHaveBeenCalledWith(error, { type: 'AUTH_ERROR' });
  });

  it('should handle non-Error objects', () => {
    const result = handleError('string error');
    expect(result.type).toBe(ErrorType.UNKNOWN);
    expect(mockTrackError).not.toHaveBeenCalled();
  });

  it('should handle null errors', () => {
    const result = handleError(null);
    expect(result.type).toBe(ErrorType.UNKNOWN);
    expect(mockTrackError).not.toHaveBeenCalled();
  });
});

describe('handleAPIError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle API errors with endpoint and context', () => {
    const error = new Error('Test error') as APIError;
    error.status = 500;
    const context = { component: 'TestComponent', action: 'test' };
    
    const result = handleAPIError('/api/test', error, context);
    expect(result.type).toBe(ErrorType.SERVER);
    expect(result.status).toBe(500);
    expect(mockTrackAPIError).toHaveBeenCalledWith(
      '/api/test',
      500,
      error,
      expect.objectContaining({
        component: 'TestComponent',
        action: 'test',
        errorType: ErrorType.SERVER,
      })
    );
  });

  it('should handle API errors without context', () => {
    const error = new Error('Test error') as APIError;
    error.status = 404;
    
    const result = handleAPIError('/api/test', error);
    expect(result.type).toBe(ErrorType.VALIDATION);
    expect(result.status).toBe(404);
    expect(mockTrackAPIError).toHaveBeenCalledWith(
      '/api/test',
      404,
      error,
      expect.objectContaining({
        errorType: ErrorType.VALIDATION,
      })
    );
  });

  it('should handle API errors without status', () => {
    const error = new Error('Test error');
    
    const result = handleAPIError('/api/test', error);
    expect(result.type).toBe(ErrorType.UNKNOWN);
    expect(mockTrackAPIError).toHaveBeenCalledWith(
      '/api/test',
      0,
      error,
      expect.objectContaining({
        errorType: ErrorType.UNKNOWN,
      })
    );
  });

  it('should handle non-Error objects', () => {
    const result = handleAPIError('/api/test', 'string error');
    expect(result.type).toBe(ErrorType.UNKNOWN);
    expect(mockTrackAPIError).not.toHaveBeenCalled();
  });

  it('should handle AUTH API errors', () => {
    const error = new Error('Unauthorized') as APIError;
    error.status = 401;
    
    const result = handleAPIError('/api/auth', error);
    expect(result.type).toBe(ErrorType.AUTH);
    expect(result.status).toBe(401);
    expect(mockTrackAPIError).toHaveBeenCalled();
  });

  it('should handle NETWORK API errors', () => {
    const error = new Error('Failed to fetch');
    
    const result = handleAPIError('/api/test', error);
    expect(result.type).toBe(ErrorType.NETWORK);
    expect(mockTrackAPIError).toHaveBeenCalled();
  });
});


