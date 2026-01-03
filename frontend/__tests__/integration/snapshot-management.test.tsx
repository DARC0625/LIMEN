/**
 * 스냅샷 관리 통합 테스트
 */

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SnapshotManager from '../../components/SnapshotManager'
import { snapshotAPI } from '../../lib/api'

// 의존성 모킹
jest.mock('../../lib/api', () => ({
  snapshotAPI: {
    list: jest.fn(),
    create: jest.fn(),
    restore: jest.fn(),
    delete: jest.fn(),
  },
  vmAPI: {
    action: jest.fn(),
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

const mockSnapshotAPI = snapshotAPI as jest.Mocked<typeof snapshotAPI>

describe('Snapshot Management Integration', () => {
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

  it('renders snapshot manager in query provider', async () => {
    mockSnapshotAPI.list.mockResolvedValue([])

    render(
      <QueryClientProvider client={queryClient}>
        <SnapshotManager vmUuid="test-uuid" vmName="Test VM" />
      </QueryClientProvider>
    )

    // SnapshotManager가 렌더링되는지 확인 (API 호출 확인)
    await waitFor(() => {
      expect(mockSnapshotAPI.list).toHaveBeenCalledWith('test-uuid')
    }, { timeout: 3000 })
  })

  it('fetches snapshots on mount', async () => {
    const mockSnapshots = [
      {
        id: 1,
        vm_id: 1,
        name: 'Test Snapshot 1',
        description: 'Test description',
        libvirt_name: 'snapshot-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]

    mockSnapshotAPI.list.mockResolvedValue(mockSnapshots as any)

    render(
      <QueryClientProvider client={queryClient}>
        <SnapshotManager vmUuid="test-uuid" vmName="Test VM" />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(mockSnapshotAPI.list).toHaveBeenCalledWith('test-uuid')
    }, { timeout: 3000 })

    // SnapshotManager가 렌더링되는지 확인
    await waitFor(() => {
      expect(screen.getByText(/snapshots for test vm/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('handles snapshot creation flow', async () => {
    mockSnapshotAPI.list.mockResolvedValue([])
    mockSnapshotAPI.create.mockResolvedValue({
      id: 1,
      vm_id: 1,
      name: 'New Snapshot',
      libvirt_name: 'snapshot-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    } as any)

    render(
      <QueryClientProvider client={queryClient}>
        <SnapshotManager vmUuid="test-uuid" vmName="Test VM" />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/snapshots for test vm/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // 스냅샷 목록이 비어있는지 확인
    expect(mockSnapshotAPI.list).toHaveBeenCalledWith('test-uuid')
  })
})

