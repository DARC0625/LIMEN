/**
 * errorMessages 테스트
 */

import { getErrorMessage, extractErrorCode, ERROR_MESSAGES } from '../errorMessages'

describe('errorMessages', () => {
  describe('getErrorMessage', () => {
    it('returns error message for known error code', () => {
      const result = getErrorMessage('NOT_APPROVED')
      
      expect(result.title).toBe('초대 대기 중')
      expect(result.message).toContain('초대 대기 상태')
      expect(result.action).toBe('대기 상태 확인')
      expect(result.actionUrl).toBe('/waiting')
    })

    it('returns UNKNOWN_ERROR for unknown error code', () => {
      const result = getErrorMessage('UNKNOWN_CODE')
      
      expect(result.title).toBe('오류 발생')
      expect(result.message).toContain('예기치 않은 오류')
    })

    it('uses custom message when provided', () => {
      const customMessage = 'Custom error message'
      const result = getErrorMessage('NOT_APPROVED', customMessage)
      
      expect(result.title).toBe('초대 대기 중')
      expect(result.message).toBe(customMessage)
      expect(result.action).toBe('대기 상태 확인')
    })

    it('handles all error codes in ERROR_MESSAGES', () => {
      Object.keys(ERROR_MESSAGES).forEach(code => {
        const result = getErrorMessage(code)
        expect(result).toBeDefined()
        expect(result.title).toBeTruthy()
        expect(result.message).toBeTruthy()
      })
    })
  })

  describe('extractErrorCode', () => {
    it('extracts code from error object', () => {
      const error = { code: 'NOT_APPROVED' }
      const result = extractErrorCode(error)
      
      expect(result).toBe('NOT_APPROVED')
    })

    it('extracts code from Error with code property', () => {
      const error = { code: 'QUOTA_EXCEEDED_VMS', message: 'Test' } as any
      const result = extractErrorCode(error)
      
      expect(result).toBe('QUOTA_EXCEEDED_VMS')
    })

    it('extracts QUOTA_EXCEEDED_VMS from message', () => {
      const error = { message: 'VM 할당량 초과' }
      const result = extractErrorCode(error)
      
      expect(result).toBe('QUOTA_EXCEEDED_VMS')
    })

    it('extracts QUOTA_EXCEEDED_CPU from message', () => {
      const error = { message: 'CPU 할당량 초과' }
      const result = extractErrorCode(error)
      
      expect(result).toBe('QUOTA_EXCEEDED_CPU')
    })

    it('extracts QUOTA_EXCEEDED_MEMORY from message', () => {
      const error = { message: '메모리 할당량 초과' }
      const result = extractErrorCode(error)
      
      expect(result).toBe('QUOTA_EXCEEDED_MEMORY')
    })

    it('extracts SESSION_IDLE_TIMEOUT from message', () => {
      const error = { message: '세션 유휴 시간 초과' }
      const result = extractErrorCode(error)
      
      expect(result).toBe('SESSION_IDLE_TIMEOUT')
    })

    it('extracts SESSION_EXPIRED from message', () => {
      const error = { message: '세션 만료' }
      const result = extractErrorCode(error)
      
      expect(result).toBe('SESSION_EXPIRED')
    })

    it('extracts UNAUTHORIZED from message', () => {
      const error = { message: '인증 필요' }
      const result = extractErrorCode(error)
      
      expect(result).toBe('UNAUTHORIZED')
    })

    it('extracts FORBIDDEN from message', () => {
      const error = { message: '권한 없음' }
      const result = extractErrorCode(error)
      
      expect(result).toBe('FORBIDDEN')
    })

    it('extracts ACCOUNT_LOCKED from message', () => {
      const error = { message: '계정 잠금' }
      const result = extractErrorCode(error)
      
      expect(result).toBe('ACCOUNT_LOCKED')
    })

    it('returns UNKNOWN_ERROR for Error object without code', () => {
      const error = new Error('Test error')
      const result = extractErrorCode(error)
      
      expect(result).toBe('UNKNOWN_ERROR')
    })

    it('returns UNKNOWN_ERROR for null', () => {
      const result = extractErrorCode(null)
      
      expect(result).toBe('UNKNOWN_ERROR')
    })

    it('returns UNKNOWN_ERROR for undefined', () => {
      const result = extractErrorCode(undefined)
      
      expect(result).toBe('UNKNOWN_ERROR')
    })

    it('returns UNKNOWN_ERROR for string', () => {
      const result = extractErrorCode('string error')
      
      expect(result).toBe('UNKNOWN_ERROR')
    })

    it('returns UNKNOWN_ERROR for number', () => {
      const result = extractErrorCode(500)
      
      expect(result).toBe('UNKNOWN_ERROR')
    })

    it('handles error with error property', () => {
      const error = { error: 'Some error' }
      const result = extractErrorCode(error)
      
      expect(result).toBe('UNKNOWN_ERROR')
    })

    it('handles case-insensitive message matching', () => {
      const error = { message: 'quota exceeded' }
      const result = extractErrorCode(error)
      
      expect(result).toBe('QUOTA_EXCEEDED_VMS')
    })
  })
})


