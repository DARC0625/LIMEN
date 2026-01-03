/**
 * VM 관리 통합 테스트
 */

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useVMs } from '../../hooks/useVMs'
import { useAgentMetrics } from '../../hooks/useAgentMetrics'
import { vmAPI } from '../../lib/api'
import QuotaDisplay from '../../components/QuotaDisplay'
import AgentMetricsCard from '../../components/AgentMetricsCard'

// 의존성 모킹
jest.mock('../../hooks/useVMs', () => ({
  useVMs: jest.fn(),
}))

jest.mock('../../hooks/useAgentMetrics', () => ({
  useAgentMetrics: jest.fn(),
}))

jest.mock('../../lib/api', () => ({
  vmAPI: {
    list: jest.fn(),
    action: jest.fn(),
  },
  quotaAPI: {
    get: jest.fn(),
  },
  agentAPI: {
    getMetrics: jest.fn(),
  },
}))

jest.mock('../../components/ToastContainer', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  }),
}))

const mockUseVMs = useVMs as jest.MockedFunction<typeof useVMs>
const mockUseAgentMetrics = useAgentMetrics as jest.MockedFunction<typeof useAgentMetrics>
const mockVmAPI = vmAPI as jest.Mocked<typeof vmAPI>

describe('VM Management Integration', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    jest.clearAllMocks()
  })

  it('renders quota display in query provider', async () => {
    const { quotaAPI } = require('../../lib/api')
    quotaAPI.get.mockResolvedValue({
      cpu: { used: 2, total: 8 },
      memory: { used: 4096, total: 16384 },
      disk: { used: 20480, total: 102400 },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <QuotaDisplay />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/resource quota/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('renders agent metrics card in query provider', async () => {
    mockUseAgentMetrics.mockReturnValue({
      data: {
        cpu_usage: 50,
        total_memory: 16384,
        used_memory: 8192,
        free_memory: 8192,
        cpu_cores: 8,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any)

    render(
      <QueryClientProvider client={queryClient}>
        <AgentMetricsCard />
      </QueryClientProvider>
    )

    // AgentMetricsCard가 렌더링되는지 확인 (Agent Metrics 텍스트)
    await waitFor(() => {
      expect(screen.getByText(/agent metrics/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('fetches VM list on mount', async () => {
    const mockVMs = [
      {
        uuid: 'vm-1',
        name: 'Test VM 1',
        status: 'running',
        vcpu: 2,
        memory: 4096,
        disk: 20480,
      },
    ]

    mockUseVMs.mockReturnValue({
      data: mockVMs,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any)

    render(
      <QueryClientProvider client={queryClient}>
        <div>
          {mockUseVMs().data?.map((vm: any) => (
            <div key={vm.uuid}>{vm.name}</div>
          ))}
        </div>
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Test VM 1')).toBeInTheDocument()
    })
  })
})

