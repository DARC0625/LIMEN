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
})

