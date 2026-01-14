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
import { useToast } from '../../components/ToastContainer'

// 의존성 모킹
jest.mock('../../components/ToastContainer')
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

// QueryClient를 제공하는 wrapper (반드시 사용)
const makeWrapper = () => {
  const qc = new QueryClient({
    defaultOptions: { 
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

// 하위 호환성을 위해 createWrapper도 유지
const createWrapper = makeWrapper

describe('useAdminUsers', () => {
  const mockUsers = [
    { id: 1, username: 'admin', role: 'admin', email: 'admin@limen.kr' },
    { id: 2, username: 'user1', role: 'user', email: 'user1@limen.kr' },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    
    // fetch 모킹: new Response() 사용
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      
      // 디버깅: 실제 호출되는 URL 확인
      // console.log('[TEST] Fetch called with URL:', url)

      // ✅ hook이 실제로 호출하는 URL로 체크 (넓게 잡기)
      // /api/admin 또는 /admin 등 모든 경우 처리
      if (url.includes('/api/admin') && !url.match(/\/admin\/users\/\d+/)) {
        return Promise.resolve(
          new Response(JSON.stringify(mockUsers), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }

      // 사용자 상세 조회
      if (url.match(/\/admin\/users\/\d+$/)) {
        const userId = parseInt(url.split('/').pop() || '0')
        const user = mockUsers.find(u => u.id === userId) || { id: userId, username: 'user', role: 'user', email: 'user@limen.kr', vms: [] }
        return Promise.resolve(
          new Response(JSON.stringify(user), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: 'not mocked: ' + url }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }) as jest.MockedFunction<typeof fetch>
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
    const unsortedUsers = [
      { id: 2, username: 'user1', role: 'user', email: 'user1@limen.kr' },
      { id: 1, username: 'admin', role: 'admin', email: 'admin@limen.kr' },
      { id: 3, username: 'user2', role: 'user', email: 'user2@limen.kr' },
    ]

    ;(global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      // URL 조건을 넓혀서 쿼리 파라미터 등 처리 (넓게 잡기)
      if (url.includes('/api/admin') && !url.match(/\/admin\/users\/\d+/)) {
        return Promise.resolve(
          new Response(JSON.stringify(unsortedUsers), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: 'not mocked: ' + url }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

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
    ;(global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      // URL 조건을 넓혀서 쿼리 파라미터 등 처리 (넓게 잡기)
      if (url.includes('/api/admin') && !url.match(/\/admin\/users\/\d+/)) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: 'not mocked: ' + url }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

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
    
    // fetch 모킹: new Response() 사용
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()

      // 사용자 상세 조회 (URL 조건을 넓혀서 쿼리 파라미터 등 처리)
      if (url.match(/\/admin\/users\/\d+$/)) {
        const userId = parseInt(url.split('/').pop() || '0')
        const mockUser = {
          id: userId,
          username: 'user1',
          role: 'user',
          email: 'user1@limen.kr',
          vms: [],
        }
        return Promise.resolve(
          new Response(JSON.stringify(mockUser), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: 'not mocked: ' + url }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }) as jest.MockedFunction<typeof fetch>
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should fetch user details successfully', async () => {
    const userId = 1

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

    // enabled가 false이므로 fetch가 호출되지 않아야 함
    expect(global.fetch).not.toHaveBeenCalled()
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
    
    // fetch 모킹: new Response() 사용
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()

      // URL 조건을 넓혀서 쿼리 파라미터 등 처리 (넓게 잡기)
      if (url.includes('/api/admin') && !url.match(/\/admin\/users\/\d+/)) {
        // POST 요청인 경우
        return Promise.resolve(
          new Response(JSON.stringify({ id: 1, username: 'newuser', role: 'user' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: 'not mocked: ' + url }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }) as jest.MockedFunction<typeof fetch>
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should create user successfully', async () => {
    const newUser = { username: 'newuser', password: 'password', role: 'user' }

    const { result } = renderHook(() => useCreateUser(), { wrapper: makeWrapper() })

    result.current.mutate(newUser)

    // useMutation은 isPending이 false가 될 때까지 기다린 후 검증
    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })

    expect(result.current.isSuccess).toBe(true)
    expect(result.current.data).toBeDefined()
  })

  it('should handle creation errors', async () => {
    const newUser = { username: 'newuser', password: 'password', role: 'user' }

    ;(global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      // URL 조건을 넓혀서 쿼리 파라미터 등 처리 (넓게 잡기)
      if (url.includes('/api/admin') && !url.match(/\/admin\/users\/\d+/)) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: 'Failed to create user' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: 'not mocked: ' + url }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    const { result } = renderHook(() => useCreateUser(), { wrapper: makeWrapper() })

    result.current.mutate(newUser)

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
    
    // fetch 모킹: new Response() 사용
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()

      // URL 조건을 넓혀서 쿼리 파라미터 등 처리
      if (url.match(/\/admin\/users\/\d+$/)) {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 1, username: 'user1', role: 'admin' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: 'not mocked: ' + url }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }) as jest.MockedFunction<typeof fetch>
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should update user successfully', async () => {
    const userId = 1
    const updateData = { role: 'admin' }

    const { result } = renderHook(() => useUpdateUser(), { wrapper: makeWrapper() })

    result.current.mutate({ id: userId, data: updateData })

    // useMutation은 isPending이 false가 될 때까지 기다린 후 검증
    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })

    expect(result.current.isSuccess).toBe(true)
    expect(result.current.data).toBeDefined()
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
    
    // fetch 모킹: new Response() 사용
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.match(/\/api\/admin\/users\/\d+$/)) {
        return Promise.resolve(
          new Response(null, {
            status: 204,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: 'not mocked: ' + url }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }) as jest.MockedFunction<typeof fetch>
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should delete user successfully', async () => {
    const userId = 1

    const { result } = renderHook(() => useDeleteUser(), { wrapper: makeWrapper() })

    result.current.mutate(userId)

    // useMutation은 isPending이 false가 될 때까지 기다린 후 검증
    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })

    expect(result.current.isSuccess).toBe(true)
    expect(result.current.error).toBeUndefined()
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
    
    // fetch 모킹: new Response() 사용
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.match(/\/api\/admin\/users\/\d+\/approve$/)) {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 1, username: 'user1', role: 'user', approved: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: 'not mocked: ' + url }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }) as jest.MockedFunction<typeof fetch>
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should approve user successfully', async () => {
    const userId = 1

    const { result } = renderHook(() => useApproveUser(), { wrapper: makeWrapper() })

    result.current.mutate(userId)

    // useMutation은 isPending이 false가 될 때까지 기다린 후 검증
    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })

    expect(result.current.isSuccess).toBe(true)
    expect(result.current.data).toBeDefined()
  })
})





