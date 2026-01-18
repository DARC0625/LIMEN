/**
 * Quota API 테스트
 * @jest-environment node
 */

// ✅ P1-Next-Fix-Module-4: factory 패턴 사용 (싱글톤 import 금지)
import { createQuotaAPI } from '../quota'

describe('quotaAPI', () => {
  let quotaAPI: ReturnType<typeof createQuotaAPI>
  let mockApiRequest: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    // ✅ P1-Next-Fix-Module-4: factory로 생성
    mockApiRequest = jest.fn()
    quotaAPI = createQuotaAPI({ apiRequest: mockApiRequest as any })
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

  it('should update quota partially (only max_vms)', async () => {
    const updateData = {
      max_vms: 15,
    }

    const updatedQuota = {
      usage: {
        vms: 5,
        cpu: 10,
        memory: 2048,
      },
      quota: {
        max_vms: 15,
        max_cpu: 20,
        max_memory: 4096,
      },
    }

    mockApiRequest.mockResolvedValue(updatedQuota)

    const result = await quotaAPI.update(updateData)

    expect(mockApiRequest).toHaveBeenCalledWith('/quota', {
      method: 'PUT',
      body: JSON.stringify(updateData),
    })
    expect(result).toEqual(updatedQuota)
  })

  it('should update quota partially (only max_cpu)', async () => {
    const updateData = {
      max_cpu: 30,
    }

    const updatedQuota = {
      usage: {
        vms: 5,
        cpu: 10,
        memory: 2048,
      },
      quota: {
        max_vms: 10,
        max_cpu: 30,
        max_memory: 4096,
      },
    }

    mockApiRequest.mockResolvedValue(updatedQuota)

    const result = await quotaAPI.update(updateData)

    expect(mockApiRequest).toHaveBeenCalledWith('/quota', {
      method: 'PUT',
      body: JSON.stringify(updateData),
    })
    expect(result).toEqual(updatedQuota)
  })

  it('should update quota partially (only max_memory)', async () => {
    const updateData = {
      max_memory: 6144,
    }

    const updatedQuota = {
      usage: {
        vms: 5,
        cpu: 10,
        memory: 2048,
      },
      quota: {
        max_vms: 10,
        max_cpu: 20,
        max_memory: 6144,
      },
    }

    mockApiRequest.mockResolvedValue(updatedQuota)

    const result = await quotaAPI.update(updateData)

    expect(mockApiRequest).toHaveBeenCalledWith('/quota', {
      method: 'PUT',
      body: JSON.stringify(updateData),
    })
    expect(result).toEqual(updatedQuota)
  })

  it('should handle get errors', async () => {
    const error = new Error('Failed to get quota')
    mockApiRequest.mockRejectedValue(error)

    await expect(quotaAPI.get()).rejects.toThrow('Failed to get quota')
  })

  it('should handle update errors', async () => {
    const error = new Error('Failed to update quota')
    mockApiRequest.mockRejectedValue(error)

    await expect(quotaAPI.update({ max_vms: 20 })).rejects.toThrow('Failed to update quota')
  })
})
