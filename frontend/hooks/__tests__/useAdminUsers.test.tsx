/**
 * useAdminUsers 훅 테스트
 * @jest-environment jsdom
 * 
 * 브라우저 계약(Response, fetch)을 사용하므로 jsdom 환경 필요
 */

import { renderHook, waitFor, act } from '@testing-library/react'
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
import { useToast } from '../../components/ToastContainer'
import type { UserWithStats } from '../../lib/types'

// 의존성 모킹
jest.mock('../../components/ToastContainer')

// ✅ 훅이 실제로 호출하는 API를 mock
jest.mock('../../lib/api/admin', () => ({
  adminAPI: {
    listUsers: jest.fn(),
    getUser: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    approveUser: jest.fn(),
  },
}))

jest.mock('../../lib/tokenManager', () => ({
  tokenManager: {
    getAccessToken: jest.fn().mockResolvedValue('mock-token'),
    getCSRFToken: jest.fn().mockReturnValue('mock-csrf-token'),
  },
}))
jest.mock('../../components/AuthGuard', () => ({
  useAuth: jest.fn(() => ({ isAuthenticated: true })),
}))
jest.mock('../useMounted', () => ({
  useMounted: jest.fn(() => true),
}))
jest.mock('../../lib/utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))
jest.mock('../../lib/errorTracking', () => ({
  trackAPIError: jest.fn(),
}))
jest.mock('../../lib/analytics', () => ({
  trackPerformanceMetric: jest.fn(),
}))
jest.mock('../../lib/utils/errorHelpers', () => ({
  handleAuthError: jest.fn(),
}))

const mockUseToast = useToast as jest.MockedFunction<typeof useToast>

// adminAPI mock 가져오기
import { adminAPI } from '../../lib/api/admin'
const mockAdminAPI = adminAPI as jest.Mocked<typeof adminAPI>

// ✅ QueryClient를 제공하는 wrapper (정석 템플릿)
// React Query v5: logger는 QueryClientConfig에 없음 → console mock으로 대체
const createTestQueryClient = () => {
  // 테스트 로그 정리용: console mock (각 테스트마다 독립적으로)
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})

  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 }, // ✅ React Query v5: cacheTime → gcTime
      mutations: { retry: false },
    },
  })
}

const makeWrapper = () => {
  const qc = createTestQueryClient()
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

// 하위 호환성을 위해 createWrapper도 유지
const createWrapper = makeWrapper

// ✅ User 타입 mock factory (정석 템플릿)
const makeUser = (overrides: Partial<UserWithStats> = {}): UserWithStats => ({
  id: 1,
  uuid: 'test-uuid-1',
  username: 'user1',
  role: 'user',
  approved: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  vm_count: 0,
  total_cpu: 0,
  total_memory: 0,
  ...overrides,
})

describe('useAdminUsers', () => {
  const mockUsers: UserWithStats[] = [
    makeUser({ id: 1, username: 'admin', role: 'admin' }),
    makeUser({ id: 2, username: 'user1', role: 'user' }),
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    
    // ✅ 훅이 실제로 호출하는 adminAPI를 mock
    mockAdminAPI.listUsers.mockResolvedValue(mockUsers)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should fetch user list successfully', async () => {
    const { result } = renderHook(() => useAdminUsers(), { wrapper: makeWrapper() })

    // useQuery는 초기 render에 data가 undefined인 게 정상
    // isLoading이 false가 될 때까지 기다린 후 data 검증
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(mockUsers)
    expect(result.current.isError).toBe(false)
  })

  it('should sort users by role and username', async () => {
    const unsortedUsers: UserWithStats[] = [
      makeUser({ id: 2, username: 'user1', role: 'user' }),
      makeUser({ id: 1, username: 'admin', role: 'admin' }),
      makeUser({ id: 3, username: 'user2', role: 'user' }),
    ]

    // ✅ adminAPI를 직접 mock
    mockAdminAPI.listUsers.mockResolvedValue(unsortedUsers)

    const { result } = renderHook(() => useAdminUsers(), { wrapper: makeWrapper() })

    // isLoading이 false가 될 때까지 기다린 후 data 검증
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // admin이 먼저, 그 다음 username 순으로 정렬
    expect(result.current.data?.[0].role).toBe('admin')
    expect(result.current.data?.[1].username).toBe('user1')
    expect(result.current.data?.[2].username).toBe('user2')
  })

  it('should handle errors', async () => {
    // ✅ adminAPI를 직접 mock하여 에러 반환
    mockAdminAPI.listUsers.mockRejectedValue(new Error('Failed to fetch users'))

    const { result } = renderHook(() => useAdminUsers(), { wrapper: makeWrapper() })

    // isLoading이 false가 될 때까지 기다린 후 에러 상태 검증
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toBeDefined()
  })
})

describe('useAdminUser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // ✅ adminAPI를 직접 mock (User 타입 스펙에 맞춤)
    mockAdminAPI.getUser.mockResolvedValue({
      ...makeUser({ id: 1, username: 'user1', role: 'user' }),
      vms: [],
    } as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should fetch user details successfully', async () => {
    const userId = 1
    const mockUser = makeUser({ id: userId, username: 'user1', role: 'user' })
    mockAdminAPI.getUser.mockResolvedValue(mockUser as any)

    const { result } = renderHook(() => useAdminUser(userId), { wrapper: makeWrapper() })

    // isLoading이 false가 될 때까지 기다린 후 data 검증
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data?.id).toBe(userId)
    expect(result.current.data?.username).toBe('user1')
    expect(result.current.isError).toBe(false)
  })

  it('should not fetch when userId is null', () => {
    renderHook(() => useAdminUser(null), { wrapper: makeWrapper() })

    // enabled가 false이므로 adminAPI.getUser가 호출되지 않아야 함
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
    
    // ✅ adminAPI를 직접 mock (User 타입 스펙에 맞춤)
    mockAdminAPI.createUser.mockResolvedValue(
      makeUser({ id: 1, username: 'newuser', role: 'user' })
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should create user successfully', async () => {
    const newUser = { username: 'newuser', password: 'password', role: 'user' }

    const { result } = renderHook(() => useCreateUser(), { wrapper: makeWrapper() })

    // ✅ mutateAsync로 성공을 "진짜" 만들기
    await act(async () => {
      await result.current.mutateAsync(newUser)
    })

    // ✅ React Query 상태 전이가 완료될 때까지 대기 (isSuccess도 waitFor로 감싸기)
    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
      expect(result.current.isSuccess).toBe(true)
    })

    // mutateAsync 완료 후 상태 검증
    expect(result.current.data).toBeDefined()
    expect(mockAdminAPI.createUser).toHaveBeenCalledWith(newUser)
  })

  it('should handle creation errors', async () => {
    const newUser = { username: 'newuser', password: 'password', role: 'user' }

    // ✅ adminAPI를 직접 mock하여 에러 반환
    mockAdminAPI.createUser.mockRejectedValue(new Error('Failed to create user'))

    const { result } = renderHook(() => useCreateUser(), { wrapper: makeWrapper() })

    // ✅ mutateAsync로 에러를 "진짜" 잡기
    await act(async () => {
      try {
        await result.current.mutateAsync(newUser)
      } catch (error) {
        // 에러는 예상된 것
      }
    })

    // useMutation은 isPending이 false가 될 때까지 기다린 후 에러 검증
    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toBeDefined()
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
    
    // ✅ adminAPI를 직접 mock (User 타입 스펙에 맞춤)
    mockAdminAPI.updateUser.mockResolvedValue(
      makeUser({ id: 1, username: 'user1', role: 'admin' })
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should update user successfully', async () => {
    const userId = 1
    const updateData = { role: 'admin' }

    const { result } = renderHook(() => useUpdateUser(), { wrapper: makeWrapper() })

    // ✅ mutateAsync로 성공을 "진짜" 만들기
    await act(async () => {
      await result.current.mutateAsync({ id: userId, data: updateData })
    })

    // ✅ React Query 상태 전이가 완료될 때까지 대기 (isSuccess도 waitFor로 감싸기)
    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeDefined()
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
    
    // ✅ adminAPI를 직접 mock
    mockAdminAPI.deleteUser.mockResolvedValue(undefined as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should delete user successfully', async () => {
    const userId = 1

    const { result } = renderHook(() => useDeleteUser(), { wrapper: makeWrapper() })

    // ✅ mutateAsync로 성공을 "진짜" 만들기
    await act(async () => {
      await result.current.mutateAsync(userId)
    })

    // ✅ React Query 상태 전이가 완료될 때까지 대기 (isSuccess도 waitFor로 감싸기)
    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.error).toBeNull() // React Query는 에러가 없을 때 null 반환
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
    
    // ✅ adminAPI를 직접 mock (User 타입 스펙에 맞춤)
    mockAdminAPI.approveUser.mockResolvedValue(
      makeUser({ id: 1, username: 'user1', role: 'user', approved: true })
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should approve user successfully', async () => {
    const userId = 1

    const { result } = renderHook(() => useApproveUser(), { wrapper: makeWrapper() })

    // ✅ mutateAsync로 성공을 "진짜" 만들기
    await act(async () => {
      await result.current.mutateAsync(userId)
    })

    // ✅ React Query 상태 전이가 완료될 때까지 대기 (isSuccess도 waitFor로 감싸기)
    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeDefined()
    expect(mockAdminAPI.approveUser).toHaveBeenCalledWith(userId)
  })
})





