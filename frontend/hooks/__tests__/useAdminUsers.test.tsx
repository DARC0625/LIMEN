/**
 * useAdminUsers 훅 테스트
 */

import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useAdminUsers,
  useAdminUser,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useApproveUser,
} from '../useAdminUsers'
import { adminAPI } from '../../lib/api'
import { useToast } from '../../components/ToastContainer'

// 의존성 모킹
jest.mock('../../lib/api')
jest.mock('../../components/ToastContainer')

const mockAdminAPI = adminAPI as jest.Mocked<typeof adminAPI>
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

describe('useAdminUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should fetch user list successfully', async () => {
    const mockUsers = [
      { id: 1, username: 'admin', role: 'admin' },
      { id: 2, username: 'user1', role: 'user' },
    ]

    mockAdminAPI.listUsers = jest.fn().mockResolvedValue(mockUsers)

    const { result } = renderHook(() => useAdminUsers(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockUsers)
    expect(mockAdminAPI.listUsers).toHaveBeenCalledTimes(1)
  })

  it('should sort users by role and username', async () => {
    const mockUsers = [
      { id: 2, username: 'user1', role: 'user' },
      { id: 1, username: 'admin', role: 'admin' },
      { id: 3, username: 'user2', role: 'user' },
    ]

    mockAdminAPI.listUsers = jest.fn().mockResolvedValue(mockUsers)

    const { result } = renderHook(() => useAdminUsers(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // admin이 먼저, 그 다음 username 순으로 정렬
    expect(result.current.data?.[0].role).toBe('admin')
    expect(result.current.data?.[1].username).toBe('user1')
    expect(result.current.data?.[2].username).toBe('user2')
  })

  it('should handle errors', async () => {
    const error = new Error('Failed to fetch users')
    mockAdminAPI.listUsers = jest.fn().mockRejectedValue(error)

    const { result } = renderHook(() => useAdminUsers(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBe(error)
  })
})

describe('useAdminUser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should fetch user details successfully', async () => {
    const userId = 1
    const mockUser = {
      id: 1,
      username: 'user1',
      role: 'user',
      vms: [],
    }

    mockAdminAPI.getUser = jest.fn().mockResolvedValue(mockUser)

    const { result } = renderHook(() => useAdminUser(userId), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockUser)
    expect(mockAdminAPI.getUser).toHaveBeenCalledWith(userId)
  })

  it('should not fetch when userId is null', () => {
    mockAdminAPI.getUser = jest.fn()

    renderHook(() => useAdminUser(null), { wrapper: createWrapper() })

    expect(mockAdminAPI.getUser).not.toHaveBeenCalled()
  })
})

describe('useCreateUser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseToast.mockReturnValue({
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
    } as any)
  })

  it('should create user successfully', async () => {
    const newUser = { username: 'newuser', password: 'password', role: 'user' }
    const createdUser = { id: 1, ...newUser }

    mockAdminAPI.createUser = jest.fn().mockResolvedValue(createdUser)

    const { result } = renderHook(() => useCreateUser(), { wrapper: createWrapper() })

    result.current.mutate(newUser)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockAdminAPI.createUser).toHaveBeenCalledWith(newUser)
  })

  it('should handle creation errors', async () => {
    const newUser = { username: 'newuser', password: 'password', role: 'user' }
    const error = new Error('Failed to create user')

    mockAdminAPI.createUser = jest.fn().mockRejectedValue(error)

    const { result } = renderHook(() => useCreateUser(), { wrapper: createWrapper() })

    result.current.mutate(newUser)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBe(error)
  })
})

describe('useUpdateUser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseToast.mockReturnValue({
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
    } as any)
  })

  it('should update user successfully', async () => {
    const userId = 1
    const updateData = { role: 'admin' }
    const updatedUser = { id: 1, username: 'user1', role: 'admin' }

    mockAdminAPI.updateUser = jest.fn().mockResolvedValue(updatedUser)

    const { result } = renderHook(() => useUpdateUser(), { wrapper: createWrapper() })

    result.current.mutate({ id: userId, data: updateData })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockAdminAPI.updateUser).toHaveBeenCalledWith(userId, updateData)
  })
})

describe('useDeleteUser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseToast.mockReturnValue({
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
    } as any)
  })

  it('should delete user successfully', async () => {
    const userId = 1

    mockAdminAPI.deleteUser = jest.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() => useDeleteUser(), { wrapper: createWrapper() })

    result.current.mutate(userId)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockAdminAPI.deleteUser).toHaveBeenCalledWith(userId)
  })
})

describe('useApproveUser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseToast.mockReturnValue({
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
    } as any)
  })

  it('should approve user successfully', async () => {
    const userId = 1

    mockAdminAPI.approveUser = jest.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() => useApproveUser(), { wrapper: createWrapper() })

    result.current.mutate(userId)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockAdminAPI.approveUser).toHaveBeenCalledWith(userId)
  })
})




