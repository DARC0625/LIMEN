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
})

