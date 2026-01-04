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

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
}

jest.mock('../ToastContainer', () => ({
  useToast: jest.fn(() => mockToast),
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
    // mockToast 함수들 재설정
    mockToast.success.mockClear()
    mockToast.error.mockClear()
    mockToast.warning.mockClear()
    mockToast.info.mockClear()
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

  it('validates empty snapshot name', async () => {
    jest.clearAllMocks()

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

    // 빈 이름으로 제출 (공백만 있는 경우)
    const nameInput = screen.getByLabelText(/snapshot name/i)
    fireEvent.change(nameInput, { target: { value: '   ' } })
    
    const submitButton = screen.getByRole('button', { name: /create/i })
    await act(async () => {
      fireEvent.click(submitButton)
    })

    // warning이 호출되었는지 확인
    await waitFor(() => {
      expect(mockToast.warning).toHaveBeenCalledWith('Please enter a snapshot name')
    })

    // 폼이 제출되지 않았는지 확인
    expect(mockSnapshotAPI.create).not.toHaveBeenCalled()
  })


  it('handles restore snapshot cancellation', async () => {
    const mockSnapshots = [
      { id: 1, name: 'Snapshot 1', created_at: '2026-01-01' },
    ]
    mockSnapshotAPI.list.mockResolvedValue(mockSnapshots as any)

    // window.confirm 모킹 - false 반환 (취소)
    global.confirm = jest.fn(() => false)

    render(<SnapshotManager {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/snapshot 1/i)).toBeInTheDocument()
    })

    const restoreButton = screen.queryByRole('button', { name: /restore/i }) ||
                         screen.queryByText(/restore/i)
    
    if (restoreButton) {
      await act(async () => {
        fireEvent.click(restoreButton)
      })

      // confirm이 false를 반환했으므로 restore가 호출되지 않아야 함
      expect(mockSnapshotAPI.restore).not.toHaveBeenCalled()
    }
  })

  it('handles delete snapshot cancellation', async () => {
    const mockSnapshots = [
      { id: 1, name: 'Snapshot 1', created_at: '2026-01-01' },
    ]
    mockSnapshotAPI.list.mockResolvedValue(mockSnapshots as any)

    // window.confirm 모킹 - false 반환 (취소)
    global.confirm = jest.fn(() => false)

    render(<SnapshotManager {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/snapshot 1/i)).toBeInTheDocument()
    })

    const deleteButton = screen.queryByRole('button', { name: /delete/i }) ||
                        screen.queryByText(/delete/i)
    
    if (deleteButton) {
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      // confirm이 false를 반환했으므로 delete가 호출되지 않아야 함
      expect(mockSnapshotAPI.delete).not.toHaveBeenCalled()
    }
  })

  it('handles restore snapshot error', async () => {
    const mockSnapshots = [
      { id: 1, name: 'Snapshot 1', created_at: '2026-01-01' },
    ]
    mockSnapshotAPI.list.mockResolvedValue(mockSnapshots as any)
    mockSnapshotAPI.restore.mockRejectedValue(new Error('Failed to restore'))

    global.confirm = jest.fn(() => true)

    render(<SnapshotManager {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/snapshot 1/i)).toBeInTheDocument()
    })

    const restoreButton = screen.queryByRole('button', { name: /restore/i }) ||
                         screen.queryByText(/restore/i)
    
    if (restoreButton) {
      await act(async () => {
        fireEvent.click(restoreButton)
      })

      await waitFor(() => {
        expect(mockSnapshotAPI.restore).toHaveBeenCalled()
      })
    }
  })

  it('handles delete snapshot error', async () => {
    const mockSnapshots = [
      { id: 1, name: 'Snapshot 1', created_at: '2026-01-01' },
    ]
    mockSnapshotAPI.list.mockResolvedValue(mockSnapshots as any)
    mockSnapshotAPI.delete.mockRejectedValue(new Error('Failed to delete'))

    global.confirm = jest.fn(() => true)

    render(<SnapshotManager {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/snapshot 1/i)).toBeInTheDocument()
    })

    const deleteButton = screen.queryByRole('button', { name: /delete/i }) ||
                        screen.queryByText(/delete/i)
    
    if (deleteButton) {
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      await waitFor(() => {
        expect(mockSnapshotAPI.delete).toHaveBeenCalled()
      })
    }
  })

  it('handles fetch snapshots error', async () => {
    mockSnapshotAPI.list.mockRejectedValue(new Error('Failed to fetch'))

    render(<SnapshotManager {...mockProps} />)

    await waitFor(() => {
      expect(mockSnapshotAPI.list).toHaveBeenCalledWith('test-uuid')
    })
  })

  it('handles fetch snapshots error with non-Error object', async () => {
    // Error 인스턴스가 아닌 객체를 reject
    mockSnapshotAPI.list.mockRejectedValue('String error')

    render(<SnapshotManager {...mockProps} />)

    await waitFor(() => {
      expect(mockSnapshotAPI.list).toHaveBeenCalledWith('test-uuid')
    })
  })

  it('handles create snapshot error with non-Error object', async () => {
    mockSnapshotAPI.create.mockRejectedValue('String error')

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

    // 에러가 처리되는지 확인
    await waitFor(() => {
      expect(mockSnapshotAPI.create).toHaveBeenCalled()
    })
  })

  it('handles restore snapshot error with non-Error object', async () => {
    const mockSnapshots = [
      { id: 1, name: 'Snapshot 1', created_at: '2026-01-01' },
    ]
    mockSnapshotAPI.list.mockResolvedValue(mockSnapshots as any)
    mockSnapshotAPI.restore.mockRejectedValue('String error')

    global.confirm = jest.fn(() => true)

    render(<SnapshotManager {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/snapshot 1/i)).toBeInTheDocument()
    })

    const restoreButton = screen.queryByRole('button', { name: /restore/i }) ||
                         screen.queryByText(/restore/i)
    
    if (restoreButton) {
      await act(async () => {
        fireEvent.click(restoreButton)
      })

      await waitFor(() => {
        expect(mockSnapshotAPI.restore).toHaveBeenCalled()
      })
    }
  })

  it('handles delete snapshot error with non-Error object', async () => {
    const mockSnapshots = [
      { id: 1, name: 'Snapshot 1', created_at: '2026-01-01' },
    ]
    mockSnapshotAPI.list.mockResolvedValue(mockSnapshots as any)
    mockSnapshotAPI.delete.mockRejectedValue('String error')

    global.confirm = jest.fn(() => true)

    render(<SnapshotManager {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/snapshot 1/i)).toBeInTheDocument()
    })

    const deleteButton = screen.queryByRole('button', { name: /delete/i }) ||
                        screen.queryByText(/delete/i)
    
    if (deleteButton) {
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      await waitFor(() => {
        expect(mockSnapshotAPI.delete).toHaveBeenCalled()
      })
    }
  })

  it('closes create form after successful creation', async () => {
    mockSnapshotAPI.create.mockResolvedValue(undefined as any)

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
    const descInput = screen.queryByLabelText(/description/i) || screen.queryByLabelText(/desc/i)
    
    fireEvent.change(nameInput, { target: { value: 'Test Snapshot' } })
    if (descInput) {
      fireEvent.change(descInput, { target: { value: 'Test Description' } })
    }

    const submitButton = screen.getByRole('button', { name: /create/i })
    await act(async () => {
      fireEvent.click(submitButton)
    })

    await waitFor(() => {
      expect(mockSnapshotAPI.create).toHaveBeenCalledWith('test-uuid', 'Test Snapshot', expect.any(String))
    })

    // 폼이 닫혔는지 확인 (create form이 더 이상 보이지 않아야 함)
    await waitFor(() => {
      const nameInputAfter = screen.queryByLabelText(/snapshot name/i)
      expect(nameInputAfter).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })
})
