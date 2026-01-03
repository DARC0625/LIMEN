/**
 * app/(protected)/admin/users/page.tsx 테스트
 */

import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { isAdmin } from '../../../../../lib/api'
import { useToast } from '../../../../../components/ToastContainer'
import { useAdminUsers } from '../../../../../hooks/useAdminUsers'
import UserManagementPage from '../page'

// 의존성 모킹
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('../../../../../lib/api', () => ({
  isAdmin: jest.fn(),
}))

jest.mock('../../../../../components/ToastContainer', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  }),
}))

jest.mock('../../../../../hooks/useAdminUsers', () => ({
  useAdminUsers: jest.fn(),
  useAdminUser: jest.fn(() => ({ data: null })),
  useCreateUser: jest.fn(() => ({ mutate: jest.fn(), isLoading: false })),
  useUpdateUser: jest.fn(() => ({ mutate: jest.fn(), isLoading: false })),
  useDeleteUser: jest.fn(() => ({ mutate: jest.fn(), isLoading: false })),
  useApproveUser: jest.fn(() => ({ mutate: jest.fn(), isLoading: false })),
}))

jest.mock('../../../../../components/Loading', () => ({
  __esModule: true,
  default: ({ message }: { message?: string }) => <div>Loading: {message}</div>,
}))

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockIsAdmin = isAdmin as jest.MockedFunction<typeof isAdmin>
const mockUseAdminUsers = useAdminUsers as jest.MockedFunction<typeof useAdminUsers>

describe('User Management Page', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue(mockRouter as any)
    mockIsAdmin.mockResolvedValue(true)
    mockUseAdminUsers.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any)
  })

  it('renders user management page when admin', async () => {
    render(<UserManagementPage />)

    await waitFor(() => {
      expect(screen.getByText(/user management/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('redirects non-admin users', async () => {
    mockIsAdmin.mockResolvedValue(false)

    render(<UserManagementPage />)

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
    }, { timeout: 3000 })
  })
})

