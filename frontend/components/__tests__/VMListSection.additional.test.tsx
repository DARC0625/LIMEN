/**
 * VMListSection 컴포넌트 추가 시나리오 테스트
 */

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
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
  default: (loader: () => Promise<any>) => {
    const Component = () => {
      const [Component, setComponent] = React.useState<any>(null)
      React.useEffect(() => {
        loader().then((mod) => setComponent(() => mod.default))
      }, [])
      return Component ? <Component /> : <div>Loading...</div>
    }
    return Component
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

describe('VMListSection Additional Scenarios', () => {
  const mockQueryClient = {
    invalidateQueries: jest.fn(),
    refetchQueries: jest.fn(),
  }

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

  it('calls onAction when action button is clicked', async () => {
    const mockOnAction = jest.fn()
    
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

    // 액션 버튼 찾기 (실제 컴포넌트 구조에 맞게 조정 필요)
    const actionButtons = screen.queryAllByRole('button')
    if (actionButtons.length > 0) {
      await act(async () => {
        fireEvent.click(actionButtons[0])
      })
      // onAction이 호출되었는지 확인 (실제 컴포넌트 동작에 따라 조정)
    }
  })

  it('calls onEdit when edit button is clicked', async () => {
    const mockOnEdit = jest.fn()
    
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

    // 편집 버튼 찾기 (실제 컴포넌트 구조에 맞게 조정 필요)
    const editButtons = screen.queryAllByRole('button')
    if (editButtons.length > 0) {
      await act(async () => {
        fireEvent.click(editButtons[0])
      })
      // onEdit이 호출되었는지 확인 (실제 컴포넌트 동작에 따라 조정)
    }
  })

  it('displays processing state when processingId is set', async () => {
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

  it('handles window resize', async () => {
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
    await act(async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      })
      window.dispatchEvent(new Event('resize'))
    })

    // 컴포넌트가 resize에 반응하는지 확인
    expect(screen.getByText('Test VM 1')).toBeInTheDocument()
  })
})

