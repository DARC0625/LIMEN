/**
 * useVMs 훅 테스트
 */

import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useVMs, useVMsSuspense, useCreateVM, useVMAction } from '../useVMs'
import { vmAPI } from '../../lib/api/index'
import { useAuth } from '../../components/AuthGuard'
import { useMounted } from '../useMounted'
import { useToast } from '../../components/ToastContainer'

// 의존성 모킹
jest.mock('../../lib/api/index')
jest.mock('../../components/AuthGuard')
jest.mock('../useMounted')
jest.mock('../../components/ToastContainer')

const mockVMAPI = vmAPI as jest.Mocked<typeof vmAPI>
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseMounted = useMounted as jest.MockedFunction<typeof useMounted>
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>

// QueryClient를 제공하는 wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useVMs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseMounted.mockReturnValue(true)
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: null,
      isLoading: false,
    } as any)
  })

  it('should fetch VM list successfully', async () => {
    const mockVMs = [
      { id: 1, name: 'VM1', status: 'running' },
      { id: 2, name: 'VM2', status: 'stopped' },
    ]

    mockVMAPI.list = jest.fn().mockResolvedValue(mockVMs)

    const { result } = renderHook(() => useVMs(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockVMs)
    expect(mockVMAPI.list).toHaveBeenCalledTimes(1)
  })

  it('should return empty array for non-array response', async () => {
    mockVMAPI.list = jest.fn().mockResolvedValue(null)

    const { result } = renderHook(() => useVMs(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([])
  })

  it('should not fetch when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      isLoading: false,
    } as any)

    mockVMAPI.list = jest.fn()

    renderHook(() => useVMs(), { wrapper: createWrapper() })

    expect(mockVMAPI.list).not.toHaveBeenCalled()
  })

  it('should handle errors', async () => {
    const error = new Error('Failed to fetch VMs')
    mockVMAPI.list = jest.fn().mockRejectedValue(error)

    const { result } = renderHook(() => useVMs(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBe(error)
  })
})

describe('useVMsSuspense', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should fetch VM list successfully', async () => {
    const mockVMs = [
      { id: 1, name: 'VM1', status: 'running' },
    ]

    mockVMAPI.list = jest.fn().mockResolvedValue(mockVMs)

    const { result } = renderHook(() => useVMsSuspense(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockVMs)
  })
})

describe('useCreateVM', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseToast.mockReturnValue({
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
    } as any)
  })

  it('should create VM successfully', async () => {
    const newVM = { name: 'NewVM', cpu: 2, memory: 4096 }
    const createdVM = { id: 1, ...newVM, status: 'running' }

    mockVMAPI.create = jest.fn().mockResolvedValue(createdVM)

    const { result } = renderHook(() => useCreateVM(), { wrapper: createWrapper() })

    result.current.mutate(newVM)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockVMAPI.create).toHaveBeenCalledWith(newVM)
    expect(result.current.data).toEqual(createdVM)
  })

  it('should handle creation errors', async () => {
    const newVM = { name: 'NewVM', cpu: 2, memory: 4096 }
    const error = new Error('Failed to create VM')

    mockVMAPI.create = jest.fn().mockRejectedValue(error)

    const { result } = renderHook(() => useCreateVM(), { wrapper: createWrapper() })

    result.current.mutate(newVM)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBe(error)
  })
})

describe('useVMAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseToast.mockReturnValue({
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
    } as any)
  })

  it('should start VM successfully', async () => {
    const uuid = 'vm-uuid-123'
    const mockVM = { uuid, name: 'Test VM', status: 'Running', cpu: 2, memory: 4096 }
    mockVMAPI.action = jest.fn().mockResolvedValue(mockVM)

    // QueryClient에 초기 VM 데이터 설정
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    queryClient.setQueryData(['vms'], [{ uuid, name: 'Test VM', status: 'Stopped', cpu: 2, memory: 4096 }])

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )

    const { result } = renderHook(() => useVMAction(), { wrapper })

    result.current.mutate({ uuid, action: 'start' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockVMAPI.action).toHaveBeenCalledWith(uuid, 'start', {})
  })

  it('should stop VM successfully', async () => {
    const uuid = 'vm-uuid-123'
    const mockVM = { uuid, name: 'Test VM', status: 'Stopped', cpu: 2, memory: 4096 }
    mockVMAPI.action = jest.fn().mockResolvedValue(mockVM)

    // QueryClient에 초기 VM 데이터 설정
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    queryClient.setQueryData(['vms'], [{ uuid, name: 'Test VM', status: 'Running', cpu: 2, memory: 4096 }])

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )

    const { result } = renderHook(() => useVMAction(), { wrapper })

    result.current.mutate({ uuid, action: 'stop' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockVMAPI.action).toHaveBeenCalledWith(uuid, 'stop', {})
  })

  it('should handle action errors', async () => {
    const uuid = 'vm-uuid-123'
    const error = new Error('Failed to start VM')

    mockVMAPI.action = jest.fn().mockRejectedValue(error)

    const { result } = renderHook(() => useVMAction(), { wrapper: createWrapper() })

    result.current.mutate({ uuid, action: 'start' })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    }, { timeout: 3000 })

    expect(result.current.error).toBe(error)
  })

  it('should delete VM successfully', async () => {
    const uuid = 'vm-uuid-123'
    const mockVM = { uuid, name: 'Test VM', status: 'Stopped', cpu: 2, memory: 4096, disk: 20480 }
    mockVMAPI.action = jest.fn().mockResolvedValue(mockVM)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    queryClient.setQueryData(['vms'], [mockVM])
    queryClient.setQueryData(['quota'], {
      usage: { vms: 1, cpu: 2, memory: 4096 },
      limit: { vms: 10, cpu: 20, memory: 81920 },
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )

    const { result } = renderHook(() => useVMAction(), { wrapper })

    result.current.mutate({ uuid, action: 'delete' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockVMAPI.action).toHaveBeenCalledWith(uuid, 'delete', {})
  })

  it('should restart VM successfully', async () => {
    const uuid = 'vm-uuid-123'
    const mockVM = { uuid, name: 'Test VM', status: 'Restarting', cpu: 2, memory: 4096 }
    mockVMAPI.action = jest.fn().mockResolvedValue(mockVM)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    queryClient.setQueryData(['vms'], [{ uuid, name: 'Test VM', status: 'Running', cpu: 2, memory: 4096 }])

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )

    const { result } = renderHook(() => useVMAction(), { wrapper })

    result.current.mutate({ uuid, action: 'restart' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockVMAPI.action).toHaveBeenCalledWith(uuid, 'restart', {})
  })

  it('should update VM successfully', async () => {
    const uuid = 'vm-uuid-123'
    const mockVM = { uuid, name: 'Updated VM', status: 'Running', cpu: 4, memory: 8192 }
    mockVMAPI.action = jest.fn().mockResolvedValue(mockVM)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    queryClient.setQueryData(['vms'], [{ uuid, name: 'Test VM', status: 'Running', cpu: 2, memory: 4096 }])

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )

    const { result } = renderHook(() => useVMAction(), { wrapper })

    result.current.mutate({ uuid, action: 'update', cpu: 4, memory: 8192, name: 'Updated VM' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockVMAPI.action).toHaveBeenCalledWith(uuid, 'update', { cpu: 4, memory: 8192, name: 'Updated VM' })
  })

  it('should handle optimistic updates for delete', async () => {
    const uuid = 'vm-uuid-123'
    const mockVM = { uuid, name: 'Test VM', status: 'Stopped', cpu: 2, memory: 4096, disk: 20480 }
    mockVMAPI.action = jest.fn().mockResolvedValue(mockVM)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    queryClient.setQueryData(['vms'], [mockVM])
    queryClient.setQueryData(['quota'], {
      usage: { vms: 1, cpu: 2, memory: 4096 },
      limit: { vms: 10, cpu: 20, memory: 81920 },
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )

    const { result } = renderHook(() => useVMAction(), { wrapper })

    result.current.mutate({ uuid, action: 'delete' })

    // Optimistic update 확인
    await waitFor(() => {
      const vms = queryClient.getQueryData(['vms']) as any[]
      expect(vms).toEqual([])
    }, { timeout: 1000 })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
  })

  it('should rollback optimistic updates on error', async () => {
    const uuid = 'vm-uuid-123'
    const mockVM = { uuid, name: 'Test VM', status: 'Running', cpu: 2, memory: 4096 }
    const error = new Error('Failed to delete VM')
    mockVMAPI.action = jest.fn().mockRejectedValue(error)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    queryClient.setQueryData(['vms'], [mockVM])

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )

    const { result } = renderHook(() => useVMAction(), { wrapper })

    result.current.mutate({ uuid, action: 'delete' })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    }, { timeout: 3000 })

    // 롤백 확인
    await waitFor(() => {
      const vms = queryClient.getQueryData(['vms']) as any[]
      expect(vms).toHaveLength(1)
      expect(vms[0].uuid).toBe(uuid)
    }, { timeout: 2000 })
  })
})

