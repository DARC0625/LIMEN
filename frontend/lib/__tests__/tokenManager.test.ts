/**
 * tokenManager 테스트
 */

import { tokenManager } from '../tokenManager'
import { logger } from '../utils/logger'

// logger 모킹
jest.mock('../utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

// fetch 모킹
global.fetch = jest.fn()

describe('tokenManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('sets tokens', () => {
    const accessToken = 'test-access-token'
    const refreshToken = 'test-refresh-token'
    const expiresIn = 900

    tokenManager.setTokens(accessToken, refreshToken, expiresIn)

    expect(localStorage.getItem('refresh_token')).toBe(refreshToken)
    expect(localStorage.getItem('token_expires_at')).toBeTruthy()
  })

  it('has valid token when refresh token exists', () => {
    // setTokens를 호출하여 내부 상태 업데이트
    tokenManager.setTokens('access-token', 'test-refresh-token', 3600)

    const result = tokenManager.hasValidToken()

    expect(result).toBe(true)
  })

  it('returns false when no refresh token', () => {
    localStorage.clear()
    tokenManager.clearTokens()

    const result = tokenManager.hasValidToken()

    expect(result).toBe(false)
  })

  it('clears tokens', () => {
    localStorage.setItem('refresh_token', 'test-token')
    localStorage.setItem('token_expires_at', '1234567890')

    tokenManager.clearTokens()

    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(localStorage.getItem('token_expires_at')).toBeNull()
  })

  it('gets expires at time after setting tokens', () => {
    // setTokens를 호출하여 내부 상태 업데이트
    tokenManager.setTokens('access-token', 'test-token', 3600)

    const result = tokenManager.getExpiresAt()

    expect(result).toBeGreaterThan(0)
    expect(result).toBeGreaterThan(Date.now())
  })
})
