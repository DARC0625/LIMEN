/**
 * security.ts 테스트
 */

import {
  getBrowserFingerprint,
  validateTokenIntegrity,
  forceLogout,
  checkAndUnblockAccount,
  getSessionId,
  checkRequestRateLimit,
  detectAbnormalActivity,
  initializeSession,
} from '../security'
import { logger } from '../utils/logger'

// logger 모킹
jest.mock('../utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

describe('security', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })

  describe('getBrowserFingerprint', () => {
    it('generates fingerprint on client side', () => {
      const result = getBrowserFingerprint()

      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('generates consistent fingerprint', () => {
      const first = getBrowserFingerprint()
      const second = getBrowserFingerprint()

      expect(first).toBe(second)
    })
  })

  describe('validateTokenIntegrity', () => {
    it('returns false for invalid token', () => {
      expect(validateTokenIntegrity('')).toBe(false)
      expect(validateTokenIntegrity('invalid')).toBe(false)
    })

    it('returns false for non-string token', () => {
      // @ts-ignore
      expect(validateTokenIntegrity(null)).toBe(false)
      // @ts-ignore
      expect(validateTokenIntegrity(123)).toBe(false)
    })

    it('returns false for invalid JWT format', () => {
      expect(validateTokenIntegrity('not.three.parts.here')).toBe(false)
      expect(validateTokenIntegrity('two.parts')).toBe(false)
    })

    it('validates correct JWT format', () => {
      // 유효한 JWT 형식 (실제 서명은 검증하지 않음)
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      const payload = btoa(JSON.stringify({ sub: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 }))
      const signature = 'signature'
      const token = `${header}.${payload}.${signature}`

      expect(validateTokenIntegrity(token)).toBe(true)
    })

    it('validates JWT without exp', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      const payload = btoa(JSON.stringify({ sub: 'user123' }))
      const signature = 'signature'
      const token = `${header}.${payload}.${signature}`

      expect(validateTokenIntegrity(token)).toBe(true)
    })
  })

  describe('forceLogout', () => {
    it('logs logout event on client side', () => {
      localStorage.setItem('auth_token', 'test-token')

      forceLogout('test reason')

      expect(logger.warn).toHaveBeenCalledWith(
        '[Security Log] Logout event detected:',
        expect.objectContaining({
          reason: 'test reason',
        })
      )
    })

    it('logs logout event on client side', () => {
      localStorage.setItem('auth_token', 'test-token')

      forceLogout('test reason')

      expect(logger.warn).toHaveBeenCalledWith(
        '[Security Log] Logout event detected:',
        expect.objectContaining({
          reason: 'test reason',
        })
      )
    })
  })

  describe('checkAndUnblockAccount', () => {
    it('checks account status on client side', () => {
      localStorage.setItem('account_blocked', 'true')

      checkAndUnblockAccount()

      // 차단 플래그가 제거되었는지 확인
      expect(localStorage.getItem('account_blocked')).toBeNull()
    })
  })

  describe('getSessionId', () => {
    it('generates session ID on client side', () => {
      sessionStorage.clear()
      const result = getSessionId()

      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
      expect(result.startsWith('session_')).toBe(true)
    })

    it('returns same session ID on subsequent calls', () => {
      sessionStorage.clear()
      const first = getSessionId()
      const second = getSessionId()

      expect(first).toBe(second)
    })
  })

  describe('checkRequestRateLimit', () => {
    it('always returns true', () => {
      expect(checkRequestRateLimit()).toBe(true)
    })
  })

  describe('detectAbnormalActivity', () => {
    it('returns false for normal activity', () => {
      const result = detectAbnormalActivity()

      expect(result.isAbnormal).toBe(false)
    })
  })

  describe('initializeSession', () => {
    it('initializes session on client side', () => {
      localStorage.setItem('account_blocked', 'true')
      const token = 'test-token'

      initializeSession(token)

      // 차단 플래그가 제거되었는지 확인
      expect(localStorage.getItem('account_blocked')).toBeNull()
      // 브라우저 핑거프린트가 저장되었는지 확인
      expect(localStorage.getItem('browser_fingerprint')).toBeTruthy()
    })
  })
})

