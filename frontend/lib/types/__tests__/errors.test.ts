/**
 * types/errors.ts 테스트
 */

import {
  isAPIError,
  isAppError,
  getErrorMessage,
  type APIError,
  type AppError,
} from '../errors'

describe('types/errors', () => {
  describe('isAPIError', () => {
    it('should return true for valid APIError', () => {
      const error: APIError = {
        error: 'API_ERROR',
        message: 'Something went wrong',
        statusCode: 500,
      }
      expect(isAPIError(error)).toBe(true)
    })

    it('should return true for APIError with only error field', () => {
      const error: APIError = {
        error: 'API_ERROR',
      }
      expect(isAPIError(error)).toBe(true)
    })

    it('should return false for non-object', () => {
      expect(isAPIError('string')).toBe(false)
      expect(isAPIError(123)).toBe(false)
      expect(isAPIError(null)).toBe(false)
      expect(isAPIError(undefined)).toBe(false)
    })

    it('should return false for object without error field', () => {
      expect(isAPIError({ message: 'error' })).toBe(false)
      expect(isAPIError({})).toBe(false)
    })

    it('should return false for object with non-string error field', () => {
      expect(isAPIError({ error: 123 })).toBe(false)
      expect(isAPIError({ error: null })).toBe(false)
    })
  })

  describe('isAppError', () => {
    it('should return true for valid AppError', () => {
      const error: AppError = {
        message: 'App error',
        code: 'APP_ERROR',
        statusCode: 400,
      }
      expect(isAppError(error)).toBe(true)
    })

    it('should return true for AppError with only message field', () => {
      const error: AppError = {
        message: 'App error',
      }
      expect(isAppError(error)).toBe(true)
    })

    it('should return false for non-object', () => {
      expect(isAppError('string')).toBe(false)
      expect(isAppError(123)).toBe(false)
      expect(isAppError(null)).toBe(false)
      expect(isAppError(undefined)).toBe(false)
    })

    it('should return false for object without message field', () => {
      expect(isAppError({ error: 'error' })).toBe(false)
      expect(isAppError({})).toBe(false)
    })

    it('should return false for object with non-string message field', () => {
      expect(isAppError({ message: 123 })).toBe(false)
      expect(isAppError({ message: null })).toBe(false)
    })
  })

  describe('getErrorMessage', () => {
    it('should extract message from APIError', () => {
      const error: APIError = {
        error: 'API_ERROR',
        message: 'API error message',
      }
      expect(getErrorMessage(error)).toBe('API error message')
    })

    it('should extract error from APIError when message is missing', () => {
      const error: APIError = {
        error: 'API_ERROR',
      }
      expect(getErrorMessage(error)).toBe('API_ERROR')
    })

    it('should return default message for APIError without error or message', () => {
      const error: APIError = {
        error: '',
      }
      expect(getErrorMessage(error)).toBe('An error occurred')
    })

    it('should extract message from AppError', () => {
      const error: AppError = {
        message: 'App error message',
      }
      expect(getErrorMessage(error)).toBe('App error message')
    })

    it('should extract message from Error instance', () => {
      const error = new Error('Standard error message')
      expect(getErrorMessage(error)).toBe('Standard error message')
    })

    it('should return string error as-is', () => {
      expect(getErrorMessage('String error')).toBe('String error')
    })

    it('should return default message for unknown error types', () => {
      expect(getErrorMessage(123)).toBe('An unknown error occurred')
      expect(getErrorMessage(null)).toBe('An unknown error occurred')
      expect(getErrorMessage(undefined)).toBe('An unknown error occurred')
      expect(getErrorMessage({})).toBe('An unknown error occurred')
    })

    it('should prioritize message over error in APIError', () => {
      const error: APIError = {
        error: 'API_ERROR',
        message: 'Message takes priority',
      }
      expect(getErrorMessage(error)).toBe('Message takes priority')
    })
  })
})
