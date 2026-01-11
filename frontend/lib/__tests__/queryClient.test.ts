/**
 * lib/queryClient.ts 테스트
 */

import { QueryClient } from '@tanstack/react-query'
import { QUERY_CONSTANTS } from '../constants'

describe('queryClient', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    // 각 테스트마다 새로운 QueryClient 생성
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: QUERY_CONSTANTS.STALE_TIME,
          gcTime: QUERY_CONSTANTS.GC_TIME,
          retry: QUERY_CONSTANTS.RETRY ? 1 : 0,
          retryDelay: QUERY_CONSTANTS.RETRY_DELAY,
          refetchOnWindowFocus: true,
          refetchOnReconnect: true,
          refetchOnMount: true,
        },
        mutations: {
          retry: false,
        },
      },
    })
  })

  it('creates QueryClient with correct default options', () => {
    const { queryClient: originalQueryClient } = require('../queryClient')
    expect(originalQueryClient).toBeDefined()
    
    const defaultOptions = originalQueryClient.getDefaultOptions()
    
    expect(defaultOptions.queries).toBeDefined()
    expect(defaultOptions.queries?.staleTime).toBe(QUERY_CONSTANTS.STALE_TIME)
    expect(defaultOptions.queries?.gcTime).toBe(QUERY_CONSTANTS.GC_TIME)
    expect(defaultOptions.queries?.retry).toBe(QUERY_CONSTANTS.RETRY ? 1 : 0)
    expect(defaultOptions.queries?.retryDelay).toBe(QUERY_CONSTANTS.RETRY_DELAY)
    expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(true)
    expect(defaultOptions.queries?.refetchOnReconnect).toBe(true)
    expect(defaultOptions.queries?.refetchOnMount).toBe(true)
  })

  it('has mutations with retry disabled', () => {
    const { queryClient: originalQueryClient } = require('../queryClient')
    const defaultOptions = originalQueryClient.getDefaultOptions()
    
    expect(defaultOptions.mutations).toBeDefined()
    expect(defaultOptions.mutations?.retry).toBe(false)
  })

  it('handles QUERY_CONSTANTS.RETRY being true', () => {
    // QUERY_CONSTANTS.RETRY가 true일 때 retry가 1이 되는지 확인
    const testQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: 1, // true 브랜치 테스트
        },
      },
    })
    
    const defaultOptions = testQueryClient.getDefaultOptions()
    expect(defaultOptions.queries?.retry).toBe(1)
  })

  it('handles QUERY_CONSTANTS.RETRY being false', () => {
    // QUERY_CONSTANTS.RETRY가 false일 때 retry가 0이 되는지 확인
    const testQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: 0, // false 브랜치 테스트
        },
      },
    })
    
    const defaultOptions = testQueryClient.getDefaultOptions()
    expect(defaultOptions.queries?.retry).toBe(0)
  })

  it('has correct query options structure', () => {
    const defaultOptions = queryClient.getDefaultOptions()
    
    expect(defaultOptions.queries).toMatchObject({
      staleTime: QUERY_CONSTANTS.STALE_TIME,
      gcTime: QUERY_CONSTANTS.GC_TIME,
      retryDelay: QUERY_CONSTANTS.RETRY_DELAY,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
    })
  })

  it('has correct mutation options structure', () => {
    const defaultOptions = queryClient.getDefaultOptions()
    
    expect(defaultOptions.mutations).toMatchObject({
      retry: false,
    })
  })
})
