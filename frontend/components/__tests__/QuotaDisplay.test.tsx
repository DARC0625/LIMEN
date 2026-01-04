/**
 * QuotaDisplay 컴포넌트 테스트
 */

import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import QuotaDisplay from '../QuotaDisplay'
import { useQuota } from '../../hooks/useQuota'

// useQuota 훅 모킹
jest.mock('../../hooks/useQuota')

const mockUseQuota = useQuota as jest.MockedFunction<typeof useQuota>

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

describe('QuotaDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state', () => {
    mockUseQuota.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as any)

    const { container } = render(<QuotaDisplay />, { wrapper: createWrapper() })
    
    // 클라이언트 사이드에서는 Skeleton이 렌더링됨 (animate-pulse 클래스 확인)
    const skeletonElements = container.querySelectorAll('.animate-pulse')
    expect(skeletonElements.length).toBeGreaterThan(0)
  })

  it('renders error state', () => {
    mockUseQuota.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch'),
    } as any)

    render(<QuotaDisplay />, { wrapper: createWrapper() })
    
    expect(screen.getByText(/resource quota/i)).toBeInTheDocument()
    // "Offline" 텍스트가 여러 곳에 있으므로 getAllByText 사용
    const offlineTexts = screen.getAllByText(/offline/i)
    expect(offlineTexts.length).toBeGreaterThan(0)
  })

  it('renders quota data correctly', () => {
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

    mockUseQuota.mockReturnValue({
      data: mockQuota,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<QuotaDisplay />, { wrapper: createWrapper() })
    
    expect(screen.getByText(/resource quota/i)).toBeInTheDocument()
    expect(screen.getByText(/5 \/ 10/)).toBeInTheDocument()
  })

  it('displays warning status when usage is above 70%', () => {
    const mockQuota = {
      usage: {
        vms: 8,
        cpu: 15,
        memory: 3000,
      },
      quota: {
        max_vms: 10,
        max_cpu: 20,
        max_memory: 4096,
      },
    }

    mockUseQuota.mockReturnValue({
      data: mockQuota,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<QuotaDisplay />, { wrapper: createWrapper() })
    
    const statusIndicator = screen.getByRole('status')
    expect(statusIndicator).toHaveClass('bg-yellow-500')
  })

  it('displays critical status when usage is above 90%', () => {
    const mockQuota = {
      usage: {
        vms: 9,
        cpu: 19,
        memory: 3800,
      },
      quota: {
        max_vms: 10,
        max_cpu: 20,
        max_memory: 4096,
      },
    }

    mockUseQuota.mockReturnValue({
      data: mockQuota,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<QuotaDisplay />, { wrapper: createWrapper() })
    
    const statusIndicator = screen.getByRole('status')
    expect(statusIndicator).toHaveClass('bg-red-500')
  })

  it('handles missing quota data gracefully', () => {
    mockUseQuota.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<QuotaDisplay />, { wrapper: createWrapper() })
    
    expect(screen.getByText(/resource quota/i)).toBeInTheDocument()
    const offlineTexts = screen.getAllByText(/offline/i)
    expect(offlineTexts.length).toBeGreaterThan(0)
  })

  it('displays normal status when usage is below 70%', () => {
    const mockQuota = {
      usage: {
        vms: 3,
        cpu: 5,
        memory: 1000,
      },
      quota: {
        max_vms: 10,
        max_cpu: 20,
        max_memory: 4096,
      },
    }

    mockUseQuota.mockReturnValue({
      data: mockQuota,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<QuotaDisplay />, { wrapper: createWrapper() })
    
    const statusIndicator = screen.getByRole('status')
    expect(statusIndicator).toHaveClass('bg-green-500')
  })

  it('displays correct memory in GB', () => {
    const mockQuota = {
      usage: {
        vms: 5,
        cpu: 10,
        memory: 2048, // 2GB
      },
      quota: {
        max_vms: 10,
        max_cpu: 20,
        max_memory: 4096, // 4GB
      },
    }

    mockUseQuota.mockReturnValue({
      data: mockQuota,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<QuotaDisplay />, { wrapper: createWrapper() })
    
    expect(screen.getByText(/2\.0 \/ 4\.0 GB/i)).toBeInTheDocument()
  })

  it('handles missing usage or quota properties', () => {
    // usage나 quota가 없는 경우는 null로 처리
    mockUseQuota.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<QuotaDisplay />, { wrapper: createWrapper() })
    
    // 에러 없이 렌더링되어야 함
    expect(screen.getByText(/resource quota/i)).toBeInTheDocument()
  })

  it('displays correct progress bar values', () => {
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

    mockUseQuota.mockReturnValue({
      data: mockQuota,
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<QuotaDisplay />, { wrapper: createWrapper() })
    
    // Progress bar들이 올바른 ARIA 속성을 가지고 있는지 확인
    const progressBars = screen.getAllByRole('progressbar')
    expect(progressBars.length).toBe(3) // VMs, CPU, Memory
    
    // 각 progress bar가 올바른 값을 가지고 있는지 확인
    progressBars.forEach(bar => {
      expect(bar).toHaveAttribute('aria-valuemin', '0')
      expect(bar).toHaveAttribute('aria-valuemax', '100')
    })
  })
})

