/**
 * vmAPI 테스트
 */

import { vmAPI } from '../vm'
import { apiRequest } from '../client'

// apiRequest 모킹
jest.mock('../client', () => ({
  apiRequest: jest.fn(),
}))

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>

describe('vmAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lists VMs', async () => {
    const mockVMs = [
      { id: 1, name: 'VM1', status: 'running' },
      { id: 2, name: 'VM2', status: 'stopped' },
    ]

    mockApiRequest.mockResolvedValue(mockVMs)

    const result = await vmAPI.list()

    expect(mockApiRequest).toHaveBeenCalledWith('/vms')
    expect(result).toEqual(mockVMs)
  })

  it('creates VM', async () => {
    const mockVM = { id: 1, name: 'NewVM', status: 'stopped' }
    const vmData = {
      name: 'NewVM',
      cpu: 2,
      memory: 4096,
    }

    mockApiRequest.mockResolvedValue(mockVM)

    const result = await vmAPI.create(vmData)

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/vms',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"name":"NewVM"'),
      })
    )
    expect(result).toEqual(mockVM)
  })

  it('creates VM with VNC enabled for GUI OS', async () => {
    const mockVM = { id: 1, name: 'UbuntuVM', status: 'stopped' }
    const vmData = {
      name: 'UbuntuVM',
      cpu: 2,
      memory: 4096,
      os_type: 'ubuntu-desktop',
    }

    mockApiRequest.mockResolvedValue(mockVM)

    await vmAPI.create(vmData)

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/vms',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"vnc_enabled":true'),
      })
    )
  })

  it('performs VM action', async () => {
    const mockResponse = { success: true }
    const uuid = 'test-uuid'
    const action = 'start'

    mockApiRequest.mockResolvedValue(mockResponse)

    const result = await vmAPI.action(uuid, action)

    expect(mockApiRequest).toHaveBeenCalledWith(
      `/vms/${uuid}/action`,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining(`"action":"${action}"`),
      })
    )
    expect(result).toEqual(mockResponse)
  })

  it('performs VM action with options', async () => {
    const mockResponse = { success: true }
    const uuid = 'test-uuid'
    const action = 'update'
    const options = { cpu: 4, memory: 8192 }

    mockApiRequest.mockResolvedValue(mockResponse)

    const result = await vmAPI.action(uuid, action, options)

    expect(mockApiRequest).toHaveBeenCalledWith(
      `/vms/${uuid}/action`,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"cpu":4'),
      })
    )
    expect(result).toEqual(mockResponse)
  })

  it('gets VM media', async () => {
    const mockMedia = { type: 'iso', path: '/path/to/iso' }
    const uuid = 'test-uuid'

    mockApiRequest.mockResolvedValue(mockMedia)

    const result = await vmAPI.getMedia(uuid)

    expect(mockApiRequest).toHaveBeenCalledWith(`/vms/${uuid}/media`)
    expect(result).toEqual(mockMedia)
  })

  it('gets ISO list', async () => {
    const mockISOs = { isos: ['iso1.iso', 'iso2.iso'] }

    mockApiRequest.mockResolvedValue(mockISOs)

    const result = await vmAPI.getISOs()

    expect(mockApiRequest).toHaveBeenCalledWith('/vms/isos')
    expect(result).toEqual(mockISOs)
  })

  it('attaches media', async () => {
    const mockResponse = { message: 'Media attached' }
    const uuid = 'test-uuid'
    const isoPath = '/path/to/iso.iso'

    mockApiRequest.mockResolvedValue(mockResponse)

    const result = await vmAPI.media(uuid, 'attach', isoPath)

    expect(mockApiRequest).toHaveBeenCalledWith(
      `/vms/${uuid}/media`,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"action":"attach"'),
      })
    )
    expect(result).toEqual(mockResponse)
  })

  it('detaches media', async () => {
    const mockResponse = { message: 'Media detached' }
    const uuid = 'test-uuid'

    mockApiRequest.mockResolvedValue(mockResponse)

    const result = await vmAPI.media(uuid, 'detach')

    expect(mockApiRequest).toHaveBeenCalledWith(
      `/vms/${uuid}/media`,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"action":"detach"'),
      })
    )
    expect(result).toEqual(mockResponse)
  })

  it('gets VM stats', async () => {
    const mockStats = { cpu_usage: 50, memory_usage: 60 }
    const uuid = 'test-uuid'

    mockApiRequest.mockResolvedValue(mockStats)

    const result = await vmAPI.getStats(uuid)

    expect(mockApiRequest).toHaveBeenCalledWith(`/vms/${uuid}/stats`)
    expect(result).toEqual(mockStats)
  })
})

