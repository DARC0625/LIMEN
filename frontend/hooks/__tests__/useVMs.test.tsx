/**
 * hooks/useVMs.ts 테스트
 */

import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode, JSX } from 'react'
import { useVMs, useVMsSuspense, useCreateVM, useVMAction } from '../useVMs'
import { vmAPI } from '../../lib/api/index'
import { useAuth } from '../../components/AuthGuard'
import { useToast } from '../../components/ToastContainer'

// 의존성 모킹
jest.mock('../../lib/api/index', () => ({
  vmAPI: {
    list: jest.fn(),
    create: jest.fn(),
    action: jest.fn(),
  },
}))

jest.mock('../../components/AuthGuard', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../../components/ToastContainer', () => ({
  useToast: jest.fn(),
}))

jest.mock('../useMounted', () => ({
  useMounted: () => true,
}))

jest.mock('../../lib/utils/token', () => ({
  decodeToken: jest.fn().mockReturnValue({ id: 1 }),
}))

jest.mock('../../lib/tokenManager', () => ({
  tokenManager: {
    getAccessToken: jest.fn().mockResolvedValue('mock-token'),
  },
}))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>
const mockVmAPI = vmAPI as jest.Mocked<typeof vmAPI>

describe('useVMs', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
    mockUseAuth.mockReturnValue({ isAuthenticated: true } as any)
    mockUseToast.mockReturnValue({
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
    } as any)
  })

  afterEach(() => {
    queryClient.clear()
    jest.clearAllMocks()
  })

  it('fetches VM list when authenticated', async () => {
    const mockVMs = [
      { id: 1, name: 'VM1', uuid: 'uuid1', status: 'Running' },
      { id: 2, name: 'VM2', uuid: 'uuid2', status: 'Stopped' },
    ]
    mockVmAPI.list.mockResolvedValue(mockVMs as any)

    const { result } = renderHook(() => useVMs(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockVMs)
  })

  it('returns empty array when response is not an array', async () => {
    mockVmAPI.list.mockResolvedValue(null as any)

    const { result } = renderHook(() => useVMs(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([])
  })

  it('does not fetch when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false } as any)

    const { result } = renderHook(() => useVMs(), { wrapper })

    expect(result.current.isPending).toBe(false)
    expect(result.current.data).toBeUndefined()
  })
})

describe('useVMsSuspense', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  })

  afterEach(() => {
    queryClient.clear()
    jest.clearAllMocks()
  })

  it('fetches VM list with suspense', async () => {
    const mockVMs = [{ id: 1, name: 'VM1', uuid: 'uuid1' }]
    mockVmAPI.list.mockResolvedValue(mockVMs as any)

    const { result } = renderHook(() => useVMsSuspense(), { wrapper })

    await waitFor(() => {
      expect(result.current.data).toEqual(mockVMs)
    })
  })
})

describe('useCreateVM', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element
  let mockToast: { success: jest.Mock; error: jest.Mock }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
    mockToast = {
      success: jest.fn(),
      error: jest.fn(),
    }
    mockUseToast.mockReturnValue(mockToast as any)
  })

  afterEach(() => {
    queryClient.clear()
    jest.clearAllMocks()
  })

  it('creates VM successfully', async () => {
    const newVM = { name: 'NewVM', cpu: 2, memory: 4096 }
    const createdVM = { id: 1, ...newVM, uuid: 'uuid1', status: 'Running' }
    mockVmAPI.create.mockResolvedValue(createdVM as any)

    const { result } = renderHook(() => useCreateVM(), { wrapper })

    result.current.mutate(newVM)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockToast.success).toHaveBeenCalled()
  })

  it('handles VM creation error', async () => {
    const newVM = { name: 'NewVM', cpu: 2, memory: 4096 }
    mockVmAPI.create.mockRejectedValue(new Error('Creation failed'))

    const { result } = renderHook(() => useCreateVM(), { wrapper })

    result.current.mutate(newVM)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(mockToast.error).toHaveBeenCalled()
  })
})

describe('useVMAction', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element
  let mockToast: { success: jest.Mock; error: jest.Mock }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
    mockToast = {
      success: jest.fn(),
      error: jest.fn(),
    }
    mockUseToast.mockReturnValue(mockToast as any)
  })

  afterEach(() => {
    queryClient.clear()
    jest.clearAllMocks()
  })

  it('starts VM successfully', async () => {
    const updatedVM = { id: 1, uuid: 'uuid1', status: 'Running' }
    mockVmAPI.action.mockResolvedValue(updatedVM as any)

    const { result } = renderHook(() => useVMAction(), { wrapper })

    result.current.mutate({ uuid: 'uuid1', action: 'start' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockToast.success).toHaveBeenCalled()
  })

  it('deletes VM successfully', async () => {
    mockVmAPI.action.mockResolvedValue({} as any)

    const { result } = renderHook(() => useVMAction(), { wrapper })

    result.current.mutate({ uuid: 'uuid1', action: 'delete' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockToast.success).toHaveBeenCalled()
  })

  it('handles VM action error', async () => {
    mockVmAPI.action.mockRejectedValue(new Error('Action failed'))

    const { result } = renderHook(() => useVMAction(), { wrapper })

    result.current.mutate({ uuid: 'uuid1', action: 'stop' })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(mockToast.error).toHaveBeenCalled()
  })
})
