/**
 * queryClient.ts 테스트
 */

import { queryClient } from '../queryClient'
import { QUERY_CONSTANTS } from '../constants'

describe('queryClient', () => {
  it('creates query client with default options', () => {
    expect(queryClient).toBeDefined()
  })

  it('has correct default query options', () => {
    const defaultOptions = queryClient.getDefaultOptions()

    expect(defaultOptions.queries).toBeDefined()
    expect(defaultOptions.queries?.staleTime).toBe(QUERY_CONSTANTS.STALE_TIME)
    expect(defaultOptions.queries?.gcTime).toBe(QUERY_CONSTANTS.GC_TIME)
    expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(true)
  })

  it('has correct default mutation options', () => {
    const defaultOptions = queryClient.getDefaultOptions()

    expect(defaultOptions.mutations).toBeDefined()
    expect(defaultOptions.mutations?.retry).toBe(false)
  })
})

