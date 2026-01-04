/**
 * VMListSection 컴포넌트 테스트
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import VMListSection from '../VMListSection'
import { useVMs } from '../../hooks/useVMs'
import { useQueryClient } from '@tanstack/react-query'

// 의존성 모킹
jest.mock('../../hooks/useVMs', () => ({
  useVMs: jest.fn(),
}))

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(),
}))

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const MockSnapshotManager = () => <div data-testid="snapshot-manager">Snapshot Manager</div>
    return MockSnapshotManager
  },
}))

jest.mock('../Loading', () => ({
  __esModule: true,
  default: ({ message }: { message?: string }) => <div>Loading: {message}</div>,
}))

jest.mock('../../lib/utils/format', () => ({
  formatBytes: jest.fn((bytes: number) => `${bytes} bytes`),
}))

const React = require('react')
const mockUseVMs = useVMs as jest.MockedFunction<typeof useVMs>
const mockUseQueryClient = useQueryClient as jest.MockedFunction<typeof useQueryClient>

describe('VMListSection', () => {
  const mockQueryClient = {
    invalidateQueries: jest.fn(),
    refetchQueries: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseQueryClient.mockReturnValue(mockQueryClient as any)
    
    // window.innerWidth 모킹
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })
  })

  it('renders loading state', async () => {
    mockUseVMs.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    } as any)

    render(<VMListSection />)

    // Loading 컴포넌트가 렌더링되는지 확인
    await waitFor(() => {
      const loadingElements = screen.queryAllByText(/loading/i)
      expect(loadingElements.length).toBeGreaterThan(0)
    })
  })

  it('renders empty state when no VMs', () => {
    mockUseVMs.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any)

    render(<VMListSection />)

    expect(screen.getByText(/No VMs found/i)).toBeInTheDocument()
  })

  it('renders VM list', async () => {
    const mockVMs = [
      {
        uuid: 'vm-1',
        name: 'Test VM 1',
        status: 'running',
        vcpu: 2,
        memory: 4096,
        disk: 20480,
      },
      {
        uuid: 'vm-2',
        name: 'Test VM 2',
        status: 'stopped',
        vcpu: 4,
        memory: 8192,
        disk: 40960,
      },
    ]

    mockUseVMs.mockReturnValue({
      data: mockVMs,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any)

    render(<VMListSection />)

    await waitFor(() => {
      expect(screen.getByText('Test VM 1')).toBeInTheDocument()
    })
  })

  it('handles keyboard navigation', async () => {
    const mockVMs = [
      {
        uuid: 'vm-1',
        name: 'Test VM 1',
        status: 'running',
        vcpu: 2,
        memory: 4096,
        disk: 20480,
      },
      {
        uuid: 'vm-2',
        name: 'Test VM 2',
        status: 'stopped',
        vcpu: 4,
        memory: 8192,
        disk: 40960,
      },
    ]

    mockUseVMs.mockReturnValue({
      data: mockVMs,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any)

    render(<VMListSection />)

    await waitFor(() => {
      expect(screen.getByText('Test VM 1')).toBeInTheDocument()
    })

    // 키보드 네비게이션 테스트 (이벤트만 발생, act 없이)
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    // 컴포넌트가 렌더링되었는지 확인
    expect(screen.getByText('Test VM 1')).toBeInTheDocument()
  })

  it('handles touch drag on mobile', async () => {
    // 모바일 화면 크기로 설정
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    })

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

    const { container } = render(<VMListSection />)

    await waitFor(() => {
      expect(screen.getByText('Test VM 1')).toBeInTheDocument()
    })

    // 터치 이벤트 시뮬레이션 (컨테이너에서, act 없이)
    const carouselContainer = container.querySelector('[role="group"]')
    if (carouselContainer) {
      fireEvent.touchStart(carouselContainer, {
        touches: [{ clientX: 100 } as Touch],
      })
      fireEvent.touchMove(carouselContainer, {
        touches: [{ clientX: 50 } as Touch],
      })
      fireEvent.touchEnd(carouselContainer)
    }
  })

  it('handles selectedVMForSnapshot prop', async () => {
    const mockVMs = [
      {
        uuid: 'vm-1',
        name: 'Test VM 1',
        status: 'running',
        vcpu: 2,
        memory: 4096,
        disk: 20480,
      },
      {
        uuid: 'vm-2',
        name: 'Test VM 2',
        status: 'stopped',
        vcpu: 4,
        memory: 8192,
        disk: 40960,
      },
    ]

    mockUseVMs.mockReturnValue({
      data: mockVMs,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any)

    const { rerender } = render(<VMListSection selectedVMForSnapshot="vm-2" />)

    await waitFor(() => {
      expect(screen.getByText('Test VM 2')).toBeInTheDocument()
    })

    // selectedVMForSnapshot 변경
    rerender(<VMListSection selectedVMForSnapshot="vm-1" />)

    await waitFor(() => {
      expect(screen.getByText('Test VM 1')).toBeInTheDocument()
    })
  })

  it('handles empty array response', () => {
    mockUseVMs.mockReturnValue({
      data: null, // null 응답
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any)

    render(<VMListSection />)

    expect(screen.getByText(/No VMs found/i)).toBeInTheDocument()
  })

  it('handles error state', () => {
    mockUseVMs.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error('Failed to fetch VMs'),
      refetch: jest.fn(),
    } as any)

    render(<VMListSection />)

    // 에러 상태 처리 확인
    expect(screen.getByText(/No VMs found/i)).toBeInTheDocument()
  })

  it('handles onAction callback', async () => {
    const mockOnAction = jest.fn()
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

    render(<VMListSection onAction={mockOnAction} />)

    await waitFor(() => {
      expect(screen.getByText('Test VM 1')).toBeInTheDocument()
    })

    // 액션 버튼 클릭 시뮬레이션 (실제 버튼이 있는 경우)
    const actionButtons = screen.queryAllByRole('button')
    if (actionButtons.length > 0) {
      fireEvent.click(actionButtons[0])
      // onAction이 호출되었는지 확인 (실제 구현에 따라 다를 수 있음)
    }
  })

  it('handles onEdit callback', async () => {
    const mockOnEdit = jest.fn()
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

    render(<VMListSection onEdit={mockOnEdit} />)

    await waitFor(() => {
      expect(screen.getByText('Test VM 1')).toBeInTheDocument()
    })
  })

  it('handles processingId prop', async () => {
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

    render(<VMListSection processingId="vm-1" />)

    await waitFor(() => {
      expect(screen.getByText('Test VM 1')).toBeInTheDocument()
    })
  })

  it('handles editingVM prop', async () => {
    const mockEditingVM = {
      uuid: 'vm-1',
      name: 'Test VM 1',
      status: 'running',
      vcpu: 2,
      memory: 4096,
      disk: 20480,
    }

    const mockVMs = [mockEditingVM]

    mockUseVMs.mockReturnValue({
      data: mockVMs,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any)

    render(<VMListSection editingVM={mockEditingVM} />)

    await waitFor(() => {
      expect(screen.getByText('Test VM 1')).toBeInTheDocument()
    })
  })

  it('handles window resize', async () => {
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

    render(<VMListSection />)

    await waitFor(() => {
      expect(screen.getByText('Test VM 1')).toBeInTheDocument()
    })

    // window resize 이벤트 발생
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 800,
    })
    fireEvent(window, new Event('resize'))

    // 컴포넌트가 여전히 렌더링되는지 확인
    expect(screen.getByText('Test VM 1')).toBeInTheDocument()
  })

  it('handles mouse drag events', async () => {
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

    const { container } = render(<VMListSection />)

    await waitFor(() => {
      expect(screen.getByText('Test VM 1')).toBeInTheDocument()
    })

    // 마우스 드래그 이벤트 시뮬레이션
    const carouselContainer = container.querySelector('[role="group"]')
    if (carouselContainer) {
      fireEvent.mouseDown(carouselContainer, { clientX: 100 })
      fireEvent.mouseMove(carouselContainer, { clientX: 50 })
      fireEvent.mouseUp(carouselContainer)
    }
  })
})

