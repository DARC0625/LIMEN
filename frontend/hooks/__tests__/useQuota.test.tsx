/**
 * hooks/useQuota.ts 테스트
 */

import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode, JSX } from 'react'
import { useQuota, useQuotaSuspense } from '../useQuota'
// ✅ P1-Next-Fix-Module-4E: 테스트는 client에서 싱글톤 import
import { quotaAPI } from '../../lib/api/client'
import { useAuth } from '../../components/AuthGuard'

// 의존성 모킹
jest.mock('../../lib/api/client', () => ({
  quotaAPI: {
    get: jest.fn(),
  },
}))

jest.mock('../../components/AuthGuard', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../useMounted', () => ({
  useMounted: () => true,
}))

jest.mock('../../lib/utils/errorHelpers', () => ({
  handleAuthError: jest.fn(),
}))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockQuotaAPI = quotaAPI as jest.Mocked<typeof quotaAPI>

describe('useQuota', () => {
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
    mockUseAuth.mockReturnValue({ isAuthenticated: true } as any)
  })

  afterEach(() => {
    queryClient.clear()
    jest.clearAllMocks()
  })

  it('fetches quota when authenticated', async () => {
    const mockQuota = {
      quota: { vms: 10, cpu: 8, memory: 16384 },
      usage: { vms: 2, cpu: 4, memory: 8192 },
    }
    mockQuotaAPI.get.mockResolvedValue(mockQuota as any)

    const { result } = renderHook(() => useQuota(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockQuota)
  })

  it('returns null for invalid quota data', async () => {
    mockQuotaAPI.get.mockResolvedValue({} as any)

    const { result } = renderHook(() => useQuota(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeNull()
  })

  it('does not fetch when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false } as any)

    const { result } = renderHook(() => useQuota(), { wrapper })

    // 인증되지 않으면 쿼리가 비활성화되므로 데이터가 없음
    expect(result.current.data).toBeUndefined()
  })

  it('handles auth error in useQuota', async () => {
    const { handleAuthError } = require('../../lib/utils/errorHelpers')
    const mockError = { status: 401, message: 'Unauthorized' }
    mockQuotaAPI.get.mockRejectedValue(mockError)

    const { result } = renderHook(() => useQuota(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    // handleAuthError가 호출되었는지 확인
    expect(handleAuthError).toHaveBeenCalledWith(mockError)
  })

  it('handles auth error in useQuotaSuspense', async () => {
    const { handleAuthError } = require('../../lib/utils/errorHelpers')
    const mockError = { status: 403, message: 'Forbidden' }
    mockQuotaAPI.get.mockRejectedValue(mockError)

    // Suspense는 에러를 throw하므로 try-catch로 감싸야 함
    try {
      const { result } = renderHook(() => useQuotaSuspense(), { wrapper })
      await waitFor(() => {
        expect(result.current).toBeDefined()
      })
    } catch (error) {
      // handleAuthError가 호출되었는지 확인
      expect(handleAuthError).toHaveBeenCalledWith(mockError)
    }
  })

  it('returns null when quota data is missing usage', async () => {
    mockQuotaAPI.get.mockResolvedValue({
      quota: { vms: 10, cpu: 8, memory: 16384 },
      // usage가 없음
    } as any)

    const { result } = renderHook(() => useQuota(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeNull()
  })

  it('returns null when quota data is missing quota', async () => {
    mockQuotaAPI.get.mockResolvedValue({
      usage: { vms: 2, cpu: 4, memory: 8192 },
      // quota가 없음
    } as any)

    const { result } = renderHook(() => useQuota(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeNull()
  })

  it('handles null data from API', async () => {
    mockQuotaAPI.get.mockResolvedValue(null as any)

    const { result } = renderHook(() => useQuota(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeNull()
  })

  it('handles undefined data from API', async () => {
    mockQuotaAPI.get.mockResolvedValue(undefined as any)

    const { result } = renderHook(() => useQuota(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeNull()
  })
})

describe('useQuotaSuspense', () => {
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
    jest.clearAllMocks()
  })

  it('fetches quota with suspense', async () => {
    const mockQuota = {
      quota: { vms: 10, cpu: 8, memory: 16384 },
      usage: { vms: 2, cpu: 4, memory: 8192 },
    }
    mockQuotaAPI.get.mockResolvedValue(mockQuota as any)

    const { result } = renderHook(() => useQuotaSuspense(), { wrapper })

    await waitFor(() => {
      expect(result.current.data).toEqual(mockQuota)
    })
  })
})
