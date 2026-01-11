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

/**
 * 테스트에서 fetch 요청의 JSON body를 안전하게 추출하는 유틸
 * @param callIndex fetch 호출 인덱스 (기본값: 0)
 * @returns 파싱된 JSON 객체
 */
function getFetchRequestJson(callIndex = 0): unknown {
  const mockFetch = fetch as unknown as jest.Mock;
  const call = mockFetch.mock.calls[callIndex];
  if (!call) throw new Error(`fetch not called (callIndex=${callIndex})`);

  const init = call[1] as RequestInit | undefined;
  const body = init?.body;

  // 테스트에서는 우리 코드가 JSON.stringify 해서 보내는 걸 기대하므로 string만 허용
  if (typeof body !== 'string') {
    throw new Error(`Expected fetch body to be string, got: ${typeof body}`);
  }

  return JSON.parse(body);
}

/**
 * apiRequest 모킹에서 요청 body를 안전하게 추출하는 유틸
 * @param callIndex apiRequest 호출 인덱스 (기본값: 0)
 * @returns 파싱된 JSON 객체
 */
function getApiRequestJson(callIndex = 0): unknown {
  const call = mockApiRequest.mock.calls[callIndex];
  if (!call) throw new Error(`apiRequest not called (callIndex=${callIndex})`);

  const init = call[1] as RequestInit | undefined;
  const body = init?.body;

  // 테스트에서는 우리 코드가 JSON.stringify 해서 보내는 걸 기대하므로 string만 허용
  if (typeof body !== 'string') {
    throw new Error(`Expected apiRequest body to be string, got: ${typeof body}`);
  }

  return JSON.parse(body);
}

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

  it('creates VM with VNC enabled for kali OS', async () => {
    const mockVM = { id: 1, name: 'KaliVM', status: 'stopped' }
    const vmData = {
      name: 'KaliVM',
      cpu: 2,
      memory: 4096,
      os_type: 'kali',
    }

    mockApiRequest.mockResolvedValue(mockVM)

    await vmAPI.create(vmData)

    const callBody = getApiRequestJson(0) as Record<string, unknown>
    expect(callBody.vnc_enabled).toBe(true)
    expect(callBody.graphics_type).toBe('vnc')
  })

  it('creates VM with VNC enabled for windows OS', async () => {
    const mockVM = { id: 1, name: 'WindowsVM', status: 'stopped' }
    const vmData = {
      name: 'WindowsVM',
      cpu: 2,
      memory: 4096,
      os_type: 'windows',
    }

    mockApiRequest.mockResolvedValue(mockVM)

    await vmAPI.create(vmData)

    const callBody = getApiRequestJson(0) as Record<string, unknown>
    expect(callBody.vnc_enabled).toBe(true)
    expect(callBody.graphics_type).toBe('vnc')
  })

  it('creates VM without VNC for non-GUI OS', async () => {
    const mockVM = { id: 1, name: 'ServerVM', status: 'stopped' }
    const vmData = {
      name: 'ServerVM',
      cpu: 2,
      memory: 4096,
      os_type: 'ubuntu-server',
    }

    mockApiRequest.mockResolvedValue(mockVM)

    await vmAPI.create(vmData)

    const callBody = getApiRequestJson(0) as Record<string, unknown>
    expect(callBody.vnc_enabled).toBeUndefined()
    expect(callBody.graphics_type).toBeUndefined()
  })

  it('creates VM with explicit graphics_type', async () => {
    const mockVM = { id: 1, name: 'VM', status: 'stopped' }
    const vmData = {
      name: 'VM',
      cpu: 2,
      memory: 4096,
      graphics_type: 'spice',
    }

    mockApiRequest.mockResolvedValue(mockVM)

    await vmAPI.create(vmData)

    const callBody = getApiRequestJson(0) as Record<string, unknown>
    expect(callBody.graphics_type).toBe('spice')
  })

  it('creates VM with explicit vnc_enabled false', async () => {
    const mockVM = { id: 1, name: 'VM', status: 'stopped' }
    const vmData = {
      name: 'VM',
      cpu: 2,
      memory: 4096,
      os_type: 'ubuntu-desktop',
      vnc_enabled: false,
    }

    mockApiRequest.mockResolvedValue(mockVM)

    await vmAPI.create(vmData)

    const callBody = getApiRequestJson(0) as Record<string, unknown>
    expect(callBody.vnc_enabled).toBe(false)
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

  it('performs VM action with null options (should be excluded)', async () => {
    const mockResponse = { success: true }
    const uuid = 'test-uuid'
    const action = 'update'
    const options = { cpu: null, memory: 8192 }

    mockApiRequest.mockResolvedValue(mockResponse)

    await vmAPI.action(uuid, action, options as any)

    const callBody = getApiRequestJson(0) as Record<string, unknown>
    expect(callBody.cpu).toBeUndefined()
    expect(callBody.memory).toBe(8192)
  })

  it('performs VM action with empty name (should be excluded)', async () => {
    const mockResponse = { success: true }
    const uuid = 'test-uuid'
    const action = 'update'
    const options = { name: '' }

    mockApiRequest.mockResolvedValue(mockResponse)

    await vmAPI.action(uuid, action, options)

    const callBody = getApiRequestJson(0) as Record<string, unknown>
    expect(callBody.name).toBeUndefined()
  })

  it('performs VM action with whitespace-only name (should be excluded)', async () => {
    const mockResponse = { success: true }
    const uuid = 'test-uuid'
    const action = 'update'
    const options = { name: '   ' }

    mockApiRequest.mockResolvedValue(mockResponse)

    await vmAPI.action(uuid, action, options)

    const callBody = getApiRequestJson(0) as Record<string, unknown>
    expect(callBody.name).toBeUndefined()
  })

  it('performs VM action with name (should be trimmed)', async () => {
    const mockResponse = { success: true }
    const uuid = 'test-uuid'
    const action = 'update'
    const options = { name: '  New Name  ' }

    mockApiRequest.mockResolvedValue(mockResponse)

    await vmAPI.action(uuid, action, options)

    const callBody = getApiRequestJson(0) as Record<string, unknown>
    expect(callBody.name).toBe('New Name')
  })

  it('performs VM action with GUI OS change (should enable VNC)', async () => {
    const mockResponse = { success: true }
    const uuid = 'test-uuid'
    const action = 'update'
    const options = { os_type: 'ubuntu-desktop' }

    mockApiRequest.mockResolvedValue(mockResponse)

    await vmAPI.action(uuid, action, options)

    const callBody = getApiRequestJson(0) as Record<string, unknown>
    expect(callBody.vnc_enabled).toBe(true)
    expect(callBody.graphics_type).toBe('vnc')
  })

  it('performs VM action with explicit vnc_enabled false', async () => {
    const mockResponse = { success: true }
    const uuid = 'test-uuid'
    const action = 'update'
    const options = { os_type: 'ubuntu-desktop', vnc_enabled: false }

    mockApiRequest.mockResolvedValue(mockResponse)

    await vmAPI.action(uuid, action, options)

    const callBody = getApiRequestJson(0) as Record<string, unknown>
    expect(callBody.vnc_enabled).toBe(false)
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

  it('attaches media with trimmed media_path', async () => {
    const mockResponse = { message: 'Media attached' }
    const uuid = 'test-uuid'
    const mediaPath = '  /path/to/iso.iso  '

    mockApiRequest.mockResolvedValue(mockResponse)

    await vmAPI.media(uuid, 'attach', mediaPath)

    const callBody = getApiRequestJson(0) as Record<string, unknown>
    expect(callBody.media_path).toBe('/path/to/iso.iso')
    expect(callBody.iso_path).toBe('/path/to/iso.iso') // 하위 호환성
  })

  it('throws error when attaching media without media_path', async () => {
    const uuid = 'test-uuid'

    await expect(vmAPI.media(uuid, 'attach')).rejects.toThrow('Media path is required')
  })

  it('throws error when attaching media with empty media_path', async () => {
    const uuid = 'test-uuid'

    await expect(vmAPI.media(uuid, 'attach', '')).rejects.toThrow('Media path is required')
  })

  it('throws error when attaching media with whitespace-only media_path', async () => {
    const uuid = 'test-uuid'

    await expect(vmAPI.media(uuid, 'attach', '   ')).rejects.toThrow('Media path is required')
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

