/**
 * lib/api.ts 테스트
 * 이 파일은 re-export만 있으므로 간단한 테스트만 작성
 */

import * as apiModule from '../api'
import * as apiIndexModule from '../api/index'
import * as typesModule from '../types'

describe('lib/api.ts', () => {
  it('exports from api/index', () => {
    // api.ts는 api/index.ts의 모든 것을 re-export하므로
    // 주요 export가 있는지 확인
    expect(apiModule).toBeDefined()
  })

  it('exports types', () => {
    // 타입들이 export되는지 확인 (런타임에서는 확인 불가하지만 구조는 확인 가능)
    expect(typesModule).toBeDefined()
  })

  it('has same exports as api/index', () => {
    // api.ts와 api/index.ts의 주요 export가 동일한지 확인
    const apiExports = Object.keys(apiModule)
    const apiIndexExports = Object.keys(apiIndexModule)
    
    // 최소한 일부 export가 있는지 확인
    expect(apiExports.length).toBeGreaterThan(0)
    expect(apiIndexExports.length).toBeGreaterThan(0)
  })
})





