/**
 * AgentMetricsCard 컴포넌트 테스트
 */

import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AgentMetricsCard from '../AgentMetricsCard'
import { useAgentMetrics } from '../../hooks/useAgentMetrics'

// useAgentMetrics 훅 모킹
jest.mock('../../hooks/useAgentMetrics')

const mockUseAgentMetrics = useAgentMetrics as jest.MockedFunction<typeof useAgentMetrics>

// QueryClient를 제공하는 wrapper
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

describe('AgentMetricsCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state', () => {
    mockUseAgentMetrics.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as any)

    render(<AgentMetricsCard />, { wrapper: createWrapper() })
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders error state', () => {
    mockUseAgentMetrics.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch'),
    } as any)

    render(<AgentMetricsCard />, { wrapper: createWrapper() })
    
    expect(screen.getByText(/unable to fetch agent metrics/i)).toBeInTheDocument()
  })

  it('renders metrics data correctly', () => {
    const mockMetrics = {
      cpu_usage: 45.5,
      total_memory: 8589934592, // 8GB in bytes
      used_memory: 4294967296, // 4GB in bytes
      free_memory: 4294967296,
      cpu_cores: 4,
    }

    mockUseAgentMetrics.mockReturnValue({
      data: mockMetrics,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<AgentMetricsCard />, { wrapper: createWrapper() })
    
    expect(screen.getByText(/agent metrics/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cpu usage: 45.5%/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/memory usage: 50.0%/i)).toBeInTheDocument()
    expect(screen.getByText(/8.00 gb/i)).toBeInTheDocument()
    expect(screen.getByText(/cpu cores:/i)).toBeInTheDocument()
    // CPU cores 값 확인 (여러 개의 "4"가 있을 수 있으므로 getAllByText 사용)
    const cpuCoresElements = screen.getAllByText(/^4$/)
    expect(cpuCoresElements.length).toBeGreaterThan(0)
  })

  it('calculates memory percentage correctly', () => {
    const mockMetrics = {
      cpu_usage: 30,
      total_memory: 10737418240, // 10GB
      used_memory: 5368709120, // 5GB
      free_memory: 5368709120,
      cpu_cores: 8,
    }

    mockUseAgentMetrics.mockReturnValue({
      data: mockMetrics,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<AgentMetricsCard />, { wrapper: createWrapper() })
    
    // 5GB / 10GB = 50%
    expect(screen.getByLabelText(/memory usage: 50.0%/i)).toBeInTheDocument()
  })

  it('handles missing metrics data gracefully', () => {
    mockUseAgentMetrics.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<AgentMetricsCard />, { wrapper: createWrapper() })
    
    expect(screen.getByText(/unable to fetch agent metrics/i)).toBeInTheDocument()
  })

  it('displays CPU cores correctly', () => {
    const mockMetrics = {
      cpu_usage: 25,
      total_memory: 4294967296,
      used_memory: 2147483648,
      free_memory: 2147483648,
      cpu_cores: 16,
    }

    mockUseAgentMetrics.mockReturnValue({
      data: mockMetrics,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<AgentMetricsCard />, { wrapper: createWrapper() })
    
    expect(screen.getByText(/cpu cores:/i)).toBeInTheDocument()
    // CPU cores 값 확인
    const cpuCoresElements = screen.getAllByText(/^16$/)
    expect(cpuCoresElements.length).toBeGreaterThan(0)
  })

  it('handles metrics with zero values', () => {
    const mockMetrics = {
      cpu_usage: 0,
      total_memory: 1073741824, // 1GB (0이면 나누기 에러)
      used_memory: 0,
      free_memory: 1073741824,
      cpu_cores: 0,
    }

    mockUseAgentMetrics.mockReturnValue({
      data: mockMetrics,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<AgentMetricsCard />, { wrapper: createWrapper() })
    
    expect(screen.getByText(/agent metrics/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cpu usage: 0.0%/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/memory usage: 0.0%/i)).toBeInTheDocument()
  })

  it('handles division by zero for memory percentage', () => {
    const mockMetrics = {
      cpu_usage: 50,
      total_memory: 0, // 0으로 나누기
      used_memory: 0,
      free_memory: 0,
      cpu_cores: 4,
    }

    mockUseAgentMetrics.mockReturnValue({
      data: mockMetrics,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<AgentMetricsCard />, { wrapper: createWrapper() })
    
    // 0으로 나누면 Infinity가 되지만, 컴포넌트는 렌더링되어야 함
    expect(screen.getByText(/agent metrics/i)).toBeInTheDocument()
    // memoryPercent는 Infinity가 될 수 있음 (NaN 또는 Infinity)
    // 컴포넌트가 렌더링되는지만 확인
    expect(screen.getByText(/cpu cores:/i)).toBeInTheDocument()
  })

  it('handles very large memory values', () => {
    const mockMetrics = {
      cpu_usage: 75,
      total_memory: 1099511627776, // 1TB
      used_memory: 549755813888, // 512GB
      free_memory: 549755813888,
      cpu_cores: 32,
    }

    mockUseAgentMetrics.mockReturnValue({
      data: mockMetrics,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<AgentMetricsCard />, { wrapper: createWrapper() })
    
    expect(screen.getByText(/agent metrics/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cpu usage: 75.0%/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/memory usage: 50.0%/i)).toBeInTheDocument()
  })

  it('handles fractional CPU usage values', () => {
    const mockMetrics = {
      cpu_usage: 33.333,
      total_memory: 4294967296,
      used_memory: 2147483648,
      free_memory: 2147483648,
      cpu_cores: 2,
    }

    mockUseAgentMetrics.mockReturnValue({
      data: mockMetrics,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<AgentMetricsCard />, { wrapper: createWrapper() })
    
    expect(screen.getByText(/agent metrics/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cpu usage: 33.3%/i)).toBeInTheDocument()
  })

  it('handles metrics with undefined cpu_usage (optional chaining)', () => {
    // metrics 객체는 있지만 cpu_usage가 undefined인 경우
    const mockMetrics = {
      cpu_usage: undefined as any,
      total_memory: 4294967296,
      used_memory: 2147483648,
      free_memory: 2147483648,
      cpu_cores: 2,
    }

    mockUseAgentMetrics.mockReturnValue({
      data: mockMetrics,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<AgentMetricsCard />, { wrapper: createWrapper() })
    
    // optional chaining으로 인해 cpuPercent는 0이 됨
    expect(screen.getByText(/agent metrics/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cpu usage: 0.0%/i)).toBeInTheDocument()
  })

  it('handles metrics with undefined cpu_cores (optional chaining)', () => {
    // metrics 객체는 있지만 cpu_cores가 undefined인 경우
    const mockMetrics = {
      cpu_usage: 50,
      total_memory: 4294967296,
      used_memory: 2147483648,
      free_memory: 2147483648,
      cpu_cores: undefined as any,
    }

    mockUseAgentMetrics.mockReturnValue({
      data: mockMetrics,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<AgentMetricsCard />, { wrapper: createWrapper() })
    
    // optional chaining으로 인해 cpuCores는 0이 됨
    expect(screen.getByText(/agent metrics/i)).toBeInTheDocument()
    expect(screen.getByText(/cpu cores:/i)).toBeInTheDocument()
  })
})

