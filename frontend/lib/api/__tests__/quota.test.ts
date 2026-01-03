/**
 * Quota API 테스트
 */

import { quotaAPI } from '../quota'
import { apiRequest } from '../client'

// apiRequest 모킹
jest.mock('../client')

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>

describe('quotaAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should get quota successfully', async () => {
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

    mockApiRequest.mockResolvedValue(mockQuota)

    const result = await quotaAPI.get()

    expect(mockApiRequest).toHaveBeenCalledWith('/quota')
    expect(result).toEqual(mockQuota)
  })

  it('should update quota successfully', async () => {
    const updateData = {
      max_vms: 20,
      max_cpu: 40,
      max_memory: 8192,
    }

    const updatedQuota = {
      usage: {
        vms: 5,
        cpu: 10,
        memory: 2048,
      },
      quota: updateData,
    }

    mockApiRequest.mockResolvedValue(updatedQuota)

    const result = await quotaAPI.update(updateData)

    expect(mockApiRequest).toHaveBeenCalledWith('/quota', {
      method: 'PUT',
      body: JSON.stringify(updateData),
    })
    expect(result).toEqual(updatedQuota)
  })

  it('should handle errors', async () => {
    const error = new Error('Failed to get quota')
    mockApiRequest.mockRejectedValue(error)

    await expect(quotaAPI.get()).rejects.toThrow('Failed to get quota')
  })
})

