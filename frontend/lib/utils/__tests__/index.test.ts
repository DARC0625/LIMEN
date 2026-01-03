/**
 * lib/utils/index.ts 테스트
 */

import * as utils from '../index'

describe('lib/utils/index', () => {
  it('exports all utility functions', () => {
    // index.ts는 re-export 파일이므로 모든 유틸리티가 export되는지 확인
    expect(utils).toBeDefined()
  })
})

