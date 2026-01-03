/**
 * lib/constants/index.ts 테스트
 */

import * as constants from '../index'

describe('lib/constants/index', () => {
  it('exports constants', () => {
    // constants 파일이 export되는지 확인
    expect(constants).toBeDefined()
  })
})

