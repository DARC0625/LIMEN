/**
 * useAgentMetrics 훅 테스트
 */

import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAgentMetrics } from '../useAgentMetrics'
import { useAuth } from '../../components/AuthGuard'
import { useMounted } from '../useMounted'

// 의존성 모킹
jest.mock('../../components/AuthGuard', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../useMounted', () => ({
  useMounted: jest.fn(),
}))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseMounted = useMounted as jest.MockedFunction<typeof useMounted>

// fetch 모킹
global.fetch = jest.fn()

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useAgentMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseMounted.mockReturnValue(true)
    mockUseAuth.mockReturnValue({ isAuthenticated: true })
  })

  it('fetches agent metrics when authenticated', async () => {
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
    } as Response)

    const { result } = renderHook(() => useAgentMetrics(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockMetrics)
  })

  it('does not fetch when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false })

    renderHook(() => useAgentMetrics(), {
      wrapper: createWrapper(),
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('handles 503 errors gracefully', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
    } as Response)

    const { result } = renderHook(() => useAgentMetrics(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(false) // 503은 조용히 처리
    })
  })
})

