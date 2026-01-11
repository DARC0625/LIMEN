/**
 * 로깅 유틸리티 테스트
 */

// Mock errorTracking
const mockTrackError = jest.fn();
jest.mock('../../errorTracking', () => ({
  trackError: (...args: unknown[]) => mockTrackError(...args),
}));

describe('logger', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  const originalConsoleDebug = console.debug;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // 모듈을 다시 로드하기 위해
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    console.debug = jest.fn();
  });

  afterEach(() => {
    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: originalEnv },
      writable: true,
      configurable: true,
    });
    jest.resetModules();
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    console.debug = originalConsoleDebug;
  });

  describe('development environment', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'env', {
        value: { ...process.env, NODE_ENV: 'development' },
        writable: true,
        configurable: true,
      });
    });

    it('should log to console.log in development', () => {
      const { logger } = require('../logger');
      logger.log('test message');
      expect(console.log).toHaveBeenCalledWith('test message');
    });

    it('should log multiple arguments to console.log', () => {
      const { logger } = require('../logger');
      logger.log('arg1', 'arg2', { key: 'value' });
      expect(console.log).toHaveBeenCalledWith('arg1', 'arg2', { key: 'value' });
    });

    it('should warn to console.warn in development', () => {
      const { logger } = require('../logger');
      logger.warn('warning message');
      expect(console.warn).toHaveBeenCalledWith('warning message');
      expect(mockTrackError).not.toHaveBeenCalled();
    });

    it('should error to console.error in development', () => {
      const { logger } = require('../logger');
      const error = new Error('test error');
      logger.error(error);
      expect(console.error).toHaveBeenCalledWith(error, undefined);
      expect(mockTrackError).toHaveBeenCalledWith(error, undefined);
    });

    it('should error with context in development', () => {
      const { logger } = require('../logger');
      const error = new Error('test error');
      const context = { component: 'TestComponent' };
      logger.error(error, context);
      expect(console.error).toHaveBeenCalledWith(error, context);
      expect(mockTrackError).toHaveBeenCalledWith(error, context);
    });

    it('should handle non-Error objects in error', () => {
      const { logger } = require('../logger');
      logger.error('string error');
      expect(console.error).toHaveBeenCalled();
      expect(mockTrackError).toHaveBeenCalled();
    });

    it('should debug to console.debug in development', () => {
      const { logger } = require('../logger');
      logger.debug('debug message');
      expect(console.debug).toHaveBeenCalledWith('debug message');
    });
  });

  describe('production environment', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'env', {
        value: { ...process.env, NODE_ENV: 'production' },
        writable: true,
        configurable: true,
      });
    });

    it('should not log to console.log in production', () => {
      const { logger } = require('../logger');
      logger.log('test message');
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should send warnings to error tracking in production', () => {
      const { logger } = require('../logger');
      logger.warn('warning message');
      expect(console.warn).not.toHaveBeenCalled();
      expect(mockTrackError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Warning: warning message'),
        }),
        expect.objectContaining({
          type: 'WARNING',
          source: 'logger',
        })
      );
    });

    it('should send warnings with multiple arguments to error tracking in production', () => {
      const { logger } = require('../logger');
      logger.warn('warning', 'message', { key: 'value' });
      expect(console.warn).not.toHaveBeenCalled();
      expect(mockTrackError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Warning:'),
        }),
        expect.objectContaining({
          type: 'WARNING',
          source: 'logger',
        })
      );
    });

    it('should send warnings with object arguments to error tracking in production', () => {
      const { logger } = require('../logger');
      logger.warn({ error: 'test' });
      expect(console.warn).not.toHaveBeenCalled();
      expect(mockTrackError).toHaveBeenCalled();
    });

    it('should send errors to error tracking in production', () => {
      const { logger } = require('../logger');
      const error = new Error('test error');
      logger.error(error);
      expect(console.error).not.toHaveBeenCalled();
      expect(mockTrackError).toHaveBeenCalledWith(error, undefined);
    });

    it('should send errors with context to error tracking in production', () => {
      const { logger } = require('../logger');
      const error = new Error('test error');
      const context = { component: 'TestComponent' };
      logger.error(error, context);
      expect(console.error).not.toHaveBeenCalled();
      expect(mockTrackError).toHaveBeenCalledWith(error, context);
    });

    it('should handle non-Error objects in production', () => {
      const { logger } = require('../logger');
      logger.error('string error');
      expect(console.error).not.toHaveBeenCalled();
      expect(mockTrackError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'string error',
        }),
        undefined
      );
    });

    it('should not debug to console.debug in production', () => {
      const { logger } = require('../logger');
      logger.debug('debug message');
      expect(console.debug).not.toHaveBeenCalled();
    });
  });
});

