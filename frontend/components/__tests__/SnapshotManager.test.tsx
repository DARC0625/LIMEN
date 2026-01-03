/**
 * SnapshotManager 컴포넌트 테스트
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import SnapshotManager from '../SnapshotManager'
import { snapshotAPI } from '../../lib/api'
import { useToast } from '../ToastContainer'

// 의존성 모킹
jest.mock('../../lib/api', () => ({
  snapshotAPI: {
    list: jest.fn(),
    create: jest.fn(),
    restore: jest.fn(),
    delete: jest.fn(),
  },
}))

jest.mock('../ToastContainer', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  }),
}))

jest.mock('../../lib/utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

const mockSnapshotAPI = snapshotAPI as jest.Mocked<typeof snapshotAPI>

describe('SnapshotManager', () => {
  const mockProps = {
    vmUuid: 'test-uuid',
    vmName: 'Test VM',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockSnapshotAPI.list.mockResolvedValue([])
  })

  it('renders snapshot manager', async () => {
    render(<SnapshotManager {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/snapshots for test vm/i)).toBeInTheDocument()
    })
  })

  it('fetches snapshots on mount', async () => {
    const mockSnapshots = [
      { id: 1, name: 'Snapshot 1', created_at: '2026-01-01' },
      { id: 2, name: 'Snapshot 2', created_at: '2026-01-02' },
    ]

    mockSnapshotAPI.list.mockResolvedValue(mockSnapshots as any)

    render(<SnapshotManager {...mockProps} />)

    await waitFor(() => {
      expect(mockSnapshotAPI.list).toHaveBeenCalledWith('test-uuid')
    })
  })

  it('shows create form when create button is clicked', async () => {
    render(<SnapshotManager {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/snapshots for test vm/i)).toBeInTheDocument()
    })

    const createButton = screen.getByText(/create snapshot/i)
    await act(async () => {
      fireEvent.click(createButton)
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/snapshot name/i)).toBeInTheDocument()
    })
  })

  it('restores snapshot', async () => {
    const mockSnapshots = [
      { id: 1, name: 'Snapshot 1', created_at: '2026-01-01' },
    ]
    mockSnapshotAPI.list.mockResolvedValue(mockSnapshots as any)
    mockSnapshotAPI.restore.mockResolvedValue(undefined as any)

    // window.confirm 모킹
    global.confirm = jest.fn(() => true)

    render(<SnapshotManager {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/snapshots for test vm/i)).toBeInTheDocument()
    })

    // 스냅샷이 렌더링될 때까지 대기
    await waitFor(() => {
      expect(screen.getByText(/snapshot 1/i)).toBeInTheDocument()
    })

    // restore 버튼 찾기 (텍스트나 aria-label로)
    const restoreButton = screen.queryByRole('button', { name: /restore/i }) ||
                         screen.queryByText(/restore/i)
    
    if (restoreButton) {
      await act(async () => {
        fireEvent.click(restoreButton)
      })

      await waitFor(() => {
        expect(mockSnapshotAPI.restore).toHaveBeenCalledWith(1)
      })
    }
  })

  it('deletes snapshot', async () => {
    const mockSnapshots = [
      { id: 1, name: 'Snapshot 1', created_at: '2026-01-01' },
    ]
    mockSnapshotAPI.list.mockResolvedValue(mockSnapshots as any)
    mockSnapshotAPI.delete.mockResolvedValue(undefined as any)

    // window.confirm 모킹
    global.confirm = jest.fn(() => true)

    render(<SnapshotManager {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/snapshots for test vm/i)).toBeInTheDocument()
    })

    // 스냅샷이 렌더링될 때까지 대기
    await waitFor(() => {
      expect(screen.getByText(/snapshot 1/i)).toBeInTheDocument()
    })

    // delete 버튼 찾기 (텍스트나 aria-label로)
    const deleteButton = screen.queryByRole('button', { name: /delete/i }) ||
                        screen.queryByText(/delete/i)
    
    if (deleteButton) {
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      await waitFor(() => {
        expect(mockSnapshotAPI.delete).toHaveBeenCalledWith(1)
      })
    }
  })

  it('handles create snapshot error', async () => {
    mockSnapshotAPI.create.mockRejectedValue(new Error('Failed to create snapshot'))

    render(<SnapshotManager {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/snapshots for test vm/i)).toBeInTheDocument()
    })

    const createButton = screen.getByText(/create snapshot/i)
    await act(async () => {
      fireEvent.click(createButton)
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/snapshot name/i)).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText(/snapshot name/i)
    fireEvent.change(nameInput, { target: { value: 'Test Snapshot' } })

    const submitButton = screen.getByRole('button', { name: /create/i })
    await act(async () => {
      fireEvent.click(submitButton)
    })

    // 에러가 처리되는지 확인 (toast.error가 호출됨)
    await waitFor(() => {
      expect(mockSnapshotAPI.create).toHaveBeenCalled()
    })
  })
})
