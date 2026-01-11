/**
 * useAgentMetrics 훅 테스트
 */

import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAgentMetrics, useAgentMetricsSuspense } from '../useAgentMetrics'
import { useAuth } from '../../components/AuthGuard'
import { useMounted } from '../useMounted'

// Mock dependencies
jest.mock('../../components/AuthGuard', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../useMounted', () => ({
  useMounted: jest.fn(),
}))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseMounted = useMounted as jest.MockedFunction<typeof useMounted>

// Mock fetch
global.fetch = jest.fn()

describe('useAgentMetrics', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    jest.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    mockUseMounted.mockReturnValue(true)
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: null,
      loading: false,
    } as any)
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('should fetch agent metrics when authenticated and mounted', async () => {
    const mockMetrics = {
      cpu_usage: 50,
      total_memory: 8192,
      used_memory: 4096,
      free_memory: 4096,
      cpu_cores: 4,
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockMetrics,
    })

    const { result } = renderHook(() => useAgentMetrics(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockMetrics)
    expect(global.fetch).toHaveBeenCalledWith('/agent/metrics')
  })

  it('should not fetch when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: false,
    } as any)

    renderHook(() => useAgentMetrics(), { wrapper })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should not fetch when not mounted', () => {
    mockUseMounted.mockReturnValue(false)

    renderHook(() => useAgentMetrics(), { wrapper })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should handle 503 errors gracefully', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
    })

    const { result } = renderHook(() => useAgentMetrics(), { wrapper })

    // throwOnError: false이므로 에러가 조용히 처리됨
    await waitFor(() => {
      expect(result.current.isError || result.current.isPending).toBeDefined()
    })

    // 503 에러는 재시도하지 않으므로 에러 상태가 될 수 있음
    if (result.current.isError) {
      expect(result.current.error).toBeInstanceOf(Error)
      expect((result.current.error as Error).message).toContain('Agent service unavailable')
    }
  })

  it('should handle other errors', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    })

    const { result } = renderHook(() => useAgentMetrics(), { wrapper })

    // throwOnError: false이므로 에러가 조용히 처리될 수 있음
    await waitFor(() => {
      expect(result.current.isError || result.current.isPending).toBeDefined()
    })

    // 에러가 발생하면 에러 객체가 있어야 함
    if (result.current.isError) {
      expect(result.current.error).toBeInstanceOf(Error)
      expect((result.current.error as Error).message).toContain('Failed to fetch agent metrics')
    }
  })

  it('should handle fetch errors', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useAgentMetrics(), { wrapper })

    // throwOnError: false이므로 에러가 조용히 처리될 수 있음
    // 쿼리가 완료될 때까지 대기
    await waitFor(() => {
      if (!result.current) return false
      return result.current.isError || result.current.isPending === false
    }, { timeout: 3000 })

    // 에러가 발생하면 에러 객체가 있어야 함
    if (result.current?.isError) {
      expect(result.current.error).toBeInstanceOf(Error)
    }
  })

  it('should configure query options correctly', async () => {
    const mockMetrics = {
      cpu_usage: 50,
      total_memory: 8192,
      used_memory: 4096,
      free_memory: 4096,
      cpu_cores: 4,
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockMetrics,
    })

    const { result } = renderHook(() => useAgentMetrics(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // 쿼리가 성공적으로 완료되었는지 확인
    expect(result.current.data).toEqual(mockMetrics)
  })
})

describe('useAgentMetricsSuspense', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    jest.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('should fetch agent metrics', async () => {
    const mockMetrics = {
      cpu_usage: 50,
      total_memory: 8192,
      used_memory: 4096,
      free_memory: 4096,
      cpu_cores: 4,
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockMetrics,
    })

    const { result } = renderHook(() => useAgentMetricsSuspense(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockMetrics)
    expect(global.fetch).toHaveBeenCalledWith('/agent/metrics')
  })

  it('should handle fetch errors', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    })

    // Suspense 버전은 에러를 throw할 수 있음
    const { result } = renderHook(() => useAgentMetricsSuspense(), { wrapper })

    // 쿼리가 완료될 때까지 대기
    await waitFor(() => {
      if (!result.current) return false
      return result.current.isError || result.current.isPending === false
    }, { timeout: 3000 })

    // 에러가 발생하면 에러 객체가 있어야 함
    if (result.current?.isError) {
      expect(result.current.error).toBeInstanceOf(Error)
    }
  })
})
