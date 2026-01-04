/**
 * Snapshot API 테스트
 */

import { snapshotAPI } from '../snapshot'
import { apiRequest } from '../client'

// apiRequest 모킹
jest.mock('../client')

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>

describe('snapshotAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should list snapshots successfully', async () => {
    const vmUuid = 'vm-uuid-123'
    const mockSnapshots = [
      { id: 1, name: 'snapshot1', vm_uuid: vmUuid },
      { id: 2, name: 'snapshot2', vm_uuid: vmUuid },
    ]

    mockApiRequest.mockResolvedValue(mockSnapshots)

    const result = await snapshotAPI.list(vmUuid)

    expect(mockApiRequest).toHaveBeenCalledWith(`/vms/${vmUuid}/snapshots`)
    expect(result).toEqual(mockSnapshots)
  })

  it('should create snapshot successfully', async () => {
    const vmUuid = 'vm-uuid-123'
    const name = 'new-snapshot'
    const description = 'Test snapshot'

    const createdSnapshot = {
      id: 1,
      name,
      description,
      vm_uuid: vmUuid,
    }

    mockApiRequest.mockResolvedValue(createdSnapshot)

    const result = await snapshotAPI.create(vmUuid, name, description)

    expect(mockApiRequest).toHaveBeenCalledWith(`/vms/${vmUuid}/snapshots`, {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    })
    expect(result).toEqual(createdSnapshot)
  })

  it('should create snapshot without description', async () => {
    const vmUuid = 'vm-uuid-123'
    const name = 'new-snapshot'

    const createdSnapshot = {
      id: 1,
      name,
      vm_uuid: vmUuid,
    }

    mockApiRequest.mockResolvedValue(createdSnapshot)

    const result = await snapshotAPI.create(vmUuid, name)

    expect(mockApiRequest).toHaveBeenCalledWith(`/vms/${vmUuid}/snapshots`, {
      method: 'POST',
      body: JSON.stringify({ name, description: undefined }),
    })
    expect(result).toEqual(createdSnapshot)
  })

  it('should restore snapshot successfully', async () => {
    const snapshotId = 1
    const mockResponse = {
      message: 'Snapshot restored',
      snapshot_id: snapshotId,
    }

    mockApiRequest.mockResolvedValue(mockResponse)

    const result = await snapshotAPI.restore(snapshotId)

    expect(mockApiRequest).toHaveBeenCalledWith(`/snapshots/${snapshotId}/restore`, {
      method: 'POST',
    })
    expect(result).toEqual(mockResponse)
  })

  it('should delete snapshot successfully', async () => {
    const snapshotId = 1
    const mockResponse = {
      message: 'Snapshot deleted',
    }

    mockApiRequest.mockResolvedValue(mockResponse)

    const result = await snapshotAPI.delete(snapshotId)

    expect(mockApiRequest).toHaveBeenCalledWith(`/snapshots/${snapshotId}`, {
      method: 'DELETE',
    })
    expect(result).toEqual(mockResponse)
  })

  it('should handle list errors', async () => {
    const error = new Error('Failed to list snapshots')
    mockApiRequest.mockRejectedValue(error)

    await expect(snapshotAPI.list('vm-uuid-123')).rejects.toThrow('Failed to list snapshots')
  })

  it('should handle create errors', async () => {
    const error = new Error('Failed to create snapshot')
    mockApiRequest.mockRejectedValue(error)

    await expect(snapshotAPI.create('vm-uuid-123', 'snapshot-name')).rejects.toThrow('Failed to create snapshot')
  })

  it('should handle restore errors', async () => {
    const error = new Error('Failed to restore snapshot')
    mockApiRequest.mockRejectedValue(error)

    await expect(snapshotAPI.restore(1)).rejects.toThrow('Failed to restore snapshot')
  })

  it('should handle delete errors', async () => {
    const error = new Error('Failed to delete snapshot')
    mockApiRequest.mockRejectedValue(error)

    await expect(snapshotAPI.delete(1)).rejects.toThrow('Failed to delete snapshot')
  })

  it('should create snapshot with empty description', async () => {
    const vmUuid = 'vm-uuid-123'
    const name = 'new-snapshot'
    const description = ''

    const createdSnapshot = {
      id: 1,
      name,
      description: '',
      vm_uuid: vmUuid,
    }

    mockApiRequest.mockResolvedValue(createdSnapshot)

    const result = await snapshotAPI.create(vmUuid, name, description)

    expect(mockApiRequest).toHaveBeenCalledWith(`/vms/${vmUuid}/snapshots`, {
      method: 'POST',
      body: JSON.stringify({ name, description: '' }),
    })
    expect(result).toEqual(createdSnapshot)
  })
})


