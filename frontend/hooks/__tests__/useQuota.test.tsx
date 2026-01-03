/**
 * useQuota 훅 테스트
 */

import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useQuota, useQuotaSuspense } from '../useQuota'
import { quotaAPI } from '../../lib/api/index'
import { useAuth } from '../../components/AuthGuard'
import { useMounted } from '../useMounted'

// 의존성 모킹
jest.mock('../../lib/api/index')
jest.mock('../../components/AuthGuard')
jest.mock('../useMounted')

const mockQuotaAPI = quotaAPI as jest.Mocked<typeof quotaAPI>
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseMounted = useMounted as jest.MockedFunction<typeof useMounted>

// QueryClient를 제공하는 wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useQuota', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseMounted.mockReturnValue(true)
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: null,
      isLoading: false,
    } as any)
  })

  it('should fetch quota data successfully', async () => {
    const mockQuota = {
      usage: {
        vms: 5,
        cpu: 10,
        memory: 2048,
      },
      quota: {
        max_vms: 10,
        max_cpu: 20,
        max_memory: 4096,
      },
    }

    mockQuotaAPI.get = jest.fn().mockResolvedValue(mockQuota)

    const { result } = renderHook(() => useQuota(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockQuota)
    expect(mockQuotaAPI.get).toHaveBeenCalledTimes(1)
  })

  it('should return null for invalid quota data', async () => {
    mockQuotaAPI.get = jest.fn().mockResolvedValue({})

    const { result } = renderHook(() => useQuota(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeNull()
  })

  it('should not fetch when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      isLoading: false,
    } as any)

    mockQuotaAPI.get = jest.fn()

    renderHook(() => useQuota(), { wrapper: createWrapper() })

    expect(mockQuotaAPI.get).not.toHaveBeenCalled()
  })

  it('should not fetch when not mounted', () => {
    mockUseMounted.mockReturnValue(false)
    mockQuotaAPI.get = jest.fn()

    renderHook(() => useQuota(), { wrapper: createWrapper() })

    expect(mockQuotaAPI.get).not.toHaveBeenCalled()
  })

  it('should handle errors', async () => {
    const error = new Error('Failed to fetch quota')
    mockQuotaAPI.get = jest.fn().mockRejectedValue(error)

    const { result } = renderHook(() => useQuota(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBe(error)
  })
})

describe('useQuotaSuspense', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should fetch quota data successfully', async () => {
    const mockQuota = {
      usage: {
        vms: 5,
        cpu: 10,
        memory: 2048,
      },
      quota: {
        max_vms: 10,
        max_cpu: 20,
        max_memory: 4096,
      },
    }

    mockQuotaAPI.get = jest.fn().mockResolvedValue(mockQuota)

    const { result } = renderHook(() => useQuotaSuspense(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockQuota)
  })
})

