/**
 * VMListSection 컴포넌트 테스트
 */

import { render, screen, waitFor } from '@testing-library/react'
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
      const [Component, setComponent] = React.useState(null as any)(null)
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
})

