/**
 * useOptimisticUpdate 훅 테스트
 */

import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode, JSX } from 'react'
import { useOptimisticUpdate } from '../useOptimisticUpdate'

describe('useOptimisticUpdate', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  })

  afterEach(() => {
    queryClient.clear()
  })

  it('should perform optimistic update', async () => {
    const queryKey = ['test']
    const initialData = { count: 0 }
    
    // 초기 데이터 설정
    queryClient.setQueryData(queryKey, initialData)

    const mutationFn = jest.fn().mockResolvedValue({ count: 1 })
    const updateFn = jest.fn((old) => ({ count: (old?.count || 0) + 1 }))

    const { result } = renderHook(
      () => useOptimisticUpdate(mutationFn, {
        queryKey,
        updateFn,
      }),
      { wrapper }
    )

    // Mutation 실행
    result.current.mutate({})

    // Optimistic update가 즉시 적용되었는지 확인
    await waitFor(() => {
      const data = queryClient.getQueryData(queryKey)
      expect(data).toEqual({ count: 1 })
    })

    expect(updateFn).toHaveBeenCalled()
  })

  it('should rollback on error', async () => {
    const queryKey = ['test']
    const initialData = { count: 0 }
    
    queryClient.setQueryData(queryKey, initialData)

    const mutationFn = jest.fn().mockRejectedValue(new Error('API Error'))
    const updateFn = jest.fn((old) => ({ count: (old?.count || 0) + 1 }))
    const onError = jest.fn()

    const { result } = renderHook(
      () => useOptimisticUpdate(mutationFn, {
        queryKey,
        updateFn,
        onError,
      }),
      { wrapper }
    )

    // Mutation 실행
    result.current.mutate({}, {
      onError: () => {
        // 에러 후 롤백 확인
        const data = queryClient.getQueryData(queryKey)
        expect(data).toEqual(initialData)
      },
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })

  it('should call onSuccess callback', async () => {
    const queryKey = ['test']
    const mutationFn = jest.fn().mockResolvedValue({ count: 1 })
    const updateFn = jest.fn((old) => ({ count: (old?.count || 0) + 1 }))
    const onSuccess = jest.fn()

    const { result } = renderHook(
      () => useOptimisticUpdate(mutationFn, {
        queryKey,
        updateFn,
        onSuccess,
      }),
      { wrapper }
    )

    result.current.mutate({})

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(onSuccess).toHaveBeenCalled()
  })

  it('should handle mutation options', async () => {
    const queryKey = ['test']
    const mutationFn = jest.fn().mockResolvedValue({ count: 1 })
    const updateFn = jest.fn((old) => ({ count: (old?.count || 0) + 1 }))

    const { result } = renderHook(
      () => useOptimisticUpdate(mutationFn, {
        queryKey,
        updateFn,
        mutationOptions: {
          onSuccess: jest.fn(),
        },
      }),
      { wrapper }
    )

    result.current.mutate({})

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
  })
})

