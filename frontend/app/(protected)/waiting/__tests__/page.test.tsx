/**
 * app/(protected)/waiting/page.tsx 테스트
 */

import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import WaitingPage from '../page'
import { checkAuth, isUserApproved } from '@/lib/auth'

// 의존성 모킹
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  checkAuth: jest.fn(),
  isUserApproved: jest.fn(),
}))

jest.mock('@/components/Loading', () => ({
  __esModule: true,
  default: () => <div>Loading...</div>,
}))

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockCheckAuth = checkAuth as jest.MockedFunction<typeof checkAuth>
const mockIsUserApproved = isUserApproved as jest.MockedFunction<typeof isUserApproved>

describe('WaitingPage', () => {
  const mockRouter = {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue(mockRouter as any)
  })

  it('shows loading initially', () => {
    mockCheckAuth.mockResolvedValue({ valid: true } as any)
    mockIsUserApproved.mockResolvedValue(false)

    render(<WaitingPage />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('redirects to login when not authenticated', async () => {
    mockCheckAuth.mockResolvedValue({ valid: false } as any)

    render(<WaitingPage />)

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/login')
    })
  })

  it('redirects to dashboard when approved', async () => {
    mockCheckAuth.mockResolvedValue({ valid: true } as any)
    mockIsUserApproved.mockResolvedValue(true)

    render(<WaitingPage />)

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('shows waiting message when not approved', async () => {
    mockCheckAuth.mockResolvedValue({ valid: true } as any)
    mockIsUserApproved.mockResolvedValue(false)

    render(<WaitingPage />)

    await waitFor(() => {
      expect(screen.getByText(/초대 대기 중/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/현재 초대 대기 상태입니다/i)).toBeInTheDocument()
  })

  it('renders login button', async () => {
    mockCheckAuth.mockResolvedValue({ valid: true } as any)
    mockIsUserApproved.mockResolvedValue(false)

    render(<WaitingPage />)

    await waitFor(() => {
      expect(screen.getByText(/로그인 페이지로 돌아가기/i)).toBeInTheDocument()
    })
  })
})



