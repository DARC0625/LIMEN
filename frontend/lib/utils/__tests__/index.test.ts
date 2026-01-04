/**
 * lib/utils/index.ts 테스트
 * 이 파일은 단순히 다른 모듈들을 re-export하는 파일이므로
 * 모든 export가 제대로 되는지 확인하는 테스트
 */

import * as utils from '../index'

describe('lib/utils/index', () => {
  it('exports token utilities', () => {
    expect(utils).toHaveProperty('decodeToken')
    expect(utils).toHaveProperty('isTokenValid')
  })

  it('exports error utilities', () => {
    expect(utils).toHaveProperty('classifyError')
    expect(utils).toHaveProperty('getUserFriendlyMessage')
    expect(utils).toHaveProperty('handleError')
    expect(utils).toHaveProperty('handleAPIError')
  })

  it('exports validation utilities', () => {
    expect(utils).toHaveProperty('isValidEmail')
    expect(utils).toHaveProperty('isValidUsername')
    expect(utils).toHaveProperty('isValidPassword')
    expect(utils).toHaveProperty('isValidUUID')
    expect(utils).toHaveProperty('isValidURL')
    expect(utils).toHaveProperty('isInRange')
    expect(utils).toHaveProperty('isEmpty')
    expect(utils).toHaveProperty('isValidLength')
    expect(utils).toHaveProperty('sanitizeInput')
    expect(utils).toHaveProperty('isValidVMName')
    expect(utils).toHaveProperty('sanitizeText')
  })

  it('exports format utilities', () => {
    expect(utils).toHaveProperty('formatBytes')
    expect(utils).toHaveProperty('formatDate')
    expect(utils).toHaveProperty('formatNumber')
    expect(utils).toHaveProperty('formatPercent')
    expect(utils).toHaveProperty('formatDuration')
    expect(utils).toHaveProperty('formatDateKR')
    expect(utils).toHaveProperty('formatRelativeTime')
    expect(utils).toHaveProperty('formatDateSimple')
    expect(utils).toHaveProperty('formatTimeSimple')
  })
})
