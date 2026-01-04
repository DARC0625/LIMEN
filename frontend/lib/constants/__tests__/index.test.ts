/**
 * lib/constants/index.ts 테스트
 */

import {
  AUTH_CONSTANTS,
  API_CONSTANTS,
  QUERY_CONSTANTS,
  PUBLIC_PATHS,
  ACTIVITY_EVENTS,
} from '../index'

describe('lib/constants/index', () => {
  describe('AUTH_CONSTANTS', () => {
    it('should have correct ACCESS_TOKEN_EXPIRY', () => {
      expect(AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY).toBe(900) // 15분
    })

    it('should have correct REFRESH_TOKEN_EXPIRY', () => {
      expect(AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY).toBe(604800) // 7일
    })

    it('should have correct INACTIVE_TIMEOUT_MS', () => {
      expect(AUTH_CONSTANTS.INACTIVE_TIMEOUT_MS).toBe(10 * 60 * 1000) // 10분
    })

    it('should have correct SESSION_CHECK_INTERVAL', () => {
      expect(AUTH_CONSTANTS.SESSION_CHECK_INTERVAL).toBe(5 * 60 * 1000) // 5분
    })

    it('should have correct TOKEN_REFRESH_BUFFER', () => {
      expect(AUTH_CONSTANTS.TOKEN_REFRESH_BUFFER).toBe(60000) // 1분
    })

    it('should have correct STORAGE_KEYS', () => {
      expect(AUTH_CONSTANTS.STORAGE_KEYS.REFRESH_TOKEN).toBe('refresh_token')
      expect(AUTH_CONSTANTS.STORAGE_KEYS.TOKEN_EXPIRES_AT).toBe('token_expires_at')
      expect(AUTH_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN).toBe('auth_token')
      expect(AUTH_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN_TIMESTAMP).toBe('auth_token_timestamp')
      expect(AUTH_CONSTANTS.STORAGE_KEYS.CSRF_TOKEN).toBe('csrf_token')
      expect(AUTH_CONSTANTS.STORAGE_KEYS.SESSION_ID).toBe('session_id')
    })
  })

  describe('API_CONSTANTS', () => {
    it('should have correct DEFAULT_TIMEOUT', () => {
      expect(API_CONSTANTS.DEFAULT_TIMEOUT).toBe(30000) // 30초
    })

    it('should have correct MAX_RETRIES', () => {
      expect(API_CONSTANTS.MAX_RETRIES).toBe(3)
    })

    it('should have correct RETRY_DELAY', () => {
      expect(API_CONSTANTS.RETRY_DELAY).toBe(1000) // 1초
    })

    it('should have correct RATE_LIMIT values', () => {
      expect(API_CONSTANTS.RATE_LIMIT.LOGIN).toBe(5)
      expect(API_CONSTANTS.RATE_LIMIT.REFRESH).toBe(10)
      expect(API_CONSTANTS.RATE_LIMIT.API).toBe(60)
    })
  })

  describe('QUERY_CONSTANTS', () => {
    it('should have correct STALE_TIME', () => {
      expect(QUERY_CONSTANTS.STALE_TIME).toBe(2000) // 2초
    })

    it('should have correct GC_TIME', () => {
      expect(QUERY_CONSTANTS.GC_TIME).toBe(10 * 60 * 1000) // 10분
    })

    it('should have correct REFETCH_INTERVAL', () => {
      expect(QUERY_CONSTANTS.REFETCH_INTERVAL).toBe(5000) // 5초
    })

    it('should have correct RETRY', () => {
      expect(QUERY_CONSTANTS.RETRY).toBe(false)
    })

    it('should have correct RETRY_DELAY', () => {
      expect(QUERY_CONSTANTS.RETRY_DELAY).toBe(0)
    })
  })

  describe('PUBLIC_PATHS', () => {
    it('should contain /login', () => {
      expect(PUBLIC_PATHS).toContain('/login')
    })

    it('should contain /register', () => {
      expect(PUBLIC_PATHS).toContain('/register')
    })

    it('should be a readonly array', () => {
      expect(Array.isArray(PUBLIC_PATHS)).toBe(true)
      expect(PUBLIC_PATHS.length).toBe(2)
    })
  })

  describe('ACTIVITY_EVENTS', () => {
    it('should contain all activity events', () => {
      expect(ACTIVITY_EVENTS).toContain('mousedown')
      expect(ACTIVITY_EVENTS).toContain('mousemove')
      expect(ACTIVITY_EVENTS).toContain('keypress')
      expect(ACTIVITY_EVENTS).toContain('scroll')
      expect(ACTIVITY_EVENTS).toContain('touchstart')
      expect(ACTIVITY_EVENTS).toContain('click')
    })

    it('should be a readonly array', () => {
      expect(Array.isArray(ACTIVITY_EVENTS)).toBe(true)
      expect(ACTIVITY_EVENTS.length).toBe(6)
    })
  })
})


